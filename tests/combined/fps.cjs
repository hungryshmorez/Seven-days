const { open } = require('./lib.cjs');
(async () => {
  const [dist, out] = process.argv.slice(2);
  const t = await open(dist, out, { viewport: { width: 320, height: 180 } });
  const { page } = t;
  await page.waitForSelector('text=NEW GAME', { timeout: 30000 });
  await page.click('text=NEW GAME');
  const fps = async (label) => { const n = await page.evaluate(() => new Promise((res) => { let c = 0; const t0 = performance.now(); const f = () => { c++; if (performance.now() - t0 > 5000) res(c / 5); else requestAnimationFrame(f); }; requestAnimationFrame(f); })); console.log(label, 'fps', n.toFixed(2)); };
  await page.waitForTimeout(2000);
  await fps('search boat');
  await page.evaluate(() => window.__journey.searchTape(1, { cp: { id: 'x', x: 0, z: 0, yaw: 0, mode: 'out', chase: false }, flash: true, clues: [], bolted: false }));
  await page.waitForTimeout(3500);
  await fps('cinema day1');
  await page.evaluate(() => window.__journey.searchLoop({ cp: { id: 'x', x: 0, z: 0, yaw: 0, mode: 'out', chase: false }, flash: true, clues: [], bolted: false }));
  await page.waitForTimeout(3500);
  await fps('cinema prologue roam');
  await t.close();
})();
