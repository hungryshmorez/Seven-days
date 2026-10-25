import React from 'react';
import { createRoot } from 'react-dom/client';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import App from './ui/App.tsx';
import { store, hydrateProgress, saveProgress, flushProgress } from './state/store.ts';
import { initSdk, registerLifecycles, sdkReady } from './sdk/runSdk.ts';
import { initPlatform } from './sdk/platform.ts';
import { warmAssets } from './assets/preload.ts';
import { startIncomingTape } from './story/tapeNavigation.ts';
import { journey } from './journey/journey.ts';
import './styles/app.css';

/**
 * Boot sequence. The ORDER here matters — it's the pattern production RUN
 * games use. Keep the numbered steps in this order; add your own work at the
 * marked points.
 */
async function boot() {
    // 1. SDK first. Nothing may call RundotGameAPI before this resolves.
    //    Resolves even if init fails (local dev outside the RUN host).
    await initSdk();

    // 2. ADAPT: load persisted progress (RundotGameAPI.storage) before first
    //    render, so the first screen can reflect real progress instead of
    //    popping in after a beat. If the game is localized, restore the
    //    language here too — before any UI renders.
    await hydrateProgress();
    await journey.init();

    // 3. Mount React. `phase` starts at 'loading', so this paints the
    //    loading screen (progress bar at 0%).
    createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    // 4. Lift the boot cover once the loading screen has actually painted
    //    (double-rAF = after the next rendered frame). Asset warming continues
    //    behind it — the player watches the progress bar, not a black screen.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const cover = document.getElementById('boot-cover');
            if (!cover) return;
            cover.classList.add('hidden');
            setTimeout(() => cover.remove(), 400); // matches the CSS transition
        });
    });

    // 5. Warm all critical assets (see src/assets/manifest.ts). Deferred
    //    assets keep loading in the background after this resolves.
    await warmAssets((p) => store.patch({ loadProgress: p }));

    // 6. Loading done — hand over to the menu.
    if (!startIncomingTape()) store.patch({ phase: 'menu' });

    // 7. Host lifecycle hooks. Register AFTER boot so handlers never race
    //    half-initialized state.
    //    Rules: persist on onSleep, never rely on onQuit firing, and never
    //    fire fresh SDK RPCs (e.g. scheduling notifications) from
    //    onSleep/onQuit — a hard close kills the runtime before they land.
    registerLifecycles({
        onPause: () => {
            store.patch({ paused: true });
            saveProgress(); // SDK storage guidance: persist on pause AND sleep
        },
        onResume: () => store.patch({ paused: false }),
        onSleep: async () => {
            saveProgress();
            await flushProgress().catch(() => false);
        },
        onQuit: async () => {
            saveProgress();
            await flushProgress().catch(() => false);
        },
    });

    // 8. Post-boot, fire-and-forget work goes here — analytics boot event,
    //    server time refresh, notification re-arming, subscription status
    //    refresh. None of it should block or throw into this function.
    if (sdkReady()) {
        try {
            RundotGameAPI.analytics.recordCustomEvent('game_loaded');
            RundotGameAPI.analytics.trackFunnelStep(1, 'game_loaded', 'boot', 1);
        } catch (err) {
            console.warn('[Main] boot analytics failed', err);
        }
        // Remote config + launch intent (share link / reminder). Never blocks or throws.
        void initPlatform();
    }
}

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot);
