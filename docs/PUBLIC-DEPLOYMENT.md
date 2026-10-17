# Public deployment — 2026-10-08

## Current release: visual polish + connected testnet beta

This section supersedes the historical v1/blocker record below.

Published v2 successfully:
- Version: `appgprj_6ac803842d1c8191bd9a7ae0a58baa70~appgver_960090297aa0819184fe310d5946a1ac`
- Deployment: `appgdep_6ac818d7b2908191a1e9624e8aa893df`
- Pushed release source: `f5521dfd35fede72d6e50626fcf3b37267991b45`
- Runtime source tag: `9bb87a0`; archive `artifacts/deployment/site-v2.tar.gz`.
- Public-origin boot, ordinary keyboard movement, Save and responsive screenshots
  passed with zero browser/HTTP errors. Real-RPC connected-mode verification also
  passed using a read-only account-provider stub. This is NOT a real browser-wallet
  signature test or consensus success; the probe rejects every signing method.
- Final review recheck at 2026-10-08T22:29:25Z: status 13 (LEADER_TIMEOUT in the
  installed Bradbury SDK), execution 0/result 0, no leader trace data. Live AI
  review is therefore unresolved, not approved. No duplicate was submitted.

- Visual source `9a89bb6`: compact objective/journal HUD, foreground upper-foliage
  cutaway, distinct repair states; ground/collisions/authored animation preserved.
- 169 game tests and 80 backend tests passed; 11 current per-site direct tests
  and all per-site lint checks passed. Actual desktop and landscape touch checks
  passed with zero browser errors. All eight sites are CPU-accessible.
- Ending visual replay uses a prior genuinely earned save, not a new full journey.
- All eight GenLayer per-site deployments executed successfully. Code hashes,
  protocol/site/version, immutable dependency maps and progress reads verified.
  Addresses: `src/genlayer/deployments.json`; hashes: `contracts/sites/manifest.json`.
  Evidence: `artifacts/deployment/site-set-verification.json` and `sites/*.json`.
- Bradbury RPC/wallet chain is **4221**; native GenVM message context is **1**.
  Both are pinned separately. No key was exported/published.
- Deployment status at verification: **ACCEPTED + execution SUCCEEDED**, not
  FINALIZED. The first root's on-chain `canFinalize` read confirmed its appeal
  window remained open. Connected mode is visibly labelled testnet beta.
- Actual AI review submitted:
  `0x568c57ab4bb2fd4ea44a639ed6a940e1651ea3dd68788164764f6def3782e2cd`.
  Live preparation passed; its digest matched native context 1. The review stayed
  **PROPOSING** after the bounded wait; trace reported no leader public data yet.
  No completed live judgment/finality/cross-contract progression is claimed.
  Inspect this existing transaction; do not blindly resubmit it.
- Restoration still requires FINALIZED successful execution and a matching approved
  receipt/broadcast/caller/site/digest. Accepted/pending/practice never grant it.
- Monolithic gas-limit blocker resolved by splitting contracts. First bridge
  constructor failed reading unfinalized parent code (`absent_runner_comment`).
  Its audit report is retained as `creek_bridge.failed-parent-finality.json` and
  its address is not configured. Corrected constructors bind immutable addresses
  without external calls; approval checks still use finalized parent state.
- The user authorized public hosting and the CLI account, NOT hackathon submission.

Read-only recheck: `node tools/verify-site-set.mjs`. Public smoke:
`node tools/hosted-smoke.mjs https://fix-the-island.plain3rd.chatgpt.site/#play`.
Latest saved version/deployment IDs are supplied in release evidence/handoff.

## Historical v1 record

Public game: https://fix-the-island.plain3rd.chatgpt.site/#play

- Site: `appgprj_6ac803842d1c8191bd9a7ae0a58baa70`
- Version: `appgprj_6ac803842d1c8191bd9a7ae0a58baa70~appgver_4a2472dd56c481919e212f61c17f8a54`
- Deployment: `appgdep_6ac80a0edf548191a9494b695262318d` — succeeded.
- Pushed release source: `774ac3918770567afbbdfdfd4aaf54a226d98277`.
- Source checkout: `../fix-the-island-publish`, with `.openai/hosting.json`.
- Public access was explicitly requested. No wallet secrets were published.
- This publication runs **local practice**, not live GenLayer reviews.

## Verified game changes

Imported CC0 camp/storage, fenced utility-yard and reedbed props; smaller,
noise-free palm occlusion opening. Large palms can still obscure surrounding
scenery. The scenery source is `cce2f9e717fbd988ada2d0cba510c624cc51c385`.
Its build and 165 unit tests passed. CPU traversal reached all eight repair sites
without completing repairs (19,246 grid cells, 205 geometry-derived obstacles).
Actual desktop keyboard and 667px touch/release checks passed with zero browser
errors. This is not a new complete eight-repair run or formal visual acceptance.

`artifacts/scenery-pass/2026-10-08-worksites/after-report.json` records the local
comparisons. `artifacts/deployment/hosted-smoke.json` records a fresh public-origin
boot, ordinary keyboard movement, Save click, desktop/landscape screenshots and
zero browser/HTTP errors. The public build's display tag is `4cfb03f`.

## GenLayer blocker

User authorized the existing CLI account `ic-builds-bradbury`, public address
`0x797d3b25fb2cca0ff93f60df1910267f3822d655`, for testnet deployment. The selected
network was verified as Bradbury (4221), not Studio. No key was exported.

CLI 0.39.2's `estimate-fees` method is incompatible with its bundled stable SDK;
the actual supported six-input Bradbury deployment ABI was checked with a
read-only gas estimate instead. Three submissions were rejected by
`eth_sendRawTransaction` with `gas limit too high`:

| Contract source | Estimated gas |
| --- | ---: |
| Original 63,269 bytes | 50,043,977 |
| Losslessly packed catalog, 28,017 bytes | 22,705,101 |
| Bounded minification, 23,799 bytes | 19,557,057 |

There is **no verified deployed contract address or live review**. The precise
per-transaction cap is unconfirmed; the block gas limit is not that cap. Do not
blindly lower the submitted gas, assume an estimate guarantees acceptance, or
enable connected mode using an unverified address. Further deployment work must
resolve the real transaction limit and reduce/split the deployable code safely.

Local backend source now ends at `b83a892a8e14d4997e7b1824e045db5931ce6bac`:
lossless catalog equality, preserved public schema/annotations/judgment closures,
and reversible AST equality for private-local renaming. Lint, 74 backend TS tests
and 44 direct contract tests passed; scripted consensus: 2 passed, 1 known expected
failure. These tests do not establish native GenVM or live consensus success.
This newer backend artifact is not the public v1 bundle; connected mode is
disabled there, so it cannot use an obsolete contract identity.

## Release notes

The Sites workflow successfully committed/pushed source, then its Windows wrapper
picked system Bash and failed packaging. Packaging was rerun with the supplied
`package-site.sh` under Git Bash using `/c/...` paths; source/build inputs were
unchanged. Saved archive: `artifacts/deployment/site-v1.tar.gz`.

A slow fresh dependency install was cancelled. Its partial files are preserved
under `../fix-the-island-publish/.install-partial` and ignored by Git; release
`node_modules` is a junction to this game's existing pinned dependencies. The
production build passed. No source assets or user files were deleted.

For the next release, reuse the existing Site ID, refresh the release checkout
from reviewed source, build with a full `BUILD_SOURCE_COMMIT`, and use the Sites
source workflow and supplied packager. Keep credentials only in process memory.
