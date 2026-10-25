// Usage: node smoke.cjs <distDir> [episodeToStart]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = process.argv[2];
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
  const errors = [], warns = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); if (m.type() === 'warning') warns.push(m.text()); });
  await page.goto(`http://localhost:${port}/`);
  let menu = false;
  try { await page.waitForSelector('text=FOUND FOOTAGE', { timeout: 20000 }); menu = true; } catch {}
  console.log('MENU_REACHED', menu);
  if (menu && process.argv[3] === 'play') {
    await page.click('button:has-text("Prologue")');
    await page.waitForTimeout(6000);
    const hud = await page.locator('text=REC').count();
    const canvas = await page.locator('canvas').count();
    console.log('PLAYING hud=', hud, 'canvas=', canvas);
    await page.screenshot({ path: process.argv[4] || path.join(process.argv[5] || '.', 'play.png') });
  }
  console.log('ERRORS', JSON.stringify(errors, null, 1));
  console.log('WARNINGS(first 6)', JSON.stringify(warns.filter(w=>!w.includes("GL Driver")).slice(0, 12), null, 1));
  await browser.close(); server.close();
});
