/** Episode select: each chapter requires every preceding chapter to be completed. */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { store, useStore, saveProgress } from '../state/store.ts';
import { EPISODES } from '../cinema/engine.ts';
import { canStartEpisode, nextEpisode, hospitalUnlocked } from '../story/progression.ts';
import MenuExtras from './MenuExtras.tsx';
import { haptic } from '../sdk/platform.ts';

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
    return (
        <div className="flex h-full flex-col items-center gap-4 overflow-y-auto px-6 py-10 font-mono">
            <h1 className="mt-4 text-4xl font-bold tracking-[0.3em] text-red-500" style={{ textShadow: '2px 0 #0ff' }}>SEVEN DAYS</h1>
            <p className="text-center text-xs tracking-widest text-white/50">FOUND FOOTAGE — WATCH UNTIL THE END</p>
            <p className="max-w-sm text-center text-sm text-white/70">All seven days are available. Day One enters the abandoned Hollowmere Galleria.</p>
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
            <div className="mt-2 flex w-full max-w-sm flex-col gap-2">
                {EPISODES.filter((e) => e.id !== 'hospitalFatal').map((e) => {
                    const unlocked = !!e.build && canStartEpisode(e.id, completed);
                    const done = unlocked && completed.includes(e.id);
                    const firstRequired = EPISODES.find((entry) => !completed.includes(entry.id));
                    return (
                        <button key={e.id} type="button" disabled={!unlocked}
                            aria-label={`${e.label}: ${unlocked ? done ? 'Replay' : 'Available' : 'Locked'}`}
                            className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${
                                unlocked ? e.id === next ? 'border-red-400/60 bg-red-950/40' : 'border-white/15 bg-white/10' : 'border-white/10 bg-white/5 text-white/40'
                            }`} onClick={() => start(e.id)}>
                            <span>
                                <span className="block text-lg font-bold">{e.label}</span>
                                <span className="block text-xs">{e.subtitle}</span>
                                {!unlocked && <span className="mt-1 block text-xs">Complete {firstRequired?.label ?? 'the earlier chapters'} first</span>}
                            </span>
                            <span className="text-xs">{done ? 'REPLAY' : unlocked ? 'PLAY' : 'LOCKED'}</span>
                        </button>
                    );
                })}
            </div>
            <MenuExtras />
            <label className="mt-2 flex min-h-12 items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={continuous} onChange={(e) => {
                    store.patch({ continuous: e.target.checked });
                    saveProgress();
                    track('menu_continuous_toggled', { on: e.target.checked });
                }} /> Continue automatically to the next unlocked day
            </label>
            <p className="text-center text-xs text-white/40">Cinematic playback · Drag to look around · Headphones recommended</p>
        </div>
    );
}
