/** Mounts whichever game the journey says is on screen, and the tape-loading screen between them. */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { journey, type JSeg } from './journey.ts';
import { PrologueGame, SAVE_KEY, SET_KEY } from '../search/game.ts';
import { kvInit } from '../search/kv.ts';
import { CinemaEngine, EPISODES, PULSE_EPISODE, type EngineOptions } from '../cinema/engine.ts';
import { store } from '../state/store.ts';
import Hud from '../ui/Hud.tsx';
import MergeEnding from './MergeEnding.tsx';

const useJourney = () => useSyncExternalStore(journey.subscribe, journey.get);

function Bridge({ text }: { text: string }) {
    useEffect(() => {
        const ms = navigator.webdriver ? 250 : 2400;
        const t = window.setTimeout(() => journey.endBridge(), ms);
        const skip = () => journey.endBridge();
        window.addEventListener('keydown', skip);
        return () => { window.clearTimeout(t); window.removeEventListener('keydown', skip); };
    }, [text]);
    return (
        <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-black font-mono text-white" onClick={() => journey.endBridge()}
            style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 3px)' }}>
            <div className="text-xs tracking-[0.5em] text-red-500">▶ PLAY</div>
            <div className="px-6 text-center text-xl tracking-[0.25em]" style={{ textShadow: '2px 0 rgba(255,0,0,.6),-2px 0 rgba(0,255,255,.6)' }}>{text}</div>
            <div className="h-px w-40 animate-pulse bg-white/40" />
        </div>
    );
}

function SearchStage({ seg, snap }: { seg: Extract<JSeg, { k: 'search' | 'tapeday' }>; snap: ReturnType<typeof journey.get>['state']['snap'] }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let game: PrologueGame | null = null;
        let dead = false;
        void kvInit([SAVE_KEY, SET_KEY]).then(() => {
            if (dead || !ref.current) return;
            const common = { onTape: undefined, onLoop: undefined } as const;
            void common;
            if (seg.k === 'tapeday') {
                game = new PrologueGame(ref.current, () => journey.exit(), {
                    autostart: 'tapeDay', tapeDay: seg.day,
                    onTapeDayEnd: () => journey.tapeDayDone(seg.day),
                });
            } else {
                game = new PrologueGame(ref.current, () => journey.exit(), {
                    autostart: seg.start === 'new' ? 'new' : 'afterTape', restore: snap,
                    onTape: (n, s) => journey.searchTape(n, s),
                    onLoop: (s) => journey.searchLoop(s),
                    onWake: () => journey.credits('wake'),
                });
            }
        });
        return () => { dead = true; game?.dispose(); };
    }, []);
    return <div ref={ref} className="absolute inset-0 bg-black" />;
}

function CinemaStage({ seg, cycle }: { seg: Extract<JSeg, { k: 'cinema' }>; cycle: 0 | 1 }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const def = seg.ep === 'pulse' ? PULSE_EPISODE : EPISODES.find((e) => e.id === seg.ep && e.build);
        if (!def || !ref.current) { journey.exit(); return; }
        store.patch({ loopCount: cycle, journey: true, episode: seg.ep, ended: false, paused: false, title: '', subtitle: '', pulseTriggered: false });
        const opts: EngineOptions = {};
        if (seg.roam) {
            opts.freeRoam = true;
            opts.vcr = seg.ep !== 'prologue';
            opts.tapeNo = seg.tape;
            if (seg.ep === 'prologue') opts.holdAtCamp = true;
        } else if (seg.ep === 'day7') {
            opts.endAt = 121; // the search game owns the living room that follows
        }
        let engine: CinemaEngine | null = null;
        engine = new CinemaEngine(ref.current, def, (id) => {
            if (id === 'pulse') { journey.go({ k: 'cinema', ep: 'pulse', roam: false, tape: 0 }, null); return; }
            if (seg.ep === 'pulse') { journey.credits('pulse'); return; }
            if (seg.roam) journey.cinemaRoamDone(seg.ep);
            else journey.cinemaTapeDone(seg.tape);
        }, (err) => {
            console.warn('[journey] cinematic chapter failed', seg.ep, err);
            // never strand the player on a broken tape: skip it as if it had ended
            if (seg.roam) journey.cinemaRoamDone(seg.ep); else journey.cinemaTapeDone(seg.tape);
        }, opts);
        return () => engine?.dispose();
    }, []);
    return (
        <>
            <div ref={ref} className="absolute inset-0 bg-black" />
            <Hud />
        </>
    );
}

function Credits({ why }: { why: 'death' | 'wake' | 'pulse' }) {
    const lines = why === 'wake'
        ? ['HE IS AWAKE.', 'It was only ever one man, looking for himself.']
        : why === 'pulse' ? ['A PULSE.', 'Someone held on.'] : ['THE LINE HOLDS STEADY.', 'It was only ever one man, looking for himself.'];
    return (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-black px-8 text-center font-mono text-white">
            {lines.map((l, i) => <p key={i} className={i ? 'text-sm text-white/60' : 'text-2xl tracking-[0.3em]'}>{l}</p>)}
            <button type="button" className="mt-6 rounded-xl border border-white/40 px-8 py-3 font-bold active:scale-95" onClick={() => journey.exit()}>MAIN MENU</button>
        </div>
    );
}

export default function JourneyRoot() {
    const v = useJourney();
    const seg = v.state.seg;
    const key = `${v.nonce}`;
    return (
        <div className="fixed inset-0 overflow-hidden bg-black text-white">
            {v.bridge !== null && <Bridge text={v.bridge} />}
            {v.bridge === null && seg.k === 'search' && <SearchStage key={key} seg={seg} snap={v.state.snap} />}
            {v.bridge === null && seg.k === 'tapeday' && <SearchStage key={key} seg={seg} snap={null} />}
            {v.bridge === null && seg.k === 'cinema' && <CinemaStage key={key} seg={seg} cycle={v.state.cycle} />}
            {v.bridge === null && seg.k === 'merge' && <MergeEnding key={key} onDone={() => journey.credits('death')} />}
            {v.bridge === null && seg.k === 'credits' && <Credits key={key} why={seg.why} />}
        </div>
    );
}
