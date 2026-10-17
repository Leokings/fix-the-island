// Development stills of the village pump repair screen: walks there with real
// WASD input, opens the repair with E and captures the editor.
// Usage: node tools/shot-pump-editor.mjs <outDir> [width] [height]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [outDir, w = '1600', h = '900'] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const YAW = 35 * Math.PI / 180;
const UP = { x: -Math.sin(YAW), z: -Math.cos(YAW) }, RIGHT = { x: Math.cos(YAW), z: -Math.sin(YAW) };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('world')?.dataset.heroReady === 'true', null, { timeout: 60000 });
await page.getByRole('button', { name: 'Begin exploring' }).click();
await page.waitForTimeout(1200);
const player = () => page.evaluate(() => { const d = document.getElementById('world').dataset; return { x: +d.playerX, z: +d.playerZ }; });
const held = new Set();
async function setKeys(keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
async function trail(points) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5));
    for (let k = 1; k <= n; k++) {
      const t = { x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n }, started = Date.now();
      for (;;) {
        const p = await player(), dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.3 || Date.now() - started > 2500) break;
        const up = (dx * UP.x + dz * UP.z) / d, right = (dx * RIGHT.x + dz * RIGHT.z) / d, keys = [];
        if (up > 0.38) keys.push('KeyW'); if (up < -0.38) keys.push('KeyS');
        if (right > 0.38) keys.push('KeyD'); if (right < -0.38) keys.push('KeyA');
        await setKeys(keys); await page.waitForTimeout(70);
      }
    }
  }
  await setKeys([]); await page.waitForTimeout(600);
}
let n = 0;
export const shot = async name => { await page.screenshot({ path: join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`) }); console.log('shot', name); };
// TRAIL="x,z|x,z" walks to another site (from spawn); the default goes to the village pump.
const route = process.env.TRAIL ? [{ x: -10.2, z: 18.6 }, ...process.env.TRAIL.split('|').map(p => { const [x, z] = p.split(',').map(Number); return { x, z }; })] : [{ x: -10.2, z: 18.6 }, { x: -9.4, z: 14.4 }, { x: -11, z: 8 }, { x: -10.3, z: 4.4 }];
await trail(route);
await shot('arrive');
await page.keyboard.press('KeyE'); await page.waitForTimeout(1500);
await shot('editor');
const extra = process.env.PUMP_STEPS;
if (extra) for (const step of extra.split(';')) {
  const [kind, arg] = step.split(':');
  if (kind === 'key') await page.keyboard.press(arg);
  if (kind === 'click') await page.locator(arg).first().click();
  if (kind === 'wait') await page.waitForTimeout(+arg);
  if (kind === 'shot') await shot(arg);
  if (kind === 'deppreview') { await page.evaluate(() => window.__dependencyPreview({ siteId: 'creek_bridge', ready: false, required: ['pier_hoist', 'village_pump', 'tidal_sluice'], confirmed: ['pier_hoist'], approvedParents: ['pier_hoist', 'village_pump'] })); await page.waitForTimeout(400); }
  if (kind === 'depstate') console.log('deps', arg, JSON.stringify(await page.evaluate(() => ({ states: [...document.querySelectorAll('.pb-deps-state')].map(e => e.textContent), resend: [...document.querySelectorAll('.pb-deps-retry')].map(b => b.dataset.key) }))));
  if (kind === 'tapone') { const [part, port] = arg.split('.'); const p = await page.evaluate(([part, port]) => JSON.parse(document.getElementById('world').dataset.hitAnchors).find(x => x.kind === 'port' && x.view === 'world' && x.endpoint?.partId === part && x.endpoint?.portId === port), [part, port]); await page.mouse.click(p.x, p.y); await page.waitForTimeout(300); console.log('targets', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.pb-target')].map(b => b.dataset.key)))); }
  if (kind === 'tapports') {
    const [a, b] = arg.split('>');
    const find = id => page.evaluate(id => { const [part, port] = id.split('.'); return JSON.parse(document.getElementById('world').dataset.hitAnchors).find(x => x.kind === 'port' && x.view === 'world' && x.endpoint && x.endpoint.partId === part && x.endpoint.portId === port); }, id);
    const pa = await find(a), pb = await find(b);
    console.log('ports', a, pa && [Math.round(pa.x), Math.round(pa.y), pa.visible], b, pb && [Math.round(pb.x), Math.round(pb.y), pb.visible], 'apart', pa && pb ? Math.round(Math.hypot(pa.x - pb.x, pa.y - pb.y)) : null);
    for (const p of [pa, pb]) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(300); }
    console.log('links', JSON.stringify(await page.evaluate(() => { const s = JSON.parse(document.getElementById('world').dataset.domainState), site = s.sites.find(x => x.id === s.inspectionId); return { count: site.draft.artifact.connections.length, editor: [s.editor.from, s.editor.to] }; })));
  }
  if (kind === 'wrongsocket') { const a = await page.evaluate(s => JSON.parse(document.getElementById('world').dataset.hitAnchors).find(x => x.kind === 'socket' && x.view === 'world' && x.slotId === s && x.visible), arg);
    console.log('socket anchor', JSON.stringify(a && [Math.round(a.x), Math.round(a.y)])); if (a) await page.mouse.click(a.x, a.y); await page.waitForTimeout(400); console.log('notice', JSON.stringify(await page.evaluate(() => { const n = document.querySelector('.repair-notice'); return { visible: !!n && !n.hidden, text: n?.textContent }; }))); }
  if (kind === 'noticestate') console.log('notice', arg, JSON.stringify(await page.evaluate(() => { const n = document.querySelector('.repair-notice'); return { visible: !!n && !n.hidden }; })));
  if (kind === 'focusenter') { await page.locator(arg).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  if (kind === 'slot') { for (let i = 0; i < 24; i++) { const s = await page.evaluate(() => JSON.parse(document.getElementById('world').dataset.domainState).editor?.slotId); if (s === arg) break; await page.keyboard.press('BracketRight'); await page.waitForTimeout(60); } }
  if (kind === 'links') console.log('links', JSON.stringify(await page.evaluate(() => { const s = JSON.parse(document.getElementById('world').dataset.domainState); const site = s.sites.find(x => x.id === s.inspectionId); return { editor: [s.editor.from, s.editor.to], conns: site.draft.artifact.connections.map(e => `${e.from.partId}.${e.from.portId}>${e.to.partId}.${e.to.portId}`) }; })));
  if (kind === 'ui') console.log('ui', arg, JSON.stringify(await page.evaluate(() => ({ pump: (s => [s.phase, s.crew, s.restorationSeconds])(JSON.parse(document.getElementById('world').dataset.domainState).sites.find(x => x.id === 'village_pump')), restored: JSON.parse(document.getElementById('world').dataset.domainState).restoredSiteIds, chip: document.querySelector('.council-chip')?.hidden ? null : document.querySelector('.council-chip')?.textContent, marker: !document.querySelector('.council-marker')?.hidden, invite: document.querySelector('.council-invite')?.hidden ? null : document.querySelector('.council-invite')?.textContent }))));
  if (kind === 'anchors') console.log('anchors', JSON.stringify(await page.evaluate(f => JSON.parse(document.getElementById('world').dataset.hitAnchors).filter(a => a.kind === 'port' && a.view === 'world' && new RegExp(f).test(a.label)).map(a => [a.label, Math.round(a.x), Math.round(a.y), a.visible]), arg)));
  // Every visible port on the machine must be clickable (not under a panel), and a mouse-made link must register.
  if (kind === 'mouseports') {
    const report = await page.evaluate(() => {
      const anchors = JSON.parse(document.getElementById('world').dataset.hitAnchors).filter(a => a.kind === 'port' && a.view === 'world' && a.visible);
      const canvas = document.querySelector('#world canvas');
      const covered = anchors.filter(a => { const el = document.elementFromPoint(a.x, a.y); return el && el !== canvas && el.closest('button, .pb-result, .pb-designs, .pb-bottom, .rp-dock'); }).map(a => a.label);
      return { ports: anchors.length, covered };
    });
    console.log('mouseports', JSON.stringify(report));
  }
  if (kind === 'mouselink') {
    const read = () => page.evaluate(() => JSON.parse(document.getElementById('world').dataset.domainState));
    const before = await read(), site = before.sites.find(s => s.id === before.inspectionId);
    const edge = site.draft.artifact.connections[Number(arg)];
    await page.locator(`[data-key="pb-unlink-${edge.from.partId}-${edge.from.portId}-${edge.to.partId}-${edge.to.portId}"]`).click();
    await page.waitForTimeout(300);
    const anchor = e => page.evaluate(e => JSON.parse(document.getElementById('world').dataset.hitAnchors).find(a => a.kind === 'port' && a.view === 'world' && a.endpoint && a.endpoint.partId === e.partId && a.endpoint.portId === e.portId), e);
    let ok = true;
    for (const end of [edge.from, edge.to]) {
      const a = await anchor(end);
      if (!a || !a.visible) { console.log('mouselink anchor not visible', JSON.stringify(end)); ok = false; break; }
      await page.mouse.click(a.x, a.y); await page.waitForTimeout(250);
    }
    const after = (await read()).sites.find(s => s.id === site.id).draft.artifact.connections;
    if (ok) console.log('mouselink', `${edge.from.partId}.${edge.from.portId} -> ${edge.to.partId}.${edge.to.portId}`, after.some(e => JSON.stringify(e) === JSON.stringify(edge)) ? 'JOINED' : 'NOT JOINED');
  }
  if (kind === 'overlap') console.log('overlap', JSON.stringify(await page.evaluate(() => { const r = e => e.getBoundingClientRect(); const dock = [...document.querySelectorAll('.rp-actions button, .rp-exit')].filter(b => b.offsetParent); const hits = []; for (const b of document.querySelectorAll('.pb button')) { if (!b.offsetParent) continue; const p = r(b); for (const d of dock) { const q = r(d); if (p.left < q.right && p.right > q.left && p.top < q.bottom && p.bottom > q.top) hits.push([b.dataset.key, d.dataset.key]); } } return hits; })));
  if (kind === 'chips') console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.pb-chip')].map(b => [b.textContent, b.getAttribute('aria-pressed'), getComputedStyle(b).backgroundColor]))));
  if (kind === 'walk') { const here = await player(); await trail([here, ...arg.split('|').map(p => { const [x, z] = p.split(',').map(Number); return { x, z }; })]); }
  if (kind === 'fill') { const [sel, text] = arg.split('='); await page.locator(sel).fill(text); }
  if (kind === 'waitfor') await page.waitForFunction(p => JSON.parse(document.getElementById('world').dataset.domainState).sites.find(s => s.id === 'village_pump').phase === p, arg, { timeout: 30000 });
}
if (errors.length) console.log('errors', errors);
await browser.close();
