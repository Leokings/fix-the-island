# Build view — UI ↔ backend handoff

Status: the GAME-DESIGN §6/§11 build view now runs on **all eight sites**
(`src/ui/build-view.ts`). The village pump adds the approach choice; the other
sites show their own checklist (from `describeRepair`) and a site-setup card
(choices only where the fixture offers more than one). Parts with several
stocks (hoist weights, windmill gears) offer Swap; any fitted part can be
rotated. The old tabs, socket cycler and inset are hidden on every site, so the
play scripts need the selectors below for every site, not just the pump.

## Shared format: nothing new

The build view edits the same `repair-v1` artifact through the same world
commands as the generic panel. There is no new data shape, no new contract
field and no new authority. What the player builds is exactly what
`validateRepairLocally` tests and what a submission freezes.

| Player action | Commands sent (existing) |
|---|---|
| Choose an approach (`direct_pump` / `quiet_pump` / `rain_cistern`) | `SelectSlot`+`RemovePart` for each placed part the approach does not use (after an on-screen confirm), then `SetConfiguration` ×3 with that design's `mountZoneId`, `outputModeId`, `routeId` |
| Tap a part in the tray | `SelectSlot`, `SelectOption` |
| Tap its glowing socket (or **Place**) | `SelectSlot`, `SelectOption`, `PlacePart` |
| **Remove** a fitted part | `SelectSlot`, `RemovePart` |
| Tap a port, then the port it feeds | `SelectPort`, `SelectPort`, `JoinPorts` |
| Turn a dial | `SetSetting` |
| Test / Explain / Review / Submit | unchanged |

The approach the player sees is inferred from the placed parts when the site
opens (`inferPumpDesign`: the smallest design containing every placed part).

**Agreed with backend (2026-10-14):** writing the design's three configuration
values (mount zone, output mode, route) when the player picks an approach is
acceptable: they are the design's fixed setup, not the repair. The contract
identifies the design from the installed slots and checks connections, budget
and that the setup matches. Condition: the setup must be visible. The chosen
approach's card shows a **Blueprint setup** panel (mounting place, working mode,
route) read from the actual draft, with a ✓ when it matches the design and a
"Use this blueprint setup" button if it does not; the switch prompt names the
new setup before anything changes. On phones it is a compact chip in the
approach row.

## Selectors for test scripts (all sites)

The generic tabs, socket cycler and inset are hidden on the pump. Keyboard
shortcuts are unchanged (`[`/`]` socket, `F` detent).

| Generic panel | Pump build view |
|---|---|
| `[data-key="tab-parts"]` | `[data-key="pb-step-place"]` |
| `[data-key="tab-connect"]` | `[data-key="pb-step-connect"]` |
| `[data-key="tab-configure"]` | `[data-key="pb-step-set"]` |
| `[data-key="part-<optionId>"]` | `[data-key="pb-part-<slotId>"]` then `[data-key="pb-place"]` |
| `source-role` / `target-role` / `port-next` / `join` | `[data-key="pb-port-<partId>-<portId>"]` twice (from, then to) |
| detent `+`/`−` | `[data-key="pb-dial-<slotId>-up"]` / `-down` |
| rotate | `[data-key="pb-rotate"]` (selected fitted part) |
| choose another stock | `[data-key="pb-swap-<optionId>"]` (fitted) / `[data-key="pb-variant-<optionId>"]` (before placing) |
| configure fields | `[data-key="pb-setup-<field>-<value>"]` (only when the site has a choice) |
| — | `[data-key="pb-design-<designId>"]`, `[data-key="pb-switch-confirm"]` (only shown when parts would be cleared), `[data-key="pb-remove"]`, `[data-key="pb-setup-apply"]` |
| `test`, `rationale`, `review`, `submit`, `exit` | unchanged |

Physical socket and port anchors are still published in `data-hit-anchors`
(pump sockets only for the chosen approach, anchored on the part itself).

Scripts that drive repairs through the generic panel and now need these
selectors: `tools/browser-play.mjs` (`tab()`, `place()`, `join()` via
`source-role`/`port-next`/`join`; `setting()` still works with its keyboard
detents once `tab-configure` becomes `pb-step-set`), `tools/clear-island-journey.mjs`,
`tools/journey.mjs`, `tools/reuse-expedition.mjs`, `tools/landing-refinement.mjs`,
`tools/layout-check.mjs`, `tools/capture-island.mjs`.

