// Virtual-time capture harness: rAF + performance.now are driven by us, one screenshot per step.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json' };
const SHIM = `(() => { let vt = 0, id = 0; const q = new Map();
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { q.set(++id, cb); return id; };
  window.cancelAnimationFrame = (i) => { q.delete(i); };
  window.__vt = { step(ms) { vt += ms; const items = [...q.entries()]; q.clear(); for (const [, cb] of items) { try { cb(vt); } catch (e) { console.error('raf', e && e.message); } } return vt; } };
})();`;
exports.open = async function (dist, opts = {}) {
  const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(dist, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 360, height: 640 }, deviceScaleFactor: opts.dpr || 1.5 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', (e.stack || e.message).slice(0, 500)));
  await page.addInitScript(SHIM);
  await page.goto(`http://localhost:${port}/index.html`);
  const step = (ms) => page.evaluate((ms) => window.__vt.step(ms), ms);
  let n = 0;
  // advance `frames` frames at `fps`, saving every frame to dir
  const record = async (dir, frames, fps, every = 1) => {
    fs.mkdirSync(dir, { recursive: true });
    const ms = 1000 / fps; const t0 = Date.now();
    for (let i = 0; i < frames; i++) { await step(ms); if (i % every === 0) await page.screenshot({ path: path.join(dir, String(n++).padStart(5, '0') + '.png'), timeout: 120000 }); }
    return (Date.now() - t0) / frames / 1000;
  };
  const advance = async (frames, fps) => { for (let i = 0; i < frames; i++) await step(1000 / fps); };
  const close = async () => { await browser.close(); server.close(); };
  return { page, step, record, advance, close };
};
