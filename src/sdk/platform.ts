/**
 * Platform features layered on the RUN SDK.
 *
 * Contract: every export is safe to call from anywhere. Off the RUN host
 * (plain browser, a GitHub preview build, CI) each one is a silent no-op that
 * returns a fallback, and none of them can throw or leave an unhandled
 * rejection — the SDK docs warn that an unhandled rejection crashes the app.
 *
 * This is a leaf module (it only imports the store and sdkReady), so the
 * engine, HUD and menu can all use it without import cycles.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
// Type-only: the enum's runtime values are the plain strings below, so no extra SDK code is bundled.
import type { HapticFeedbackStyle } from '@series-inc/rundot-game-sdk';
import { sdkReady } from './runSdk.ts';
import { store } from '../state/store.ts';

type Haptic = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

/** Run an SDK call; off-host or on any failure return the fallback. */
async function attempt<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    if (!sdkReady()) return fallback;
    try {
        return await fn();
    } catch (err) {
        console.warn(`[platform] ${label} failed`, err);
        return fallback;
    }
}

/** Fire-and-forget analytics that never throws. */
export function track(name: string, props: Record<string, unknown> = {}): void {
    if (!sdkReady()) return;
    try { void Promise.resolve(RundotGameAPI.analytics.recordCustomEvent(name, props)).catch(() => undefined); } catch { /* host unavailable */ }
}

/** Funnel step helper: one funnel ("campaign") ordered by chapter. */
export function funnel(step: number, name: string): void {
    if (!sdkReady()) return;
    try { void Promise.resolve(RundotGameAPI.analytics.trackFunnelStep(step, name, 'campaign', step)).catch(() => undefined); } catch { /* host unavailable */ }
}

// ---------------------------------------------------------------- toasts

export async function toast(message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info'): Promise<void> {
    await attempt('toast', () => RundotGameAPI.popups.showToast(message, { variant, duration: 3000 }), false);
}

// --------------------------------------------------------------- haptics

let lastHaptic = -Infinity; // not 0: performance.now() is small right after page load
/** Throttled haptic tap. Respects the player's haptics setting and does nothing where unsupported. */
export function haptic(style: Haptic, minGapMs = 140): void {
    if (!sdkReady() || !store.get().haptics) return;
    const now = performance.now();
    if (now - lastHaptic < minGapMs) return;
    lastHaptic = now;
    try { void RundotGameAPI.triggerHapticAsync(style as unknown as HapticFeedbackStyle).catch(() => undefined); } catch { /* no vibration hardware */ }
}

/** Map a glitch burst strength (0..1) to a jolt. Small glitches stay silent so it never buzzes constantly. */
export function scareHaptic(strength: number): void {
    if (strength >= 0.7) haptic('heavy', 400);
    else if (strength >= 0.35) haptic('medium', 400);
}

// ---------------------------------------------------- local notifications

const REMINDER_KEY = 'seven-days-reminder-id';

/** Local reminders only exist on native hosts; on web they are skipped by the platform. */
export async function remindersAvailable(): Promise<boolean> {
    return attempt('remindersAvailable', async () => !RundotGameAPI.system.isWeb(), false);
}
export async function getRemindersEnabled(): Promise<boolean> {
    return attempt('getRemindersEnabled', () => RundotGameAPI.notifications.isLocalNotificationsEnabled(), false);
}
export async function setRemindersEnabled(on: boolean): Promise<boolean> {
    const ok = await attempt('setRemindersEnabled', () => RundotGameAPI.notifications.setLocalNotificationsEnabled(on), false);
    if (!on) await cancelReminder();
    return ok;
}
export async function cancelReminder(): Promise<void> {
    await attempt('cancelReminder', async () => {
        const id = await RundotGameAPI.deviceCache.getItem(REMINDER_KEY);
        if (id) await RundotGameAPI.notifications.cancelNotification(id);
        await RundotGameAPI.deviceCache.removeItem(REMINDER_KEY);
    }, undefined);
}
/**
 * Replace any pending reminder with one for the next tape. Call while the game
 * is running (e.g. when a chapter completes) — never from onSleep/onQuit, where
 * a hard close kills the runtime before the RPC lands.
 */
export async function scheduleTapeReminder(opts: { title: string; body: string; delayHours: number }): Promise<void> {
    await attempt('scheduleTapeReminder', async () => {
        if (RundotGameAPI.system.isWeb()) return;
        if (!(await RundotGameAPI.notifications.isLocalNotificationsEnabled())) return;
        await cancelReminder();
        const res = await RundotGameAPI.notifications.submitMessageAsync({
            channels: ['local'],
            title: opts.title,
            body: opts.body,
            delaySeconds: Math.max(60, Math.min(Math.round(opts.delayHours * 3600), 604800)),
            collapseKey: 'seven-days-next-tape',
        });
        const local = res.results.find((r) => r.channel === 'local');
        if (local && local.status !== 'skipped' && 'id' in local && typeof local.id === 'string') {
            await RundotGameAPI.deviceCache.setItem(REMINDER_KEY, local.id);
        }
        track('reminder_scheduled', { delay_hours: opts.delayHours, status: local?.status ?? 'unknown' });
    }, undefined);
}

