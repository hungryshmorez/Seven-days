import type { Sfx } from './audio.ts';

/**
 * THE TAPE SLOT. This is only a doorway.
 *
 * When the player puts a tape in the player, the game hands the whole screen to that tape and
 * does nothing else. What happens inside (cinematic, guided play, free exploration, controls,
 * camera, sound, enemies, how the second cycle differs) belongs entirely to the tape.
 * The game only waits for one signal: "this tape is finished".
 *
 * Preferred way to install tape N (a self-contained embedded page, like an iframe):
 *   1. put the page at public/tapes/tapeN/index.html (with any files it needs beside it)
 *   2. add N to the "tapes" list in public/tapes/manifest.json
 *   3. when the tape is over, the page calls:
 *        parent.postMessage({ type: 'seven-days:tape-done' }, '*')
 * The page is opened with ?tape=N&cycle=1 (or cycle=2 after the loop). That is information only.
 *
 * Alternative: src/tapes/tapeN.ts default-exporting a TapePlayer (see src/tapes/README.md).
 */
export interface TapeApi {
    tape: number;
    /** Information only: 1 on the first trip through the seven days, 2 after the loop. */
    cycle: 1 | 2;
    root: HTMLElement;
    sfx: Sfx;
    reducedFlash: boolean;
    done(): void;
}
export type TapePlayer = (api: TapeApi) => void | (() => void);

const modulePlayers = new Map<number, TapePlayer>();
const modules = import.meta.glob('../tapes/*.ts', { eager: true }) as Record<string, { default?: TapePlayer; tape?: number }>;
for (const [file, mod] of Object.entries(modules)) {
    const n = mod.tape ?? Number(/tape[-_]?0*(\d+)/i.exec(file)?.[1]);
    if (typeof mod.default === 'function' && n > 0) modulePlayers.set(n, mod.default);
}

async function installedEmbeds(): Promise<number[]> {
    try {
        const r = await fetch('tapes/manifest.json', { cache: 'no-store' });
        const j = (await r.json()) as { tapes?: unknown };
        return Array.isArray(j.tapes) ? j.tapes.map(Number) : [];
    } catch {
        return [];
    }
}

function mountEmbed(n: number, api: TapeApi, end: () => void): () => void {
    const frame = document.createElement('iframe');
    frame.src = `tapes/tape${n}/index.html?tape=${n}&cycle=${api.cycle}`;
    frame.title = 'Tape ' + n;
    frame.allow = 'autoplay; fullscreen; gamepad; accelerometer; gyroscope';
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:20;background:#000';
    api.root.appendChild(frame);
    const onMessage = (e: MessageEvent) => {
        if (e.source !== frame.contentWindow) return;
        const d = e.data as { type?: string } | string | null;
        if (d === 'seven-days:tape-done' || (typeof d === 'object' && d?.type === 'seven-days:tape-done')) end();
    };
    window.addEventListener('message', onMessage);
    frame.addEventListener('load', () => frame.focus());
    return () => { window.removeEventListener('message', onMessage); frame.remove(); };
}

/** Shown only while no recording has been installed for that tape. */
function mountPlaceholder(api: TapeApi, end: () => void): () => void {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;inset:0;z-index:20;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#ddd;font-family:ui-monospace,Menlo,monospace;text-align:center;padding:24px';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:clamp(16px,3.4vw,26px);letter-spacing:4px';
    title.textContent = 'TAPE ' + String(api.tape).padStart(2, '0');
    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:13px;color:#889';
    sub.textContent = 'RECORDING NOT INSTALLED YET';
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:12px 30px;min-height:48px;font:inherit;font-size:16px;background:#d8d8d8;color:#000;border:0;border-radius:6px;cursor:pointer';
    btn.textContent = 'CONTINUE';
    btn.addEventListener('click', end);
    box.append(title, sub, btn);
    api.root.appendChild(box);
    return () => box.remove();
}

export function playTape(n: number, api: Omit<TapeApi, 'tape' | 'done'> & { done(): void }): void {
    if (document.pointerLockElement) document.exitPointerLock();
    api.sfx.setMaster(0); // the tape owns all sound while it plays
    let ended = false;
    let cleanup: (() => void) | undefined;
    const end = () => {
        if (ended) return;
        ended = true;
        try { cleanup?.(); } catch { /* ignore */ }
        api.sfx.setMaster(0.8);
        api.done();
    };
    const full: TapeApi = { ...api, tape: n, done: end };
    void installedEmbeds().then((list) => {
        if (ended) return;
        const mod = modulePlayers.get(n);
        if (list.includes(n)) cleanup = mountEmbed(n, full, end);
        else if (mod) { const out = mod(full); if (typeof out === 'function') cleanup = out; }
        else cleanup = mountPlaceholder(full, end);
    });
}
