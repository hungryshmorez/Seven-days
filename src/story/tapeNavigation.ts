import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { store, hydrateProgress, saveProgress, flushProgress } from '../state/store.ts';
import { parseTapeRequest, RETURN_GAME_URL, type TapeSession } from './tapeLink.ts';
import { canStartEpisode } from './progression.ts';

const SHARED_KEY = 'seven-days:return-to-search:v1';
const SHARED_NAMESPACE = 'tape-handoff';
const sharedBucket = () => RundotGameAPI.sharedStorage.open({ namespace: SHARED_NAMESPACE });
const NAV_TIMEOUT_MS = 10_000;

function timeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), NAV_TIMEOUT_MS)),
    ]);
}

export function startIncomingTape(): boolean {
    const session = store.get().tapeSession;
    if (!session || store.get().tapeFinished) return false;
    if (!canStartEpisode(tapeEpisodeFor(session), store.get().completed)) {
        store.patch({ playbackError: 'Complete the earlier chapters before watching this tape.' });
        return false;
    }
    store.patch({ episode: tapeEpisodeFor(session), phase: 'playing', paused: false, ended: false, playbackError: '' });
    return true;
}

function tapeEpisodeFor(session: TapeSession): string {
    return ({ 1: 'day1', 2: 'day2', 3: 'day3', 4: 'day4', 5: 'day5', 6: 'day6', 7: 'day7' } as const)[session.tapeDay];
}

/**
 * Return to the companion search. This source records progress in its own SDK
 * cache scope; the return receipt is written to genuinely shared storage.
 * The source searches only its own cache scope for native progress.
 */
export async function returnToSearch(): Promise<void> {
    const session = store.get().tapeSession;
    if (!session) throw new Error('This playback was not opened from the search game.');
    const finished = store.get().tapeFinished;
    saveProgress();
    if (!await flushProgress()) throw new Error(store.get().saveNotice || 'Progress could not be saved. Please try again.');
    const receipt = {
        version: 1 as const,
        status: finished ? 'completed' as const : 'returned-early' as const,
        sourceGameSlug: session.source,
        requestId: session.requestId,
        tapeDay: session.tapeDay,
        completedAt: finished ? Date.now() : undefined,
        returnedAt: Date.now(),
    };
    await timeout(sharedBucket().setItem(SHARED_KEY, JSON.stringify(receipt)), 'Saving the return receipt');
    try {
        await timeout(RundotGameAPI.navigateToGame(RETURN_GAME_URL), 'Opening the search game');
    } catch {
        // A rejected navigate promise can still mean the host accepted the handoff.
    }
}

export async function readIncomingTape(): Promise<TapeSession | null> {
    try {
        const raw = await sharedBucket().getItem(SHARED_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as Record<string, unknown>;
        if (value?.kind === 'play-request') return parseTapeRequest(value.request);
    } catch { /* absent or malformed cross-game request */ }
    return null;
}

export { hydrateProgress };
