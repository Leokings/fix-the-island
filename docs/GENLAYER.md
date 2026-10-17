# GenLayer repair validation: implemented backend and Builder API

> **Historical implementation notes.** The original Stage-A sections below
> describe the retired single-contract implementation and are not an
> operational guide. The current app requires eight per-site contracts and the
> exact eight-key `VITE_GENLAYER_SITE_ADDRESSES` map. See
> [GENLAYER-PER-SITE.md](GENLAYER-PER-SITE.md) for the current architecture and
> [PUBLIC-DEPLOYMENT.md](PUBLIC-DEPLOYMENT.md) for release evidence. The shared
> `contracts/island_repairs.source.py` remains only as the generator template.

Status: full Stage-A backend implemented and locally verified against final PLAN.md, 2026-10-08. BRIEF.md already makes repair-artifact validation central. Eight immutable fixtures, construction actions, deterministic advisory, runner-pinned Python contract and real injected-wallet adapter are available. Native GenVM/full network consensus remains unverified; the scripted GLSim rollback limitation below is explicit. No game, UI, art, package, BRIEF or PLAN files are owned here.

## Current backend delta (2026-10-13)

The shared catalog is now `island-2026-10-13-v2`. The village pump has three
exact physical designs in its fixture: direct pump (budget 14), quiet pump
(budget 19, serviceable attenuation housing plus vibration mount), and rain
cistern (budget 20, roof/gutter/leaf screen/first-flush/tank/filter/delivery,
plus overflow and soakaway). The deterministic checks and local advisory report
per-design metrics; the GenLayer council review still only assesses suitability.
Existing v1 deployments have not been upgraded and do not match this fixture.

Repair polling now treats `UNDETERMINED`, `LEADER_TIMEOUT` and
`VALIDATORS_TIMEOUT` as recoverable unresolved states, not final failure. The
original ticket remains saved and blocks re-submission for that nonce; a player
must explicitly recover that same transaction later. Only a finalized execution
and matching latest-final receipt can establish repair approval.

The separate pump-council pilot has a read-only result projector in
`src/genlayer/council/live-adapter.ts`. It checks pinned source, Bradbury chain,
EVM event ↔ GenLayer transaction identity, sender/recipient/calldata, finalized
successful execution, the latest-final review record, request digest, and the
shared result shape. It is not yet wired into gameplay and cannot restore a site.
The contract is undeployed; adapter tests are mocked and do not establish live
consensus or protocol availability.

## Builder entry point

Import from `src/genlayer/index.ts`. The actual readonly interfaces live in `types.ts`; this document does not duplicate a stale interface.

| Export | Purpose |
| --- | --- |
| `REPAIR_SCENARIOS`, `FIXTURE_VERSION`, `getRepairScenario(id)` | Eight frozen fixture mirrors, exact option/slot/port/setting/configuration IDs, budgets, prerequisites, requirements and damaged artifacts. |
| `createInitialArtifact(id)` | A fresh deeply frozen damaged construction. |
| `getSlotOptions(id, slot)`, `placeRepairPart`, `removeRepairPart`, `updateRepairPart` | Actual placement/removal/rotation/setting actions. Replacing a part with a different ID drops its old wires; placement never automatically connects it. |
| `updateRepairConfiguration`, `connectRepairPorts`, `disconnectRepairPorts` | New snapshots for mount/output/route and compatible directed connections. Missing routes are valid drafts, not valid repairs. |
| `createRepairArtifact`, `validateRepairArtifact`, `parseRepairArtifact` | Strict immutable construction/schema helpers; optional catalog validation. No approval claim. |
| `validateRepairLocally(id, artifact)` | `{mode: 'advisory', valid, flags, materialCost, budget, metrics, feedback}`. Deterministic only: no contextual judgment, caller dependency proof or chain progress. |
| `createRepairExampleDraft(id, 'valid' \| 'initial-damage')` | Bounded golden drafts for assembly tests/documentation. Includes the real parts/settings/graph and rationale, never completion, nonce or approval. Do not expose as a one-click game completion. |
| `canonicalizeRepairArtifact`, `canonicalizeRepairSubmission`, `digestRepairSubmission` | Stable JSON and domain-bound SHA-256; no signing. |
| `resolveGenLayerConfig`, `createGenLayerAdapter` | Real adapter, no side effects on import/boot. Empty address visibly disables connected use. |
| `ApprovalEvidence`, adapter `getApprovalEvidence` / `reverifyApproval` | Separate bounded original-broadcast archive and explicit read-only connected reload verification, never a cache-only grant. |
| `GenLayerClientError`, `GenLayerUnavailableError` | Typed bounded failures; no inferred chain success. |

