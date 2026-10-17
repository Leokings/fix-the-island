// Plays the first-visit tutorial as a new visitor (fresh browser storage) and
// captures each coach card: intro, walk/open, fix, answer, finish, council, live.
// Usage: node tools/check-tutorial.mjs <outDir>   (needs the dev server on :5173)
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join as path } from 'node:path';
import { openGame, inspect, place, setting, join, state, press, click } from './browser-play.mjs';

const out = process.argv[2] ?? 'artifacts/tutorial';
await mkdir(out, { recursive: true });
const { browser, page, errors } = await openGame({ width: 1440, height: 900 });
const coach = async () => (await page.locator('.coach').isVisible()) ? (await page.locator('.coach h2').textContent()) : null;
let n = 0;
const shot = async name => { await page.waitForTimeout(400); await page.screenshot({ path: path(out, `${String(++n).padStart(2, '0')}-${name}.png`) }); console.log(n, name, '→', await coach()); };
const expectCoach = async (title) => { await page.waitForFunction(t => document.querySelector('.coach h2')?.textContent === t && !document.querySelector('.coach')?.hidden, title, { timeout: 20000 }); };

await page.getByRole('button', { name: /Begin exploring|Start new practice game/ }).first().click();
await expectCoach('A storm hit the island in the night'); await shot('intro');
await click(page, '[data-key="coach-next"]');
await page.waitForFunction(() => /Walk to|Open the repair/.test(document.querySelector('.coach h2')?.textContent ?? ''));
await shot('walk-or-open');
await inspect(page, 'pier_hoist');
await expectCoach('Find the fault and fix it'); await shot('fix');
await place(page, 'rope', 'rope_standard'); await setting(page, 'weight_b', 'rail_1500');
await join(page, { partId: 'rope', portId: 'anchor' }, { partId: 'boom', portId: 'anchor' });
await press(page, 'KeyT');
await page.waitForFunction(() => { const s = JSON.parse(document.getElementById('world').dataset.domainState); const site = s.sites.find(x => x.id === 'pier_hoist'); return site.advice?.valid === true && site.testSeconds === 0; }, null, { timeout: 20000 });
await expectCoach('Answer the council'); await shot('answer');
await click(page, '[data-key="rationale"]');
await page.getByRole('textbox', { name: 'Your one-line answer to the council' }).fill('Crews stay on the marked path and lift slowly with the guarded pulley so loads never swing over the nests.');
await click(page, '[data-key="review"]');
await expectCoach('Finish the repair'); await shot('finish');
await click(page, '[data-key="submit"]');
await expectCoach('Meet the council'); await shot('council');
// Walk is not needed: the restorer is already beside the hoist's council. Hear it.
await page.getByRole('button', { name: /Hear the Landing Hoist council/ }).click({ timeout: 20000 });
await page.waitForFunction(() => document.body.classList.contains('council-open'));
await page.waitForTimeout(1500); await shot('council-reveal');
await page.keyboard.press('Escape');
await expectCoach('You’ve got it'); await shot('live');
const s = await state(page);
assert.equal(s.mode, 'practice');
await click(page, '[data-key="coach-practise"]');
await page.waitForFunction(() => document.querySelector('.coach')?.hidden === true);
assert.equal(await page.evaluate(() => localStorage.getItem('fix-island:tutorial-done')), '1');
console.log('tutorial complete; remembered as done; page errors:', errors.length ? errors : 'none');
await browser.close();