// ---------------------------------------------------------------- sharing

/** Share a link to the game. Mobile opens the native sheet; web copies the link. */
export async function shareGame(label: string, day?: string): Promise<boolean> {
    const result = await attempt('shareGame', async () => {
        const shareParams: Record<string, string> = { from: 'seven-days' };
        if (day) shareParams.day = day;
        return RundotGameAPI.social.shareLinkAsync({
            shareParams,
            metadata: { title: 'SEVEN DAYS', description: `Found footage. ${label}. Watch until the end.` },
        });
    }, null);
    if (!result) return false;
    track('share_link_created', { day: day ?? 'menu' });
    if (RundotGameAPI.system.isWeb()) void toast('Link copied', 'success');
    return true;
}

/** Read how this session was launched (share link, notification, ...). Resolves null if nothing notable. */
export async function readLaunchIntent(): Promise<{ kind: string; params: Record<string, string> } | null> {
    return attempt('readLaunchIntent', async () => {
        const intent = (await RundotGameAPI.app.resolveLaunchIntent({ maxWaitMs: 800 })) as { kind: string; params?: Record<string, string> };
        if (!intent || intent.kind === 'none' || intent.kind === 'timed_out') return null;
        return { kind: intent.kind, params: intent.params ?? {} };
    }, null);
}

// ------------------------------------------------------------------ clips

let recording = false;
/** True when the host can record clips (native app; not the local Playground). */
export async function clipsAvailable(): Promise<boolean> {
    return attempt('clipsAvailable', async () => (await RundotGameAPI.clips.isSupportedAsync()).canRecord, false);
}
/** Route the game's Web Audio master bus into recorded clips (called per engine; each episode owns a new AudioContext). */
export function attachClipAudio(master: AudioNode): void {
    if (!sdkReady()) return;
    try { RundotGameAPI.clips.useGameAudio(master); } catch { /* unsupported host */ }
}
/** Called by the engine once per frame after the final render; a cheap no-op unless recording. */
export function clipFrame(): void {
    if (!recording) return;
    try { RundotGameAPI.clips.captureFrame(); } catch { /* recording ended */ }
}
export async function startClip(): Promise<boolean> {
    const started = await attempt('startClip', async () => {
        await RundotGameAPI.clips.startRecordingAsync({
            captureMode: 'manual',
            fps: 30,
            maxDurationMs: 30_000,
            // Game audio only: no microphone or camera, so no consent prompt is needed.
            audio: { microphone: false, gameAudio: true },
            onAutoStop: () => { void stopClip(); },
        });
        return true;
    }, false);
    recording = started;
    store.patch({ recording: started });
    if (started) track('clip_started');
    return started;
}
export async function stopClip(): Promise<boolean> {
    if (!recording) return false;
    recording = false;
    store.patch({ recording: false });
    const saved = await attempt('stopClip', async () => {
        const ep = store.get().episode;
        await RundotGameAPI.clips.stopRecordingAsync({ title: `SEVEN DAYS — ${ep}`, tags: ['seven-days', ep], persist: 'ugc' });
        return true;
    }, false);
    if (saved) {
        track('clip_saved');
        void toast('Clip saved to your library', 'success');
    } else {
        void toast('Could not save the clip', 'warning');
    }
    return saved;
}
/** Abort a recording without saving (episode ended or the player left). */
export async function cancelClip(): Promise<void> {
    if (!recording) return;
    recording = false;
    store.patch({ recording: false });
    await attempt('cancelClip', () => RundotGameAPI.clips.cancelRecordingAsync(), undefined);
}

// ------------------------------------------------- stats & leaderboards

/** Record campaign stats. Stats are last-write-wins, so values are absolute totals. */
export async function submitCampaignStats(completedCount: number, loopCount: number, episodeId: string): Promise<void> {
    await attempt('submitCampaignStats', async () => {
        await RundotGameAPI.stats.submit('episodes_completed', completedCount);
        await RundotGameAPI.stats.submit('loop_count', loopCount);
        await RundotGameAPI.stats.submit(`episode_${episodeId}_completed`, 1);
    }, undefined);
}

/** "Survivors" board: score = chapters completed (+ true-ending bonus), duration = seconds watched this chapter. */
export async function submitSurvivalScore(completedCount: number, loopCount: number, durationSec: number): Promise<void> {
    await attempt('submitSurvivalScore', async () => {
        const result = await RundotGameAPI.leaderboard.submitScore({
            score: completedCount + loopCount * 10,
            duration: Math.max(1, Math.round(durationSec)),
            metadata: { loopCount },
        });
        if (!result.accepted) console.warn('[platform] survival score not recorded:', result.reason);
    }, undefined);
}