```ts
import {
  createInitialArtifact, getSlotOptions, updateRepairPart,
  validateRepairLocally, createGenLayerAdapter, resolveGenLayerConfig,
} from './genlayer';

let artifact = createInitialArtifact('coast_windmill');
const choices = getSlotOptions('coast_windmill', 'driver');
// A player's selected part changes the real construction:
artifact = updateRepairPart('coast_windmill', artifact, 'driver', {
  optionId: choices[1]!.id,
});
const advice = validateRepairLocally('coast_windmill', artifact);
// Still damaged until its other settings and protected routes are repaired.
const adapter = createGenLayerAdapter(resolveGenLayerConfig(import.meta.env));
// Explicit player actions only:
// await adapter.connect(injectedProvider);
// const prepared = await adapter.prepare({ siteId, artifact, rationale });
// await adapter.submit(prepared);
```

`RepairArtifact` is exactly `{schemaVersion: 'repair-v1', parts, configuration, connections}`.
Parts contain `id, optionId, slotId, orientationQuarterTurns: 0|1|2|3, settingId`.
Configuration contains `mountZoneId, outputModeId, routeId`.
Connections contain `channel: 'mechanical'|'electrical'|'water'` and `from/to: {partId, portId}`.
`RepairDraft` adds only `siteId` and `rationale`. No client-supplied resource facts, claimed output, requirements, prerequisite list, score, completed or approved fields.

Bounds: artifact JSON 8 KiB UTF-8; 24 parts; 48 connections; ASCII IDs `[a-z0-9_-]{1,40}`; rationale 40–800 Unicode scalars and 2 KiB UTF-8. Duplicate/escaped duplicate JSON keys, extra fields, duplicate slots/parts/edges, unpaired surrogates, unsupported IDs and invalid ports reject. Number tokens are unsigned integers: no decimal/exponent/negative-zero representation. Nonces are canonical decimal uint256 text in browser bindings, integers in contract calldata. CRLF becomes LF in rationale; no other Unicode normalization.

## Frozen eight-site catalog

Fixture version: `island-2026-10-08-v1`. The embedded standalone contract catalog, `contracts/island_fixtures.json` review manifest and `src/genlayer/catalog.ts` mirror are tested for equality. No fixture/rubric setter exists.

| Site ID | Budget | Required approved sites | Independent technical rule and initial fault |
| --- | ---: | --- | --- |
| `pier_hoist` | 16 | none | Counterweight moment 6000 ±250, integer millimetre units; anchored and guarded lifting route. Initial moment 5000 and missing rope anchor. Valid example: mass 3 at 1000 plus mass 2 at 1500. |
| `village_pump` | 14 | none | Derived pressure 3–5, trunk flow ≥6, screened/relieved routes. Initial inlet 4/bypass 0/outlet 1 gives pressure 10 and flow 2. Valid 4/1/3 gives pressure 4 and flow 6. |
| `tidal_sluice` | 14 | none | Source 8, nursery 2–3, creek ≥5, bank flow 0, stored rack. Initial open bank/closed creek/nursery 1/obstruction. Valid nursery 3 gives creek 5; nursery 2/creek 6 is also valid. |
| `creek_bridge` | 18 | `pier_hoist, village_pump, tidal_sluice` | Continuous deck/support/shoes/opposing braces, capacity ≥8 and tensioned rail clearance ≥600. Initial missing deck join, parallel braces and loose rail. |
| `coast_windmill` | 16 | `creek_bridge` | Fixed shaft 60 rpm, catalog teeth 12/24/36, guarded drive, derived output 100–140 rpm by integer cross-multiplication. Initial 12→24 gives 30 rpm and missing guard path. Valid 24→12 gives 120 rpm. |
| `woodland_pathlight` | 12 | `coast_windmill` | 12 V /6 W within 1 A protection, source→fuse→regulator→lamp→return, shield down, sleeved route. Initial shield rotated and fuse output disconnected. |
| `upland_waterworks` | 16 | `creek_bridge, village_pump` | Six-unit supply, village ≥4, habitat ≥2, descending filtered routes/capacities, no bypass. Initial allocation 3/1 and missing filter route. Valid 4/2. |
| `ridge_beacon` | 14 | `woodland_pathlight, upland_waterworks` | Protected circuit, clear lens/shield, derived coastal sector excluding inland/nesting, safe plinth. Initial inland reflector and rotated shield. |

