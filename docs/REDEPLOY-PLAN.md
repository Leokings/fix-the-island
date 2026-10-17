# Fix the Island — StudioNet Contract Redeployment Plan

Status: proposed only. No deployment, configuration write, review submission, Vercel update, or wallet signature is authorized by this document.

## Target and release boundary

- Target the existing stable GenLayer StudioNet (`https://studio.genlayer.com/api`, chain ID `61999`). Do not mix in Studio-dev/Studio Next: it is a separate preview chain with a different chain definition.
- Deploy a fresh eight-contract set from the reviewed source at commit `18751e5` plus the matching UI wording commit `62ec88e` (or a later explicitly reviewed source commit). Record the exact source commit and the eight hashes from `contracts/sites/manifest.json` before broadcasting.
- Keep the existing v3 addresses and transaction records as historical deployments. Never overwrite them or silently treat them as the new set.
- Deploy/configure/verify scripts take a deployment directory argument and use a fresh directory such as `artifacts/deployment/v4-studionet`. They must reject normalized paths into every historical deployment directory. All commands must be resumable from saved transaction IDs and must refuse to rebroadcast if a prior broadcast is unresolved. Commit and review this script change before the first signature.
- The `main` frontend has new source hashes but still references the v3 addresses. Do not build, publish, or promote that mismatch to the live website. Keep the current Vercel deployment unchanged during contract deployment. The only frontend release is the tested release that includes the verified v4 address map.

## Pre-broadcast gates

1. Confirm CLI network info says StudioNet and chain ID `61999`; confirm the active account address is the intended deployer. Do not print, export, or change key material.
2. Review the historical StudioNet fee evidence in `docs/BACKEND-DIRECTION.md` and show the deployer account's current balance before each write. Use the pre/post balance tripwire described below; it is not a fee cap, and an unexpected charge on the first transaction cannot be prevented by this check.
3. Re-run the committed source-hash check, contract lint, direct tests and integration suite against the exact release commit. Do not deploy if any generated contract differs from `contracts/sites/manifest.json` or if a required check fails.
4. Make a local backup of the current StudioNet address manifest and deployment reports. Do not modify Vercel or the active app address map during contract deployment.
5. Run `node tools/deploy-async-site-set.mjs --dry-run --output-dir artifacts/deployment/v4-studionet` (or the lower-level `node tools/plan-site-deployment.mjs --output-dir artifacts/deployment/v4-studionet`). This is offline and read-only: it prints exact constructor arguments wherever finalized parent addresses are already recorded, and lists unresolved address-dependent arguments otherwise. It never signs or broadcasts. Re-run it after each deployment phase; after all eight deployment reports exist, it prints the exact eight `configure_dependents` payloads. Review each transaction's exact payload and current account balance before its separate approval.

## Approval and transaction count

Budget for 16 deployer-account transactions (8 contract deployments plus 8 `configure_dependents` writes), followed by 8 player review transactions. `retry_dependency_notifications` may add an occasional write if a finalized notice is not confirmed. These are separate transactions, not one batch approval. Before each deployer transaction, show its exact constructor/configuration arguments and current account balance, state that the balance tripwire cannot cap a possible first charge, then wait for the user to explicitly approve that individual action. Never let the all-sites script run these writes unattended. Before each player review, show the site/build and wait for the user to approve the connected browser-wallet prompt. Any retry notification or review retry is an additional approval, never automatic.

## Deployment order

Wait for each deployment to finalize successfully and verify its source before using its address as a constructor dependency.

| Order | Site | Constructor dependencies |
| --- | --- | --- |
| 1 | `pier_hoist` | none (`{}`) |
| 2 | `village_pump` | none (`{}`) |
| 3 | `tidal_sluice` | none (`{}`) |
| 4 | `creek_bridge` | finalized addresses for Hoist, Pump and Sluice |
| 5 | `coast_windmill` | finalized Bridge address |
| 6 | `upland_waterworks` | finalized Bridge and Pump addresses |
| 7 | `woodland_pathlight` | finalized Windmill address |
| 8 | `ridge_beacon` | finalized Pathlight and Waterworks addresses |

For every broadcast, persist the GenLayer transaction hash and constructor arguments immediately. Resume polling that hash after interruption; do not send a duplicate deployment. A deployment counts as usable only if the receipt is finalized **and** execution succeeded, and the deployed source hash equals the pinned manifest hash.

## `configure_dependents` calls

After all eight new addresses are deployed and source-verified, make one `configure_dependents` write to each new contract. Each call contains the direct child site IDs and their new v4 addresses. The mapping is derived from `contracts/sites/manifest.json`:

| Contract receiving the call | Child-address mapping |
| --- | --- |
| `pier_hoist` | `creek_bridge` → new Bridge |
| `village_pump` | `creek_bridge` → new Bridge; `upland_waterworks` → new Waterworks |
| `tidal_sluice` | `creek_bridge` → new Bridge |
| `creek_bridge` | `coast_windmill` → new Windmill; `upland_waterworks` → new Waterworks |
| `coast_windmill` | `woodland_pathlight` → new Pathlight |
| `woodland_pathlight` | `ridge_beacon` → new Beacon |
| `upland_waterworks` | `ridge_beacon` → new Beacon |
| `ridge_beacon` | empty mapping `{}`; still call it so the configured state is explicit |

