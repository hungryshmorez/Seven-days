// node tests/capture/shoot.cjs <distDir> <outDir> [episodes,comma] — one PNG per (episode, time).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [dist, out, only] = process.argv.slice(2);
const PLAN = {
  __humans: [1, 3],
  prologue: [4, 9, 14, 26, 50, 64], day1: [5, 15, 25, 35, 48, 60], day2: [8, 30, 50, 75, 95, 115],
  day3: [10, 50, 90, 130, 165, 200], day4: [10, 45, 80, 115, 150, 185], day5: [8, 30, 60, 90, 115, 135],
  day6: [10, 50, 90, 130, 170, 210], day7: [10, 45, 85, 125, 165, 205], hospital: [8, 22, 36, 50, 64, 76],
};
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(dist, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const eps = only ? only.split(',') : Object.keys(PLAN);
  for (const ep of eps) {
    const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://localhost:${port}/tests/capture/index.html?ep=${ep}${process.env.QS ? '&' + process.env.QS : ''}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    for (const t of PLAN[ep]) {
      const at = await page.evaluate((t) => window.__seek(t), t);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, `${ep}_${String(t).padStart(3, '0')}.png`) });
      if (await page.evaluate(() => window.__ended || window.__error)) break;
    }
    const err = await page.evaluate(() => window.__error);
    console.log(ep, errs.length || err ? 'ERR ' + (err || errs[0]) : 'ok');
    await page.close();
  }
  await browser.close(); server.close();
});
