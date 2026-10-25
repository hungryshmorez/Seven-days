const { open } = require('./lib.cjs');
(async () => {
  const [dist, out] = process.argv.slice(2);
  const t = await open(dist, out, { viewport: { width: 320, height: 180 } });
  const { page, shot } = t;
  await page.waitForSelector('text=NEW GAME', { timeout: 30000 });
  await page.click('text=NEW GAME');
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__journey.go({ k: 'cinema', ep: 'day1', roam: true, tape: 1 }, null, { cycle: 1 }); });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { const e = window.__sd_cine; e.dir.time = 229; });
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(1500);
    console.log(JSON.stringify(await page.evaluate(() => { const e = window.__sd_cine; return { time: e.dir.time, fin: e.finished, vs: e.vcrStarted, va: e.vcrActive, cues: e.dir.cues.length }; })));
  }
  await shot('vcr');
  await t.close();
})();
