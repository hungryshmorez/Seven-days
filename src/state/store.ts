/**
 * Minimal external store bridging game code (Pixi scenes, SDK callbacks) and
 * React. Game code writes via store.patch(); React reads via useStore(selector).
 *
 * Why not React context or a state library: the Pixi ticker and SDK lifecycle
 * callbacks live outside React and must read/write state without re-rendering
 * or stale closures. useSyncExternalStore is React's sanctioned bridge for
 * exactly this.
 */
import { useSyncExternalStore } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { EPISODE_ORDER, HOSPITAL_AFTER, type EpisodeId } from '../cinema/engine.ts';
import { parseTapeRequest, type TapeSession } from '../story/tapeLink.ts';
import { sdkReady } from '../sdk/runSdk.ts';
import { LIVEOPS_DEFAULTS, type LiveOpsValues } from '../sdk/platform.ts';

/** The UI-facing app state. Game systems own their own internals; this is only what React renders. */
export interface AppState {
    /** Boot phase machine: 'loading' → 'menu' → 'playing'. */
    phase: 'loading' | 'menu' | 'playing' | 'journey' | 'archive';
    /** 0..1 asset-warming progress for the loading screen. */
    loadProgress: number;
    /** True while the in-game pause overlay is up (set by lifecycle + HUD button). */
    paused: boolean;
    /** ADAPT: replace with your game's HUD numbers (lives, coins, ...). */
    score: number;
    /** Current subtitle line shown by the HUD (empty = hidden). */
    subtitle: string;
    /** Player subtitle preference. */
    subtitlesOn: boolean;
    /** Current title-card text (empty = hidden). */
    title: string;
    /** Bodycam REC timecode shown by the HUD. */
    timecode: string;
    /** Selected cinematic episode id. */
    episode: string;
    /** Continue to next unlocked day automatically when one ends. */
    continuous: boolean;
    /** Completed episode ids. */
    completed: string[];
    /** True when playback reaches its endpoint and shows the completion card. */
    ended: boolean;
    /** A user-visible playback failure. */
    playbackError: string;
    /** Last device-save or save-read problem, shown so progress loss is never silent. */
    saveNotice: string;
    /** Number of completed Hospital endings; cycle two begins at 1. */
    loopCount: number;
    /** A consented, expiring video request from the companion search game. */
    tapeSession?: TapeSession;
    /** True once the requested linked tape reached its endpoint in this visit. */
    tapeFinished: boolean;
    /** Player reduced-motion preference; starts from the system preference. */
    reducedMotion: boolean;
    /** Per-friend outcome so far (set by the scary pass). */
    friends?: Record<string, string>;
    /** Set by the cinematic when the pulse under the prologue fires. */
    pulseTriggered?: boolean;
    /** Player haptics preference (scare jolts + UI taps). Only has an effect on devices that support it. */
    haptics: boolean;
    /** True while a gameplay clip is being recorded. */
    recording: boolean;
    /** Remote config from LiveOps (menu banner, ad/reminder flags). Defaults apply off-host. */
    liveops: LiveOpsValues;
    /** Set when a chapter just completed, consumed by the menu to place an optional break interstitial. */
    pendingBreak: boolean;
    /** Free-roam / VCR room: show the walk stick and the USE button. */
    roam: boolean;
    /** Live position of the on-screen walk stick, -1..1 on each axis (y is forward-negative like the keys). */
    moveStick?: { x: number; y: number };
    /** What the USE button would do right now ('' = nothing). */
    useLabel: string;
    /** True while the combined journey owns playback. */
    journey: boolean;
}

const SAVE_KEY = 'seven-days-cinematic-progress-v1';
/** Cloud (appStorage) key: progress + settings that should follow the player across devices. */
const CLOUD_KEY = 'progress-v1';
// Retain the old key only to recognize that an incompatible cinema save exists.
let pendingWrite: Promise<void> = Promise.resolve();
/** Persist progress on the device (RUN SDK device cache; browser storage is blocked in the sandbox). */
export function saveProgress(): void {
    const s = state;
    pendingWrite = pendingWrite.catch(() => undefined).then(async () => {
        try {
            await RundotGameAPI.deviceCache.setItem(SAVE_KEY, JSON.stringify({
                completed: s.completed,
                loopCount: s.loopCount,
                friends: s.friends,
                continuous: s.continuous,
                subtitlesOn: s.subtitlesOn,
                reducedMotion: s.reducedMotion,
                haptics: s.haptics,
                tapeSession: s.tapeSession,
                tapeFinished: s.tapeFinished,
            }));
            if (state.saveNotice) store.patch({ saveNotice: '' });
        } catch {
            store.patch({ saveNotice: `Progress could not be saved on this device. Your progress is still available in this session.` });
        }
        // Mirror progress + settings to the player's cloud save. The device save above stays the
        // source of the visible "could not save" notice; a cloud failure is silent (and retried by
        // the next save) because the progress is still safe on the device.
        if (!sdkReady()) return;
        try {
            await RundotGameAPI.appStorage.setItem(CLOUD_KEY, JSON.stringify({
                savedAt: Date.now(),
                completed: s.completed,
                loopCount: s.loopCount,
                friends: s.friends,
                continuous: s.continuous,
                subtitlesOn: s.subtitlesOn,
                reducedMotion: s.reducedMotion,
                haptics: s.haptics,
            }));
        } catch (err) {
            console.warn('[store] cloud save failed', err);
            try { RundotGameAPI.analytics.recordCustomEvent('cloud_save_failed', { code: (err as { code?: string })?.code ?? 'unknown' }); } catch { /* host unavailable */ }
        }
    });
}
/** Navigation unmounts this game: wait for queued device saves before leaving. */
export async function flushProgress(): Promise<boolean> {
    await pendingWrite;
    return !state.saveNotice;
}

