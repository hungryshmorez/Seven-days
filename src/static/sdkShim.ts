/**
 * Stand-in for the RUN.world SDK so the game runs on any static host (GitHub Pages, Netlify, itch.io, a plain folder).
 * Saves go to localStorage; everything else the host would provide (ads, leaderboards, clips, push, share) is a quiet no-op.
 * Used only by `npm run build:static` (see vite.static.config.mjs). The real RUN.world build does not import this.
 */
const ls = (): Storage | null => { try { return window.localStorage; } catch { return null; } };
const mem = new Map<string, string>();
const store = {
    getItem: async (k: string): Promise<string | null> => { const s = ls(); try { return (s ? s.getItem('sd:' + k) : null) ?? mem.get(k) ?? null; } catch { return mem.get(k) ?? null; } },
    setItem: async (k: string, v: string): Promise<void> => { mem.set(k, v); try { ls()?.setItem('sd:' + k, v); } catch { /* storage full or blocked */ } },
    removeItem: async (k: string): Promise<void> => { mem.delete(k); try { ls()?.removeItem('sd:' + k); } catch { /* ignore */ } },
};
const noop = (): any => new Proxy(function () { /* no-op */ }, {
    get: (_t, k) => (k === 'then' ? undefined : noop()),
    apply: () => Promise.resolve(undefined),
});
const overrides: Record<string, unknown> = {
    initializeAsync: () => Promise.resolve(),
    deviceCache: store,
    appStorage: store,
    storage: store,
    getProfile: () => ({ id: 'local', username: 'Player', isAnonymous: true }),
    system: new Proxy({ isWeb: () => true, canAddToHomeScreen: () => false }, { get: (t: any, k) => (k in t ? t[k] : noop()) }),
    lifecycles: new Proxy({}, { get: () => () => ({ unsubscribe() { /* none */ } }) }),
    ads: { isInterstitialAdReadyAsync: () => Promise.resolve(false), showInterstitialAd: () => Promise.resolve(false) },
    analytics: { recordCustomEvent: () => undefined, trackFunnelStep: () => undefined },
    liveops: { getConfigAsync: () => Promise.resolve({}) },
    app: { resolveLaunchIntent: () => Promise.resolve(null) },
    clips: { isSupportedAsync: () => Promise.resolve(false) },
    notifications: { isLocalNotificationsEnabled: () => Promise.resolve(false) },
    popups: { canShowCommentsPanel: () => false, canShowLikeDialog: () => false },
    triggerHapticAsync: () => Promise.resolve(),
};
const api: any = new Proxy({}, { get: (_t, k: string) => (k in overrides ? overrides[k] : noop()) });
export default api;