All routes and costs are recomputed from contract-owned option facts and sockets, not a player's self-report. Part IDs may change and array order may change without changing the design. Technically valid alternatives are tested; the validator does not require the exact golden serialization. These are original bounded game requirements, not real engineering certificates.

## Contract and decision boundary

Pinned header:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

`IslandRepairs` owns per-caller nonce, attempts and first site approvals. Technical checks precede all nondeterministic work: schema/catalog, budget/inventory, port direction/channel, exact required graph with no extra bypass, integer operation/capacity, prerequisite approvals, nonce and already-approved state.

A well-formed technical failure records a rejected attempt with null context flags and consumes its nonce without awarding progress. Malformed schema, replay/value transfer/already-approved input reverts. Approved sites cannot be farmed; another wallet has independent progress. `get_receipt` bounds its nonce to uint256, rejecting booleans, negatives and overflow.

A technically sound artifact reaches contextual judging using only the contract's immutable fixture/rubric, independently computed metrics, artifact and quoted untrusted player rationale. No URL fetch, gameplay outcome, animation, client score or rationale instruction can supply requirements or override technical checks. The leader and custom validator separately run the same decision process; the validator prompt contains no leader answer. Both parse exactly four boolean rule flags plus bounded feedback:

`groundedInArtifact, explainsTradeoff, protectsHabitat, safeUseAndMaintenance`.

All four are needed. Validators compare the derived flags, not prose and not strict equality on LLM text. Malformed judgments and all nondeterministic errors fail closed. No arbitrary `[TRANSIENT]` text or generic SDK error is classified as trustworthy agreement. Even a genuine transient failure produces no award or new receipt/progress.

Digest: SHA-256 of sorted compact UTF-8 JSON with domain `fix-island-repair-v1`, chain ID, lowercase contract/caller addresses, fixture version, site, decimal nonce, normalized artifact and rationale. Parts sort by ID; edges sort by their individual channel/from/to fields. Addresses/nonces/prose/site/artifact/version/network changes alter the binding.

| Method | Actual result |
| --- | --- |
| `get_protocol()` | `{protocolVersion, fixtureVersion, chainId, sites: siteIds[]}` only. No catalog or limits in this view. |
| `get_site(site_id)` | Fresh complete fixture, including its initial artifact/technical facts/rubric. |
| `get_progress(caller)` | `{nextNonce: decimalText, approvedSiteIds}`. Read-only; not a restoration grant. |
| `prepare_repair(caller, site_id, artifact_json, rationale, nonce)` | Caller/site/artifact/rationale/nonce/digest/fixtureVersion, technicalFlags, technicallyValid, metrics and materialCost. No contextual approval. |
| `submit_repair(site_id, artifact_json, rationale, nonce)` | Sender-bound receipt: the prepared binding plus decision/contextFlags/feedback, persisted to attempt and optionally first site approval. Rejects value transfers. |
| `get_receipt(caller, nonce)` | Exact attempt receipt or null. |
| `get_site_approval(caller, site_id)` | First approved site receipt or null. |

## Real browser adapter

SDK: installed stable `genlayer-js@1.1.8`; full `testnetBradbury` preset, chain 4221/`0x107d`, RPC `https://rpc-bradbury.genlayer.com`. The sole address setting is the exact eight-site JSON map `VITE_GENLAYER_SITE_ADDRESSES`; there is no single-address fallback. It contains no key or secret. The imported preset remains intact: no global CLI configuration, account creation, endpoint mutation or local signing.

An account-free public client handles reads. All contract views explicitly use `TransactionHashVariant.LATEST_FINAL`; the SDK default is non-final. Explicit `connect(injectedProvider)` requests accounts and can request a Bradbury switch/add; it checks chain/account again, source fingerprint and protocol/version/site IDs. It does not invoke the SDK `connect()` helper or request wallet snaps. Address ABI arguments use `CalldataAddress`, not an encoded ordinary string.

