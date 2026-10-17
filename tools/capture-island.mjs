// Live capture set for the stylized island: six stills matched to refs-locked slots,
// walkthrough frames from one continuous real-input session (including a genuine
// local practice repair), a per-frame manifest, and equal-blur SxS pairs.
// Usage: node tools/capture-island.mjs [baseUrl]   (dev server must be running)
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { click, press, setting, join as joinPorts, state } from './browser-play.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.argv[2] ?? 'http://localhost:5173/';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = join(root, 'artifacts', 'island-captures', stamp);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src', 'index.html'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
for (const d of ['stills', 'walkthrough-frames', 'sxs']) await mkdir(join(out, d), { recursive: true });

const YAW = 35 * Math.PI / 180;
const UP = { x: -Math.sin(YAW), z: -Math.cos(YAW) }, RIGHT = { x: Math.cos(YAW), z: -Math.sin(YAW) };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (/context lost|CONTEXT_LOST|webglcontextlost/i.test(m.text())) errors.push('console: ' + m.text()); });
const t0 = Date.now();

async function boot(query = '') {
  await page.goto(base + query, { waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('world')?.dataset.heroReady === 'true', null, { timeout: 60000 });
  await page.evaluate(() => document.querySelector('#world canvas')?.addEventListener('webglcontextlost', () => console.log('webglcontextlost')));
  await page.getByRole('button', { name: 'Begin exploring' }).click();
  await page.waitForTimeout(1500);
}
const player = () => page.evaluate(() => { const d = document.getElementById('world').dataset; return { x: +d.playerX, y: +d.playerY, z: +d.playerZ }; });
const held = new Set();
async function setKeys(keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
/** Plan a route on the live walk surface with the same rules as movement, as a player would choose one. */
const route = goal => page.evaluate(async goal => {
  const t = await import('/src/domain/terrain.ts'), L = window.__islandLevel, step = 0.5;
  const s = JSON.parse(document.getElementById('world').dataset.domainState), R = new Set(s.restoredSiteIds), start = s.player.position;
  const key = (x, z) => Math.round(x / step) + ',' + Math.round(z / step), prev = new Map([[key(start.x, start.z), null]]), at = new Map([[key(start.x, start.z), start]]);
  const queue = [start]; let found = null;
  while (queue.length) {
    const f = queue.shift();
    if (Math.hypot(f.x - goal.x, f.z - goal.z) < 0.7) { found = f; break; }
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, step], [step, -step], [-step, -step]]) {
      const x = f.x + dx, z = f.z + dz, k = key(x, z); if (prev.has(k)) continue;
      const g = t.dryStandingGround(L, { x, y: f.y, z }, R); if (!g) continue;
      // Movement refuses any 0.22 m jump between ticks: check the step every 0.1 m like the game does.
      let prevY = f.y, ok = true;
      for (let k = 1; k <= 7 && ok; k++) { const q = t.sampleGround(L, f.x + dx * k / 7, f.z + dz * k / 7, R); if (!q || Math.abs(q.y - prevY) > 0.2 || q.normal.y < 0.8) ok = false; else prevY = q.y; }
      if (!ok) continue;
      const to = { x, y: g.y, z }; if (t.collidingObstacles(L, f, to, R, 0.31).length) continue;
      prev.set(k, key(f.x, f.z)); at.set(k, to); queue.push(to);
    }
  }
  if (!found) return null;
  const path = []; for (let k = key(found.x, found.z); k; k = prev.get(k)) path.unshift(at.get(k));
  return path.filter((_, i) => i % 2 === 0 || i === path.length - 1).map(p => ({ x: p.x, z: p.z }));
}, goal);

