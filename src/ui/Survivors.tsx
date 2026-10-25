/** "Survivors" leaderboard panel: top 10 plus the player's own rank. Only live inside the RUN app. */
import { useEffect, useState } from 'react';
import { loadSurvivors, type SurvivorBoard } from '../sdk/platform.ts';

export default function Survivors({ onClose }: { onClose: () => void }) {
    const [board, setBoard] = useState<SurvivorBoard | null | undefined>(undefined);
    useEffect(() => {
        let live = true;
        void loadSurvivors().then((b) => { if (live) setBoard(b); });
        return () => { live = false; };
    }, []);
    return (
        <div role="dialog" aria-modal="true" aria-label="Survivors"
            className="absolute inset-0 z-20 flex flex-col items-center gap-3 overflow-y-auto bg-black/90 px-6 py-10 font-mono">
            <h2 className="text-2xl font-bold tracking-[0.3em] text-red-500">SURVIVORS</h2>
            <p className="text-center text-xs text-white/50">Chapters completed. The true ending counts ten.</p>
            {board === undefined && <p className="text-sm text-white/60">Loading…</p>}
            {board === null && <p className="max-w-sm text-center text-sm text-white/60">The survivors list is only available inside the RUN app.</p>}
            {board && (
                <div className="w-full max-w-sm">
                    {board.rows.length === 0 && <p className="text-center text-sm text-white/60">No survivors yet.</p>}
                    <ol className="flex flex-col gap-1">
                        {board.rows.map((r) => (
                            <li key={`${r.rank}-${r.username}`} className="flex justify-between rounded bg-white/10 px-3 py-2 text-sm">
                                <span>{r.rank}. {r.username}</span><span className="tabular-nums">{r.score}</span>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-3 text-center text-xs text-white/60">
                        {board.myRank !== null ? `You are ${board.myRank} of ${board.total}.` : 'Finish a chapter to be ranked.'}
                    </p>
                </div>
            )}
            <button type="button" className="mt-2 min-h-12 rounded-xl border border-white/40 px-8 py-3 font-bold active:scale-95" onClick={onClose}>Close</button>
        </div>
    );
}
