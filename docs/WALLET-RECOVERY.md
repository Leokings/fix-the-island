# Wallet resume and Bridge recovery

Connect GenLayer resumes the wallet's island automatically. StudioNet wallet
history supplies original review candidates, even without a browser save. The
adapter checks contract source/protocol identity, the original transaction log,
caller, recipient, full submitted build, final consensus/execution outcome and
the matching receipt read from `LATEST_FINAL`. History and local saves alone
never approve a repair.

Approved repairs install in dependency order. Independent repairs continue when
one review cannot be read. Pending reviews are checked again after 15 seconds
while the game is active, with a single observation per ticket per sweep. Each
sweep has a 90-second deadline; the player can walk, edit and pause throughout.
No recovery operation requests a signature or resubmits a transaction.

Finalized `NO_MAJORITY` and failed execution return the saved build for revision.
The terminal ticket is removed and its matching uncertainty marker is cleared
after verification. A pending review blocks a new submission for its own site;
it does not block independent repairs. Unknown broadcasts remain recoverable.

## Menus and practice games

- Connect GenLayer loads the existing wallet island and runs recovery.
- Resume game returns from Pause to the same world without resetting it.
- Start new practice game backs up the existing practice save before starting.
- Resume previous practice game loads that backed-up practice expedition.
- Wallet approvals belong to the deployed contracts. Starting practice does not
  reset them or make approved sites available for another on-chain reward.

The menu edits add behavior and labels only. Island models, layout, materials,
camera and graphics were not changed in this recovery pass.

## Repeatable read-only verification

```powershell
node tools/check-wallet-recovery.mjs <public-wallet-address> artifacts/deployment/wallet-auto-recovery.json --expect-bridge-retry
```

For the current test wallet, this checks the three previously finalized
approvals (Hoist, Pump, Sluice), returns the old Bridge `NO_MAJORITY` review to
revision, and asserts no pending ticket remains. It uses a provider stub that
rejects signing requests. This proves live network reads and the domain's grant
handling; real-browser connection and gameplay are a separate check. It does
not prove that a fresh Bridge submission will obtain a validator majority.

Studio history discovery uses the official
[`sim_getTransactionsForAddress` endpoint](https://github.com/genlayerlabs/genlayer-studio/blob/main/backend/protocol_rpc/rpc_methods.py).
Finalized state reads follow
[GenLayer's snapshot guidance](https://docs.genlayer.com/developers/decentralized-applications/reading-data).

## Browser check and Claude handoff

The real Chrome wallet connection automatically restored 3/8 repairs without
clicking either recovery button. Keyboard movement to the village, opening the
Bridge, its 8-part/8-link local load test, and Pause → Resume game all passed.
No fresh Bridge transaction was sent during that check.

Scene clearance needs Claude's review: near the barrels/stock on the village
side of the bridge, the player at approximately x=-7.77, z=2.42 cannot walk
forward/right, and the interaction still selects the restored pump. Stepping
back to approximately x=-7.10, z=3.60 frees movement and selects the Bridge.
The bridge opens and tests correctly there. Please check prop collision boxes,
path clearance and the visible interaction cue in this overlap; this backend
pass does not change that authored scenery.
