const { open } = require('./lib.cjs');
(async () => {
  const [dist, out] = process.argv.slice(2);
  const t = await open(dist, out, { viewport: { width: 480, height: 270 } });
  const { page, shot } = t;
  await page.waitForSelector('text=NEW GAME', { timeout: 30000 });
  await page.evaluate(() => { window.__sd_norender = true; });
  await page.click('text=NEW GAME');
  await page.waitForTimeout(2000);
  for (let i = 0; i < 20; i++) { const st = await page.evaluate(() => { const g = window.__sd_search; if (g) g.clock += 4; return g && g.state; }); await page.waitForTimeout(300); if (st === 'PLAY') break; }
  await page.evaluate(() => {
    const g = window.__sd_search;
    g.applyMode('d1'); g.day1.respawn('d1_terminal');
  });
  await page.waitForTimeout(1500);
  const info = () => page.evaluate(() => { const g = window.__sd_search; return { mode: g.mode, p: [+g.p.x.toFixed(1), +g.p.z.toFixed(1)], stage: g.day1.stage, wp: g.day1.waypoint(), tgt: g.objectiveTarget(), prompt: g.ui.prompt.style.display + ' ' + g.ui.prompt.textContent, wpShown: g.wp.style.display, wpText: g.wp.textContent }; });
  console.log('A', JSON.stringify(await info()));
  await page.evaluate(() => { window.__sd_norender = false; });
  await page.waitForTimeout(6000);
  await shot('01_waypoint');
  // walk to the breaker panel and look at it
  await page.evaluate(() => { window.__sd_norender = true; const g = window.__sd_search; const w = g.day1.waypoint(); g.p.set(w.x + 1.3, 0, w.z); g.yaw = Math.PI / 2; });
  await page.waitForTimeout(800);
  console.log('B', JSON.stringify(await info()));
  await page.evaluate(() => { window.__sd_norender = false; });
  await page.waitForTimeout(6000);
  await shot('02_at_panel');
  // throw lighting, check next target
  await page.evaluate(() => { window.__sd_norender = true; const g = window.__sd_search; const it = g.interactables.find((i) => i.id === 'd1_brk_light'); it.used = true; it.run(); });
  await page.waitForTimeout(800);
  console.log('C', JSON.stringify(await info()));
  await page.evaluate(() => { const g = window.__sd_search; const it = g.interactables.find((i) => i.id === 'd1_brk_arch'); it.run(); });
  await page.waitForTimeout(800);
  console.log('D', JSON.stringify(await info()));
  console.log('errors', t.errs.length, t.errs.slice(0, 3));
  await t.close();
})();
