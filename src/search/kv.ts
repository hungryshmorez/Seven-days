import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

/** Small sync-read key/value store backed by the SDK's device cache (browser storage is blocked in the sandbox). */
const mem = new Map<string, string>();

export async function kvInit(keys: string[]): Promise<void> {
    for (const k of keys) {
        try {
            const v = await RundotGameAPI.deviceCache.getItem(k);
            if (typeof v === 'string') mem.set(k, v);
        } catch {
            /* running outside the host: start fresh */
        }
    }
}

export function kvGet(k: string): string | null {
    return mem.get(k) ?? null;
}

export function kvSet(k: string, v: string): void {
    mem.set(k, v);
    try {
        void Promise.resolve(RundotGameAPI.deviceCache.setItem(k, v)).catch(() => undefined);
    } catch {
        /* ignore */
    }
}

export function kvRemove(k: string): void {
    mem.delete(k);
    try {
        void Promise.resolve(RundotGameAPI.deviceCache.removeItem(k)).catch(() => undefined);
    } catch {
        /* ignore */
    }
}
