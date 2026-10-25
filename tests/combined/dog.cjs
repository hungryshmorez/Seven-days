// Dog ending: sit with the dog on the opening beach, wait ~10 minutes (time-warped), wake in hospital, credits.
const { open } = require('./lib.cjs');
(async () => {
  const [dist, out] = process.argv.slice(2);
  const t = await open(dist, out);
  const { page, shot, state } = t;
  await page.waitForSelector('text=NEW GAME', { timeout: 30000 });
  await page.evaluate(() => { window.__sd_norender = true; });
  await page.click('text=NEW GAME');
  await page.waitForTimeout(2500);
  // skip the boat intro
  for (let i = 0; i < 20; i++) { const st = await page.evaluate(() => { const g = window.__sd_search; if (g) g.clock += 4; return g && g.state; }); await page.waitForTimeout(400); if (st === 'PLAY') break; }
  console.log('state', await page.evaluate(() => { const g = window.__sd_search; return [g.state, g.mode, g.p.x, g.p.z, g.cabinOn, g.dogAvailable()]; }));
  await page.evaluate(() => { window.__sd_norender = false; const g = window.__sd_search; g.p.set(-0.8, 0, -0.6); g.yaw = 1.0; });
  await page.waitForTimeout(3000);
  await shot('01_beach_dog');
  console.log('avail', await page.evaluate(() => window.__sd_search.dogAvailable()), 'prompt', await page.evaluate(() => window.__sd_search.ui.prompt.textContent));
  await page.evaluate(() => { window.__sd_search.dogIt.run(); });
  await page.waitForTimeout(6000);
  await shot('02_sitting');
  await page.evaluate(() => { window.__sd_norender = true; });
  // jump ahead ~9 minutes in two warps
  await page.evaluate(() => { window.__sd_search.clock += 300; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__sd_search.clock += 270; });
  await page.waitForTimeout(1500);
  console.log('sitting?', await page.evaluate(() => window.__sd_search.dogSit));
  await page.evaluate(() => { window.__sd_search.clock += 40; });
  await page.waitForTimeout(6500);
  console.log('after wake', await page.evaluate(() => { const g = window.__sd_search; return [g.state, g.mode, g.passages.kind]; }));
  await page.evaluate(() => { window.__sd_norender = false; });
  await page.waitForTimeout(5000);
  await shot('03_hospital_wake');
  await page.evaluate(() => { window.__sd_norender = true; const g = window.__sd_search; g.clock += 0; });
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(1000); await page.evaluate(() => { window.__sd_search && (window.__sd_search.clock += 1.5); }); const s = await state(); if (s && s.seg.k === 'credits') break; }
  console.log('end', JSON.stringify(await state()));
  console.log('errors', t.errs.length, t.errs.slice(0, 3));
  await t.close();
})();
