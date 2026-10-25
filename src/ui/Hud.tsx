/**
 * Bodycam HUD: REC light + timecode, subtitles, title cards, pause/menu.
 * Overlay is pointer-events-none so drags reach the camera; buttons opt in.
 */
import { useEffect, useState } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { clipsAvailable, startClip, stopClip, haptic } from '../sdk/platform.ts';
import { store, useStore, saveProgress } from '../state/store.ts';
import { EPISODES } from '../cinema/engine.ts';
import { canStartEpisode } from '../story/progression.ts';
import TapeReturnButton from './TapeReturnButton.tsx';
import RoamControls from './RoamControls.tsx';
import { journey } from '../journey/journey.ts';

function track(name: string, props: Record<string, unknown> = {}) {
    try {
        RundotGameAPI.analytics.recordCustomEvent(name, props);
    } catch { /* analytics unavailable */ }
}

const journey_label = () => (store.get().journey ? 'Quit to main menu' : 'Episode select');

export default function Hud() {
    const paused = useStore((s) => s.paused);
    const subtitle = useStore((s) => s.subtitle);
    const subtitlesOn = useStore((s) => s.subtitlesOn);
    const title = useStore((s) => s.title);
    const timecode = useStore((s) => s.timecode);
    const episode = useStore((s) => s.episode);
    const ended = useStore((s) => s.ended);
    const reducedMotion = useStore((s) => s.reducedMotion);
    const completed = useStore((s) => s.completed);
    const tapeSession = useStore((s) => s.tapeSession);
    const tapeFinished = useStore((s) => s.tapeFinished);
    const recording = useStore((s) => s.recording);
    const haptics = useStore((s) => s.haptics);
    const [canClip, setCanClip] = useState(false);
    useEffect(() => {
        let live = true;
        void clipsAvailable().then((ok) => { if (live) setCanClip(ok); });
        return () => { live = false; };
    }, []);
    const chapter = EPISODES.find((e) => e.id === episode);
    const next = EPISODES[EPISODES.findIndex((e) => e.id === episode) + 1];
    const nextUnlocked = next && canStartEpisode(next.id, completed);

    return (
        <div className="pointer-events-none absolute inset-0 pt-safe-top font-mono text-white">
            <div className="flex items-start justify-between p-4">
                <div className="text-lg font-bold tracking-widest" style={{ textShadow: '0 0 6px #000' }}>
                    <span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-red-600" />
                    REC <span className="ml-2 tabular-nums">{timecode}</span>
                </div>
                <div className="pointer-events-auto flex gap-2">
                    {canClip && (
                        <button
                            type="button"
                            aria-pressed={recording}
                            className="rounded-lg bg-black/50 px-3 py-2 text-sm font-bold active:scale-95"
                            onClick={() => { haptic('light'); void (recording ? stopClip() : startClip()); }}
                        >
                            {recording ? '■ SAVE' : '● CLIP'}
                        </button>
                    )}
                    <button
                        type="button"
                        className="rounded-lg bg-black/50 px-3 py-2 text-sm font-bold active:scale-95"
                        onClick={() => {
                            store.patch({ subtitlesOn: !subtitlesOn });
                            saveProgress();
                            track('hud_subtitles_toggled', { on: !subtitlesOn });
                        }}
                    >
                        CC {subtitlesOn ? 'ON' : 'OFF'}
                    </button>
                    <button
                        type="button"
                        className="rounded-lg bg-black/50 px-3 py-2 text-sm font-bold active:scale-95"
                        onClick={() => {
                            track(paused ? 'hud_resumed' : 'hud_paused', { episode });
                            store.patch({ paused: !paused });
                        }}
                    >
                        {paused ? '▶' : '❚❚'}
                    </button>
                </div>
            </div>

            <RoamControls />

            {subtitlesOn && subtitle && (
                <div className="absolute inset-x-0 bottom-16 flex justify-center px-6">
                    <p
                        className="max-w-md rounded bg-black/60 px-3 py-2 text-center text-base"
                        style={{ textShadow: '0 0 4px #000' }}
                    >
                        {subtitle}
                    </p>
                </div>
            )}

            {title && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <h2 className="max-w-full break-words px-5 text-center font-bold text-white" style={{ fontSize: 'clamp(1.1rem, 5vw, 2.5rem)', letterSpacing: '0.08em', textShadow: '0 2px 8px #000' }}>
                        {title}
                    </h2>
                </div>
            )}

            {ended && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-8 text-center">
                    <p className="text-xl tracking-widest">{tapeSession ? `TAPE ${tapeSession.tapeDay} COMPLETE` : `${chapter?.label.toUpperCase() ?? 'RECORDING'} COMPLETE`}</p>
                    {tapeSession ? (
                        <>
                            <p className="text-sm text-white/70">{tapeSession.tapeDay < 7 ? `The search continues on Day ${tapeSession.tapeDay + 1}.` : 'Return to the search for the final handoff.'}</p>
                            <TapeReturnButton finished={tapeFinished} />
                        </>
                    ) : <p className="text-sm text-white/60">{nextUnlocked ? next.label + ' is available.' : 'Returning to episode select.'}</p>}
                </div>
            )}

            {paused && (
                <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
                    <p className="text-2xl font-bold tracking-widest">PAUSED</p>
                    {tapeSession && <TapeReturnButton finished={tapeFinished} />}
                    <>
                        <button
                            type="button"
                            aria-pressed={reducedMotion}
                            className="min-h-12 rounded-xl border border-white/40 px-6 py-3 text-sm font-bold active:scale-95"
                            onClick={() => {
                                store.patch({ reducedMotion: !reducedMotion });
                                saveProgress();
                                track('settings_reduced_motion_toggled', { on: !reducedMotion });
                            }}
                        >
                            Reduced motion: {reducedMotion ? 'ON' : 'OFF'}
                            <span className="mt-1 block text-xs font-normal text-white/70">Reduces bob, camera shake and sudden zooms</span>
                        </button>
                    </>
                    <button
                        type="button"
                        aria-pressed={haptics}
                        className="min-h-12 rounded-xl border border-white/40 px-6 py-3 text-sm font-bold active:scale-95"
                        onClick={() => {
                            store.patch({ haptics: !haptics });
                            saveProgress();
                            haptic('light', 0);
                            track('settings_haptics_toggled', { on: !haptics });
                        }}
                    >
                        Haptics: {haptics ? 'ON' : 'OFF'}
                    </button>
                    <button
                        type="button"
                        className="rounded-xl bg-white px-8 py-3 font-bold text-black active:scale-95"
                        onClick={() => {
                            track('hud_resumed', { episode });
                            store.patch({ paused: false });
                        }}
                    >
                        Resume
                    </button>
                    <button
                        type="button"
                        className="rounded-xl border border-white/40 px-8 py-3 font-bold active:scale-95"
                        onClick={() => {
                            track('hud_exit_to_menu', { episode });
                            if (store.get().journey) { store.patch({ paused: false }); journey.exit(); return; }
                            store.patch({ paused: false, phase: 'archive', ended: false });
                        }}
                    >
                        {journey_label()}
                    </button>
                </div>
            )}
        </div>
    );
}