/** Walk to a goal with real WASD input, replanning whenever progress stalls. */
async function walk(target, onTick) {
  let goal = target, bestDist = Infinity, lastGain = Date.now();
  const started = Date.now();
  for (;;) {
    const here = await player(), dist = Math.hypot(goal.x - here.x, goal.z - here.z);
    if (dist < 0.6) break;
    // Close enough for framing once progress stalls within a metre of the spot.
    if (dist < bestDist - 0.1) { bestDist = dist; lastGain = Date.now(); }
    if (dist < 1.1 && Date.now() - lastGain > 4000) break;
    if (Date.now() - started > 60000) throw new Error(`walk timed out at ${here.x.toFixed(1)},${here.z.toFixed(1)} for ${goal.x},${goal.z}`);
    let r = await route(goal);
    // If props cover the exact spot, stand at the nearest reachable point around it.
    for (let k = 0; !r && k < 12; k++) { const ang = k * Math.PI / 3, rad = k < 6 ? 0.9 : 1.7; r = await route({ x: goal.x + Math.cos(ang) * rad, z: goal.z + Math.sin(ang) * rad }); if (r) goal = { x: goal.x + Math.cos(ang) * rad, z: goal.z + Math.sin(ang) * rad }; }
    if (!r) throw new Error(`no route to ${goal.x},${goal.z}`);
    for (const target of r.slice(1, 7)) {
      const legStart = Date.now();
      for (;;) {
        const p = await player(), dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.35 || Date.now() - legStart > 2500) break;
        const up = (dx * UP.x + dz * UP.z) / d, right = (dx * RIGHT.x + dz * RIGHT.z) / d, keys = [];
        if (up > 0.38) keys.push('KeyW'); if (up < -0.38) keys.push('KeyS');
        if (right > 0.38) keys.push('KeyD'); if (right < -0.38) keys.push('KeyA');
        await setKeys(keys); await page.waitForTimeout(90);
        if (onTick) await onTick();
      }
    }
  }
  await setKeys([]); await page.waitForTimeout(700);
}

/** Follow a trail of footpath vertices with real WASD input, steering along each straight leg. */
async function trail(points, onTick) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = 1; k <= n; k++) {
      const target = { x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n }, legStart = Date.now();
      for (;;) {
        const p = await player(), dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.3 || Date.now() - legStart > 2500) break;
        const up = (dx * UP.x + dz * UP.z) / d, right = (dx * RIGHT.x + dz * RIGHT.z) / d, keys = [];
        if (up > 0.38) keys.push('KeyW'); if (up < -0.38) keys.push('KeyS');
        if (right > 0.38) keys.push('KeyD'); if (right < -0.38) keys.push('KeyA');
        await setKeys(keys); await page.waitForTimeout(70);
        if (onTick) await onTick();
      }
    }
  }
  await setKeys([]); await page.waitForTimeout(700);
  const end = await player(), goal = points.at(-1);
  if (Math.hypot(end.x - goal.x, end.z - goal.z) > 1.5) throw new Error(`trail ended at ${end.x.toFixed(1)},${end.z.toFixed(1)}, not ${goal.x},${goal.z}`);
}

const stills = [], frames = [];
const sha = async path => createHash('sha256').update(await readFile(path)).digest('hex');
async function still(id, ref, scene, how) {
  const file = `still-${id}.png`, path = join(out, 'stills', file);
  await page.screenshot({ path });
  const p = await player();
  stills.push({ file, ref, scene: `${scene} [zone: ${zone(p)}; HUD: ${(await hud()) || 'none'}]`, how, at: new Date().toISOString(), sha256: await sha(path) });
}
const ZONES = { 'landing': [-11, 18], 'pier': [-13, 27], 'village pump': [-10, 2.5], 'village commons': [-15.6, -0.4], 'creek bridge': [-3, 0], 'creek bank by the bridge': [-8, 0], 'stone ford': [-11.5, -6.3], 'upland waterworks': [-17.5, -15.5], 'woodland': [5, -12] };
const zone = p => Object.entries(ZONES).sort((a, b) => Math.hypot(a[1][0] - p.x, a[1][1] - p.z) - Math.hypot(b[1][0] - p.x, b[1][1] - p.z))[0][0];
const hud = () => page.evaluate(() => ['#diagnosis', '#prompt', '.rp-guidance'].map(q => document.querySelector(q)).filter(e => e && e.offsetParent !== null && e.textContent.trim()).map(e => e.textContent.trim().split(String.fromCharCode(32)).filter(Boolean).join(' ').slice(0, 90)).join(' / '));
async function frame(scene) {
  if (frames.length >= 12) return;
  const file = `frame-${String(frames.length + 1).padStart(2, '0')}.png`, path = join(out, 'walkthrough-frames', file);
  await page.screenshot({ path });
  const p = await player(), s = await state(page);
  frames.push({ file, scene: `${scene} [zone: ${zone(p)}; HUD: ${(await hud()) || 'none'}]`, at: new Date().toISOString(), seconds: ((Date.now() - t0) / 1000).toFixed(1), player: `${p.x.toFixed(1)},${p.z.toFixed(1)}`, restored: s.restoredSiteIds.join(' ') || 'none', sha256: (await sha(path)).slice(0, 16) });
}


