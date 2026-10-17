// Development stills of the council reveal at the commons fire, driven through the
// dev-only window.__council hook (labelled mock preview). Usage:
// node tools/shot-council.mjs <outDir> <design> [width] [height]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [outDir, design = 'quiet_pump', w = '1600', h = '900'] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/?camera-at=-15.6,-0.4', { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('world')?.dataset.councilReady === 'true', null, { timeout: 60000 });
await page.getByRole('button', { name: 'Begin exploring' }).click();
await page.waitForTimeout(1500);
const shot = async name => { await page.screenshot({ path: join(outDir, `${name}.png`) }); console.log('shot', name); };
await shot('01-idle');
await page.evaluate(d => window.__council.preview(d), design);
for (const [ms, name] of [[1400, '02-gather'], [2200, '03-speaker1'], [4500, '04-speaker2'], [9000, '05-speaker4'], [4200, '06-verdict']]) { await page.waitForTimeout(ms); await shot(name); }
if (errors.length) console.log('errors', errors);
await browser.close();
