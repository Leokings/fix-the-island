# Fix the Island

## Current release — 8 October 2026

Play: https://fix-the-island.vercel.app/#play

Primary hosting moved to Vercel on 9 October 2026 at the user's request.
The previous ChatGPT-hosted site is preserved, not the primary submission URL.
Deployment details: `docs/VERCEL-DEPLOYMENT.md`.

Landscape Three.js adventure with eight distinct restoration puzzles. WASD/arrows
to walk, E to interact, touch joystick on phones. **Local practice** offers the
complete wallet-free game. See `docs/PLAYER-GUIDE.md`.

**GenLayer testnet beta:** eight separate Bradbury contracts executed successfully;
public addresses are in `src/genlayer/deployments.json`. Source hashes and immutable
dependencies are pinned. A genuine AI repair review was submitted but remained
PROPOSING at release verification. Connected restoration requires finalized,
successful, matching approved evidence; practice progress is never promoted.
This is not yet a fully verified live-consensus walkthrough.

Latest visual pass: compact objective/journal HUD, foreground foliage cutaway,
repair-state colours, authored walking animation and eight accessible sites.
169 game tests and 80 backend tests passed. Actual desktop/touch controls passed.
No hackathon entry was submitted. `docs/PUBLIC-DEPLOYMENT.md` records current
status; the implementation notes below include historical checkpoints.

Publish: public hosting authorized by the user on 2026-10-08. The Sites release
checkout is `../fix-the-island-publish`; its `.openai/hosting.json` owns the Site
identity. GenLayer deployment is separately authorized using the existing
`ic-builds-bradbury` testnet account. Never export or publish wallet keys.

Landing refinement: a compact next-repair guide/checklist, physical-site marker,
contextual construction/test feedback, animated cargo/crews after genuine local
completion or verified connected approval, and optional synthesized sound.
Sound starts only from the Sound button; reload never autoplays. The imported
island remains freely walkable; dependencies lock repairs, not land. Run
`node tools/landing-refinement.mjs --strict-commit` for the focused actual-input
hoist completion, Save/Continue, next-objective and 667px touch check. This proves
only the first local repair, not all eight on this layout or live GenLayer.

All eight repair panels now explain their own goal with a live **draft preview**,
three focusable construction steps, optional hints and specific test reasons.
The hoist alone has a labelled balance target, heavier/lighter weights and
near/far positions; moving a weight visibly changes the lift-arm tilt. Preview
checks never replace Test or grant approval. Socket lists, direct setting
buttons and selected-part port choices reduce cycling; physical picking and
the existing keyboard controls remain available. Technical metrics/storage
limits are under Technical details; exact validators and save schemas remain.

Island rebuild (2026-10-13, user-approved, see `docs/GAME-DESIGN.md` §12): the walkable
island is now a stylized low-poly island generated in code (`src/content/stylized-island.ts`,
`src/render/island/`), replacing the imported Poly island in the game. One shared description
produces both the visible terrain and the walk/collision data; sites keep their IDs and unlock
order. A shallow ford keeps all land reachable; the creek bridge deck becomes walkable only after
the bridge is restored. Each restored site turns its surroundings from storm-dry to green, clears
debris, blooms flowers and (pump/waterworks/sluice) raises a clear creek. Old saves return to the
new landing. Walkability is checked by `tests/unit/stylized-island.test.ts`. Dev-only visual QA:
`?camera-at=x,z[,y]` and `?preview-restored=site,site` affect the camera/scenery only.

Previous replacement (superseded in the game): the complete **Island by Poly by Google** scene (CC BY 3.0)
and **Quaternius restoration robot** (CC0) replace the authored route terrain,
workshop and procedural humanoid motion. The robot is 1.65 m tall and plays the
original Idle/Walking/Running clips with AnimationMixer. Visible transformed
island vertices supply ground; rocks/trunk bases supply collision. Land never
locks behind repairs. The eight distinct puzzle IDs and prerequisite activation,
local/connected separation, uncertainty/recovery and final-approval checks remain.
Old saves retain validated drafts/progress and restart at the new landing, never
at obsolete world coordinates. Existing sources/assets/evidence are preserved.
Attribution and adaptation notes: `assets/island/README.md`,
`assets/robot/README.md`, `public/licenses/imported-island.txt` (pause-menu link).
Focused check: `node tools/imported-roam-smoke.mjs`. This replacement is not yet a
fresh full eight-repair replay or formal visual acceptance.

