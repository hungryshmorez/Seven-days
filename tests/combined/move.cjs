// Movement feel: pass 2 free roam (eased, crouch, bob) and pass 1 (no movement from keys).
const { open } = require('./vt.cjs');
(async () => {
  const [dist] = process.argv.slice(2);
  const t = await open(dist, { viewport: { width: 270, height: 480 }, dpr: 1 });
  const { page } = t;
  await page.waitForSelector('text=NEW GAME', { timeout: 30000 });
  await t.advance(3, 30);
  await page.click('text=NEW GAME'); await t.advance(5, 30);
  const sample = () => page.evaluate(() => { const c = window.__sd_cine; return { x: c.rig.pos.x, z: c.rig.pos.z, cy: c.rig.camera.position.y, fov: c.rig.camera.fov, sp: c.rig.speed, amp: c.rig.amp, fo: c.fr ? { ox: c.fr.off.x, oz: c.fr.off.z } : null }; });
  const run = async (label, frames, fps, per) => { const out = []; for (let i = 0; i < frames; i++) { await t.step(1000 / fps); out.push(await sample()); } return out; };
  // ---- pass 1: a tape (no free roam). WASD must do nothing.
  await page.evaluate(() => window.__journey.go({ k: 'cinema', ep: 'day1', roam: false, tape: 1 }, null));
  await t.advance(60, 30);
  const a = await sample();
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  const p1 = await run('p1', 60, 30);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  const dOff = p1[p1.length - 1].fo; console.log('PASS1 free-roam offset after holding W+Shift 2s:', dOff ? JSON.stringify(dOff) : 'none (no roam state)');
  // ---- pass 2: free roam
  await page.evaluate(() => window.__journey.go({ k: 'cinema', ep: 'day1', roam: true, tape: 1 }, null, { cycle: 1 }));
  await t.advance(90, 30);
  console.log('style', await page.evaluate(() => [window.__sd_cine.rig.style, window.__sd_cine.rig.baseFov]));
  const reset = () => page.evaluate(() => { const c = window.__sd_cine; c.fr.off.set(0, 0, 0); c.pv.x = 0; c.pv.z = 0; });
  await reset();
  await page.keyboard.down('KeyW');
  const w = await run('walk', 40, 30);
  await page.keyboard.up('KeyW');
  const stop = await run('stop', 20, 30);
  const vel = w.map((s, i) => i ? Math.hypot(s.fo.ox - w[i - 1].fo.ox, s.fo.oz - w[i - 1].fo.oz) * 30 : 0);
  console.log('ramp-up speeds (m/s) frames 1,2,3,5,10,20,39:', [1, 2, 3, 5, 10, 20, 39].map((i) => vel[i].toFixed(2)).join(' '));
  const all = [w[w.length - 1], ...stop];
  const vs = all.map((s, i) => i ? Math.hypot(s.fo.ox - all[i - 1].fo.ox, s.fo.oz - all[i - 1].fo.oz) * 30 : 0);
  console.log('stop speeds frames 1,2,3,5,8,12,20:', [1, 2, 3, 5, 8, 12, 20].map((i) => vs[i].toFixed(2)).join(' '));
  const ys = w.map((s) => s.cy); let maxJump = 0; for (let i = 1; i < ys.length; i++) maxJump = Math.max(maxJump, Math.abs(ys[i] - ys[i - 1]));
  console.log('walk cam y range', Math.min(...ys).toFixed(3), Math.max(...ys).toFixed(3), 'max frame step', maxJump.toFixed(4), 'bob amp', w[w.length - 1].amp.toFixed(2), 'measured speed', w[w.length - 1].sp.toFixed(2));
  await reset();
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  const r = await run('run', 30, 30); console.log('run: offset speed', (Math.hypot(r[29].fo.ox - r[28].fo.ox, r[29].fo.oz - r[28].fo.oz) * 30).toFixed(2), 'bob amp', r[29].amp.toFixed(2));
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); await reset(); await run('x', 20, 30);
  // crouch
  const s0 = (await sample()).cy;
  await page.keyboard.down('KeyC'); const c1 = await run('crouch', 30, 30); const s1 = c1[c1.length - 1].cy;
  await page.keyboard.up('KeyC'); const c2 = await run('stand', 30, 30); const s2 = c2[c2.length - 1].cy;
  console.log('eye height standing', s0.toFixed(2), 'crouched', s1.toFixed(2), 'standing again', s2.toFixed(2));
  await t.close();
})();
