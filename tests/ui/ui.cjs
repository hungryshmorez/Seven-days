const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = process.argv[2], out = process.argv[3] || require('os').tmpdir();
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
let fails = 0; const check = (name, ok, extra = '') => { console.log(ok ? 'ok  ' : 'FAIL', name, extra); if (!ok) fails++; };
server.listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('text=FOUND FOOTAGE', { timeout: 20000 });
  await page.waitForTimeout(1200); // let capability probes + liveops resolve
  const body = async () => await page.locator('body').innerText();
  let t = await body();
  check('menu: operator line', t.includes('OPERATOR: TESTER'));
  check('menu: liveops banner', t.includes('Day Seven is now recording.'));
  check('menu: SHARE / SURVIVORS / COMMENTS / PIN buttons', ['SHARE', 'SURVIVORS', 'COMMENTS', 'ADD TO HOME SCREEN'].every(x => t.includes(x)));
  check('menu: haptics + reminders toggles', t.includes('Haptic feedback') && t.includes('Remind me when the next tape is waiting'));
  await page.screenshot({ path: path.join(out, 'host_menu.png') });
  // survivors panel
  await page.click('button:has-text("SURVIVORS")'); await page.waitForTimeout(600);
  t = await body(); check('survivors: rows + my rank rendered', t.includes('1. a') && t.includes('2. b') && t.includes('You are 2 of 2.'), JSON.stringify(t.slice(t.indexOf('SURVIVORS'), t.indexOf('SURVIVORS') + 120)));
  await page.screenshot({ path: path.join(out, 'host_survivors.png') });
  await page.click('button:has-text("Close")');
  // share
  await page.click('button:has-text("SHARE")'); await page.waitForTimeout(300);
  let calls = await page.evaluate(() => window.__fakeCalls.map(c => c.name));
  check('share: shareLinkAsync called', calls.includes('social.share'));
  // haptics toggle in menu persists to save (device + cloud)
  await page.click('label:has-text("Haptic feedback") input'); await page.waitForTimeout(500);
  const saved = await page.evaluate(() => window.__fakeCalls.filter(c => c.name === 'app.set').map(c => JSON.parse(c.args[1]).haptics));
  check('haptics toggle: cloud save written with haptics=false', saved.includes(false), JSON.stringify(saved));
  await page.click('label:has-text("Haptic feedback") input'); // back on
  // play: clip button + pause toggles
  await page.click('button:has-text("Prologue")'); await page.waitForTimeout(3500);
  t = await body(); check('hud: CLIP button visible (host supports clips)', t.includes('CLIP'));
  await page.click('button:has-text("CLIP")'); await page.waitForTimeout(1500); // software GL in CI renders a few fps
  t = await body(); check('hud: recording state shows SAVE', t.includes('SAVE'));
  calls = await page.evaluate(() => window.__fakeCalls.map(c => c.name));
  check('clips: startRecording + audio attached + frames captured', calls.includes('clips.start') && calls.includes('clips.audio') && calls.filter(c => c === 'clips.frame').length > 5, `frames=${calls.filter(c => c === 'clips.frame').length}`);
  await page.screenshot({ path: path.join(out, 'host_hud_recording.png') });
  await page.click('button:has-text("SAVE")'); await page.waitForTimeout(600);
  calls = await page.evaluate(() => window.__fakeCalls.map(c => c.name));
  check('clips: stop saves + toast', calls.includes('clips.stop') && calls.includes('popups.toast'));
  const framesAfter = calls.filter(c => c === 'clips.frame').length; await page.waitForTimeout(500);
  const framesLater = (await page.evaluate(() => window.__fakeCalls.filter(c => c.name === 'clips.frame').length));
  check('clips: no frame capture after stop', framesLater === framesAfter, `${framesAfter} -> ${framesLater}`);
  await page.click('button:has-text("❚❚")'); await page.waitForTimeout(300);
  t = await body(); check('pause: haptics toggle present', t.includes('Haptics: ON'));
  await page.click('button:has-text("Haptics: ON")'); await page.waitForTimeout(300);
  t = await body(); check('pause: haptics toggles off', t.includes('Haptics: OFF'));
  await page.screenshot({ path: path.join(out, 'host_pause.png') });
  check('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
  console.log(fails ? `\n${fails} FAILED` : '\nall UI checks passed');
  await browser.close(); server.close(); process.exit(fails ? 1 : 0);
});
