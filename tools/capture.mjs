import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Stage A skeleton. Register actual playable input routes after Stage B.
export const CAPTURE_SPEC = Object.freeze({
  viewport: Object.freeze({ width: 1920, height: 1080 }),
  deviceScaleFactor: 1,
  matchedRefs: Object.freeze(Array.from({ length: 6 }, (_, i) => `ref-0${i + 1}`)),
  walkthroughSeconds: Object.freeze({ min: 45, max: 90 }),
  sampledFrames: Object.freeze({ min: 8, max: 12 }),
  runtimeCommitSelector: 'meta[name="fix-the-island-build"]',
});

// Record browser inputs rather than mutating simulation or saved progress.
// The future route supplies real game coordinates and verifies each result.
export async function performInput(page, action, log) {
  const startedAt = new Date().toISOString();
  switch (action.kind) {
    case 'key-down':
      await page.keyboard.down(action.key);
      break;
    case 'key-up':
      await page.keyboard.up(action.key);
      break;
    case 'key-press':
      await page.keyboard.press(action.key);
      break;
    case 'pointer-move':
      await page.mouse.move(action.x, action.y);
      break;
    case 'pointer-down':
      await page.mouse.down({ button: action.button ?? 'left' });
      break;
    case 'pointer-up':
      await page.mouse.up({ button: action.button ?? 'left' });
      break;
    default:
      throw new Error(`Unsupported capture input: ${action.kind}`);
  }
  log.push({ sequence: log.length + 1, startedAt, completedAt: new Date().toISOString(), ...action });
}

// The running game's commit must match the capture commit. Stage A's setup
// page has no stamp, so it cannot produce a claimed gameplay capture here.
export async function captureNativeStill(page, { path, commit, scene, camera, matchedRef, inputLog }) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert(CAPTURE_SPEC.matchedRefs.includes(matchedRef), 'Unknown locked reference');
  assert(scene && camera, 'Scene and camera metadata are required');
  assert(inputLog.length > 0, 'An actual input route is required');
  assert.deepEqual(page.viewportSize(), CAPTURE_SPEC.viewport);
  const pixelRatio = await page.evaluate(() => window.devicePixelRatio);
  assert.equal(pixelRatio, CAPTURE_SPEC.deviceScaleFactor, 'Capture at native pixel ratio 1');
  const runtimeCommit = await page.locator(CAPTURE_SPEC.runtimeCommitSelector).getAttribute('content');
  assert.equal(runtimeCommit, commit, 'Running build does not match the capture commit');
  const timestamp = new Date().toISOString();
  await page.screenshot({ path, type: 'png', fullPage: false });
  return {
    file: path, buildCommit: commit, resolution: '1920x1080', scene, camera,
    timestamp, matchedRef, inputCount: inputLog.length,
  };
}

export async function runCapture() {
  // Deliberate gate: no synthetic screenshot, route or completion evidence.
  throw new Error('No playable capture route registered. Await Stage B input-route implementation. No capture created.');
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (process.argv.includes('--help')) {
    console.log('Fix the Island capture skeleton: no live route registered.');
    console.log(JSON.stringify(CAPTURE_SPEC, null, 2));
    console.log('Help starts no server/browser and writes no output. Future routes must use real traversal and repair inputs.');
  } else {
    runCapture().catch((error) => {
      console.error(error.message);
      process.exitCode = 2;
    });
  }
}
