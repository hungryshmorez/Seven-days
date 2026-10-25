/**
 * Screen router. One phase visible at a time; the 'playing' phase stacks the
 * React HUD above the Pixi canvas.
 *
 * #app-frame (styled in styles/app.css) is the device frame: a centered
 * portrait column that fills phones edge-to-edge and letterboxes on desktop.
 * Everything — canvas and DOM UI — lives inside it, so they always align.
 */
import { useStore } from '../state/store.ts';
import LoadingScreen from './LoadingScreen.tsx';
import MainMenu from './MainMenu.tsx';
import Hud from './Hud.tsx';
import GameCanvas from '../game/GameCanvas.tsx';
import JourneyRoot from '../journey/JourneyRoot.tsx';
import JourneyMenu from '../journey/JourneyMenu.tsx';

export default function App() {
    const phase = useStore((s) => s.phase);
    if (phase === 'journey') return <JourneyRoot />;
    return (
        <div id="app-frame" className="bg-surface text-white">
            {phase === 'loading' && <LoadingScreen />}
            {phase === 'menu' && <JourneyMenu />}
            {phase === 'archive' && <MainMenu />}
            {phase === 'playing' && (
                <div className="absolute inset-0">
                    <GameCanvas />
                    <Hud />
                </div>
            )}
        </div>
    );
}
