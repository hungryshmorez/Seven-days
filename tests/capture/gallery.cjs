// node tests/capture/gallery.cjs <distDir> <outDir> — one PNG per creature in every chapter.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const TOP = new Map((process.env.TOP || '').split(',').filter(Boolean).map((x) => x.split(':')));
const [dist, out] = process.argv.slice(2);
const EPS = process.env.EPS ? process.env.EPS.split(',') : ['prologue', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(dist, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
fs.mkdirSync(out, { recursive: true });
server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const ep of EPS) {
    const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
    await page.goto(`http://localhost:${port}/tests/capture/index.html?ep=${ep}${process.env.QS ? '&' + process.env.QS : ''}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    await page.evaluate(() => window.__seek(1.5));
    const pre = (process.env.PRESEEK || '').split(',').map(Number).filter(Boolean);
    const seen = new Set(); let list = [];
    for (const t of pre.length ? pre : [0]) { if (t) await page.evaluate((t) => window.__seek(t), t); }
    list = await page.evaluate(() => window.__creatures());
    const _unused = await page.evaluate(() => window.__creatures());
    for (let i = 0; i < list.length; i++) {
      await page.evaluate(([i, top]) => window.__frame(i, top), [i, TOP.has(list[i]) ? Number(TOP.get(list[i])) : false]);
      await page.evaluate(() => window.__seek(window.__t = (window.__t || 1.5) + 0.6));
      await page.evaluate(([i, top]) => window.__frame(i, top), [i, TOP.has(list[i]) ? Number(TOP.get(list[i])) : false]);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, `${ep}-${String(i).padStart(2, '0')}-${list[i]}_000.png`) });
    }
    console.log(ep, list.join(','));
    await page.close();
  }
  await browser.close(); server.close();
});
