// Fake RUN host + fake store/runSdk used to exercise src/sdk/platform.ts in Node.
export const calls: { name: string; args: unknown[] }[] = [];
export const cfg = { ready: true, isWeb: false, failAll: false, notificationsEnabled: true, liked: false, likeAvailable: true, interstitialReady: true,
  liveops: { values: {} as Record<string, unknown>, assignments: [] as { experimentId: string; variantId: string }[] }, clipsCanRecord: true,
  localResult: { channel: 'local', status: 'scheduled', id: 'n1' } as Record<string, unknown> };
const mem = new Map<string, string>();
function rec<T>(name: string, value: T) {
  return (...args: unknown[]): Promise<T> => { calls.push({ name, args }); return cfg.failAll ? Promise.reject(new Error('boom:' + name)) : Promise.resolve(value); };
}
export const storeState: any = { haptics: true, recording: false, episode: 'day1', completed: [], loopCount: 0, liveops: { menuBanner: '', interstitialsEnabled: false, reminderDelayHours: 22 } };
export const store = { get: () => storeState, patch: (p: any) => Object.assign(storeState, p) };
export const sdkReady = () => cfg.ready;
export const reset = () => { calls.length = 0; mem.clear(); Object.assign(cfg, { ready: true, isWeb: false, failAll: false, notificationsEnabled: true, liked: false, likeAvailable: true, interstitialReady: true, clipsCanRecord: true, localResult: { channel: 'local', status: 'scheduled', id: 'n1' } }); cfg.liveops = { values: {}, assignments: [] }; Object.assign(storeState, { haptics: true, recording: false, liveops: { menuBanner: '', interstitialsEnabled: false, reminderDelayHours: 22 } }); };
export const cloud = { data: new Map<string, string>(), failGet: false, failSet: false };
export const device = { data: new Map<string, string>(), failSet: false };
const api = {
  appStorage: { getItem: (k: string) => { calls.push({ name: 'app.get', args: [k] }); return cloud.failGet ? Promise.reject(new Error('cloud down')) : Promise.resolve(cloud.data.get(k) ?? null); },
    setItem: (k: string, v: string) => { calls.push({ name: 'app.set', args: [k, v] }); if (cloud.failSet) return Promise.reject(Object.assign(new Error('rate'), { code: 'RATE_LIMITED' })); cloud.data.set(k, v); return Promise.resolve(); } },
  analytics: { recordCustomEvent: rec('analytics.event', undefined), trackFunnelStep: rec('analytics.funnel', undefined) },
  popups: { showToast: rec('popups.toast', true), canShowCommentsPanel: rec('popups.canComments', { available: true }), showCommentsPanel: rec('popups.comments', { shown: true, dismissed: false }),
    canShowLikeDialog: (...a: unknown[]) => rec('popups.canLike', { available: cfg.likeAvailable })(...a), getLikeState: (...a: unknown[]) => rec('popups.likeState', { isLiked: cfg.liked, likesCount: 3 })(...a), showLikeDialog: rec('popups.like', { shown: true, dismissed: false, liked: true }) },
  triggerHapticAsync: rec('haptic', undefined),
  system: { isWeb: () => cfg.isWeb, canAddToHomeScreen: rec('system.canPin', true), addToHomeScreen: rec('system.pin', { added: true }) },
  deviceCache: { getItem: (k: string) => { calls.push({ name: 'dc.get', args: [k] }); return cfg.failAll ? Promise.reject(new Error('boom')) : Promise.resolve(mem.get(k) ?? null); },
    setItem: (k: string, v: string) => { calls.push({ name: 'dc.set', args: [k, v] }); if (cfg.failAll) return Promise.reject(new Error('boom')); mem.set(k, v); return Promise.resolve(); },
    removeItem: (k: string) => { calls.push({ name: 'dc.remove', args: [k] }); mem.delete(k); return Promise.resolve(); } },
  notifications: { isLocalNotificationsEnabled: (...a: unknown[]) => rec('notif.enabled', cfg.notificationsEnabled)(...a), setLocalNotificationsEnabled: rec('notif.setEnabled', true), cancelNotification: rec('notif.cancel', true),
    submitMessageAsync: (...a: unknown[]) => rec('notif.submit', { messageId: 'm', results: [cfg.localResult] })(...a) },
  social: { shareLinkAsync: rec('social.share', { shareUrl: 'https://w.run/s/x', shareLinkId: 'x' }) },
  app: { resolveLaunchIntent: (...a: unknown[]) => rec('app.intent', (cfg as any).intent ?? { kind: 'none' })(...a) },
  clips: { isSupportedAsync: (...a: unknown[]) => rec('clips.supported', { canRecord: cfg.clipsCanRecord, canUseMicrophone: false, canUseCamera: false })(...a), useGameAudio: (...a: unknown[]) => { calls.push({ name: 'clips.audio', args: a }); },
    startRecordingAsync: rec('clips.start', undefined), captureFrame: (...a: unknown[]) => { calls.push({ name: 'clips.frame', args: a }); }, stopRecordingAsync: rec('clips.stop', { ugc: { id: 'u' } }), cancelRecordingAsync: rec('clips.cancel', undefined) },
  stats: { submit: rec('stats.submit', { grants: [] }) },
  leaderboard: { submitScore: rec('lb.submit', { accepted: true, rank: 4 }), getPagedScores: rec('lb.page', { entries: [{ rank: 1, username: 'a', score: 9 }, { rank: null, username: 'b', score: 5 }], totalEntries: 2 }), getMyRank: rec('lb.rank', { rank: 2, score: 5, totalPlayers: 2 }) },
  liveops: { getConfigAsync: (...a: unknown[]) => rec('liveops.get', { values: cfg.liveops.values, assignments: cfg.liveops.assignments, activeOverrideIds: [], configVersion: '1', nextChangeAt: null })(...a) },
  ads: { isInterstitialAdReadyAsync: (...a: unknown[]) => rec('ads.ready', cfg.interstitialReady)(...a), showInterstitialAd: rec('ads.show', true) },
  getProfile: () => ({ id: 'p', username: 'tester', isAnonymous: false }),
};
export default api;
