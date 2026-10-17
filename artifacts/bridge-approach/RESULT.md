# Bridge west approach: clearance and interaction cue

Measured on the stylized island with `node tools/check-bridge-approach.mjs <out> [w h] [touch]`
(real keyboard or a real touch drag on the on-screen joystick and the Interact button;
`RELOAD=1` saves, reloads and continues first).

## Cause
Supply props around each site (barrels, crates, fences from `imported-scenery.ts`) were
authored for the earlier island and kept their offsets on the rebuilt one. At the pump,
one barrel stood 0.55 m from the pump platform's east edge — narrower than the
restorer (~0.6 m) — closing the natural way around the platform at x≈-7.77, z≈2.42.
A fence ran across the bridge's west landing and a crate sat at its edge. Their colliders
were correct, measured from the visible models; the props were misplaced.

## Fix (scene only)
- On the stylized island every solid work-area prop keeps clear of footpaths
  (1.4 m + its own reach from the path centre) and leaves at least 1 m of walking room
  around every site platform. 12 props were dropped island-wide (pump 5, sluice 3,
  windmill 2, hoist 1, bridge 1); all stood in walking room.
- A signpost marks the bridge's west-bank landing (x≈-7.05, z≈0), where the bridge,
  not the pump, is in focus. The deck stays closed until a finalized approval.

## Results
| Check | Before | After |
|---|---|---|
| Desktop keyboard: W / D at the reported spot | 0 m / 0 m (stuck) | 1.34 m / 1.33 m |
| Phone landscape touch joystick: up / right | 0.03 m / 0 m (stuck) | 1.56 m / 1.60 m |
| Prompt on the west landing | never reached; "Spring Pump" | "E / Interact · Splitbank Bridge" |
| E / Interact on the landing | opened the pump | opens the bridge; deck stays closed |
| Pump from its own side | opens | opens |
| After Save → reload → Continue | — | same as After |

At the reported spot itself the prompt reads "Spring Pump": that is correct, the
restorer is 2.2 m from the pump and 5.3 m from the bridge's centre, so no domain
interaction-rule change is needed. The focus rule from `163394e` (deepest relative
reach) is unchanged.

Typecheck, 220 unit tests, the production build and the full eight-site journey
(repairs, ending, Save/Continue) pass.

Not verified here: the connected path with automatic wallet recovery — that needs a
real wallet, which only the human can operate. The change touches no wallet,
recovery, review or build-artifact code, and the island geometry is identical in
practice and connected modes.
