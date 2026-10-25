/** Episode select: each chapter requires every preceding chapter to be completed. */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { store, useStore, saveProgress } from '../state/store.ts';
import { EPISODES } from '../cinema/engine.ts';
import { canStartEpisode, nextEpisode } from '../story/progression.ts';
import MenuExtras from './MenuExtras.tsx';
import { haptic } from '../sdk/platform.ts';

const CSS = `
@keyframes sd-glitch { 0%,92%,100% { transform: translate(0,0); clip-path: none } 93% { transform: translate(-3px,1px); clip-path: inset(10% 0 55% 0) } 95% { transform: translate(3px,-1px); clip-path: inset(55% 0 12% 0) } 97% { transform: translate(-2px,0); clip-path: none } }
@media (prefers-reduced-motion: no-preference) { .sd-glitch { animation: sd-glitch 5s infinite steps(1) } }
`;

function track(name: string, props: Record<string, unknown> = {}) {
    try { RundotGameAPI.analytics.recordCustomEvent(name, props); } catch { /* standalone host unavailable */ }
}

export default function MainMenu() {
    const completed = useStore((s) => s.completed);
    const continuous = useStore((s) => s.continuous);
    const playbackError = useStore((s) => s.playbackError);
    const saveNotice = useStore((s) => s.saveNotice);
    const loopCount = useStore((s) => s.loopCount);
    const next = nextEpisode(completed);
    const start = (id: string) => {
        if (!canStartEpisode(id, store.get().completed)) {
            track('menu_episode_locked', { episode: id });
            return;
        }
        track('menu_episode_selected', { episode: id, replay: completed.includes(id) });
        haptic('light');
        store.patch({ episode: id, phase: 'playing', paused: false, ended: false, playbackError: '', title: '', subtitle: '', tapeSession: undefined, tapeFinished: false });
        saveProgress();
    };
    const firstRequired = EPISODES.find((entry) => !completed.includes(entry.id));
    return (
        <div className="relative h-full w-full overflow-hidden bg-black font-mono text-white">
            <style>{CSS}</style>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_80%_8%,rgba(70,130,255,.20),transparent_70%),radial-gradient(ellipse_60%_35%_at_10%_95%,rgba(40,200,170,.08),transparent_70%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,.8)_100%)]" />
            <div className="pointer-events-none absolute inset-0 z-10 opacity-25 [background:repeating-linear-gradient(0deg,rgba(0,0,0,.45)_0_1px,transparent_1px_3px)]" />
            <div className="relative flex h-full flex-col items-center gap-4 overflow-y-auto px-5 pb-10 pt-4">
                <div className="flex w-full max-w-sm items-center">
                    <button type="button" aria-label="Back to main menu"
                        className="min-h-11 rounded-lg border border-white/30 bg-black/60 px-4 py-2 text-xs tracking-widest active:scale-95"
                        onClick={() => { haptic('light'); store.patch({ phase: 'menu', playbackError: '' }); }}>&lt; BACK</button>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <h1 className="sd-glitch whitespace-nowrap text-center font-black leading-none tracking-[0.14em] text-[#cdeff5]"
                        style={{ fontSize: 'clamp(24px, 8.5vw, 48px)', textShadow: '-3px 0 rgba(255,40,70,.85), 3px 0 rgba(0,240,255,.8), 0 0 18px rgba(120,230,255,.35)' }}>SEVEN DAYS</h1>
                    <div className="text-center text-[11px] font-bold tracking-[0.35em] text-sky-300/80" style={{ textShadow: '0 0 10px rgba(80,160,255,.6)' }}>TAPE ARCHIVE</div>
                </div>
                <p className="max-w-xs text-center text-[10px] leading-relaxed tracking-[0.2em] text-white/50">FOUND FOOTAGE. EACH TAPE UNLOCKS WHEN YOU HAVE WATCHED THE ONE BEFORE.</p>
                {playbackError && <p role="alert" className="w-full max-w-sm rounded-lg border border-red-400/50 bg-red-950/50 p-3 text-sm">{playbackError}</p>}
                {saveNotice && (
                    <div role="status" className="w-full max-w-sm rounded-lg border border-amber-300/40 p-3 text-sm">
                        <p>{saveNotice}</p>
                        <button type="button" className="mt-2 min-h-12 w-full rounded border border-white/40 px-3 py-2" onClick={() => {
                            track('menu_save_retried');
                            saveProgress();
                        }}>Try saving again</button>
                    </div>
                )}
                <div className="flex w-full max-w-sm flex-col gap-2.5">
                    {EPISODES.filter((e) => e.id !== 'hospitalFatal').map((e) => {
                        const unlocked = !!e.build && canStartEpisode(e.id, completed);
                        const done = unlocked && completed.includes(e.id);
                        const isNext = unlocked && e.id === next;
                        return (
                            <button key={e.id} type="button" disabled={!unlocked}
                                aria-label={`${e.label}: ${unlocked ? done ? 'Replay' : 'Available' : 'Locked'}`}
                                className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-transform active:scale-[0.98] ${
                                    isNext ? 'border-red-500/80 bg-[#2a0a0e]/80 shadow-[0_0_18px_rgba(255,40,60,.35),inset_0_0_14px_rgba(255,40,60,.15)]'
                                    : unlocked ? 'border-sky-400/60 bg-[#0a1630]/70 shadow-[0_0_12px_rgba(80,160,255,.2)]'
                                    : 'border-white/10 bg-black/50 text-white/35'
                                }`} onClick={() => start(e.id)}>
                                <span className="min-w-0">
                                    <span className="block text-base font-bold tracking-wider">{e.label}</span>
                                    <span className="block text-[11px] text-white/60">{e.subtitle}</span>
                                    {!unlocked && <span className="mt-1 block text-[11px] text-white/35">Watch {firstRequired?.label ?? 'the earlier tapes'} first</span>}
                                </span>
                                <span className={`shrink-0 text-[11px] font-bold tracking-widest ${isNext ? 'text-red-300' : unlocked ? 'text-sky-200' : ''}`}>{done ? 'REPLAY' : unlocked ? (isNext ? '\u25B6 PLAY' : 'PLAY') : 'LOCKED'}</span>
                            </button>
                        );
                    })}
                </div>
                <MenuExtras />
                <label className="mt-1 flex min-h-12 w-full max-w-sm items-center gap-3 text-xs text-white/70">
                    <input type="checkbox" className="h-5 w-5 accent-red-500" checked={continuous} onChange={(e) => {
                        store.patch({ continuous: e.target.checked });
                        saveProgress();
                        track('menu_continuous_toggled', { on: e.target.checked });
                    }} /> Continue automatically to the next unlocked day
                </label>
                <p className="max-w-xs text-center text-[10px] text-white/35">Cinematic playback. Drag to look around. Headphones recommended.</p>
            </div>
        </div>
    );
}
