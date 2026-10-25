import { useState } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { returnToSearch } from '../story/tapeNavigation.ts';

/** Remains on this screen with a retry if navigation/save fails. */
export default function TapeReturnButton({ finished }: { finished: boolean }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    return (
        <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3 px-4">
            <button type="button" disabled={busy}
                className="min-h-14 w-full rounded-xl border border-teal-200/60 bg-teal-950 px-5 py-4 text-base font-bold disabled:opacity-60"
                onClick={async () => {
                    RundotGameAPI.analytics.recordCustomEvent('tape_return_clicked', { tape_complete: finished });
                    setBusy(true); setError('');
                    try { await returnToSearch(); }
                    catch (reason) {
                        setError(reason instanceof Error ? reason.message : 'Could not return to the search. Please try again.');
                    } finally { setBusy(false); }
                }}>
                {busy ? 'Opening search…' : finished ? 'Return to the search' : 'Return without finishing the tape'}
            </button>
            {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
        </div>
    );
}
