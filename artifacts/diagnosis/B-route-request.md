# Stage B route diagnosis request

Publish: LOCKED. Technical diagnosis only; no visual score and no Stage D FAIL streak.
Source checkpoint: `05959cdaa097de9e75283de3ae2c4212f1f3f1af`.

The placeholder eight-site input journey repeatedly stops at a service approach even though its target centre has ground. Retained evidence includes the c18 bridge arrival, d93 path-light arrival and the current 059 pump-return failure. See `artifacts/rounds.log`, `artifacts/stage-b/boot.log` and `artifacts/stage-b/journey-report.json` for exact poses, timings and source identities. Current report: four loop frames, 18 compositions, no ending; stop near (-19.2198295, 4, 24.8191537) while aiming at (-18, 24.8).

Audit all journey approaches, detours, inspection stances, return legs and short interpolated targets together. A supported target does not prove that the eight-direction arrival envelope or the intervening path has room for all four footprint samples. Distinguish capture-driver issues, shared-floor discontinuity, real obstacle collision and actual visible-map usability.

Read-only evidence and implementation:

- `BRIEF.md`, `PLAN.md`, `art/LOOK.md`, `art/BAR.md` and locked refs/source list.
- `artifacts/rounds.log`, `artifacts/verdicts/A-plan-02.md`, current Stage B boot/report/loop frames and composition measurements/native PNGs.
- `tools/browser-play.mjs`, `tools/journey.mjs`, `src/content/island-level.ts`, `src/content/service-layout.ts`, `src/content/site-plan.ts`, `src/domain/terrain.ts`, `src/domain/world.ts`, `src/input/camera-relative.ts` if present, and `tests/unit/seams.test.ts`.

No implementation edits, score, authority injection, preview replacement, signing, broadcast, deployment, dependency/global configuration changes or art work. An isolated offline ground/steering calculation is diagnostic only, not gameplay evidence. Preserve the 0.28 m footprint, 0.22 m step, 38-degree slope limit, real rails, route dependencies and visible-floor alignment.

Write only `artifacts/diagnosis/B-route-steer.md` with Root cause, Evidence, What to stop doing, Steer instructions and Success check. Cite concrete files/lines/poses. Provide a bounded comprehensive route correction/verification strategy for the primary Builder, not another untested edge waypoint. The success check remains actual input from a new local expedition through all eight repairs, ending and reload, with current-source camera evidence; no changes to the locked Visual Bar.
