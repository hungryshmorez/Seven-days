const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.json':'application/json' };
exports.open = async function open(dist, out, opts = {}) {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(dist, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: opts.viewport || { width: 480, height: 270 } });
  const errs = []; page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR', (e.stack || e.message).slice(0, 700)); });
  page.on('console', (m) => { if (m.type() === 'error' || /\[journey\]/.test(m.text())) console.log('CONSOLE', m.type(), m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${port}/index.html`);
  const shot = async (name) => { await page.screenshot({ path: path.join(out, name + '.png'), timeout: 120000 }); };
  const state = () => page.evaluate(() => { const j = window.__journey && window.__journey.get(); return j ? { seg: j.state.seg, cycle: j.state.cycle, bridge: j.bridge } : null; });
  const close = async () => { await browser.close(); server.close(); };
  return { page, shot, state, errs, close };
};