Historical pipeline before the user-authorized imported replacement: main recorded fresh B-01 loop-only acceptance and locked walking
35° yaw / 52° pitch / 8.4 m span and inset 35° / 58° / 5.8 m. C1 lighting/post
is in progress, not visually accepted. Renderer-only value blocking, one stable
sun, hemisphere/bounce fill, cast shadows, contact SSAO, filmic grade/fog and
genuine-height upland blending leave terrain/collision/authority unchanged.
Art-only capture uses unchanged hash-verified earned 731 saves and supported
Continue plus ordinary walking, with both saved origin and new render SHA:

```powershell
& 'C:/Program Files/nodejs/node.exe' tools/capture-c1.mjs --strict-commit
& 'C:/Program Files/nodejs/node.exe' tools/make-stage-sxs.mjs 'artifacts/stage-c/C1/<run-directory>'
```

Formal staged reviews/capture matrices are paused by the human's priority override.

An original browser restoration adventure using Three.js and TypeScript: eight physical construction families for water, power, transport and habitat, a fixed 60 Hz tick, and a renderer separate from authority. The imported robot/crew use real authored animations; the existing windmill remains unchanged. Historical exact `731c0cd80e713b58d3daaba79491e1306e0f4a1c` evidence completed all eight repairs and ending/reload on the previous layout at `artifacts/stage-b/reuse-journey/2026-10-08T17-38-53-798Z/`. That does not prove completion on the replacement island or connected approval.

Work only in this project. The sibling CircuitQuest project is preserved. Planner owns `PLAN.md`, `art/LOOK.md` and the initial ledger; Backend owns the paths listed in `docs/GENLAYER.md`; closed asset specialists supplied their isolated GLBs, Blender sources and turnarounds. Main owns process gates and flow diagrams.

The replacement no longer renders the SmallWorld-derived terrain/foliage; those sources/evidence and their MIT notice are preserved. Its supporting surface maps remain on water/repair equipment. The curated Survival/Factory props and separate palettes retain CC0 notices and `docs/PROP-PROVENANCE.md`; Nunito retains its OFL notice. Imported terrain is unconditional, with walking bounded by the visible shoreline, slopes and solid meshes rather than repair state. The user-authorized camera is wider (16 m desktop / 12 m landscape gameplay span; whole-island title view), replacing the historical 8.4 m camera. Only high palm geometry above the maximum terrain height dithers when blocking the hero; floors/collision are unchanged by occlusion treatment.

Focused native boot/walk/inspection and a five-repair windmill milestone use the existing server, default hardware Chrome, actual input and uniquely timestamped evidence directories:

```powershell
& 'C:/Program Files/nodejs/node.exe' tools/reuse-boot.mjs --strict-commit
& 'C:/Program Files/nodejs/node.exe' tools/reuse-expedition.mjs --strict-commit
```

The boot check captures articulated walking, pier inspection and 667px landscape, plus a paused warm/cool swap with exact domain equality. The expedition plays hoist, pump, sluice, bridge and windmill; it is deliberately not the eight-site ending/36-view package. Reports retain failures and distinguish dirty source from same-commit evidence. Licensed reuse supersedes the earlier asset-binding hold, not the frozen refs, authority or later review gates.

Node 24.19.0 and npm 11.17.0 are verified on this Windows host. All direct dependency versions are pinned in `package.json`, with the dependency graph in `package-lock.json`: Three.js 0.186.1, genlayer-js 1.1.8, direct viem 2.57.4, Vite 8.3.3, TypeScript 7.0.2, Vitest 5.0.3 and Playwright 1.64.0. Build currently emits a nonfatal large-chunk warning; this is not a performance guarantee.

