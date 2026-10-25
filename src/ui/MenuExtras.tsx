/**
 * Platform-powered extras for the episode-select menu: operator name, LiveOps
 * banner, share / survivors / comments / pin buttons, reminder + haptics
 * toggles, and the post-chapter prompts. Every control hides itself when the
 * host can't do it (e.g. in a plain browser), so the menu degrades to the
 * original layout.
 */
import { useEffect, useState } from 'react';
import { store, useStore, saveProgress } from '../state/store.ts';
import * as platform from '../sdk/platform.ts';
import { sdkReady } from '../sdk/runSdk.ts';
import Survivors from './Survivors.tsx';

const BTN = 'min-h-12 rounded-lg border border-white/40 px-3 py-2 text-sm font-bold active:scale-95';

export default function MenuExtras() {
    const haptics = useStore((s) => s.haptics);
    const banner = useStore((s) => s.liveops.menuBanner);
    const completed = useStore((s) => s.completed);
    const [caps, setCaps] = useState({ reminders: false, comments: false, pin: false });
    const [remindersOn, setRemindersOn] = useState(false);
    const [showBoard, setShowBoard] = useState(false);
    const operator = platform.operatorName();
    // Off the RUN host (plain browser / GitHub preview) none of these features exist, so render nothing extra.
    const onHost = sdkReady();

    // Ask the host what it can do once; hide whatever it can't.
    useEffect(() => {
        let live = true;
        void (async () => {
            const [reminders, comments, pin, on] = await Promise.all([
                platform.remindersAvailable(), platform.canShowComments(), platform.canPinToHomeScreen(), platform.getRemindersEnabled(),
            ]);
            if (live) { setCaps({ reminders, comments, pin }); setRemindersOn(on); }
        })();
        return () => { live = false; };
    }, []);

    // Back at the menu after a chapter: optional break interstitial (off unless LiveOps enables it),
    // otherwise a one-time like prompt once Day Seven has been finished.
    useEffect(() => {
        const s = store.get();
        const interstitial = s.pendingBreak && s.liveops.interstitialsEnabled;
        if (s.pendingBreak) store.patch({ pendingBreak: false });
        if (interstitial) { void platform.maybeInterstitial(); return; }
        if (s.completed.includes('day7')) {
            const t = window.setTimeout(() => { void platform.maybePromptLike(); }, 1500);
            return () => window.clearTimeout(t);
        }
    }, []);

    const next = completed.length > 0 ? `${completed.length} chapter${completed.length === 1 ? '' : 's'} survived` : 'Begin with the Prologue';

    if (!onHost) return null;

    return (
        <>
            {operator && <p className="text-center text-xs tracking-widest text-white/40">OPERATOR: {operator.toUpperCase()}</p>}
            {banner && <p role="status" className="w-full max-w-sm rounded-lg border border-red-400/40 bg-red-950/30 p-3 text-center text-sm">{banner}</p>}
            <div className="flex w-full max-w-sm flex-wrap justify-center gap-2">
                <button type="button" className={BTN} onClick={() => { platform.haptic('light'); void platform.shareGame(next); }}>SHARE</button>
                <button type="button" className={BTN} onClick={() => { platform.haptic('light'); platform.track('survivors_opened'); setShowBoard(true); }}>SURVIVORS</button>
                {caps.comments && <button type="button" className={BTN} onClick={() => { void platform.showComments(); }}>COMMENTS</button>}
                {caps.pin && <button type="button" className={BTN} onClick={() => { void platform.pinToHomeScreen(); }}>ADD TO HOME SCREEN</button>}
            </div>
            <div className="flex w-full max-w-sm flex-col gap-1">
                <label className="flex min-h-12 items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={haptics} onChange={(e) => {
                        store.patch({ haptics: e.target.checked });
                        saveProgress();
                        platform.haptic('light', 0);
                        platform.track('menu_haptics_toggled', { on: e.target.checked });
                    }} /> Haptic feedback
                </label>
                {caps.reminders && (
                    <label className="flex min-h-12 items-center gap-3 text-sm">
                        <input type="checkbox" className="h-5 w-5" checked={remindersOn} onChange={(e) => {
                            const on = e.target.checked;
                            setRemindersOn(on);
                            platform.track('menu_reminders_toggled', { on });
                            void platform.setRemindersEnabled(on).then((ok) => { if (!ok) setRemindersOn(!on); });
                        }} /> Remind me when the next tape is waiting
                    </label>
                )}
            </div>
            {showBoard && <Survivors onClose={() => setShowBoard(false)} />}
        </>
    );
}