`prepare(draft)` freezes/validates the actual artifact/rationale, reads caller progress, compares contract-derived technical flags with local advisory and caller dependencies, and verifies digest. `submit(prepared)` accepts only the same current-session prepared object, with valid technical checks and current wallet/nonce/dependencies. It never signs automatically or holds private keys. The guarded provider accepts only the exact zero-value SDK `addTransaction` envelope for this contract/construct/caller/network and forbids a second signing/broadcast request, including SDK ABI fallback retries.

The EVM broadcast hash and GenLayer transaction ID are distinct. Persist `RecoveryTicket` immediately at the provider's returned EVM hash, before SDK receipt waiting. Recovery extracts the unique `CreatedTransaction/NewTransaction` ID from the pinned consensus contract's actual EVM logs, then verifies the original GenLayer sender/recipient/ID and exact RLP/calldata payload. It does not trust cached tickets, SDK return IDs, human-readable calldata, vote agreement or EVM success as a repair approval.

`GenLayerAdapter` methods: `getState, subscribe, getScenarios, connect, disconnect, getProgress, getRecoveryTickets, getApprovalEvidence, prepare, submit, resume, reverifyApproval, dispose`.
`getRecoveryTickets(caller)` returns untrusted saved pending suggestions, never grants; `resume(ticket, signal?)` is explicit, read-only and requires the original active wallet. It never rebroadcasts or silently adopts a newer draft/receipt. Account/network/disconnect events invalidate prepared writes and stop polling; late results cannot grant across wallet sessions. A late broadcast still preserves its original caller's ticket.

Approved sites retain a separate **original broadcast archive**, bounded to eight entries per caller/contract/chain/fixture version. `ApprovalEvidence` is exactly a `RecoveryTicket` plus `kind: 'approved-broadcast-v1'` and a required `txId`: original EVM hash, GenLayer ID and frozen prepared construction/binding. It stores no receipt, contextual judgment or restored boolean. A successful receipt is archived before removing its pending ticket; archive storage failure keeps the original pending proof recoverable. Archives do not enter pending-ticket BUSY checks.

`getApprovalEvidence(caller)` only reads untrusted cache suggestions, performs no RPC and returns fixed topological catalog order. It cannot grant or silently restore. On explicit connected-save hydration, `reverifyApproval(evidence, signal?)` checks the original active wallet, full archive shape/digest/context binding, source/network/protocol pin, original EVM event, original GenLayer call and latest-final approved receipt using the same finalized-success guard as submission recovery. It uses public reads plus `eth_accounts/eth_chainId`, never a signer or `eth_sendTransaction`. A revised cached draft, added cached contextual decision, altered nonce/hash/version/wallet or failed/provisional/missing chain result cannot grant. Timeout leaves the archived proof available, without creating a pending submission.

Builder's connected reload loop can consume the actual exported API after explicit wallet connection:

```typescript
for (const evidence of adapter.getApprovalEvidence(activeWallet)) {
  const state = await adapter.reverifyApproval(evidence);
  if (state.status === 'finalized-success') {
    // Builder: verify active save/wallet/site/digest and apply this original
    // receipt's artifact idempotently, only after verified prerequisites.
    // Never hydrate from getProgress(), cache booleans or evidence alone.
    applyVerifiedRestoration(state.grant);
  }
}
```

`applyVerifiedRestoration` is Builder-owned, not a backend export. `getApprovalEvidence` orders all eight sites so prerequisites come first; if one fails reverification, Builder must keep dependent restoration gated. New draft edits remain separate from the approved original design.

Default polling: at most 40 iterations, 120 seconds between loop checks, 3-second interval and 10-second per-read deadline; all have hard bounds. One iteration's finite in-flight reads can finish after the loop-time boundary. Abort/dispose stops reconciliation; only public reads occur while polling. Routine EVM receipt-not-found is pending, not fabricated failure. A genuine RPC error remains recoverable.

