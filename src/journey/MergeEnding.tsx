/** The last scene: both games on one screen, then one. See mergeScene.ts. */
import { useEffect, useRef } from 'react';
import { MergeScene } from './mergeScene.ts';
import RoamControls from '../ui/RoamControls.tsx';

export default function MergeEnding({ onDone }: { onDone: () => void }) {
    const host = useRef<HTMLDivElement>(null);
    const done = useRef(onDone);
    done.current = onDone;
    useEffect(() => {
        const scene = new MergeScene(host.current!, () => done.current());
        return () => scene.dispose();
    }, []);
    return (
        <div className="absolute inset-0 bg-black">
            <div ref={host} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-0 z-[5]"><RoamControls /></div>
        </div>
    );
}
