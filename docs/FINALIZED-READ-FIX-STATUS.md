# Finalized-read fix status — 2026-10-15

## Actual runtime fix is not installed on public StudioNet

The patch is in the Studio server, not in the game's Intelligent Contracts:
https://github.com/genlayerlabs/genlayer-studio/pull/1792

PR status checked during this task: open, unmerged; head
`05dcafb1cec7c49a096caa09209ce72ee18ab85b`, target `v0.123-dev`.
We do not have administration access to the hosted server. Docker CLI exists
locally, but its daemon is not running; there is no running local Studio to patch.
No Docker service was started, no host was provisioned, no contracts redeployed,
and no existing game approval was migrated or cleared.

Changing a runner pin, increasing gas, or redeploying identical contract source
does not install this host patch. Switching to non-final state would weaken the
prerequisite rule and was deliberately not done.

## Audit of all eight deployed sites

Every deployed source hash and dependency address matches the local manifest.
All eight pass `genvm-lint check` (AST safety and SDK semantics).

| Site | Finalized cross-contract dependencies | Exposure |
| --- | --- | --- |
| Hoist | none | Not on this affected path |
| Pump | none | Not on this affected path |
| Sluice | none | Not on this affected path |
| Bridge | Hoist, Pump, Sluice | Needs the shared host fix |
| Windmill | Bridge | Needs the shared host fix |
| Woodland Pathlight | Windmill | Needs the shared host fix |
| Upland Waterworks | Bridge, Pump | Needs the shared host fix |
| Ridge Beacon | Woodland Pathlight, Upland Waterworks | Needs the shared host fix |

Evidence: `artifacts/deployment/finalized-dependency-audit.json`.
This is source/binding verification, not five new consensus tests.

The separate, legacy `contracts/council/village_pump_council.py` also performs
finalized cross-contract reads, including a constructor protocol check. It must
not be activated on the affected host. It is not the active one-review Pump
contract. The historical monolithic contract does not use cross-contract reads
for site prerequisites and is not a reason to migrate or reset current progress.

## App-side prevention implemented locally

`src/genlayer/runtime-check.ts`, called by `adapter.prepare`, covers every Studio
per-site contract with a nonempty dependency list. Once local technical checks and
individual prerequisites pass, it performs the exact `prepare_repair` **view** on
the actual deployed contract. This executes nested finalized reads but no model
and no persistent write. It uses the parser's raw-calldata path to avoid the
separate outer-RLP bug described in `BRIDGE-TIMEOUT-DIAGNOSIS.md`.

The existing finite public-read timeout applies (10 seconds by default). A stall
or RPC error produces `RUNTIME_UNAVAILABLE` before registering a prepared design,
before the uncertainty marker, before a wallet signature and before broadcasting.
The existing error notice displays the reason; visual code was not changed.

A successful view is validated for caller, contract-bound digest, nonce, site,
fixture, canonical artifact and technical flags. It never grants progress. Binary
length, nesting, collection sizes and map keys are checked before using the SDK
decoder, which otherwise trusts untrusted collection counts.

Root sites and approval recovery are unchanged. Missing prerequisites still fail
their ordinary checks. No capability success is permanently cached. A later host
fix can therefore pass the same gate without changing the game contracts.

## Verification

- 220 unit/game tests pass.
- 109 GenLayer adapter/direct tests pass, including all five affected-site
  pre-signing timeout cases, successful read-only gating, malformed responses,
  identity/digest mismatches and root-site compatibility.
- Typecheck and production build pass (existing bundle-size warning remains).
- Read-only live check using the **local modified adapter** recovers the original
  three approvals and stops Bridge preparation with `RUNTIME_UNAVAILABLE`, with no
  new transaction or grant: `artifacts/deployment/wallet-runtime-gate.json`.
- Actual Studio host patch installation: **not done**.
- Deployment of this app-side guard to Vercel: **not done**.
- New live consensus review after the host fix: **not done**.

## Decision needed to unblock reviews

Either GenLayer's operators install the fix on the current public endpoint, or a
separate patched Studio environment must be hosted. The latter is a network and
state-migration decision: it needs explicit endpoint ownership, hosting/resources,
contract redeployment and a plan for the existing three approvals. It is not safe
to silently point the public game at a local machine or pretend approvals carry
across networks.

After a fixed host is available, run the exact read-only Bridge preparation and
verify its bound successful result before a separately authorized new review.