// 2. One continuous real-input session: landing, a genuine local repair, then across the island.
await boot(); await page.waitForTimeout(1200);
await still('06', 'ref-06', 'Pier workshop and landing hoist with the restorer at spawn', 'default camera at spawn');
await frame('Boot: restorer at the landing beside the pier workshop');
await walk({ x: -12.4, z: 19.1 });
await press(page, 'KeyE'); await page.waitForTimeout(900);
await frame('Landing Hoist repair panel open (HUD state)');
await press(page, 'KeyT');
await page.waitForFunction(() => JSON.parse(document.getElementById('world').dataset.domainState).sites[0].advice !== null);
await page.waitForTimeout(600); await frame('First local test: cargo side too heavy, rope link missing');
await page.waitForFunction(() => JSON.parse(document.getElementById('world').dataset.domainState).sites[0].testSeconds === 0);
await setting(page, 'weight_b', 'rail_1500');
await joinPorts(page, { partId: 'rope', portId: 'anchor' }, { partId: 'boom', portId: 'anchor' });
await press(page, 'KeyT');
await page.waitForFunction(() => JSON.parse(document.getElementById('world').dataset.domainState).sites[0].advice?.valid === true);
await page.waitForFunction(() => JSON.parse(document.getElementById('world').dataset.domainState).sites[0].testSeconds === 0);
await page.waitForTimeout(400); await frame('Second local test passed after moving a weight and linking the rope');
await click(page, '[data-key=rationale]');
await page.getByRole('textbox', { name: 'Your one-line answer to the council' }).fill('I moved the far counterweight to balance the cargo and joined the rope to the boom anchor, keeping clear of the nests.');
await click(page, '[data-key=review]'); await click(page, '[data-key=submit]');
await page.waitForFunction(() => JSON.parse(document.getElementById('world').dataset.domainState).sites[0].phase === 'restoring');
await page.waitForTimeout(700); await frame('Local practice restoration: crew finishing, cargo lifting');
await page.waitForFunction(() => JSON.parse(document.getElementById('world').dataset.domainState).restoredSiteIds.includes('pier_hoist'), null, { timeout: 30000 });
await page.waitForTimeout(3600); await frame('Landing restored (local practice): hoist working, surroundings greening, debris cleared');
const exit = page.getByRole('button', { name: 'Exit' }); if (await exit.isVisible().catch(() => false)) await exit.click();
await page.waitForTimeout(500);

let last = Date.now();
const tick = label => async () => { if (Date.now() - last > 9000 && frames.length < 11) { last = Date.now(); await frame(label); } };
const SPAWN = { x: -10.2, z: 18.6 }, PUMP = { x: -10, z: 2.5 }, FORD = { x: -11.5, z: -6.3 }, NORTH = { x: -8, z: -9.8 }, FORK = { x: -3.5, z: -10.8 };
await trail([{ x: -12.4, z: 19.1 }, { x: -13, z: 20.2 }, { x: -13, z: 28.6 }], tick('Walking'));
await page.waitForTimeout(800);
await still('04', 'ref-04', 'Restorer at the end of the pier in the landing cove between cliffs', 'walked with WASD onto the pier');
await trail([{ x: -13, z: 28.6 }, { x: -13, z: 20.2 }, SPAWN, { x: -9.4, z: 14.4 }, { x: -11, z: 8 }, PUMP, { x: -14.2, z: 0.2 }], tick('Walking'));
await still('01', 'ref-01', 'Restorer at the village commons among the houses on the village plateau (storm state)', 'walked the footpath with WASD');
await trail([{ x: -14.2, z: 0.2 }, PUMP, { x: -12.5, z: -2.5 }, FORD, NORTH, FORK, { x: 0.2, z: -14.2 }, { x: 1.3, z: -17 }, { x: 0.6, z: -19.1 }, { x: -1.6, z: -20.2 }, { x: -4.6, z: -20 }, { x: -7.6, z: -18 }, { x: -12.4, z: -15.4 }], tick('Walking'));
await page.waitForTimeout(1200);
await still('05', 'ref-05', 'Restorer on the upland plateau at the waterworks (cool upland grade)', 'walked the footpath with WASD: ford, then the climb to the upland');
await frame('Upland plateau at the waterworks');
await trail([{ x: -12.4, z: -15.4 }, { x: -7.6, z: -18 }, { x: -4.6, z: -20 }, { x: -1.6, z: -20.2 }, { x: 0.6, z: -19.1 }, { x: 1.3, z: -17 }, { x: 0.2, z: -14.2 }, FORK, { x: 0.8, z: -11.2 }, { x: 3.4, z: -11.6 }], tick('Walking'));
await still('02', 'ref-02', 'Restorer arriving at the woodland path-light site among the groves', 'walked the footpath with WASD');
await trail([{ x: 3.4, z: -11.6 }, { x: 5, z: -12 }, { x: 4, z: -5 }, { x: 2.2, z: -0.4 }], tick('Walking'));
await page.waitForTimeout(800);
await still('03', 'ref-03', 'Restorer on the far bank of the broken bridge above the creek canyon (storm state)', 'walked the footpath with WASD');
await frame('Far bank of the broken bridge');
await browser.close();

