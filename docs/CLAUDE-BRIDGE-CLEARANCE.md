# Prompt for Claude: Bridge approach and interaction clarity

Please fix the scene clearance and interaction cue around the west/village
approach to Splitbank Bridge in Fix the Island.

Project: `C:/Users/leoki/OneDrive/Documents/okex hackathon/fix-the-island`.
The backend recovery fixes are committed on main as `b8ef871` and `b799659`.
The Vercel app is https://fix-the-island.vercel.app/.

Wallet connection now automatically rechecks the original on-chain reviews and
restores the Hoist, Pump and Sluice (3/8). You do not need to click recovery
buttons to reproduce this. The old Bridge transaction finalized NO_MAJORITY;
its original 8-part/8-link construction is preserved, editable and passes the
local capacity-8 test. It still needs a new successful finalized review before
the bridge deck becomes walkable.

Observed scene problem in the real browser:

- At approximately world x=-7.77, z=2.42, beside the barrels/stock on the village
  side of the bridge, W and D do not move the robot. The prompt says Spring Pump
  even though the Bridge objective is about 5 metres away.
- Pressing S steps back to approximately x=-7.10, z=3.60; movement is free there
  and E correctly opens Splitbank Bridge.
- The Bridge editor and its Test button then work normally. Pause → Resume game
  also preserves the connected island.

Inspect the actual rendered props and their collision boxes, the authored path
into the west bridge landing, and the visibility/placement of the interaction
cue. Move obstructing supply barrels/crates or correct oversized/misaligned
collision boxes so the intended approach is clear. Check whether the prompt
matches the scene near the pump/bridge overlap. If a domain interaction-rule
change is needed, document the measured case for Codex rather than duplicating
the rule in the renderer.

Preserve the shared backend and build-artifact format, wallet recovery, repair
dependencies, and GenLayer review logic. Keep the broken bridge deck closed
until its actual finalized approval; provide a clear place on the bank from
which to inspect it. Do not use a mock approval or remove all collision to make
the route pass.

Verify with real keyboard and touch input, after automatic wallet recovery and
after a reload. Capture the west-bank approach and prompt before/after at
desktop and phone landscape. Check that the restored pump remains inspectable,
the bridge opens from its intended approach, and unrelated walking routes stay
clear. Commit only your scene/UI files; leave unrelated work intact.
