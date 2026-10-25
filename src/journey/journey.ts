/**
 * THE JOURNEY: the one script that runs both games as a single story.
 *
 * The protagonist is in a coma. The "search" game (first person, you walk around) and the "tape" game (the
 * cinematic recordings) are two halves of the same mind, and the story alternates between them.
 *
 * First pass (cycle 0): you play the search game. Each time you finish a day you find a tape and put it in the TV.
 *   search: boat, prologue, Day 1  ->  tape 1  ->  cinematic Day 1  ->  search Day 2  ->  tape 2  ->  ...
 *   -> search Day 7 and the living room  ->  the cinematic Prologue (second pass starts)
 * Second pass (cycle 1): the roles swap. The cinematic game is the one you walk around in, and the search game is
 * what you watch on tape (guided, no exploring, friends hostile).
 *   cinematic Prologue (roam)  ->  cinematic Day 1 (roam) + VCR  ->  search Day 1 as a tape  ->  cinematic Day 2 ...
 *   -> cinematic Day 7 + VCR  ->  search Day 7 as a tape  ->  THE MERGE (both games at once)  ->  hospital.
 * Hidden: stay on the beach with the dog long enough and you wake up (the dog ending).
 */
import { kvGet, kvSet, kvRemove, kvInit } from '../search/kv.ts';
import type { SearchSnapshot } from '../search/game.ts';
import { store } from '../state/store.ts';

export type JSeg =
    | { k: 'search'; start: 'new' | 'afterTape' }
    | { k: 'cinema'; ep: string; roam: boolean; tape: number }
    | { k: 'tapeday'; day: number }
    | { k: 'merge' }
    | { k: 'credits'; why: 'death' | 'wake' | 'pulse' };

export interface JState { v: 1; cycle: 0 | 1; seg: JSeg; snap: SearchSnapshot | null }
export interface JView { state: JState; bridge: string | null; nonce: number; live: boolean }

const KEY = 'sevendays_journey_v1';
export const DAYS = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const;

type Listener = () => void;
const listeners = new Set<Listener>();
let view: JView = { state: { v: 1, cycle: 0, seg: { k: 'search', start: 'new' }, snap: null }, bridge: null, nonce: 0, live: false };

function emit() { for (const l of listeners) l(); }
function persist() {
    if (navigator.webdriver) return;
    try { kvSet(KEY, JSON.stringify(view.state)); } catch { /* storage unavailable */ }
}
function set(partial: Partial<JView>) { view = { ...view, ...partial }; emit(); }

export const journey = {
    get: (): JView => view,
    subscribe(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); },
    async init(): Promise<void> { await kvInit([KEY]); },
    hasSave(): boolean {
        try { const s = kvGet(KEY); if (!s) return false; const j = JSON.parse(s) as JState; return j?.v === 1 && j.seg?.k !== 'credits'; } catch { return false; }
    },
    /** Move to a segment. `bridge` is the line shown on the tape-loading screen between the two games. */
    go(seg: JSeg, bridge: string | null, extra: Partial<JState> = {}) {
        const state: JState = { ...view.state, ...extra, seg };
        view = { ...view, state, bridge, nonce: view.nonce + 1, live: true };
        persist();
        emit();
    },
    endBridge() { if (view.bridge !== null) set({ bridge: null }); },
    newGame() {
        try { kvRemove('sevendays_prologue_v1'); } catch { /* ignore */ }
        store.patch({ loopCount: 0, journey: true, phase: 'journey', completed: [], friends: undefined });
        view = { state: { v: 1, cycle: 0, seg: { k: 'search', start: 'new' }, snap: null }, bridge: null, nonce: view.nonce + 1, live: true };
        persist(); emit();
    },
    continueGame() {
        try {
            const j = JSON.parse(kvGet(KEY) || 'null') as JState | null;
            if (!j || j.v !== 1) return false;
            store.patch({ loopCount: j.cycle, journey: true, phase: 'journey' });
            view = { state: j, bridge: j.seg.k === 'search' && j.seg.start === 'new' ? null : 'RESUMING', nonce: view.nonce + 1, live: true };
            emit();
            return true;
        } catch { return false; }
    },
    exit() {
        store.patch({ journey: false, phase: 'menu', title: '', subtitle: '', roam: false, useLabel: '' });
        view = { ...view, live: false, bridge: null };
        emit();
    },

    // ── hand-offs, in story order ──
    /** First pass: the player put tape `n` in the TV. The cinematic recording of that day plays. */
    searchTape(n: number, snap: SearchSnapshot) {
        const day = DAYS[Math.max(0, Math.min(6, n - 1))];
        journey.go({ k: 'cinema', ep: day, roam: false, tape: n }, `TAPE ${String(n).padStart(2, '0')}  ·  INSERTED`, { snap });
    },
    /** First pass: the recording ended. Back to the search, carrying on from the tape room. */
    cinemaTapeDone(n: number) {
        journey.go({ k: 'search', start: 'afterTape' }, `TAPE ${String(n).padStart(2, '0')}  ·  EJECTED`);
    },
    /** First pass over: the living room is behind you. The second pass begins in the cinematic prologue. */
    searchLoop(snap: SearchSnapshot) {
        store.patch({ loopCount: 1 });
        journey.go({ k: 'cinema', ep: 'prologue', roam: true, tape: 0 }, 'SEVEN DAYS  ·  AGAIN', { cycle: 1, snap });
    },
    /** Second pass: a cinematic chapter you explored has ended. */
    cinemaRoamDone(ep: string) {
        if (ep === 'prologue') { journey.go({ k: 'cinema', ep: 'day1', roam: true, tape: 1 }, 'DAY ONE'); return; }
        const i = DAYS.indexOf(ep as (typeof DAYS)[number]);
        if (i >= 0) journey.go({ k: 'tapeday', day: i + 1 }, `PLAYING TAPE ${String(i + 1).padStart(2, '0')}`);
    },
    /** Second pass: the guided tape of a search day ended. */
    tapeDayDone(day: number) {
        if (day >= 7) { journey.go({ k: 'merge' }, 'BOTH TAPES  ·  PLAYING'); return; }
        journey.go({ k: 'cinema', ep: DAYS[day], roam: true, tape: day + 1 }, `DAY ${['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'][day + 1]}`);
    },
    credits(why: 'death' | 'wake' | 'pulse') { journey.go({ k: 'credits', why }, null); },
};

if (typeof window !== 'undefined') (window as unknown as { __journey: unknown }).__journey = journey;
