/** React owns episode selection; CinemaEngine owns the only render loop. */
import { useEffect, useRef } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { CinemaEngine, EPISODES, PULSE_EPISODE } from '../cinema/engine.ts';
import { canStartEpisode } from '../story/progression.ts';
import { store, useStore, saveProgress } from '../state/store.ts';
import { tapeEpisode } from '../story/tapeLink.ts';

// Lifecycle analytics: registered exactly once at module scope.
try {
    RundotGameAPI.lifecycles.onPause(() => RundotGameAPI.analytics.recordCustomEvent('game_paused'));
    RundotGameAPI.lifecycles.onResume(() => RundotGameAPI.analytics.recordCustomEvent('game_resumed'));
    RundotGameAPI.lifecycles.onSleep(() => RundotGameAPI.analytics.recordCustomEvent('game_sleep'));
    RundotGameAPI.lifecycles.onQuit(() => RundotGameAPI.analytics.recordCustomEvent('game_quit'));
} catch { /* standalone preview without host lifecycle support */ }

function track(name: string, props: Record<string, unknown>) {
    try { RundotGameAPI.analytics.recordCustomEvent(name, props); } catch { /* standalone host unavailable */ }
}

export default function GameCanvas() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const episodeId = useStore((s) => s.episode);
    useEffect(() => {
        const isPulse = episodeId === 'pulse';
        const def = isPulse ? PULSE_EPISODE : EPISODES.find((e) => e.id === episodeId && e.build);
        // First-cycle hospital: fatal, no completion. The true ending is second-cycle only.
        const fatalFirstCycle = episodeId === 'hospital' && store.get().loopCount === 0;
        const playDef = fatalFirstCycle ? EPISODES.find((e) => e.id === 'hospitalFatal')! : def;
        if (!def || !hostRef.current || (!isPulse && !canStartEpisode(episodeId, store.get().completed))) {
            track('episode_access_blocked', { episode: episodeId });
            store.patch({ phase: 'archive', playbackError: 'Complete the earlier chapters before starting this day.' });
            return;
        }
        // A completed linked tape reloads to its return screen, never to an auto-replay.
        if (store.get().tapeSession && store.get().tapeFinished
            && tapeEpisode(store.get().tapeSession!) === episodeId) return;
        let engine: CinemaEngine | null = null;
        let returnTimer: number | undefined;
        const fail = (error: unknown) => {
            console.warn('[Cinema] episode playback failed', episodeId, error);
            if (returnTimer !== undefined) window.clearTimeout(returnTimer);
            track('episode_load_failed', { episode: episodeId });
            store.patch({ phase: 'archive', paused: false, ended: false,
                playbackError: `${def.label} couldn't finish loading or playing. Your completed chapters are kept; select it to try again.` });
        };
        try {
            engine = new CinemaEngine(hostRef.current, playDef ?? def!, (id) => {
                if (id === 'pulse') {
                    if (episodeId === 'pulse') {
                        // The pulse epilogue itself has ended: return to the menu, progress untouched.
                        store.patch({ ended: true });
                        returnTimer = window.setTimeout(() => store.patch({ phase: 'archive', ended: false, paused: false, pulseTriggered: false }), 3500);
                    } else {
                        // Prologue handed off to the hidden pulse epilogue.
                        store.patch({ episode: 'pulse', ended: false, title: '', subtitle: '' });
                    }
                    return;
                }
                const visit = store.get().tapeSession;
                if (visit && tapeEpisode(visit) === id) {
                    store.patch({ tapeFinished: true, ended: true });
                    saveProgress();
                    track('tape_playback_completed', { tape_day: visit.tapeDay, request_id: visit.requestId });
                    // Linked playback is exactly one recording, never the next cinematic.
                    return;
                }
                if (id === 'hospitalFatal') {
                    // First-cycle hospital death: back to the menu, nothing completed.
                    store.patch({ ended: true });
                    returnTimer = window.setTimeout(() => store.patch({ phase: 'archive', ended: false, paused: false }), 3500);
                    return;
                }
                const index = EPISODES.findIndex((e) => e.id === id);
                const next = EPISODES[index + 1];
                if (store.get().continuous && next?.build && canStartEpisode(next.id, store.get().completed)) {
                    store.patch({ episode: next.id, ended: false, title: '', subtitle: '' });
                } else {
                    store.patch({ ended: true });
                    returnTimer = window.setTimeout(() => store.patch({ phase: 'archive', ended: false, paused: false }), 3500);
                }
            }, fail);
        } catch (error) {
            fail(error);
        }
        return () => {
            if (returnTimer !== undefined) window.clearTimeout(returnTimer);
            engine?.dispose();
        };
    }, [episodeId]);

    return <div ref={hostRef} className="absolute inset-0 bg-black" />;
}
