# Verification story

The player opens the landscape game, explores real Three.js terrain, constructs a repair at an accessible site, submits the exact design for local practice or GenLayer review, receives an honest decision, and sees the corresponding machinery and geography recover. Save/reload preserves the correct mode and progress without inventing chain approval.

## Required evidence before handoff

- Clean install, typecheck/build and documented local server boot. Record exact source commit and command exits; preserve failures rather than rewrite them as successes.
- Native desktop and short-landscape browser screenshots, console/network errors, visible title/game controls and real loaded Three.js renderer. No reference image in public assets or built output.
- Keyboard and touch movement, camera-relative directions, collision footprints, shoreline/elevation guards, recovery from invalid saved positions, pause and clear-input on blur/dialogs.
- Same final skinned hero asset for idle/walk/repair; native gait frames show alternating articulated legs and grounded movement, not a vertically translated static body.
- Every repair: invalid construct and actionable fault feedback; actual part/configuration manipulation; passing construct; prerequisites; before/after visible consequence; pending/rejected/retry states without progression leakage. Walk a complete local route through all repairs to the real ending without seeded completion flags or teleporting around collision.
- Save version/schema validation, corrupt storage and unavailable storage handling; replay/reset scope; namespace isolation across local versus live, network, contract and wallet. Previous local completions never become live-approved sites.
- Contract lint before tests. Direct tests for all immutable fixtures, technical validity and malformed/oversized/replay/unauthorized inputs, caller isolation, dependencies, rejected reasoning and bad validator response. These tests do not prove GenVM runtime or consensus.
- Independent validator checks cover same structured decision, disagreeing decisions, bad types/missing fields, injection-like explanations, leader failure and transient failure handling. State mutation only after a valid agreed decision.
- SDK adapter tests for missing configuration, rejected wallet, wrong network/account change, pending timeout, accepted-but-execution-failed, finalized-but-execution-failed, approved receipt mismatch, replay/reload recovery, and successful finalized read reconciliation. Mocked transport evidence must be labelled mocked, never presented as a public-chain transaction.
- Real GenVM/full-consensus integration is recorded separately. Do not broadcast to a public network or fund/unlock/create a wallet to obtain evidence without separate human authorization. If unavailable, preserve the runnable integration tests and explain the unverified boundary.
- Six native reference-matched stills and manifest, full side-by-sides/blur variants, 45–90 second live walkthrough and extracted frames. Fresh separate Critic per gate; main's final harsh visual read; no visual WIN before both.

The verification skill stops a check at the first broken boundary: record its evidence, give Builder a specific failure, fix it, then verify again. Do not hide an error by continuing into downstream claims.
