import { EPISODE_ORDER, HOSPITAL_AFTER, type EpisodeId } from '../cinema/engine.ts';

export function canStartEpisode(id: string, completed: readonly string[]): boolean {
    if (id === HOSPITAL_AFTER) return EPISODE_ORDER.every((episode) => completed.includes(episode));
    const index = EPISODE_ORDER.indexOf(id as EpisodeId);
    return index === 0 || (index > 0 && completed.includes(EPISODE_ORDER[index - 1]));
}

/**
 * Record a genuine completion. An id is only added when its prerequisites are
 * met, so a skipped-day completion can never be fabricated. Unknown ids
 * (pulse, hospitalFatal) are never recorded.
 */
export function completeEpisode(id: string, completed: readonly string[]): string[] {
    if (completed.includes(id)) return [...completed];
    if (!canStartEpisode(id, completed)) return [...completed];
    return [...completed, id];
}

export function hospitalUnlocked(completed: readonly string[]): boolean {
    return canStartEpisode(HOSPITAL_AFTER, completed);
}

export function completedThrough(completed: readonly string[]): number {
    let count = 0;
    while (count < EPISODE_ORDER.length && completed.includes(EPISODE_ORDER[count])) count += 1;
    return count;
}

export function nextEpisode(completed: readonly string[]): EpisodeId | typeof HOSPITAL_AFTER | null {
    const count = completedThrough(completed);
    if (count < EPISODE_ORDER.length) return EPISODE_ORDER[count];
    return completed.includes(HOSPITAL_AFTER) ? null : HOSPITAL_AFTER;
}
