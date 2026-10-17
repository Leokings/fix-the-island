# Async prerequisite notifications and expedition namespaces

This is the v2 backend protocol for replacing StudioNet's failing synchronous
`LATEST_FINAL` reads between site contracts. It does not change the island's
visuals. Generated contracts come only from `contracts/island_repairs.source.py`
and `tools/build-site-contracts.py`.

## What changes

- Every connected game has a random 32-byte `expeditionId`. It is stored with
  the caller/network/contract's active game, included in the submission digest
  and transaction calldata, and included in every contract storage key.
- Reconnect reuses that active ID. An explicit New Connected Expedition action
  rotates it. The old run remains public on-chain but cannot unlock the new ID.
- Site approval is written only by the site's finalized successful review.
  At that point the site emits `receive_dependency_approval(...)` to its direct
  dependents with `on='finalized'`.
- A dependent accepts a notice only from its configured parent contract. The
  message is idempotent and records only a digest under the same caller and
  expedition ID. It does not judge or award progress.
- `retry_dependency_notifications(caller, expeditionId, siteId)` can re-emit
  notices from an already stored approval. Duplicate delivery is harmless.
- A child's `get_progress` reports `requiredParentSiteIds`,
  `confirmedParentSiteIds`, and `dependencyReady`. Until the child has received
  every finalized notice, its deterministic prerequisite flag is false.

## Contract ABI

```text
get_progress(caller, expedition_id)
get_receipt(caller, expedition_id, nonce)
get_site_approval(caller, expedition_id, site_id)
prepare_repair(caller, expedition_id, site_id, artifact_json, rationale, nonce)
submit_repair(expedition_id, site_id, artifact_json, rationale, nonce)
receive_dependency_approval(caller, expedition_id, parent_site_id, approval_digest)
retry_dependency_notifications(caller, expedition_id, site_id)
configure_dependents(dependents_json)
```

`configure_dependents` is a one-time, idempotent deployment-owner action. The
mapping must exactly match the immutable site graph. Parent addresses are still
passed to child constructors and pinned in each child's protocol view. The
app refuses to connect unless every contract's source hash, graph bindings,
protocol version and dependent configuration match the generated manifest.

## Deployment/migration status

The fresh async-notification set is deployed and configured on StudioNet
(chain ID `61999`). All eight deployments and all eight `configure_dependents`
transactions finalized successfully. Each deployed source hash, protocol view,
constructor dependency binding, outbound notification graph and fresh-expedition
progress view passed `tools/verify-site-set.mjs`. Detailed addresses, transaction
hashes and source hashes are recorded in
`docs/GENLAYER-STUDIONET-PROOF.json` and the raw receipts are retained under
`artifacts/deployment/v3-studionet/`.

`src/genlayer/deployments.studionet.json` now points to the new set. The prior
addresses are preserved in `src/genlayer/deployments.studionet.legacy.json`;
those old contracts and approvals remain on-chain but are not imported into a
new expedition. The production app is live at
`https://fix-the-island.vercel.app` (deployment
`dpl_4fkh9m7iYgyW2Csmf3Nxh2dHqD7d`, source commit
`fca8edea962a52e74a9bb203702977530216ed88`). Its served bundle was checked for
the new addresses and absence of the legacy Pump address. A first connect on
the new map creates or reuses a new address-bound expedition ID; it does not
silently carry old contract approvals across. Old browser saves are not erased,
but are keyed to the legacy contract set and are not exposed by this build. A
real production browser smoke rendered the WebGL2 canvas with zero page errors;
it did not connect a wallet or submit a review.

## UI handoff (Claude-owned)

Do not treat a pending child notification as either approval or rejection. Use
`dependencyReady` and the required/confirmed parent lists to explain that the
island is still receiving finalized prerequisite confirmations. The backend
listens for `island:new-connected-expedition` and
`island:resume-previous-connected-expedition` for Claude-owned controls.
For a missing prerequisite notice, dispatch `island:retry-dependency-notification`
with `{ parentSiteId, childSiteId }`; the app verifies a finalized parent
approval, submits only the idempotent retry call, and reports the retry hash as
pending. Dispatch
the new event only after the player confirms the reset. It refuses to switch
while there are unresolved submitted reviews, saves the prior run, and rotates
the ID without deleting its local save. The resume event selects the prior run
and reloads its caller-bound local save; approvals still have to be recovered
from finalized on-chain transactions.

No GenLayer result should be labeled verified before its transaction is
finalized, execution succeeded, the source/ABI binding matches, and the
expedition-bound receipt is independently re-read and validated.

## UI wiring (Claude + backend, 2026-10-15)

Claude committed the UI controls separately. Backend feeds are now wired in
`src/main.ts`:

1. **Prerequisite card.** While a connected site is inspected, call
   `panel.setDependencyStatus({ siteId, ready, required, confirmed, approvedParents })`
   with `ready`/`required`/`confirmed` from `adapter.getProgress(caller, siteId)`
   (`dependencyReady`, `requiredParentSiteIds`, `confirmedParentSiteIds`) and
   `approvedParents` = parents restored by a verified approval in this
   expedition; pass `null` in practice mode or when leaving the site. The card
   shows only while `ready` is false: each parent reads "confirmed",
   "approved · notice not received yet" (with **Resend notice**, which
   dispatches `island:retry-dependency-notification` `{ parentSiteId, childSiteId }`),
   or "not approved yet". Copy says waiting is not a rejection.
2. **Expedition controls.** In the pause/expedition menu, shown only while a
   connected session is active: **Start a new connected expedition** (opens a
   confirm: the current run stays saved and resumable; its approvals will not
   unlock the new run; only **Start new expedition** dispatches
   `island:new-connected-expedition`) and **Resume previous connected expedition**
   (dispatches `island:resume-previous-connected-expedition`). New is disabled
   with a note while `reviewCount > 0` or `uncertain`. Pass
   `previousExpedition: boolean` in `hud.setConnection(...)` from
   `previousExpeditionId(...)` to hide Resume when there is none (omitted = shown).

The prerequisite read refreshes no more often than every 10 seconds while a
connected site is inspected. A failed RPC clears the display data rather than
guessing an approval/rejection. The Resume control is hidden if there is no
previous expedition key for this wallet and contract set.

Dev-only previews (no state, grant nothing): `window.__dependencyPreview(status|null)`
and `window.__previewConnectedMenu(partialConnectionModel|null)`.
