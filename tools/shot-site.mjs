// Development stills of one spot: node tools/shot-site.mjs <outDir> <name>=<query> ...
// Each query is appended to the dev server URL (e.g. "camera-at=-10,2.5,1,5&preview-pump=quiet_pump").
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [outDir, ...shots] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
for (const shot of shots) {
  const [name, query] = shot.split(/=(.*)/s);
  await page.goto(`http://localhost:5173/?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('world')?.dataset.heroReady === 'true', null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Begin exploring' }).click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log('shot', name);
}
if (errors.length) console.log('errors', errors);
await browser.close();
