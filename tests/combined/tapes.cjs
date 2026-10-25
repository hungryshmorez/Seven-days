// Run every cycle-2 tape day with rendering off and report what the autopilot did.
const { open } = require('./lib.cjs');
(async () => {
  const [dist, out] = process.argv.slice(2);
  const t = await open(dist, out, { viewport: { width: 320, height: 180 } });
  const { page } = t;
  await page.waitForSelector('text=NEW GAME', { timeout: 30000 });
  await page.evaluate(() => { window.__sd_norender = true; });
  const days = process.env.DAYS ? process.env.DAYS.split(',').map(Number) : [1,2,3,4,5,6,7];
  for (const d of days) {
    await page.evaluate(() => { window.__sd_norender = true; });
    await page.click('text=NEW GAME').catch(() => {});
    await page.evaluate((d) => { window.__journey.go({ k: 'tapeday', day: d }, null, { cycle: 1 }); }, d);
    const t0 = Date.now();
    let last = '';
    for (let i = 0; i < 400; i++) {
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => { const g = window.__sd_search; if (!g) return null; return { seg: window.__journey.get().state.seg.k, tm: g.tapeMode, mode: g.mode, st: g.state, ended: g.tapeEnded, clk: +g.tapeClock.toFixed(1), used: g.tapeUsed.size + '/' + g.tapeRoute.length, caps: g.tapeCaptures, p: [Math.round(g.p.x), Math.round(g.p.z)] }; });
      const s = JSON.stringify(info);
      if (i % 20 === 0 || s !== last && (info && (info.ended))) console.log('day', d, ((Date.now() - t0) / 1000).toFixed(0) + 's', s);
      last = s;
      const seg = await page.evaluate(() => window.__journey.get().state.seg);
      if (seg.k !== 'tapeday') { console.log('day', d, 'ended ->', JSON.stringify(seg), ((Date.now() - t0) / 1000).toFixed(0) + 's'); break; }
      // game clock warp: tape mode runs ~real time; speed it up 8x
      await page.evaluate(() => { const g = window.__sd_search; if (g) g.clock += 0.4; });
    }
  }
  console.log('errors', t.errs.length, t.errs.slice(0, 3));
  await t.close();
})();
