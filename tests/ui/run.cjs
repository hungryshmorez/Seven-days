// Host-present UI test: builds the app against a fake RUN host, then drives it in headless Chromium.
// Needs Playwright + a Chromium install (not a project dependency):  npm i -D playwright && npx playwright install chromium
const { execFileSync } = require('child_process'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const out = path.join(ROOT, 'node_modules/.cache/dist-fakehost'), shots = path.join(ROOT, 'node_modules/.cache/ui-shots');
fs.mkdirSync(shots, { recursive: true });
execFileSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--config', path.join(__dirname, 'vite.fakehost.config.mjs')], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, OUT: out } });
execFileSync(process.execPath, [path.join(__dirname, 'ui.cjs'), out, shots], { cwd: ROOT, stdio: 'inherit' });
console.log('screenshots:', shots);
