import * as p from '../../src/sdk/platform.ts';
import api, { calls, cfg, reset, storeState } from './fakes.ts';
import assert from 'assert';
const n = (name: string) => calls.filter((c) => c.name === name).length;
const last = (name: string) => calls.filter((c) => c.name === name).at(-1)?.args;
let passed = 0; const t = async (name: string, fn: () => Promise<void> | void) => { reset(); try { await fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n   ', (e as Error).message); process.exitCode = 1; } };

(async () => {
await t('off-host: every call is a silent fallback and touches no SDK method', async () => {
  cfg.ready = false;
  assert.strictEqual(await p.clipsAvailable(), false); assert.strictEqual(await p.remindersAvailable(), false);
  assert.strictEqual(await p.shareGame('x'), false); assert.strictEqual(await p.startClip(), false);
  assert.strictEqual(await p.loadSurvivors(), null); assert.deepStrictEqual(await p.loadLiveOps(), p.LIVEOPS_DEFAULTS);
  assert.strictEqual(p.operatorName(), ''); p.haptic('heavy'); p.track('x'); p.funnel(1, 'x'); p.clipFrame();
  await p.initPlatform(); await p.maybeInterstitial(); await p.maybePromptLike(); await p.scheduleTapeReminder({ title: 't', body: 'b', delayHours: 1 });
  await p.submitCampaignStats(1, 0, 'day1'); await p.submitSurvivalScore(1, 0, 60);
  assert.strictEqual(calls.length, 0, 'unexpected SDK calls: ' + JSON.stringify(calls.map(c => c.name)));
});
await t('haptics: throttled, honours the player setting, scares map to heavy/medium only', async () => {
  p.haptic('light'); p.haptic('light'); assert.strictEqual(n('haptic'), 1, 'second tap inside the gap must be dropped');
  reset(); storeState.haptics = false; p.haptic('heavy', 0); assert.strictEqual(n('haptic'), 0, 'setting off => no haptic');
  const gap = () => new Promise((r) => setTimeout(r, 450)); // throttle state is module-level by design
  await gap(); reset(); p.scareHaptic(0.2); assert.strictEqual(n('haptic'), 0, 'tiny glitch is silent');
  p.scareHaptic(0.5); assert.deepStrictEqual(last('haptic'), ['medium']);
  p.scareHaptic(0.9); assert.strictEqual(n('haptic'), 1, 'a second scare inside the 400ms gap is dropped');
  await gap(); p.scareHaptic(0.9); assert.deepStrictEqual(last('haptic'), ['heavy']);
});
await t('reminders: replaces the old one, clamps delay, stores the new id', async () => {
  (await import('./fakes.ts')).default.deviceCache.setItem('seven-days-reminder-id', 'old'); calls.length = 0;
  await p.scheduleTapeReminder({ title: 'T', body: 'B', delayHours: 22 });
  assert.deepStrictEqual(last('notif.cancel'), ['old']);
  const sub: any = last('notif.submit')![0]; assert.deepStrictEqual(sub.channels, ['local']); assert.strictEqual(sub.delaySeconds, 79200); assert.strictEqual(sub.collapseKey, 'seven-days-next-tape');
  assert.deepStrictEqual(last('dc.set'), ['seven-days-reminder-id', 'n1']);
  reset(); await p.scheduleTapeReminder({ title: 'T', body: 'B', delayHours: 9999 }); assert.strictEqual((last('notif.submit')![0] as any).delaySeconds, 604800, '7 day cap');
  reset(); await p.scheduleTapeReminder({ title: 'T', body: 'B', delayHours: 0 }); assert.strictEqual((last('notif.submit')![0] as any).delaySeconds, 60, 'floor of 60s');
});
await t('reminders: skipped on web, when disabled, and a skipped schedule stores no id', async () => {
  cfg.isWeb = true; await p.scheduleTapeReminder({ title: 'T', body: 'B', delayHours: 1 }); assert.strictEqual(n('notif.submit'), 0);
  reset(); cfg.notificationsEnabled = false; await p.scheduleTapeReminder({ title: 'T', body: 'B', delayHours: 1 }); assert.strictEqual(n('notif.submit'), 0);
  reset(); cfg.localResult = { channel: 'local', status: 'skipped', reason: 'permission_denied' }; await p.scheduleTapeReminder({ title: 'T', body: 'B', delayHours: 1 }); assert.strictEqual(calls.filter(c => c.name === 'dc.set').length, 0);
});
await t('share: sends params + metadata, toasts only on web', async () => {
  assert.strictEqual(await p.shareGame('2 chapters survived', 'day2'), true);
  const a: any = last('social.share')![0]; assert.deepStrictEqual(a.shareParams, { from: 'seven-days', day: 'day2' }); assert.ok(a.metadata.title); assert.ok(!('imageUrl' in a.metadata));
  assert.strictEqual(n('popups.toast'), 0);
  reset(); cfg.isWeb = true; await p.shareGame('x'); assert.strictEqual(n('popups.toast'), 1);
});
await t('launch intent: ignores none/timed_out, passes share params', async () => {
  assert.strictEqual(await p.readLaunchIntent(), null);
  (cfg as any).intent = { kind: 'timed_out' }; assert.strictEqual(await p.readLaunchIntent(), null);
  (cfg as any).intent = { kind: 'share', params: { from: 'seven-days', day: 'day3' } };
  await p.initPlatform(); assert.strictEqual(n('popups.toast'), 1); assert.ok(calls.some(c => c.name === 'analytics.event' && c.args[0] === 'launched_from_share'));
  delete (cfg as any).intent;
});
await t('clips: frame capture only while recording; stop saves privately; cancel/stop are safe when idle', async () => {
  p.clipFrame(); assert.strictEqual(n('clips.frame'), 0);
  assert.strictEqual(await p.startClip(), true); assert.strictEqual(storeState.recording, true);
  const o: any = last('clips.start')![0]; assert.strictEqual(o.captureMode, 'manual'); assert.deepStrictEqual(o.audio, { microphone: false, gameAudio: true }); assert.strictEqual(o.maxDurationMs, 30000);
  p.clipFrame(); assert.strictEqual(n('clips.frame'), 1);
  assert.strictEqual(await p.stopClip(), true); assert.strictEqual(storeState.recording, false); assert.strictEqual((last('clips.stop')![0] as any).persist, 'ugc');
  p.clipFrame(); assert.strictEqual(n('clips.frame'), 1, 'no frames after stop');
  assert.strictEqual(await p.stopClip(), false); await p.cancelClip(); assert.strictEqual(n('clips.cancel'), 0);
  p.attachClipAudio({} as AudioNode); assert.strictEqual(n('clips.audio'), 1);
});
await t('clips: a failed start leaves recording false', async () => {
  cfg.failAll = true; assert.strictEqual(await p.startClip(), false); assert.strictEqual(storeState.recording, false); p.clipFrame();
});
await t('stats + leaderboard: absolute stats, score formula, rank fallback, nulls', async () => {
  await p.submitCampaignStats(3, 1, 'day2');
  assert.deepStrictEqual(calls.filter(c => c.name === 'stats.submit').map(c => c.args), [['episodes_completed', 3], ['loop_count', 1], ['episode_day2_completed', 1]]);
  await p.submitSurvivalScore(9, 1, 0.2); const s: any = last('lb.submit')![0]; assert.strictEqual(s.score, 19); assert.strictEqual(s.duration, 1, 'duration floor of 1s'); assert.deepStrictEqual(s.metadata, { loopCount: 1 });
  const b = await p.loadSurvivors(); assert.deepStrictEqual(b, { rows: [{ rank: 1, username: 'a', score: 9 }, { rank: 2, username: 'b', score: 5 }], myRank: 2, total: 2 });
});
await t('liveops: valid values pass through; garbage falls back; assignments tracked', async () => {
  cfg.liveops = { values: { menuBanner: 'x'.repeat(500), interstitialsEnabled: true, reminderDelayHours: 46 }, assignments: [{ experimentId: 'reminder-delay', variantId: 'two-days' }] };
  const v = await p.loadLiveOps(); assert.strictEqual(v.menuBanner.length, 160); assert.strictEqual(v.interstitialsEnabled, true); assert.strictEqual(v.reminderDelayHours, 46);
  assert.ok(calls.some(c => c.name === 'analytics.event' && c.args[0] === 'liveops_assignment'));
  reset(); cfg.liveops = { values: { menuBanner: 5, interstitialsEnabled: 'yes', reminderDelayHours: -3 }, assignments: [] };
  assert.deepStrictEqual(await p.loadLiveOps(), p.LIVEOPS_DEFAULTS);
});
await t('interstitial: off by default, gated by flag, 10-minute cooldown, respects readiness', async () => {
  await p.maybeInterstitial(); assert.strictEqual(n('ads.show'), 0, 'default off');
  storeState.liveops.interstitialsEnabled = true; cfg.interstitialReady = false; await p.maybeInterstitial(); assert.strictEqual(n('ads.show'), 0, 'not ready');
  cfg.interstitialReady = true; await p.maybeInterstitial(); assert.strictEqual(n('ads.show'), 1);
  await p.maybeInterstitial(); assert.strictEqual(n('ads.show'), 1, 'cooldown');
});
await t('like prompt: once per device, never when already liked or unavailable', async () => {
  await p.maybePromptLike(); assert.strictEqual(n('popups.like'), 1);
  await p.maybePromptLike(); assert.strictEqual(n('popups.like'), 1, 'second call is a no-op');
  reset(); cfg.liked = true; await p.maybePromptLike(); assert.strictEqual(n('popups.like'), 0);
  reset(); cfg.likeAvailable = false; await p.maybePromptLike(); assert.strictEqual(n('popups.like'), 0);
});
await t('failure injection: every function swallows rejections (no throw, no unhandled rejection)', async () => {
  let unhandled = 0; const h = () => { unhandled++; }; process.on('unhandledRejection', h);
  cfg.failAll = true; storeState.liveops.interstitialsEnabled = true;
  await p.toast('x'); p.haptic('heavy', 0); p.track('x'); p.funnel(1, 'x'); p.clipFrame();
  await p.remindersAvailable(); await p.getRemindersEnabled(); await p.setRemindersEnabled(false); await p.cancelReminder(); await p.scheduleTapeReminder({ title: 't', body: 'b', delayHours: 1 });
  await p.shareGame('x'); await p.readLaunchIntent(); await p.clipsAvailable(); await p.startClip(); await p.stopClip(); await p.cancelClip();
  await p.submitCampaignStats(1, 0, 'a'); await p.submitSurvivalScore(1, 0, 5); await p.loadSurvivors(); await p.canShowComments(); await p.showComments(); await p.maybePromptLike();
  await p.loadLiveOps(); await p.maybeInterstitial(); await p.canPinToHomeScreen(); await p.pinToHomeScreen(); await p.initPlatform();
  await new Promise((r) => setTimeout(r, 50)); process.off('unhandledRejection', h);
  assert.strictEqual(unhandled, 0, `${unhandled} unhandled rejection(s)`);
});
console.log(`\n${passed} test(s) passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
})();