Persist each configuration transaction hash before polling. Require finalized-success for all eight calls. Then run the read-only site-set verifier and check that every contract reports `dependentsConfigured: true`, the exact expected parent/child maps, the expected protocol/fixture version, and the expected initial `get_progress` state.

## Updating client addresses

- `contracts/sites/manifest.json` is the source-of-truth for contract source hashes, site IDs and prerequisite edges. `src/genlayer/site-contract-meta.ts` is generated metadata from that manifest; it is not the deployment-address list. Regenerate/verify it only if the source or dependency metadata changed. Do not place deployed addresses in it.
- Write the eight verified v4 addresses into `src/genlayer/deployments.studionet.json` only after the complete deployment, configuration and read-only verification gates pass. `src/genlayer/deployments.ts` imports that map; the client checks deployed code against `site-contract-meta.ts`.
- Leave `src/genlayer/deployments.json` (Bradbury) unchanged. Preserve the old StudioNet map in the v3 deployment evidence and update `docs/STUDIONET-DEPLOYMENT.md` with a dated current-v4 section and an explicitly historical v3 section.
- After all eight new contracts are deployed, configured and read-only verified, update the client address map, build and test that exact release, and only then deploy the matching Vercel build. This is the only allowed frontend release for the new code hashes. Confirm the served app points to all eight v4 addresses before asking the user to run live reviews.

## Existing saves and expeditions

- No migration is performed. Existing on-chain approvals, nonces, review receipts, pending transactions, and expedition-specific state remain at the old v3 contract addresses. New v4 contracts start with empty state.
- The connected save/expedition namespaces include the chain and contract address (and caller/expedition/fixture context). Switching to v4 therefore selects a distinct connected expedition namespace; the player's old v3 local save is not overwritten, but it will not silently resume against v4.
- Old pending/recovery tickets are bound to their old contract addresses and expedition IDs. Resolve or explicitly preserve any pending v3 transaction against v3 before switching; do not replay a v3 ticket against v4.
- Keep v3 addresses and records available as historical/read-only evidence. The new app release should clearly start a new v4 expedition, while offering a deliberate legacy lookup/recovery path only if separately implemented and tested. No old progress is copied or represented as a v4 approval.

## Live, no-mock validation: one review per site

After deployment and app address update, use the connected browser wallet and one new expedition ID. Submit one real review per site in prerequisite order:

1. Hoist, Pump, Sluice.
2. Bridge, after all three parent approvals have finalized and their notices are confirmed.
3. Windmill and Waterworks, after Bridge finalizes (and Pump for Waterworks).
4. Pathlight, after Windmill; then Beacon, after Pathlight and Waterworks.

Use the site's actual repair builder and a technically valid build. Do not use mock council data or development hooks. Make the Village Pump review the empty-note case, exercising the new optional-note path on a real submission. The connected player must approve each wallet transaction; plan for eight review signatures. Do not automatically retry or substitute a mock if one fails. If a site returns revise, no-majority, timeout, or execution error, record it and pause downstream dependent reviews until the result is understood and any additional attempt is explicitly approved.

For each site, record in the proof manifest:

- site ID, v4 contract address, source hash, source commit, wallet address and expedition ID;
- submitted GenLayer transaction hash and submission time;
- final transaction status, execution result, and consensus result (for example, `MAJORITY_AGREE`), kept as distinct fields;
- validator vote details from the finalized receipt (validator identity as exposed by the receipt, vote/result, and any execution error); do not infer the vote list from the overall consensus result;
- the contract's finalized decision (`approve` or `revise`), feedback, receipt link, and whether the approval is visible in a fresh `get_progress` read;
- prerequisite notices sent/confirmed for dependent sites.

Count a review as verified only after its receipt is finalized successfully, the contract decision is read back from the live contract, and `get_progress` confirms the expected state. A finalized transaction alone is not enough. If all eight succeed, preserve the receipts and publish the proof manifest/read-only verification report. If not, publish the partial evidence and exact stopping point; never label an unresolved or mocked case as verified.

## Approval boundary

This plan authorizes preparation and review only. Commit the versioned-output/dry-run script change and this plan, then send both commit hashes and the dry-run output for review. No contract deployment, `configure_dependents` write, Vercel address change, wallet signature, or live review submission should occur until the user has reviewed the committed plan and explicitly approved the next execution stage.

## Fee evidence and balance tripwire (2026-10-16)

- The read-only account-history audit recorded in `docs/BACKEND-DIRECTION.md` (`02203ad`) found 346 deploy/write transactions through 2026-10-15 with zero EVM gas price, zero value and no recorded fee. The report's transfer arithmetic implies a 1 GEN starting balance; that starting amount was inferred, not read.
- A read-only StudioNet balance check on 2026-10-16 returned **0.792 GEN** for the deployer. This agrees with that audit's arithmetic.
- This is strong evidence about past StudioNet behavior, not a promise of future fee policy. The EVM-compatible layer's gasless result alone does not rule out a separate protocol fee.
- Because the pinned SDK cannot quote current protocol fees, deployment scripts use an explicit pre/post balance tripwire instead: snapshot the balance before each transaction, show it in the typed confirmation, persist it in that site's report, read the balance again after finalization, and stop before the next transaction if it decreased.
- **Risk boundary:** this tripwire detects a net balance decrease after a transaction; it does not reserve or cap the first transaction's possible charge, and concurrent account activity could affect the comparison. Do not run parallel transactions from the deployer account. No fee has been quoted or guaranteed to be zero.
