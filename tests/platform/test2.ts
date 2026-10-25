import { store, hydrateProgress, saveProgress, flushProgress } from '../../src/state/store.ts';
import api, { cfg, cloud, reset, calls } from './fakes.ts';
import assert from 'assert';
(globalThis as any).window = Object.assign((globalThis as any).window ?? {}, { matchMedia: () => ({ matches: false }) });
let passed = 0;
const exp = Date.now() + 3_600_000;
const t = async (name: string, fn: () => Promise<void>) => { reset(); cloud.data.clear(); cloud.failGet = cloud.failSet = false; await api.deviceCache.clear?.(); store.patch({ completed: [], loopCount: 0, saveNotice: '', friends: undefined, tapeSession: undefined, tapeFinished: false, haptics: true, subtitlesOn: true, continuous: true });
  try { await fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n   ', (e as Error).message); process.exitCode = 1; } };
const putDevice = (o: unknown) => api.deviceCache.setItem('seven-days-cinematic-progress-v1', typeof o === 'string' ? o : JSON.stringify(o));
const putCloud = (o: unknown) => { cloud.data.set('progress-v1', typeof o === 'string' ? o : JSON.stringify(o)); };
(async () => {
  // deviceCache fake has no clear(); emulate by overwriting keys via the shared map in fakes (reset() clears it).
  await t('cloud ahead of device: cloud progress restored, tape visit still comes from device', async () => {
    const tape = { source: 'sevendayscinematics-solarkjng', requestId: 'abcdefgh12', tapeDay: 2, requestedAt: Date.now(), expiresAt: exp };
    await putDevice({ completed: ['prologue'], loopCount: 0, tapeSession: tape, tapeFinished: true });
    putCloud({ completed: ['prologue', 'day1', 'day2'], loopCount: 0, haptics: false, subtitlesOn: false });
    await hydrateProgress();
    assert.deepStrictEqual(store.get().completed, ['prologue', 'day1', 'day2']);
    assert.strictEqual(store.get().haptics, false); assert.strictEqual(store.get().subtitlesOn, false);
    assert.strictEqual(store.get().tapeSession?.requestId, 'abcdefgh12'); assert.strictEqual(store.get().tapeFinished, true);
  });
  await t('device ahead of cloud: device wins (never regress to an older cloud save)', async () => {
    await putDevice({ completed: ['prologue', 'day1', 'day2', 'day3'], loopCount: 0 }); putCloud({ completed: ['prologue'], loopCount: 0 });
    await hydrateProgress(); assert.deepStrictEqual(store.get().completed, ['prologue', 'day1', 'day2', 'day3']);
  });
  await t('tie: device wins; a higher loop count outranks more chapters', async () => {
    await putDevice({ completed: ['prologue', 'day1'], loopCount: 0, haptics: true }); putCloud({ completed: ['prologue', 'day1'], loopCount: 0, haptics: false });
    await hydrateProgress(); assert.strictEqual(store.get().haptics, true, 'tie => device settings');
    reset(); cloud.data.clear(); store.patch({ completed: [], loopCount: 0 });
    await putDevice({ completed: ['prologue','day1','day2','day3','day4','day5','day6','day7'], loopCount: 0 }); putCloud({ completed: ['prologue','day1','day2','day3','day4','day5','day6','day7','hospital'], loopCount: 1 });
    await hydrateProgress(); assert.strictEqual(store.get().loopCount, 1); assert.ok(store.get().completed.includes('hospital'));
  });
  await t('cloud-only (fresh device): progress restored with no device save at all', async () => {
    putCloud({ completed: ['prologue', 'day1'], loopCount: 0, continuous: false }); await hydrateProgress();
    assert.deepStrictEqual(store.get().completed, ['prologue', 'day1']); assert.strictEqual(store.get().continuous, false); assert.strictEqual(store.get().saveNotice, '');
  });
  await t('corrupt or unreachable cloud is ignored: device save used, no scary notice', async () => {
    await putDevice({ completed: ['prologue', 'day1'], loopCount: 0 }); putCloud('{not json'); await hydrateProgress();
    assert.deepStrictEqual(store.get().completed, ['prologue', 'day1']); assert.strictEqual(store.get().saveNotice, '');
    reset(); cloud.data.clear(); store.patch({ completed: [] }); cloud.failGet = true; await putDevice({ completed: ['prologue'], loopCount: 0 }); await hydrateProgress();
    assert.deepStrictEqual(store.get().completed, ['prologue']); assert.strictEqual(store.get().saveNotice, '');
  });
  await t('cloud save with skipped days is normalised (no fabricated unlocks)', async () => {
    putCloud({ completed: ['prologue', 'day3', 'day4'], loopCount: 0 }); await hydrateProgress();
    assert.deepStrictEqual(store.get().completed, ['prologue']);
    reset(); cloud.data.clear(); store.patch({ completed: [] });
    putCloud({ completed: ['prologue', 'day1', 'hospital'], loopCount: 0 }); await hydrateProgress();
    assert.deepStrictEqual(store.get().completed, ['prologue', 'day1'], 'hospital needs every chapter first');
    reset(); cloud.data.clear(); store.patch({ completed: [] });
    putCloud({ completed: ['day1', 'day2'], loopCount: 0 }); await hydrateProgress();
    assert.deepStrictEqual(store.get().completed, [], 'no prologue => nothing');
  });
  await t('corrupt device save still raises the existing notice (behaviour unchanged)', async () => {
    await putDevice('[1,2]'); await hydrateProgress(); assert.ok(store.get().saveNotice.includes('could not be read'));
  });
  await t('save: writes device AND cloud; cloud payload omits the tape visit', async () => {
    store.patch({ completed: ['prologue'], loopCount: 0, tapeSession: { source: 'sevendayscinematics-solarkjng', requestId: 'abcdefgh12', tapeDay: 1, requestedAt: 1, expiresAt: exp } as any });
    saveProgress(); await flushProgress();
    const c = JSON.parse(cloud.data.get('progress-v1')!); assert.deepStrictEqual(c.completed, ['prologue']); assert.ok(!('tapeSession' in c)); assert.ok(typeof c.savedAt === 'number');
    assert.ok(calls.some((x) => x.name === 'dc.set' && String(x.args[1]).includes('tapeSession')), 'device save keeps the tape visit');
    assert.strictEqual(store.get().saveNotice, '');
  });
  await t('save: a cloud failure is silent (device save succeeded) and reported to analytics', async () => {
    cloud.failSet = true; saveProgress(); await flushProgress(); assert.strictEqual(store.get().saveNotice, '');
    assert.ok(calls.some((x) => x.name === 'analytics.event' && x.args[0] === 'cloud_save_failed' && (x.args[1] as any).code === 'RATE_LIMITED'));
  });
  await t('save: a device failure still shows the notice, and cloud is still attempted', async () => {
    cfg.failAll = true; saveProgress(); await flushProgress(); assert.ok(store.get().saveNotice.includes('could not be saved'));
  });
  await t('off-host: save never touches cloud storage', async () => {
    cfg.ready = false; saveProgress(); await flushProgress(); assert.strictEqual(calls.filter((x) => x.name.startsWith('app.')).length, 0);
    await hydrateProgress(); assert.strictEqual(calls.filter((x) => x.name.startsWith('app.')).length, 0);
  });
  console.log(`\n${passed} store test(s) passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
})();
