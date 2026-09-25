// Usage: node scripts/sprite-preview/render.js <out.png> [comma,separated,types] [--abandoned]
// Bundles entry.ts with esbuild, opens it in headless Chromium and screenshots every procedural sprite.
const path = require('path');
const esbuild = require('esbuild');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const root = path.resolve(__dirname, '../..');
  const out = await esbuild.build({
    entryPoints: [path.join(__dirname, 'entry.ts')], bundle: true, write: false, format: 'iife',
    alias: { '@': path.join(root, 'src') }, logLevel: 'error',
  });
  const html = `<html><body style="margin:0;background:#6d8a4a;font:12px sans-serif">
    <div id="root" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;align-items:flex-end"></div>
    <style>figure{margin:0;background:#5d7a3d;padding:4px;display:flex;flex-direction:column;align-items:center}figcaption{color:#fff}</style></body></html>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.setContent(html);
  const args = process.argv.slice(3);
  const types = args.find((a) => !a.startsWith('--')) || '';
  await p.evaluate(([t, ab]) => { window.__types = t; window.__abandoned = ab; }, [types, args.includes('--abandoned')]);
  await p.addScriptTag({ content: out.outputFiles[0].text });
  await p.screenshot({ path: process.argv[2] || 'sprites.png', fullPage: true });
  await b.close();
})();
