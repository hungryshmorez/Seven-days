const { open } = require('./lib.cjs');
(async () => {
  const [dist, out] = process.argv.slice(2);
  const t = await open(dist, out);
  const { page, shot } = t;
  await page.waitForSelector('text=NEW GAME', { timeout: 30000 });
  await page.evaluate(() => { window.__sd_norender = true; });
  await page.click('text=NEW GAME');
  await page.waitForTimeout(2000);
  for (let i = 0; i < 20; i++) { const st = await page.evaluate(() => { const g = window.__sd_search; if (g) g.clock += 4; return g && g.state; }); await page.waitForTimeout(300); if (st === 'PLAY') break; }
  await page.evaluate(() => { const g = window.__sd_search; g.startPassage('hospital_wake'); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__sd_search.clock += 6; });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__sd_norender = false; });
  await page.waitForTimeout(9000);
  await shot('01_wake_a');
  await page.evaluate(() => { window.__sd_norender = true; window.__sd_search.clock += 6; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__sd_norender = false; });
  await page.waitForTimeout(8000);
  await shot('02_wake_b');
  console.log('errors', t.errs.length, t.errs.slice(0, 3));
  await t.close();
})();