From PowerShell, select the isolated project:

```powershell
Set-Location -LiteralPath 'C:/Users/leoki/OneDrive/Documents/okex hackathon/fix-the-island'
```

The npm shim on this host is broken. Invoke the installed Node executable and npm CLI directly. A clean dependency install is:

```powershell
& 'C:/Program Files/nodejs/node.exe' 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' ci --no-audit --no-fund
```

Build and typecheck:

```powershell
& 'C:/Program Files/nodejs/node.exe' 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run build
```

The initial setup checks are in `artifacts/setup/toolchain.log`. Unit checks cover movement/fixed ticks, shared ramp seams/full-foot support, physical edits, paused and background-site reconciliation, strict transactional saves, exact transaction/grant binding, prepare→queued→submit orchestration and reload-persistent unknown-broadcast safety. Run them with the same explicit npm CLI and `test`. Synthetic unit fixtures are not walkthrough or live judgment evidence.

Coordinate server ownership with main before starting. Current owned Vite exec session is **23496** at `127.0.0.1:5173`; do not start a second server. Both dev and local preview use `strictPort`, so a conflict cannot silently select a different port. If that session has ended, dev command:

```powershell
& 'C:/Program Files/nodejs/node.exe' 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run dev
```

Local preview of `dist` uses the same CLI with `run preview`. Neither command publishes a build.

`PLAN.md` revision 2 defines the eight site IDs, graph and construction requirements. `src/content/site-plan.ts` exposes its root constraints for backend coordination; it defines no option/slot/port catalog or repair validator. `src/genlayer` exports own those catalogs. Repairs in Stage B must use physical shaped gears, boards, pipes or bridge pieces with snap, rotate and connect interactions. Matching catalog IDs through generic selects or a checklist does not exercise construction. Keep inputs understandable and the game HUD compact; the rationale journal follows construction and is required for connected contextual review.

Read `docs/GENLAYER.md` for the exact backend integration contract. Every repair serializes the bounded `repair-v1` parts/configuration/connections envelope, with its rationale in `RepairDraft`. Builder consumes `src/genlayer/index.ts` exports when Backend provides them. Connected restoration requires a matching finalized successful approved record; queued, pending, accepted and polling timeout states do not restore a site. Reviewing crews may inspect, hammer and use scaffolding while the player explores. Rejection pauses them with an amber revision state; approval produces a brief glow and the physically finished machine. No completion countdown grants approval.

Local practice has an explicit persistent label and a separate save namespace. Its puzzle completion is local and never becomes a connected approval. The current setup has no configured connected runtime, signer, deployment or public transaction.

`tools/capture.mjs` is the Stage A capture skeleton. Inspect its specification without starting a server or browser:

```powershell
& 'C:/Program Files/nodejs/node.exe' 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run capture -- --help
```

`tools/journey.mjs` starts at the menu and uses actual keyboard/pointer/text input through eight constructions and traversable gates to the local ending. Read-only observations check results; no saves, teleportation or completed flags are injected. Its 11 journey frames and 36 closed/open composition captures cover all six scenes at 1920×1080, 844×390 and 667×375. Reports distinguish intermediate failures from completed runs. Against the existing server:

```powershell
& 'C:/Program Files/nodejs/node.exe' tools/early-hoist.mjs
& 'C:/Program Files/nodejs/node.exe' tools/layout-check.mjs --strict-commit
& 'C:/Program Files/nodejs/node.exe' tools/journey.mjs --strict-commit
& 'C:/Program Files/nodejs/node.exe' tools/annotate-composition.mjs 'artifacts/stage-b/reuse-journey/2026-10-08T17-38-53-798Z'
```

Refresh Vite's build metadata after the source checkpoint before strict capture.
Reports record source/runtime SHA, actual unmasked renderer, scoped measured FPS,
reload persistence, shader linking, allocated cast shadows and paused domain
invariance across the warm/cool swap. Use default hardware Chrome; older Stage A
forced software diagnostics are not playability/performance-floor evidence.
PNG originals are never retouched. Separate annotations show actual bounds,
coverage/count methods and placeholder gaps; main owns camera lock and critics.
The bridge has a parent-gated, west-anchored dead-end service workwalk. It lets
the player inspect real joints without opening the unapproved crossing. Its
service target keeps the same span/angles/body dimensions. Protected-region
and whole-structure bounds remain measured acceptance questions, not a lock.