| State | Truthful UI meaning |
| --- | --- |
| `disabled / disconnected / ready` | Configuration, wallet or verified readiness; no award. |
| `queued / awaiting-wallet` | Prepared draft/explicit wallet request, not broadcast or chain review. |
| `submitted / pending` | Durable broadcast or observed pending review. Keep walking. |
| `accepted` | Provisional ACCEPTED/READY_TO_FINALIZE, never restore. |
| `finalized` | Finality observed; execution unknown or receipt verification still incomplete. No grant yet. |
| `finalized-success` + `decision: approved` | Matching original call, FINALIZED, execution SUCCEEDED, latest-final matching approved receipt; contains a frozen `RestorationGrant`. |
| `rejected` | FINALIZED + successful execution + exact rejected receipt. Pause work; revise original submitted draft. |
| `failed` | Finalized execution/EVM failure or unusable consensus state. No award. Non-final consensus failures retain recovery tickets for later explicit reconciliation; they never trigger automatic signing. |
| `timed-out` + `pending: true` | Polling stopped with incomplete verification, not chain rejection. Preserve ticket and review; explicitly recover later. |
| `wallet-rejected / wrong-network / network-error / recovery-needed` | No verified restoration; actionable connection/read/ticket recovery. |

Only `finalized-success` grants connected restoration. Builder must additionally match the active connected save, wallet/site/digest and frozen submitted construction before enqueueing its idempotent world change. Editing another draft never inherits an old approval. `getProgress` or a cached approved record alone cannot restore a site.

Crew/scaffold animation represents preparing/under review only. No invented percentage/countdown; animation duration never grants completion. Rejection pauses work; polling timeout leaves preparation recoverable. Player remains free to walk away. Builder owns UI/world behavior; see main's `docs/REPAIR-LIFECYCLE.md`.

Local practice is explicitly labelled “Local practice — deterministic checks”, uses separate progress/save namespace and the local advisory only, and never creates a `RestorationGrant`. No silent fallback, fake AI/chain award or migration of practice completions into connected state. The receipt validates a submitted design, not physical repairs/walking/worker activity/attendance.

## Verification and reproducible Windows commands

Run the current v4/v5 site-contract direct tests with exactly:

```powershell
python -m pytest -q -p no:gltest tests/direct/test_site_contracts.py tests/direct/test_village_pump_council.py
```

Warning: do not omit `-p no:gltest`; the gltest plugin clears its configured artifacts directory at session start.

No dependencies installed or package files changed. Existing Node 24.19.0/project dependencies and Python `C:/Users/leoki/anaconda3/python.exe` are used. Tool pins: `genlayer-test==0.29.2, genlayer-py==0.16.3, genvm-linter==0.11.0`; CLI 0.39.2. Adapter event/envelope decoding uses the already-installed `viem` dependency of the stable SDK; Builder owns package declarations.

```powershell
node node_modules/typescript/bin/tsc -p tools/genlayer-tsconfig.json
node node_modules/vitest/vitest.mjs run --config tools/genlayer-vitest.config.ts
./tools/genlayer-check.ps1
python -m pytest -q -p no:gltest tests/direct/test_site_contracts.py tests/direct/test_village_pump_council.py
```

Reproduce the complete safe check suite with `./tools/genlayer-check.ps1`. Backend and shared-project TypeScript checks passed; **74 TypeScript tests passed in four files, 43 direct Python tests passed**. Scripted GLSim: **2 passed, 1 strict expected failure** (rollback regression below). Linter machine result: `{"ok":true,"lint":{"ok":true,"passed":3},"validate":{"ok":true,"contract":"IslandRepairs","methods":7,"view_methods":6,"write_methods":1,"ctor_params":0}}`. UTF-8 invocation avoids the CLI's Windows cp1252 checkmark-print failure without changing global environment.

Coverage includes all eight damaged/valid repairs and construction actions, frozen mirrored facts, independent quantities/graphs/budgets, dependencies/caller isolation, nonce/replay/value/exhaustion/bounded reads, alternative allocation and renamed parts, duplicate JSON/extra fields, canonical bindings and explicit custom-validator reruns with independent prompts, differing prose, each differing flag, malformed returns, unknown/transient errors and closure serialization. Fixed JS/Python vectors test Unicode/canonical SHA-256, method calldata and Address ABI encoding. Adapter tests script lifecycle evidence: ACCEPTED without grant, finalized failure, record/call/account/digest/version mismatch, unknown execution, wallet refusal/events, bounded polling/RPC, reload recovery and event-origin checks. Seven approval-archive regressions cover approved→reload→full reverify, all eight original proofs in dependency order, forged cache artifact/transaction/context, failed/provisional/missing records, storage failure preserving pending evidence, archive bounds/isolation and pending BUSY separation. Reverification asserts no wallet send or writer invocation. An additional test runs the actual installed 1.1.8 SDK external-provider write pipeline against mocked JSON-RPC only. Test outcomes are scripted, not real AI judgments.

