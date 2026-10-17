import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Stage A diagnostic only: actual input, no seeded progress, no chain writes.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'artifacts/stage-a');
await mkdir(output, { recursive: true });
const report = { scope: 'Stage A WebGL/input/style smoke only', timestamp: new Date().toISOString(),
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), actions: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  const http = await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  assert.equal(http.status(), 200);
  await page.waitForFunction(() => Number(document.getElementById('world')?.dataset.frames ?? 0) >= 8, undefined, { timeout: 30_000 });
  const host = page.locator('#world');
  assert.equal(await host.getAttribute('data-renderer'), 'webgl2');
  report.runtimeBuildCommit = await page.locator('meta[name="fix-the-island-build"]').getAttribute('content');
  assert.equal(report.runtimeBuildCommit, report.baseCommit, 'Restart/reload Vite configuration after committing source before this check');
  report.shadowMapReady = await host.getAttribute('data-shadow-ready') === 'true';
  report.shaderProgramsLinked = await host.getAttribute('data-programs-linked') === 'true';
  assert(report.shadowMapReady && report.shaderProgramsLinked, 'Shadow allocation and shader program links must be valid');
  report.webgl = await page.evaluate(() => {
    const canvas = document.querySelector('#world canvas'), gl = canvas.getContext('webgl2');
    return { version: gl.getParameter(gl.VERSION), width: canvas.width, height: canvas.height };
  });
  report.siteCount = Number(await host.getAttribute('data-site-count'));
  assert.equal(report.siteCount, 8);
  report.start = { x: Number(await host.getAttribute('data-player-x')), z: Number(await host.getAttribute('data-player-z')) };
  await page.screenshot({ path: join(output, 'smoke-warm.png'), fullPage: false });
  report.actions.push({ kind: 'key-down', key: 'KeyW', time: new Date().toISOString() });
  await page.keyboard.down('KeyW');
  try { await page.waitForFunction(() => document.getElementById('world')?.dataset.focus === 'pier_hoist', undefined, { timeout: 15_000 }); }
  finally { await page.keyboard.up('KeyW'); report.actions.push({ kind: 'key-up', key: 'KeyW', time: new Date().toISOString() }); }
  report.moved = { x: Number(await host.getAttribute('data-player-x')), z: Number(await host.getAttribute('data-player-z')) };
  assert(report.moved.x < report.start.x && report.moved.z < report.start.z, 'Camera-relative walking must move in both planned axes');
  await page.keyboard.press('KeyE'); report.actions.push({ kind: 'key-press', key: 'KeyE' });
  await page.waitForFunction(() => document.getElementById('world')?.dataset.inspection === 'pier_hoist');
  await page.screenshot({ path: join(output, 'smoke-inspect.png'), fullPage: false });
  report.inspection = JSON.parse(await host.getAttribute('data-inspect-view'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('world')?.dataset.inspection === '');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('world')?.dataset.paused === 'true');
  report.actions.push({ kind: 'key-press', key: 'Escape', count: 2 });
  const before = await host.getAttribute('data-domain-state');
  await page.screenshot({ path: join(output, 'swap-warm.png'), fullPage: false });
  await page.getByRole('button', { name: 'Cool lighting', exact: true }).click();
  report.actions.push({ kind: 'pointer-click', target: 'Cool lighting' });
  await page.waitForFunction(() => document.getElementById('world')?.dataset.style === 'cool-smoke');
  const after = await host.getAttribute('data-domain-state');
  assert.equal(after, before, 'Material/light swap must leave domain state unchanged');
  await page.screenshot({ path: join(output, 'swap-cool.png'), fullPage: false });
  const hash = async (name) => createHash('sha256').update(await readFile(join(output, name))).digest('hex');
  const domainHash = (state) => createHash('sha256').update(state).digest('hex');
  report.styleSwap = { paused: true, domainUnchanged: true, beforeDomainHash: domainHash(before), afterDomainHash: domainHash(after), warmHash: await hash('swap-warm.png'), coolHash: await hash('swap-cool.png') };
  assert.notEqual(report.styleSwap.warmHash, report.styleSwap.coolHash);
  report.frames = Number(await host.getAttribute('data-frames'));
  report.renderedTriangles = Number(await host.getAttribute('data-triangles'));
  assert(report.renderedTriangles > 0);
  assert.deepEqual(report.errors, []);
  report.result = 'checks completed';
  await context.close();
} catch (error) {
  report.result = 'check error'; report.failure = error.message; process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(join(output, 'smoke-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
