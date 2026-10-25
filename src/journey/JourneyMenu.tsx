import { journey } from './journey.ts';
import { store } from '../state/store.ts';
import menuBg from '../assets/menu-bg.jpg';

/** Main menu: the key art (it already carries the title) with the buttons laid over its dark floor. */
export default function JourneyMenu() {
    const has = journey.hasSave();
    return (
        <div className="relative h-full w-full overflow-hidden bg-black font-mono">
            {/* blurred copy fills the frame behind the full-width art, so tall screens never show a black void */}
            <img src={menuBg} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl" draggable={false} />
            <div className="absolute inset-x-0 top-0 bottom-64 flex items-center justify-center overflow-hidden">
                <img
                    src={menuBg}
                    alt="SEVEN DAYS. A wall of static-filled televisions; the middle one says: wake up."
                    className="w-[125%] max-w-none shrink-0"
                    draggable={false}
                />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black via-black/85 to-transparent px-6 pb-6 pt-24">
                <p className="text-center text-[11px] tracking-[0.25em] text-white/60">THEY WERE LOOKING FOR THEIR FRIENDS. PUT THE TAPE IN.</p>
                <div className="flex w-full max-w-xs flex-col gap-3">
                    <button type="button" className="min-h-14 rounded-xl border border-red-400/60 bg-red-950/60 px-4 py-3 text-lg font-bold backdrop-blur-sm active:scale-95" onClick={() => journey.newGame()}>NEW GAME</button>
                    {has && <button type="button" className="min-h-14 rounded-xl border border-white/30 bg-black/50 px-4 py-3 text-lg font-bold backdrop-blur-sm active:scale-95" onClick={() => { journey.continueGame(); }}>CONTINUE</button>}
                    <button type="button" className="min-h-11 rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-white/65 active:scale-95" onClick={() => store.patch({ phase: 'archive' as never })}>TAPE ARCHIVE (cinematic only)</button>
                </div>
                <p className="max-w-xs text-center text-[10px] leading-relaxed text-white/40">WASD move · mouse look · E use · Shift run · C crouch. Touch: left stick, drag to look. Headphones recommended.</p>
            </div>
        </div>
    );
}
