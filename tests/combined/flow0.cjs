// First pass: search -> tape 1 -> cinematic Day 1 -> back to search Day 2
const { open } = require('./lib.cjs');
(async () => {
  const [dist, out] = process.argv.slice(2);
  const t = await open(dist, out);
  const { page, shot, state } = t;
  await page.waitForSelector('text=NEW GAME', { timeout: 30000 });
  await shot('00_menu');
  await page.click('text=NEW GAME');
  await page.waitForTimeout(3500);
  console.log('after new game', JSON.stringify(await state()));
  await shot('01_boat');
  // drop the player straight into the tape room with tape 1 pending
  await page.evaluate(() => { const g = window.__sd_search; g.pendingTape = { n: 1, next: 'd2' }; g.startPassage('tape'); });
  await page.waitForTimeout(3500);
  await shot('02_taperoom');
  await page.evaluate(() => { const g = window.__sd_search; const its = g.passages.interactables; its.find((i) => i.id === 'tape_pickup').run(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = window.__sd_search; const its = g.passages.interactables; its.find((i) => i.id === 'tape_insert').run(); });
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(700); const s = await state(); if (s && s.seg.k === 'cinema') break; }
  console.log('after insert', JSON.stringify(await state()));
  await shot('03_bridge_or_cinema');
  await page.waitForTimeout(3500);
  console.log('cinema', JSON.stringify(await state()));
  await shot('04_cinema_day1');
  await page.evaluate(() => { window.__sd_cine.dir.time = 40; });
  await page.waitForTimeout(2500);
  await shot('05_cinema_day1_later');
  await page.evaluate(() => { window.__sd_cine.finish(); });
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(700); const s = await state(); if (s && s.seg.k === 'search') break; }
  console.log('after cinema', JSON.stringify(await state()));
  await page.waitForTimeout(4000);
  await shot('06_back_in_search');
  await page.waitForTimeout(3000);
  await shot('07_search_day2');
  console.log('mode', await page.evaluate(() => window.__sd_search && window.__sd_search.mode));
  console.log('errors', t.errs.length);
  await t.close();
})();
