import { journey } from './journey.ts';
import { store } from '../state/store.ts';
import floorImg from '../assets/menu-floor.jpg';

/**
 * Main menu, matching the approved design: glitch title, red "WAKE UP.", tagline, NEW GAME (red) /
 * CONTINUE / TAPE ARCHIVE (blue), controls hint, over a dark room. Swap the backdrop by replacing src/assets/menu-bg.jpg.
 */
const CSS = `
@keyframes sd-glitch { 0%,92%,100% { transform: translate(0,0); clip-path: none } 93% { transform: translate(-3px,1px); clip-path: inset(10% 0 55% 0) } 95% { transform: translate(3px,-1px); clip-path: inset(55% 0 12% 0) } 97% { transform: translate(-2px,0); clip-path: none } }
@keyframes sd-flicker { 0%,100% { opacity: 1 } 47% { opacity: 1 } 48% { opacity: .55 } 50% { opacity: 1 } 78% { opacity: .8 } 80% { opacity: 1 } }
@media (prefers-reduced-motion: no-preference) { .sd-glitch { animation: sd-glitch 5s infinite steps(1) } .sd-flicker { animation: sd-flicker 4s infinite steps(1) } }
`;

export default function JourneyMenu() {
    const has = journey.hasSave();
    return (
        <div className="relative h-full w-full overflow-hidden bg-black font-mono text-white">
            <style>{CSS}</style>
            {/* cold glow from an off-screen television, and the tape-strewn floor below */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_80%_28%,rgba(70,130,255,.22),transparent_70%),radial-gradient(ellipse_60%_40%_at_15%_85%,rgba(40,200,170,.10),transparent_70%)]" />
            <img src={floorImg} alt="" aria-hidden className="absolute inset-x-0 bottom-0 h-[30%] w-full object-cover opacity-55" draggable={false} />
            <div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b from-black via-black/55 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,.85)_100%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-30 [background:repeating-linear-gradient(0deg,rgba(0,0,0,.45)_0_1px,transparent_1px_3px)]" />
            <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6">
                <div className="flex flex-col items-center gap-1">
                    <h1
                        className="sd-glitch whitespace-nowrap text-center font-black leading-none tracking-[0.14em] text-[#cdeff5]"
                        style={{ fontSize: 'clamp(26px, 9.5vw, 56px)', textShadow: '-3px 0 rgba(255,40,70,.85), 3px 0 rgba(0,240,255,.8), 0 0 18px rgba(120,230,255,.35)' }}
                    >SEVEN DAYS</h1>
                    <div
                        className="sd-flicker text-center font-black italic leading-none tracking-[0.04em] text-[#ff3030]"
                        style={{ fontSize: 'clamp(24px, 8.5vw, 50px)', textShadow: '0 0 14px rgba(255,40,40,.7), 2px 0 rgba(0,240,255,.45)' }}
                    >WAKE UP.</div>
                </div>
                <p className="max-w-xs text-center text-[10px] leading-relaxed tracking-[0.2em] text-white/55">THEY WERE LOOKING FOR THEIR FRIENDS. PUT THE TAPE IN.</p>
                <div className="mt-2 flex w-full max-w-[300px] flex-col gap-3">
                    <button
                        type="button"
                        className="min-h-14 rounded-xl border-2 border-red-500/80 bg-[#2a0a0e]/80 px-4 py-3 text-lg font-bold tracking-widest shadow-[0_0_18px_rgba(255,40,60,.35),inset_0_0_14px_rgba(255,40,60,.15)] active:scale-95"
                        onClick={() => journey.newGame()}
                    >NEW GAME</button>
                    {has && (
                        <button
                            type="button"
                            className="min-h-14 rounded-xl border-2 border-white/40 bg-black/60 px-4 py-3 text-lg font-bold tracking-widest active:scale-95"
                            onClick={() => { journey.continueGame(); }}
                        >CONTINUE</button>
                    )}
                    <button
                        type="button"
                        className="min-h-12 rounded-xl border-2 border-sky-400/70 bg-[#0a1630]/80 px-4 py-2 text-sm tracking-wider text-sky-100 shadow-[0_0_14px_rgba(80,160,255,.3),inset_0_0_12px_rgba(80,160,255,.12)] active:scale-95"
                        onClick={() => store.patch({ phase: 'archive' as never })}
                    >TAPE ARCHIVE (cinematic only)</button>
                </div>
                <p className="mt-3 max-w-[300px] text-center text-[10px] leading-relaxed text-white/40">WASD move · mouse look · E use · Shift run · C crouch. Touch: left stick, drag to look. Headphones recommended.</p>
            </div>
        </div>
    );
}