/** Load saved progress once the SDK is ready. */
function normalizeCompleted(value: unknown): EpisodeId[] {
    if (!Array.isArray(value)) return [];
    const requested = new Set(value.filter((id): id is EpisodeId => typeof id === 'string'
        && (EPISODE_ORDER.includes(id as EpisodeId) || id === HOSPITAL_AFTER)));
    // Keep only the unbroken run from the Prologue. (Checking each chapter's predecessor against what
    // the save merely *claimed*, rather than what was accepted, let `prologue, day3, day4` keep day4.)
    const completed: EpisodeId[] = [];
    for (const id of EPISODE_ORDER) {
        if (!requested.has(id)) break;
        completed.push(id);
    }
    if (requested.has(HOSPITAL_AFTER) && EPISODE_ORDER.every((id) => completed.includes(id))) completed.push(HOSPITAL_AFTER);
    return completed;
}

/** More chapters and more completed loops = more progress. Used only to choose between device and cloud saves. */
function progressScore(d: unknown): number {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return -1;
    const v = d as { completed?: unknown; loopCount?: unknown };
    const done = Array.isArray(v.completed) ? v.completed.length : 0;
    const loops = typeof v.loopCount === 'number' && Number.isSafeInteger(v.loopCount) && v.loopCount > 0 ? v.loopCount : 0;
    return loops * 100 + done;
}

/** Cloud save, or null when absent, unreadable or off-host. Never throws. */
async function readCloudSave(): Promise<unknown | null> {
    if (!sdkReady()) return null;
    try {
        const raw = await RundotGameAPI.appStorage.getItem(CLOUD_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        console.warn('[store] cloud save unreadable', err);
        return null;
    }
}

export async function hydrateProgress(): Promise<void> {
    try {
        const raw = await RundotGameAPI.deviceCache.getItem(SAVE_KEY);
        const device = raw ? JSON.parse(raw) : null;
        if (raw && (!device || typeof device !== 'object' || Array.isArray(device))) throw new Error('Invalid save');
        const cloud = await readCloudSave();
        // Whichever save has more progress wins; on a tie the device save wins (it is the freshest local write).
        const useCloud = progressScore(cloud) > progressScore(device);
        const d = (useCloud ? cloud : device) as Record<string, any> | null;
        if (useCloud) { try { RundotGameAPI.analytics.recordCustomEvent('cloud_save_restored'); } catch { /* host unavailable */ } }
        if (d) {
            const friends: Record<string, string> = {};
            for (const name of ['Mitzi Goins', 'Alan', 'Sloppy', 'Oliver']) {
                const value = d.friends?.[name];
                if (['with-you', 'missing', 'lost', 'hostile'].includes(value)) friends[name] = value;
            }
            store.patch({
                completed: normalizeCompleted(d.completed),
                tapeSession: parseTapeRequest(device?.tapeSession) ?? undefined,
                tapeFinished: !!parseTapeRequest(device?.tapeSession) && device?.tapeFinished === true,
                loopCount: Number.isSafeInteger(d.loopCount) && d.loopCount >= 0 ? d.loopCount : 0,
                friends: Object.keys(friends).length ? friends : undefined,
                continuous: d.continuous !== false,
                subtitlesOn: d.subtitlesOn !== false,
                reducedMotion: typeof d.reducedMotion === 'boolean' ? d.reducedMotion : state.reducedMotion,
                haptics: d.haptics !== false,
            });
        }
    } catch {
        store.patch({ saveNotice: 'Saved progress could not be read. The Prologue is available, and new progress can still be saved.' });
        try { RundotGameAPI.analytics.recordCustomEvent('save_read_failed'); } catch { /* host unavailable */ }
    }
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: 'loading',
    loadProgress: 0,
    paused: false,
    score: 0,
    subtitle: '',
    subtitlesOn: true,
    title: '',
    timecode: '00:00:00',
    episode: 'prologue',
    continuous: true,
    completed: [],
    ended: false,
    playbackError: '',
    saveNotice: '',
    loopCount: 0,
    tapeFinished: false,
    reducedMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    haptics: true,
    recording: false,
    liveops: LIVEOPS_DEFAULTS,
    pendingBreak: false,
    roam: false,
    useLabel: '',
    journey: false,
};

export const store = {
    /** Read the current state (from game code; in React use useStore). */
    get: (): AppState => state,
    /** Shallow-merge a partial update and notify React subscribers. */
    patch(partial: Partial<AppState>): void {
        state = { ...state, ...partial };
        for (const l of listeners) l();
    },
    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

/**
 * React hook. IMPORTANT: the selector must return a primitive or a stable
 * reference (e.g. s => s.phase). Returning a fresh object/array each call
 * makes React re-render forever.
 */
export function useStore<T = AppState>(
    selector: (s: AppState) => T = (s) => s as unknown as T
): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}
