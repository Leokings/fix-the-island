# Bridge review timeout: read-only investigation

Checked 2026-10-15 against https://studio.genlayer.com/api, chain ID 61999.
No deployment, approval, appeal, review submission, or signing operation was made.
No application, contract, or visual files were changed by this investigation.

## Conclusion

High-confidence matching cause: Studio's host does not implement nested
`StorageType.LATEST_FINAL` reads correctly. This is not a source-size or fee
estimation error. Bridge is the first site to exercise that operation.

Upstream issue: https://github.com/genlayerlabs/genlayer-studio/issues/1791

Proposed upstream fix: https://github.com/genlayerlabs/genlayer-studio/pull/1792

At the time checked, PR 1792 was OPEN and NOT MERGED, head
`05dcafb1cec7c49a096caa09209ce72ee18ab85b`, targeting `v0.123-dev`.
This is not evidence that any hosted endpoint has installed the fix.

The PR describes the exact chain of failure: a latest-finalized storage read
hits a host assertion, that assertion escapes, the host retries with exponential
backoff, and the execution exhausts its 600-second budget. Its local reproduction
uses tiny contracts with no AI or HTTP calls. The proposed fix routes finalized
reads to the finalized state bucket and separates caches by state status.

## Evidence from this app

Bridge: `0x904EE30069960246c948a037e978567E6F2F7bd2`.
Caller: `0x63038a310a46ac61a59c1bc5ead5fe41040ef38e`.

Both submitted reviews finalized with a timeout, empty vote maps and no successful
execution:

- `0x08460062ee77ef270e2056ffe7ed187f4d78833cb808f05c6858ce8b183b29e9`
  (leader model `openai/gpt-5.4`).
- `0xbb8977220c7f23ce7838a883d4d2fe0aef2b3f9791c8fba6d75f0b60ca58ee1c`
  (leader model `policy:prd-sonnet`).

Each leader reports `CONSENSUS_LEADER_EXEC_TIMEOUT`,
`Leader execution exceeded 600.000s`, and processing time 600000 ms.
The SDK represents these finalized timeout outcomes as `NO_MAJORITY`; this must
not be described as validators rejecting the design or disagreeing about it.

Canonical Bridge progress remains no approved sites and nextNonce `0`;
`get_receipt(caller, 0)` is null. Parent progress confirms Hoist, Pump and Sluice
approved, each with nextNonce `1`.

Retrieved deployed source matches the repository manifest hashes for all four
contracts. Each uses the same explicit pinned Python runner:
`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
Bridge lint and SDK validation pass (`genvm-lint check ... --json`).

| Contract | Source bytes | Existing successful leader processing |
| --- | ---: | --- |
| Bridge | 16646 | none; both attempts 600 seconds |
| Hoist | 16948 | 10.355 seconds |
| Pump | 17176 | 11.070 / 8.407 seconds |
| Sluice | 17175 | 3.705 / 4.586 seconds |

Source size alone is not a plausible differentiator: the working contracts are
larger. The failed transaction reached leader execution, rather than failing gas
estimation or submission. No out-of-gas/code-size exception appears in its receipt.

## Isolating the deterministic path without a new review

`tools/diagnose-bridge-review.mjs` replays **only the public view** `prepare_repair`
through `sim_call`, with the original artifact/rationale/nonce. That function
performs technical and dependency checks but never invokes the model.

The usual SDK RLP envelope fails before execution on both Sluice and Bridge:
`RLP string ends with ... superfluous bytes`. Public Studio's
`decode_method_call_data` strips two bytes from long-list headers even when three
are needed. This is a separate framing defect, not the cause of the already
submitted Bridge write: that write was successfully decoded and started GenVM.

To isolate execution, the diagnostic uses the same parser's supported raw-calldata
path (without the malformed outer RLP list), still `type: read` on a snapshot:

- Sluice preparation returns `SUCCESS` in 1323 ms, with no AI invocation.
- Bridge preparation does not return within the finite 35000-ms client deadline;
  the request is aborted at 35021 ms. **This is a bounded diagnostic observation,
  not another 600-second finalized transaction.**
- Ordinary top-level source/progress reads work for each contract (~1.5–1.9 s).

Bridge's preparation differs critically by calling
`_dependencies_ready`, which reads all three parent approvals using
`view(state=StorageType.LATEST_FINAL)` before reaching the AI block.

Studio source inspected at commit `c94072951e483510329670aa427fba3fa6944f45`
contains `assert type != StorageType.LATEST_FINAL` in
`backend/node/genvm/base.py` and the 600-second outer budget in
`backend/consensus/base.py`. The hosted internal runtime version is not exposed;
its exact internal stack was not recovered. `gen_dbg_traceTransaction` is not
available on this endpoint. Consequently the upstream mechanism is strongly
corroborated, not a claim to have obtained this transaction's private host trace.

## Correction to earlier preflight claims

`adapter.prepare()` intentionally uses local deterministic technical checks and
individual top-level parent progress reads; it avoids the broken nested
`prepare_repair` RPC. It verifies useful prerequisites but does **not** prove the
contract's cross-contract execution works. Earlier wording calling that a live
Bridge preflight was incomplete. Local tests and approval recovery did not prove
this dependency-read path either.

## Before any fresh submission

1. Do not repeatedly submit the unchanged contract, increase wallet gas, or split
   the contract further as a purported fix. More contracts add nested reads.
2. Preserve finalized prerequisites. Removing the state selector or replacing it
   with non-final state would weaken the game's authorization rule; it is not an
   equivalent fix and is not recommended as a silent workaround.
3. Use a Studio host with the upstream finalized-read fix installed, then verify
   the exact Bridge `prepare_repair` path returns promptly and passes. A patched
   local/staging Studio would be a different environment, with explicit state
   migration and no claim that old approvals automatically apply there.
4. Only after the read-only gate passes should a separately authorized fresh
   review be sent and its finalized execution and receipt verified.

Current public contracts, three approvals, and deployment configuration remain
unchanged. This investigation added only a diagnostic tool and this report.