## Where the code is

Uncommitted in this checkout (new files are untracked, so `git diff` alone does not show them):
`src/ui/pump-build.ts`, `src/ui/pump-build.css`, `src/render/island/pump-machinery.ts`,
`src/render/island/scaffold.ts`; edits in `src/ui/repair-panel.ts`, `src/render/three-renderer.ts`,
`src/render/contract.ts`, `src/content/assembly-layout.ts`, `src/content/stylized-island.ts` (one house moved),
`src/main.ts` (`removePart`/`tapPort` mapping). Dev capture: `node tools/shot-pump-editor.mjs <outDir>`.

## What the renderer shows (display only)

- Authored models for all 19 pump slots on a stone platform; storm-worn
  (rusted, leaning) until a build is installed.
- Blueprint ghosts in the chosen approach's empty sockets; the held part's
  ghost pulses warm.
- Copper plumbing between authored port points; flow beads run along water
  pipes only during a local test or after restoration.
- A crew scaffold with an awning while the crew is present.
- A close-up camera while building; the restorer steps out of frame.

## Council reveal at the commons fire (display only)

The four island priorities (fisher, farmer, engineer, elder) sit around the
commons fire as village life. `CouncilReveal.present(p: CouncilPresentation)`
(`src/ui/council/council-reveal.ts`) plays any presentation from
`src/genlayer/council/types.ts` there: pending/accepted (deliberating, thinking
bubbles), timed_out, failed, and finalized (each member stands and reacts in
contract order, then the verdict card). It never touches the World, saves,
wallets or restoration; `assertCouncilResult` runs before a finalized reveal.

- **Live (backend to wire):** once the adapter returns a verified finalized
  presentation, call `council.present(livePresentation)` from `src/main.ts`.
  Only `source: 'genlayer'` results are labelled "Council decision · verified".
- **Practice (now):** after the pump is restored by local rules, walking near
  the fire offers "Council preview at the fire (mock)". It builds a mock
  approval of the design actually built (`src/ui/council/council-preview.ts`:
  contract-matching stances, quality `good`, consequences) and is badged
  MOCK PREVIEW / "Simulated decision". It awards nothing.
- While the reveal holds the screen, movement commands are withheld from the
  World tick and the HUD hides; Escape closes, Space/Enter skips.
- Seat colliders `council-seat:<role>` were added to the stylized island level.
- Dev capture: `node tools/shot-council.mjs <outDir> <designId>` (uses the
  DEV-only `window.__council` hook).

### One review, shown in two moments (2026-10-14)

The pump's own repair transaction is the council review; there is no second
review step. `CouncilReveal` now has an ambient state the player sees while
still exploring, plus the cinematic reveal they choose to hear at the fire.

| Pump repair state | Call | What the player sees |
|---|---|---|
| `submitted` / `pending` | `council.setAmbient(pending presentation)` | Thinking bubbles over the members, steady fire, top note "The council is weighing your pump plan · keep exploring" |
| `accepted` (not final) | `setAmbient(accepted presentation)` | Bright fire, "A result is forming · waiting for finality" |
| finalized approve / revise (verified receipt) | `setAmbient(finalized presentation)` | Bright fire, "!" marker over it, "The council has decided · come to the fire to hear it"; the invite at the fire then calls `council.present(...)`. After it is heard the note and marker clear. |
| `timed-out` / failed | `setAmbient(timed_out / failed)` | Low fire, "… this is not a rejection" |
| new submission / cleared | `setAmbient(null)` | Idle council |

`council.pendingDecision` returns the finalized presentation still waiting to
be heard. Mock presentations are always prefixed "MOCK PREVIEW"; only
`source: 'genlayer'` results that pass `isVerifiedCouncilPresentation` read as
verified. Nothing here touches the World, saves, wallets or restoration.

- Practice: `council.observe(snapshot)` (called each frame) plays the pump
  crew's work as a labelled mock deliberation, then leaves a labelled mock
  approval of the design actually built waiting at the fire. Grants nothing.
- Dev only: `window.__councilFlow.show(designId, 'pending'|'accepted'|'approve'|'revise'|'timed_out'|'failed')`,
  `.hear()`, `.clear()` drive these visuals with labelled mock data.
- The council now sits on log seats attached to each member; the fire pit's
  old benches were removed.