export interface SurvivorRow { rank: number; username: string; score: number }
export interface SurvivorBoard { rows: SurvivorRow[]; myRank: number | null; total: number }
export async function loadSurvivors(): Promise<SurvivorBoard | null> {
    return attempt('loadSurvivors', async () => {
        const [page, mine] = await Promise.all([
            RundotGameAPI.leaderboard.getPagedScores({ limit: 10 }),
            RundotGameAPI.leaderboard.getMyRank(),
        ]);
        return {
            rows: page.entries.map((e, i) => ({ rank: e.rank ?? i + 1, username: e.username, score: e.score })),
            myRank: mine.rank,
            total: page.totalEntries,
        };
    }, null);
}

// ------------------------------------------------------- social popups

export async function canShowComments(): Promise<boolean> {
    return attempt('canShowComments', async () => (await RundotGameAPI.popups.canShowCommentsPanel()).available, false);
}
export async function showComments(): Promise<void> {
    await attempt('showComments', () => RundotGameAPI.popups.showCommentsPanel(), undefined);
}
/** Ask for a like once per device, after the player has finished Day Seven. Respects platform cooldowns. */
export async function maybePromptLike(): Promise<void> {
    await attempt('maybePromptLike', async () => {
        if (await RundotGameAPI.deviceCache.getItem('like-prompted')) return;
        if (!(await RundotGameAPI.popups.canShowLikeDialog()).available) return;
        await RundotGameAPI.deviceCache.setItem('like-prompted', '1');
        if ((await RundotGameAPI.popups.getLikeState()).isLiked) return;
        const result = await RundotGameAPI.popups.showLikeDialog();
        track('like_prompt', { shown: result.shown });
    }, undefined);
}

// --------------------------------------------- liveops, ads, home screen

export interface LiveOpsValues { menuBanner: string; interstitialsEnabled: boolean; reminderDelayHours: number }
export const LIVEOPS_DEFAULTS: LiveOpsValues = { menuBanner: '', interstitialsEnabled: false, reminderDelayHours: 22 };

/** Remote config + A/B experiment assignments (rundot/liveops.config.json). Bad or missing values fall back to defaults. */
export async function loadLiveOps(): Promise<LiveOpsValues> {
    return attempt('loadLiveOps', async () => {
        const cfg = await RundotGameAPI.liveops.getConfigAsync({ maxAgeMs: 60_000 });
        const v = cfg.values as Record<string, unknown>;
        for (const a of cfg.assignments) track('liveops_assignment', { experiment: a.experimentId, variant: a.variantId });
        return {
            menuBanner: typeof v.menuBanner === 'string' ? v.menuBanner.slice(0, 160) : LIVEOPS_DEFAULTS.menuBanner,
            interstitialsEnabled: v.interstitialsEnabled === true,
            reminderDelayHours: typeof v.reminderDelayHours === 'number' && v.reminderDelayHours > 0 ? v.reminderDelayHours : LIVEOPS_DEFAULTS.reminderDelayHours,
        };
    }, LIVEOPS_DEFAULTS);
}

let lastInterstitial = 0;
/**
 * Interstitial at a natural break (back at the menu after a chapter). OFF unless
 * LiveOps `interstitialsEnabled` is true, and never more than once per 10 minutes.
 */
export async function maybeInterstitial(): Promise<void> {
    if (!store.get().liveops.interstitialsEnabled) return;
    if (Date.now() - lastInterstitial < 10 * 60_000) return;
    await attempt('maybeInterstitial', async () => {
        if (!(await RundotGameAPI.ads.isInterstitialAdReadyAsync())) return;
        lastInterstitial = Date.now();
        const shown = await RundotGameAPI.ads.showInterstitialAd({ adDisplayId: 'chapter_break', adDisplayName: 'Between chapters' });
        track('interstitial', { shown });
    }, undefined);
}

/** One-time post-boot work: remote config, and reacting to how the player arrived. Never throws. */
export async function initPlatform(): Promise<void> {
    store.patch({ liveops: await loadLiveOps() });
    const intent = await readLaunchIntent();
    if (intent?.kind === 'share' && intent.params.from === 'seven-days') {
        track('launched_from_share', { day: intent.params.day ?? 'menu' });
        void toast('Someone sent you this tape. Watch until the end.', 'info');
    } else if (intent?.kind === 'notification') {
        track('launched_from_reminder');
    }
}

export async function canPinToHomeScreen(): Promise<boolean> {
    return attempt('canPinToHomeScreen', () => RundotGameAPI.system.canAddToHomeScreen(), false);
}
export async function pinToHomeScreen(): Promise<boolean> {
    const res = await attempt('pinToHomeScreen', () => RundotGameAPI.system.addToHomeScreen(), { added: false });
    if (res.added) track('pinned_to_homescreen');
    return res.added;
}

/** Display name for the "OPERATOR" line, or '' when anonymous / off-host. */
export function operatorName(): string {
    if (!sdkReady()) return '';
    try {
        const profile = RundotGameAPI.getProfile();
        if (profile.isAnonymous) return '';
        return typeof profile.username === 'string' ? profile.username.slice(0, 32) : '';
    } catch { return ''; }
}
