export const RETURN_GAME_URL = 'https://run.world/game/sevendayscinematics-solarkjng';
export const SOURCE_GAME_SLUG = 'sevendayscinematics-solarkjng';

export type TapeDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface TapeSession {
    source: typeof SOURCE_GAME_SLUG;
    requestId: string;
    tapeDay: TapeDay;
    requestedAt: number;
    expiresAt: number;
}

const TAPE_BY_DAY: Record<TapeDay, string> = {
    1: 'day1',
    2: 'day2',
    3: 'day3',
    4: 'day4',
    5: 'day5',
    6: 'day6',
    7: 'day7',
};

export function tapeEpisode(session: TapeSession): string {
    return TAPE_BY_DAY[session.tapeDay];
}

export function parseTapeRequest(value: unknown): TapeSession | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    const tapeDay = Number(v.tapeDay);
    if (v.source !== SOURCE_GAME_SLUG || typeof v.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(v.requestId)) return null;
    if (!Number.isInteger(tapeDay) || tapeDay < 1 || tapeDay > 7) return null;
    if (!Number.isFinite(v.requestedAt) || !Number.isFinite(v.expiresAt) || Number(v.expiresAt) <= Date.now()) return null;
    return value as TapeSession;
}
