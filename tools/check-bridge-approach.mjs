// Real-input check of the bridge's west (village) approach: walk with WASD (or the
// touch joystick) from the landing to the spot beside the pump where the restorer
// used to stick, try moving on, then stand on the bridge landing, read the prompt,
// open the bridge with E (or the Interact button), and check the pump still opens.
// Usage: node tools/check-bridge-approach.mjs <outDir> [width] [height] [touch]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [outDir, w = '1600', h = '900', mode = 'keys'] = process.argv.slice(2);
const touch = mode === 'touch';
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('world')?.dataset.heroReady === 'true', null, { timeout: 60000 });
await page.getByRole('button', { name: 'Begin exploring' }).click();
await page.waitForTimeout(1200);
// RELOAD=1: save, reload the page and continue the saved expedition before walking.
if (process.env.RELOAD) {
  await page.locator('#save').click(); await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('world')?.dataset.heroReady === 'true', null, { timeout: 60000 });
  await page.waitForFunction(() => { const b = document.querySelector('#continue'); return b instanceof HTMLButtonElement && !b.disabled; });
  await page.locator('#continue').click(); await page.waitForTimeout(1200);
}

const YAW = 35 * Math.PI / 180, UP = { x: -Math.sin(YAW), z: -Math.cos(YAW) }, RIGHT = { x: Math.cos(YAW), z: -Math.sin(YAW) };
const state = () => page.evaluate(() => JSON.parse(document.getElementById('world').dataset.domainState));
const player = async () => (await state()).player.position;
const prompt = () => page.evaluate(() => document.getElementById('prompt')?.textContent?.trim() ?? '');
const report = { viewport: `${w}x${h}`, input: touch ? 'touch joystick' : 'keyboard', reloaded: !!process.env.RELOAD, steps: [] };
const log = (step, extra = {}) => { report.steps.push({ step, ...extra }); console.log(step, JSON.stringify(extra)); };

// Movement: keys, or a real touch drag on the on-screen joystick.
const held = new Set();
async function setKeys(keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
let stick = null, cdp = null;
async function setStick(right, up) {
  if (!cdp) cdp = await context.newCDPSession(page);
  if (!stick) stick = await page.locator('#joystick').boundingBox();
  const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2;
  if (!right && !up) { if (setStick.down) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); setStick.down = false; } return; }
  const point = [{ x: cx + right * stick.width * 0.4, y: cy - up * stick.height * 0.4, id: 1 }];
  if (!setStick.down) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] }); setStick.down = true; }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point });
}
async function steer(right, up) {
  if (touch) return setStick(right, up);
  const keys = [];
  if (up > 0.38) keys.push('KeyW'); if (up < -0.38) keys.push('KeyS');
  if (right > 0.38) keys.push('KeyD'); if (right < -0.38) keys.push('KeyA');
  return setKeys(keys);
}
async function trail(points) {
  for (const target of points) {
    const started = Date.now();
    for (;;) {
      const p = await player(), dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3 || Date.now() - started > 6000) break;
      const up = (dx * UP.x + dz * UP.z) / d, right = (dx * RIGHT.x + dz * RIGHT.z) / d;
      await steer(touch ? right : right, touch ? up : up); await page.waitForTimeout(70);
    }
  }
  await steer(0, 0); await page.waitForTimeout(500);
}
/** Hold one direction for a moment and measure how far the restorer actually moves. */
async function nudge(name, right, up) {
  const before = await player();
  await steer(right, up); await page.waitForTimeout(600); await steer(0, 0); await page.waitForTimeout(400);
  const after = await player();
  return { input: name, moved: +Math.hypot(after.x - before.x, after.z - before.z).toFixed(2) };
}
async function interact() {
  if (touch) await page.locator('#interact').tap();
  else await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);
  return (await state()).inspectionId;
}
async function leave() { await page.keyboard.press('Escape'); await page.waitForTimeout(600); if ((await state()).paused) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } }
const shot = name => page.screenshot({ path: join(outDir, `${name}.png`) });

// 1. From the landing up through the village to the reported spot beside the pump.
await trail([{ x: -9.4, z: 14.4 }, { x: -11, z: 8 }, { x: -7.4, z: 4.6 }, { x: -7.77, z: 2.42 }]);
const at = await player();
log('reported spot', { at: { x: +at.x.toFixed(2), z: +at.z.toFixed(2) }, prompt: await prompt(), focus: (await state()).focusId });
await shot('1-reported-spot');
log('try W', await nudge('W (up)', 0, 1));
await trail([{ x: -7.77, z: 2.42 }]);
log('try D', await nudge('D (right)', 1, 0));
// 2. On to the bridge landing on the west bank.
await trail([{ x: -7.4, z: 1.2 }, { x: -7.05, z: 0 }]);
const land = await player();
log('bridge landing', { at: { x: +land.x.toFixed(2), z: +land.z.toFixed(2) }, prompt: await prompt(), focus: (await state()).focusId });
await shot('2-bridge-landing');
const opened = await interact();
log('interact at landing', { inspection: opened, deckOpen: (await state()).restoredSiteIds.includes('creek_bridge') });
await shot('3-bridge-open');
await leave();
// 3. The pump is still reachable and opens from its own side.
await trail([{ x: -7.4, z: 1.4 }, { x: -9.2, z: 0.9 }]);
log('pump front', { prompt: await prompt(), focus: (await state()).focusId });
log('interact at pump', { inspection: await interact() });
await leave();
report.errors = errors;
await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
await browser.close();
