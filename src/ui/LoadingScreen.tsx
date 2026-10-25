/**
 * Loading screen shown while warmAssets() runs. Rendered by React, revealed
 * when the boot cover lifts, driven by store.loadProgress.
 */
import { useStore } from '../state/store.ts';
import menuBg from '../assets/menu-bg.jpg';

export default function LoadingScreen() {
    const progress = useStore((s) => s.loadProgress);
    const pct = Math.round(progress * 100);
    return (
        <div className="relative flex h-full flex-col items-center justify-end gap-3 overflow-hidden bg-black px-10 pb-10">
            <img src={menuBg} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl" draggable={false} />
            <div className="absolute inset-x-0 top-0 bottom-40 flex items-center justify-center overflow-hidden"><img src={menuBg} alt="SEVEN DAYS" className="w-[125%] max-w-none shrink-0" draggable={false} /></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div
                className="relative h-3 w-full max-w-xs overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="relative text-sm text-white/60">Loading… {pct}%</p>
        </div>
    );
}