Direct tooling uses cached v0.2.16 SDK/stdlib and a test-only Windows stdin-pipe shim: upstream gltest 0.29.2 tries to unlink a file still open as fd 0, which Windows rejects. Installed packages are not patched. Direct `run_validator()` executes the actual closure but does not roll back the earlier leader call; these are **not consensus or native GenVM tests**. Linter “validation” is SDK/schema import/storage validation, not chain execution.

The old scripted GLSim suite exercised only the retired monolithic contract and has been removed. Its rollback observation was version-specific and did not establish live validator consensus. Current offline tests cover the eight per-site contracts; they remain distinct from real network judgments.

Native full GenVM/Studio consensus remains unverified here: no executable `genvm`, Docker or WSL was available on PATH, and v0.2.16 release assets do not provide a native Windows executor. No public deployment, wallet/key creation/unlock/signing, live write or paid API call was made. Future live execution needs separate authorization and proper native runtime/consensus evidence.

The retired monolith's `REPAIR_CONTRACT_CODE_HASH` pin is removed. The eight live site hashes are generated from `contracts/sites/manifest.json` into `src/genlayer/site-contract-meta.ts` and verified independently by the adapter.

## Primary sources verified for the implementation

Published stable SDK gitHead: `a76bec395aaa927720ee0ce364899a64044dd43e`. Installed distribution source was inspected for actual APIs and execution/status fields, including `getTransactionData + getTransactionAllData`, `txExecutionResult`, raw app calldata, EVM-event hash extraction and provider routing. Numeric execution 1 is FINISHED_WITH_RETURN/SUCCEEDED, 2 FINISHED_WITH_ERROR/FAILED; missing, 0 or conflicting evidence never grants.

[Stable npm metadata](https://registry.npmjs.org/genlayer-js/1.1.8), [pinned account-free/provider transport](https://github.com/genlayerlabs/genlayer-js/blob/a76bec395aaa927720ee0ce364899a64044dd43e/src/client/client.ts), [wallet helper behavior](https://github.com/genlayerlabs/genlayer-js/blob/a76bec395aaa927720ee0ce364899a64044dd43e/src/wallet/connect.ts), [full Bradbury preset](https://github.com/genlayerlabs/genlayer-js/blob/a76bec395aaa927720ee0ce364899a64044dd43e/src/chains/testnetBradbury.ts), [official networks](https://docs.genlayer.com/developers/networks), [contract read/write/event extraction](https://github.com/genlayerlabs/genlayer-js/blob/a76bec395aaa927720ee0ce364899a64044dd43e/src/contracts/actions.ts), [transaction actions](https://github.com/genlayerlabs/genlayer-js/blob/a76bec395aaa927720ee0ce364899a64044dd43e/src/transactions/actions.ts), [transaction decoding](https://github.com/genlayerlabs/genlayer-js/blob/a76bec395aaa927720ee0ce364899a64044dd43e/src/transactions/decoders.ts), [status/execution schema](https://github.com/genlayerlabs/genlayer-js/blob/a76bec395aaa927720ee0ce364899a64044dd43e/src/types/transactions.ts).

[Official pinned runner example](https://docs.genlayer.com/developers/intelligent-contracts/first-intelligent-contract), [v0.2.16 release/assets](https://github.com/genlayerlabs/genvm/releases/tag/v0.2.16), [independent equivalence verification](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle), [error handling](https://docs.genlayer.com/developers/intelligent-contracts/features/error-handling), [LLM API](https://docs.genlayer.com/developers/intelligent-contracts/features/calling-llms). The cached runner hash is `1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`, stdlib `11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v`. The latest release endpoint pointed to v0.3.0-rc7 during verification; no alias/latest compatibility was assumed.

Blender and [Genex](https://genex.games/) are allowed art/toolchain references, outside this backend and separate from GenLayer. No model/provider identifiers or secrets are embedded in prompts, fixtures or logs.
