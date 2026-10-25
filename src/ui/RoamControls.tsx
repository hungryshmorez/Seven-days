/** On-screen walk stick and USE button for the roam / VCR-room stretches. Keyboard (WASD, Shift, E) works as well. */
import { useRef } from 'react';
import { store, useStore } from '../state/store.ts';

export default function RoamControls() {
    const roam = useStore((s) => s.roam);
    const useLabel = useStore((s) => s.useLabel);
    const knob = useRef<HTMLDivElement>(null);
    const base = useRef<HTMLDivElement>(null);
    if (!roam) return null;
    const move = (e: React.PointerEvent) => {
        const r = base.current!.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let x = (e.clientX - cx) / (r.width / 2), y = (e.clientY - cy) / (r.height / 2);
        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        if (knob.current) knob.current.style.transform = `translate(${x * 34}px,${y * 34}px)`;
        store.patch({ moveStick: { x, y } });
    };
    const end = () => {
        if (knob.current) knob.current.style.transform = 'translate(0,0)';
        store.patch({ moveStick: undefined });
    };
    return (
        <>
            <div
                ref={base}
                className="pointer-events-auto absolute bottom-24 left-6 h-28 w-28 touch-none select-none rounded-full border border-white/30 bg-white/5"
                onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e); }}
                onPointerMove={(e) => { if (e.buttons) move(e); }}
                onPointerUp={end}
                onPointerCancel={end}
            >
                <div ref={knob} className="pointer-events-none absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full bg-white/25" />
            </div>
            {useLabel && (
                <button
                    type="button"
                    className="pointer-events-auto absolute bottom-28 right-6 max-w-[48%] rounded-xl border border-white/50 bg-black/60 px-4 py-3 text-sm font-bold active:scale-95"
                    onClick={() => window.dispatchEvent(new Event('sd-use'))}
                >
                    <span className="mr-2 rounded bg-white px-1.5 py-0.5 text-black">E</span>{useLabel}
                </button>
            )}
        </>
    );
}
