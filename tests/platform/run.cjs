// Runs the Node-side platform + store tests against a fake RUN host. Usage: node tests/platform/run.cjs
const path = require('path');
const D = path.resolve(__dirname, '../..'), S = __dirname, OUT = path.join(D, 'node_modules/.cache/seven-days-tests');
const esbuild = require(path.join(D, 'node_modules/esbuild'));
const fakes = path.join(S, 'fakes.ts'), storeFakes = path.join(S, 'store-fakes.ts');
const alias = (rules) => ({ name: 'alias', setup(b) { for (const [filter, to] of rules) b.onResolve({ filter }, () => ({ path: to })); } });
(async () => {
  await esbuild.build({ entryPoints: [path.join(S, 'test.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(OUT, 'platform.cjs'), logLevel: 'error',
    plugins: [alias([
      [/^@series-inc\/rundot-game-sdk\/api$/, fakes], [/^@series-inc\/rundot-game-sdk$/, fakes],
      [/sdk\/runSdk\.ts$|^\.\/runSdk\.ts$/, fakes], [/state\/store\.ts$/, fakes],
      [/^\.\.\/\.\.\/src\/sdk\/platform\.ts$/, path.join(D, 'src/sdk/platform.ts')],
    ])] });
  await esbuild.build({ entryPoints: [path.join(S, 'test2.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(OUT, 'store.cjs'), logLevel: 'error',
    define: { window: 'globalThis' }, banner: { js: 'globalThis.matchMedia = () => ({ matches: false });' },
    plugins: [alias([
      [/^@series-inc\/rundot-game-sdk\/api$/, fakes], [/sdk\/runSdk\.ts$/, fakes],
      [/sdk\/platform\.ts$/, storeFakes], [/cinema\/engine\.ts$/, storeFakes],
    ])] });
  // Each file sets process.exitCode on failure; run them back to back in this process.
  await new Promise((r) => { require(path.join(OUT, 'platform.cjs')); setTimeout(r, 4000); });
  require(path.join(OUT, 'store.cjs'));
})().catch((e) => { console.error(e); process.exit(1); });
