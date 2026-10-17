# Builder integration surface — Stage B

Publish: LOCKED. Temporary geometry throughout; no asset gate is implied.

UI helper owns only `src/ui/repair-panel.ts` and `src/ui/repair-panel.css`.
Builder retains the simulation and main.ts wiring. `src/domain/world.ts` exports
`WorldSnapshot`, `SiteSnapshot`, `EditorSnapshot` and `Command` for inspection.
The selected site snapshot has `draft`, `advice`, `feedback`, `phase`, `crew`,
`ticket` and `requires`. Editor has `slotId`, `optionId`, `tab`, `from`, `to`,
configuration `field`, and `stage` (construct/rationale/review/status).

`src/render/contract.ts` exports `HitAnchor`: kind socket/port, siteId, slotId,
label, endpoint (partId/portId or null), view world/inset, x/y in CSS pixels,
visible. `renderer.hitAnchors()` projects the actual assembly in both views.
These are read-only hit targets; a tap still dispatches a semantic command.

Current command grammar: SelectSlot, SelectOption, PlacePart, RemovePart,
RotatePart, SetDetent (cycle immutable allowed setting stops), ConfigField,
CycleConfiguration, SelectPort, JoinPorts, RemoveConnection, TestDraft,
EditRationale, Rationale, Review, Back, Exit, ConfirmPractice. The panel's public
semantic payloads will be adapted in main.ts without editing helper files.
World never calls a golden/example repair helper. A selected tray item must be
snapped into a real socket; removing/replacing parts detaches their graph edges.

Local confirmation requires a valid catalog test, prerequisite restorations and
a bounded player-written rationale. Connected callbacks only queue outside the
frame. Provisional accepted/pending/timeout never opens routes; bound finalized
success is the sole connected restoration path. Worker rig integration waits
for main's turnaround and Stage C3; Stage B contains scaffold/tool-slot hooks.

The helper's actual layout is now a structural, engine-free RepairRenderLayout.
Panel arrange precedes rendering; camera, inset, picking and anchors use its
actual inset, not the reserved container. Actual desktop inset is
(1392,744,504,312); phones are (8,196,196,108) and (8,192,196,103).
Journal/keyboard removes inset rendering. Explicit setting/config/rotation/
directed-port actions consume real catalog IDs. Helper-owned files are unchanged.

Preparation captures owner/context/epoch; queued is its expected result. The
registered prepared object is submitted only in that same connected session.
Original-transaction grants require valid matching ticket txId and every
technical/context flag. Pending draft export contains only siteId/artifact/
rationale; full preparation identity remains exclusively in its ticket.

Durable pre-wallet uncertainty is a bounded safety latch, not an approval.
Reconnect/reload cannot clear it. Original-hash recovery reads only; explicit
wallet activity acknowledgement cannot clear pending tickets. Actionable
notices survive autosave. Archive reads serialize and wait for actual installed
parents. Raw cache/getter flags never restore; already restored history is
skipped. Pending polls/results preserve other sites' journals and editing.

Strictly parsed completed-artifact hints suppress a repeat history glow only
after the complete original finalized grant boundary passes again. They cannot
restore a site before that read-only verification or bypass dependencies.

Bridge service framing uses an actual west-anchored workwalk, parent-gated and
dead-ended before the east bank. Repair/walking spans, yaw/pitch and body size
are unchanged. Placeholder building/tower clearance constants drive both
visible geometry and obstacles. Whole-bridge protected-region containment is
still a measured candidate constraint for main, never a camera-lock claim.