const manifest = [
  '# Island capture manifest', '',
  `Build: working tree on ${commit}${dirty ? ' (uncommitted src changes present)' : ''}. Native 1920x1080 PNG from the live dev build at ${base}.`,
  'Camera: locked walk preset (yaw 35, pitch 48) following the restorer. Nothing is composited or retouched.',
  'Every still and walkthrough frame comes from one continuous session driven by real keyboard and pointer input, including a genuine local practice repair of the Landing Hoist. Zone and HUD text in brackets are read from the live page at capture time.', '',
  '## Stills', '', '| Still | Ref | Scene | How | Captured | SHA-256 |', '|---|---|---|---|---|---|',
  ...stills.sort((a, b) => a.file.localeCompare(b.file)).map(s => `| ${s.file} | ${s.ref} | ${s.scene} | ${s.how} | ${s.at} | ${s.sha256.slice(0, 16)} |`),
  '', '## Walkthrough frames', '', '| Frame | t (s) | Player x,z | Restored | Scene | Captured | SHA-256 |', '|---|---|---|---|---|---|---|',
  ...frames.map(f => `| ${f.file} | ${f.seconds} | ${f.player} | ${f.restored} | ${f.scene} | ${f.at} | ${f.sha256} |`),
  '', `Page errors: ${errors.length ? errors.join('; ') : 'none'}.`,
].join('\n');
await writeFile(join(out, 'stills', 'MANIFEST.md'), manifest);

// Equal-blur side-by-sides (internal review only; refs never enter the build).
const sxs = await chromium.launch({ channel: 'chrome', headless: true });
const sp = await sxs.newPage({ deviceScaleFactor: 1 });
for (const s of stills) {
  const ref = await readFile(join(root, 'refs-locked', `${s.ref}.png`)), game = await readFile(join(out, 'stills', s.file));
  const w = 1920, h = 1080;
  for (const blur of [false, true]) {
    const scale = blur ? 0.5 : 1, f = blur ? 'filter="url(#b)"' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2 * scale}" height="${(h + 44) * scale}" viewBox="0 0 ${w * 2} ${h + 44}"><defs><filter id="b"><feGaussianBlur stdDeviation="8"/></filter></defs><rect width="100%" height="100%" fill="#111"/><text x="16" y="31" fill="#fff" font-size="26" font-family="sans-serif">REF (review only) ${s.ref}</text><text x="${w + 16}" y="31" fill="#fff" font-size="26" font-family="sans-serif">GAME ${s.file}</text><image ${f} x="0" y="44" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${ref.toString('base64')}"/><image ${f} x="${w}" y="44" width="${w}" height="${h}" href="data:image/png;base64,${game.toString('base64')}"/></svg>`;
    await sp.setViewportSize({ width: w * 2 * scale, height: (h + 44) * scale });
    await sp.setContent(`<body style="margin:0">${svg}</body>`, { waitUntil: 'load' });
    await sp.screenshot({ path: join(out, 'sxs', `sxs-${s.file.slice(6, 8)}${blur ? '-blur' : ''}.png`) });
  }
}
await sxs.close();
console.log(JSON.stringify({ out, stills: stills.length, frames: frames.length, errors }));