Every journey uses a new timestamped directory, preserving previous failed runs.
The completed 731 packet contains 11 native journey frames, 36 native composition
views, separate overlays/equal-blur pairs and a hashed manifest. Nine earned
storage exports were copied unchanged after the real supported Save control,
with originating run/commit/time/tick/site-frame traces. They may support later
art-only Continue captures with provenance; they did not seed this fresh B proof.
The new prop and UI/font helper files remain unimported, outside this candidate.

layout-check verifies actual panel insets (desktop 1392,744,504,312; phones
8,196,196,108 and 8,192,196,103), journal and isolated HUD controls/ending labels.
Its keyboard boundary uses a **simulated visualViewport**, not a native mobile
OS keyboard. Those isolated component states do not grant game progress.

Click New local expedition. WASD/arrows move relative to the fixed camera, Shift walks briskly, E/Interact inspects, [ ] cycles sockets, 1–6 selects stock, Enter snaps, R rotates, F changes a detent, T tests and Esc exits/pauses. Parts/Configure/Connect expose equivalent physical socket/port controls; Test → Explain → Review → Submit is local confirmation. Inspection renders the same assembly and consumes actual panel layout before rendering, including keyboard protected regions. The temporary windmill service cover opens during construction and closes for testing; no decorative gear hides the draft. Cool/Warm swaps materials/lights without a domain command. `src/render/presets.ts` keeps the 8.4 m walking and 5.8 m inspection spans as reversible candidates; main records camera acceptance separately.

Connected mode is enabled only by real public config and an available injected
wallet, with explicit Connect; boot never prompts. Resolved rejected/declined/
execution-failure states can prepare again in the original session. New Submit
remains globally busy while another review runs, but other damaged sites remain
editable. Async polling/result updates never close unrelated inspections.

Resume reviews, Reverify approvals and Recover original hash are explicit
read-only actions. Archived original broadcasts reverify serially in catalog
dependency order, waiting for actual parent installations before children.
Cached tickets do not start crew activity or award progress, and reopened
history does not repeat restoration pulses. Unsafe/gated connected saves may
return to the landing until public rechecks restore routes.

A bounded caller/contract/chain/fixture safety marker is persisted before a
submission can reach the wallet request. Reload/reconnect does not clear unknown
broadcasts. Original-hash verification can resolve them; otherwise the player
must explicitly check original wallet activity before a separate retry. That
acknowledgement clears only uncertainty, never pending tickets or progress.
Storage failure blocks submission. Actionable notices are separate from and
not immediately overwritten by autosave feedback. No build/capture test signs.

Historical Stage A diagnostic (not the current eight-site input route):

```powershell
& 'C:/Program Files/nodejs/node.exe' tools/smoke-check.mjs
```

It records actual movement/interact/Escape/button input, reads the running WebGL context, and compares paused domain state before/after a visible material/light swap. Its report includes source base commit and working-tree state. These short diagnostic stills are not the full walkthrough, final reference comparisons or hardware-performance evidence. No capture command starts another server or signs/submits anything.

Capture requirements come from `BRIEF.md`, `art/BAR.md` and `docs/VERIFICATION-STORY.md`: six native reference-matched stills with manifest, equally blurred side-by-side pairs, a 45–90 second live walkthrough and 8–12 sampled frames. Final artwork and the final walkthrough package remain staged work; placeholder routes/comparison tools report their actual results separately. Reference PNGs stay review-only in `refs-locked/` and never enter game assets or the build.

Installed dependencies, generated builds, local tool runtimes and capture media are ignored by Git. Source, brief/plan files, tools, locked review refs and text logs remain trackable. Local Git uses `Local Game Builder <game-builder@localhost>`; there is no remote.
