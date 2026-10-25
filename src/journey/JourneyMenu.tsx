import { journey } from './journey.ts';
import { store } from '../state/store.ts';

export default function JourneyMenu() {
    const has = journey.hasSave();
    return (
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6 font-mono">
            <h1 className="text-4xl font-bold tracking-[0.3em] text-red-500" style={{ textShadow: '2px 0 #0ff' }}>SEVEN DAYS</h1>
            <p className="max-w-sm text-center text-xs tracking-widest text-white/50">THEY WERE LOOKING FOR THEIR FRIENDS.<br />PUT THE TAPE IN.</p>
            <div className="mt-4 flex w-full max-w-xs flex-col gap-3">
                <button type="button" className="min-h-14 rounded-xl border border-red-400/60 bg-red-950/40 px-4 py-3 text-lg font-bold active:scale-95" onClick={() => journey.newGame()}>NEW GAME</button>
                {has && <button type="button" className="min-h-14 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-lg font-bold active:scale-95" onClick={() => { journey.continueGame(); }}>CONTINUE</button>}
                <button type="button" className="min-h-12 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/60 active:scale-95" onClick={() => store.patch({ phase: 'archive' as never })}>TAPE ARCHIVE (cinematic only)</button>
            </div>
            <p className="mt-6 max-w-xs text-center text-[11px] leading-relaxed text-white/40">WASD move · mouse look · E use · Shift run · C crouch. Touch: left stick, drag to look. Headphones recommended.</p>
        </div>
    );
}
