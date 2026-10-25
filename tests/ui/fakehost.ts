// A fake RUN host for UI testing: real behaviour for the APIs the new features use, harmless no-ops for everything else.
import base, { cfg } from '../platform/fakes.ts';
cfg.liveops.values = { menuBanner: 'Day Seven is now recording.', interstitialsEnabled: false, reminderDelayHours: 22 };
const universal = (): any => new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? undefined : universal()),
  apply: () => Promise.resolve(undefined),
});
const api: any = new Proxy(base as any, {
  get(t, k: string) {
    if (k in t) return t[k];
    if (k === 'initializeAsync') return () => Promise.resolve();
    if (k === 'lifecycles') return new Proxy({}, { get: () => () => ({ unsubscribe() {} }) });
    return universal();
  },
});
(window as any).__fakeCalls = (await import('../platform/fakes.ts')).calls;
export default api;
