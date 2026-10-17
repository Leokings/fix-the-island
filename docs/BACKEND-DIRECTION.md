# Backend direction — review of the GenLayer contracts and adapter

Reviewer: Claude, 2026-10-15. Scope: `contracts/` (generator, eight generated
site contracts), `src/genlayer/` (adapter, evidence, schema), the live v3
StudioNet deployment (read-only calls only; nothing signed or sent), and how the
UI consumes all of it. For Codex to implement; Claude reviews the result.

## Verdict

The architecture is right: one contract per site; prerequisites delivered by
`emit(on='finalized')` notices instead of synchronous cross-contract reads;
per-expedition namespaces; an adapter that guards every signature and never
mistakes a timeout for a rejection. Keep all of that.

What will make the game fail in front of a player is the **AI judgment design
on seven of the eight sites**, plus a few reliability gaps on the client. None
of it has been exercised end to end on v3 yet.

Live check (read-only, 2026-10-15): all eight v3 contracts at the
`deployments.studionet.json` addresses report `async-notify-v1`,
`dependentsConfigured: true`, and parent/child maps that match the game's
dependency graph. Deployed source hashes match the committed
`contracts/sites/*.py`.

## Keep (do not rework)

- Async prerequisite notices (`receive_dependency_approval`, sender-authenticated,
  idempotent; `retry_dependency_notifications`). No cross-contract reads remain
  on the submit path, so the StudioNet `LATEST_FINAL` host bug no longer applies.
- Expedition IDs bound into storage keys, digest and calldata.
- Deterministic technical checks run before any model call; technically invalid
  builds are rejected without AI.
- Adapter guarantees: transaction decoded and checked before the wallet signs;
  ticket saved on broadcast; timeouts/no-majority are "unresolved", not rejected;
  receipts re-read and validated before restoration.
- Generator (`tools/build-site-contracts.py`) as the only source of site contracts.
  (Root sites get `dependencies = True` by design; dependent sites call
  `_dependencies_ready`. Verified, not a bug.)

## P0 — must change before calling the game playable live

### 1. Replace the four-flag rubric on the seven non-pump sites

Now: the model returns four booleans (`groundedInArtifact`, `explainsTradeoff`,
`protectsHabitat`, `safeUseAndMaintenance`); validators must match **all four
exactly**; approval needs all four true. Two of the four grade the player's
written explanation.

Why it fails: four independent subjective booleans that must all match makes
validator disagreement likely, i.e. `NO_MAJORITY` or rotations into timeouts,
which looks to the player like the game broke. It also contradicts
GAME-DESIGN §9 ("one narrow question per site") and §6.5 (the note is optional;
"the player never has to write an essay").

Change: give every site the pump's shape.
- One question per site, written against that site's frozen facts (e.g. Bridge:
  "Is this braced, two-shoe crossing a plausible safe repair that keeps the
  creek channel clear?").
- Model returns `{decision: approve|revise, feedback}`.
- Validator reruns and compares **only `decision`**. Feedback is free text,
  never compared.
- Keep technical flags authoritative and stated as such in the prompt.

Acceptance: a direct test per site that the validator agrees whenever both
runs reach the same decision regardless of feedback wording; an integration
run (below) reaching `MAJORITY_AGREE` on a valid build for at least Hoist and
Bridge.

### 2. Make the pump's `evidenceQuote` best-effort, never fatal

Now: `parse()` raises `[LLM_ERROR]` unless the quote is an exact 8–160 character
substring of the evidence JSON, and the validator's own run goes through the
same `parse`. One sloppy quote on the leader, or on any validator, forces
disagreement or rotation.

Change: if the quote is not an exact substring, store `null` (or a fixed
fallback) instead of raising; validate quotes only in the leader output;
validators compare `decision` only. The council UI already treats the quote as
optional display text.

### 3. Make the player's explanation optional, as designed

Now: contract `_rationale` and `src/genlayer/schema.ts` require 40–800
characters, so the Explain step is mandatory.

Change: 0–800 characters (keep the 2048-byte cap and normalization). When
empty, the prompt states "No player note; judge the build and site facts
only." Update `REPAIR_LIMITS`, the contract, the UI counter copy, and tests
together. This changes the contract, so it ships with items 1–2 in one
redeploy.

### 4. Prove v3 end to end before calling anything live

Nothing has run a full v3 review yet. Add an integration suite
(`genlayer-dev:integration-tests`) against StudioNet or a local Studio,
covering:
1. Root site approve (Hoist): receipt stored, `approvedSiteIds` updated.
2. Root site revise: receipt stored, no approval, no notices sent.
3. Notice delivery: after Hoist, Pump and Sluice approve and finalize, the
   Bridge's `get_progress` reaches `dependencyReady: true` within N minutes.
4. `retry_dependency_notifications` is idempotent (a second delivery is harmless).
5. Expedition isolation: approvals under ID A never make ID B ready.
6. A dependent site refuses submission before it's ready (technically
   invalid; no model call).

Then one real-wallet browser run of Hoist → Pump → Sluice → Bridge with the
human approving each signature.

## P1 — reliability and clarity

5. **Retry idempotent reads.** `view`, `getTransaction` and receipt reads give
   up on the first network error. That is the "Failed to fetch" the player hit
   before the wallet prompt. Retry reads 3 times with backoff and jitter (e.g.
   0.5 s, 1.5 s, 4 s). Never retry `eth_sendTransaction`. Show "Network hiccup,
   retrying…" in the repair banner, not an error, until the retries are spent.
6. **Don't stop polling at 2 minutes.** `maxPollMs` 120 s turns slow-but-fine
   reviews into "timed out, recover later". After 2 min keep polling every
   15 s for up to 15 min while the UI keeps showing "the council is
   deliberating / crew waiting". Stop only on page leave. Resume automatically
   on reconnect (this already exists).
7. **Wire the two UI feeds already built** (`docs/ASYNC-EXPEDITION-MIGRATION.md`,
   "UI wiring"): `panel.setDependencyStatus(...)` while a connected site is
   inspected, and `previousExpedition` in `hud.setConnection(...)`. After any
   parent approval finalizes, poll that parent's children's `get_progress`
   until they confirm, so the "waiting for confirmations" card resolves by
   itself; offer Resend only after about 3 minutes without the notice.
8. **Generator: remove the duplicate storage annotation.** `dependencies:
   TreeMap[str, Address]` is declared twice in each generated class (first and
   seventh field). Remove one, keep the field order stable otherwise, and lint.
   Lands in the same redeploy as P0.
9. **Docs drift.** `docs/STUDIONET-DEPLOYMENT.md` lists the v2 addresses
   (e.g. Bridge `0x904E…`) while the app uses v3 (`0x35a4…`). Make v3 the
   current table and mark v2 and the legacy `contracts/council/` pilot as
   retired.

## P2 — tidy-ups

10. `getProgress` reads all eight contracts in batches of two (four sequential
    round trips, about 1.5 s each) wherever it's called. Read only the sites a
    screen needs.
11. Environment: around 20:38 on 2026-10-15 most of `node_modules` disappeared
    (23 packages left; `genlayer-js`, vitest and others missing), so tests and
    the dev server won't run in this checkout. Nobody should run npm while
    another agent is mid-install; then do a single `npm ci`. Consider moving the
    repo out of OneDrive or excluding `node_modules` from sync.

## How backend and UI should interact (target)

| Player step | Backend | UI shows |
|---|---|---|
| Builds and taps Test | local `validateRepairLocally` only | test card names the fix |
| Explain (optional) | none | "No note added — the council judges the build" if empty |
| Submit | reads (with retries): protocol, `get_progress`, nonce; then one guarded wallet prompt | repair banner: "Checking… / Network hiccup, retrying…"; wallet prompt |
| Signed | ticket saved; poll | crew scaffold at the site; pump: council deliberating at the fire |
| Accepted, not final | keep polling | "A result is forming · waiting for finality" |
| Finalized approve | verify receipt, grant restoration, notices emitted to children | site restores; pump: "!" over the fire, reveal on demand |
| Finalized revise | verify receipt; no grant | revise card with the contract's `feedback`; build stays editable |
| No majority / timeout / failed | ticket kept, no grant | "Not a rejection — your build is saved"; one clear retry path |
| Child not yet confirmed | poll children's `get_progress` | "Waiting for prerequisite confirmations" card, Resend after ~3 min |

Rule that never changes: only a finalized, successfully executed, re-read and
validated receipt restores a site or reads as "verified". Practice mode and
mocks are always labelled and grant nothing.

## Order of work

1. P0 1–3 in the generator and contracts, plus P1 8; lint all eight; direct
   tests. (Claude reviews the diff.)
2. P0 4 integration suite on a fresh deployment. (Claude reviews the evidence.)
3. P1 5–7 in the adapter and `main.ts`. (Claude reviews, then re-tests the UI
   states.)
4. Real-wallet run with the human. Only then update the docs and the live
   Vercel build.

## Progress (2026-10-15, evening)

- P1-5 done (Claude): `src/genlayer/read-retry.ts`; every public read in the
  adapter (views, chain ID, contract source, transaction status/receipts,
  history) retries transient network failures at 0.5 s, 1.5 s and 4 s. Answers,
  invalid evidence, "receipt not found yet" and cancellations are never
  retried; wallet transactions never go through it. Unit tests:
  `tests/unit/read-retry.test.ts`. StudioNet check: CORS allows the Vercel and
  local origins; 30/30 `get_progress` reads succeeded (median 1.26 s), so the
  "Failed to fetch" was transient.
- P1-6 done (Claude): polling keeps watching for up to 15 min (every 3 s for two
  minutes, then every 15 s) instead of stopping at 2 min.
- P1-7 done (Codex, `afbdf1e`; reviewed, correct). Claude added: Resend notice
  appears only after a parent has waited 3 min for its notice ("notice on its
  way" until then), so normal delivery doesn't prompt a wallet signature.
- **New finding for Codex:** `tools/genlayer-vitest.config.ts` (the adapter
  and direct suites) fails 53 of 95 tests on committed `main`: the adapter
  stays `disabled` and preparation lacks an expedition ID, i.e. the tests
  predate expedition IDs. With today's working-tree changes it fails 67 of
  109. Update this suite alongside P0 1–3; it should be green before any
  redeploy.

## Review of Codex's uncommitted P0 work (2026-10-15, 22:10 working tree)

Done as directed: one approve/revise decision on all eight sites with
decision-only validator comparison (P0-1); pump `evidenceQuote` best-effort,
invalid becomes `null` (P0-2); explanation 0–800 characters with an explicit
"No player note" in the seven generic evidences (P0-3); duplicate
`dependencies` storage line removed (P1-8).

Must fix before committing or deploying:

1. **Blocker: `prompt` is out of scope in the validator on seven sites.**
   In every generated site except the pump, `prompt` is assigned inside
   `leader_fn`, but `validator_fn` calls `gl.nondet.exec_prompt(prompt, …)`.
   That raises `NameError`, the `except Exception: return False` swallows it,
   and every validator disagrees, so every non-pump review ends `NO_MAJORITY`.
   Build `prompt` once, before both functions (as the pump does), in the
   generator template.
2. **Make reply parsing tolerant.** `_judgment_result` and the pump's
   `leader_fn` reject any reply whose keys aren't exactly
   `{decision, feedback}` (plus optional `evidenceQuote`), and reject feedback
   over 240 characters. A model adding one extra key or a long sentence fails
   the leader and forces rotations. Read `decision` (normalized with
   `.strip().lower()`), take `feedback` if it's a string, trim to 240
   characters, fall back to a fixed sentence if missing, ignore extra keys.
   Raise only when `decision` isn't approve/revise.
3. **The question still asks for an explanation.** The seven generic prompts
   judge against `operationRequirement`, whose catalog text begins "Explain …"
   (e.g. "Explain opposing braces and channel clearance…"). With the note now
   optional, an empty note invites "revise: doesn't explain". Give each site a
   build-focused question (e.g. Bridge: "Does this build give a supported
   crossing with opposing braces and no new riverbed supports?"), stored in
   the fixture as a new `judgmentQuestion` field rather than reusing the
   "Explain …" requirement text.
4. **Pump empty note.** Its evidence passes `''` for an empty rationale; use
   the same "No player note; judge the build and site facts only." text.
5. **Tests that would have caught 1.** Add a direct test that executes each
   site's `validator_fn` with a mocked `exec_prompt` (same decision → True,
   different → False, extra keys → still True), and get
   `tools/genlayer-vitest.config.ts` green, before committing.

## Review of `a0ffd79` (Fix GenLayer judgment prompts and parsing)

Checked on a clean copy of the commit (no working-tree changes):
typecheck passes, unit tests 225/225, direct Python contract tests 18/18,
`genvm-lint` clean on all eight generated contracts.

All five points above are fixed:

1. The prompt is built once before `leader_fn`/`validator_fn` on all eight
   sites, so validators can see it.
2. Parsing is tolerant: decision is trimmed and lower-cased; feedback is
   optional, trimmed to 240 characters, with a fixed fallback; extra keys are
   ignored. An invalid pump quote becomes `None`.
3. Each site has a build-focused `judgmentQuestion` in the fixture and
   catalog, and the prompts use it instead of the "Explain …" text.
4. The pump passes "No player note; judge the build and site facts only."
   when the note is empty.
5. Direct validator tests exist for all sites.

**One gap: the commit isn't self-contained.** On the commit alone,
`tools/genlayer-vitest.config.ts` gives 93/94. The failing test is
`genlayer-core.test.ts › canonical submission binding`. It expects the
optional note, but the client side of that change (`src/genlayer/schema.ts`
min 40 → 0, `evidence.ts`, `council/*`, `src/domain/save.ts` and their
unit tests) is still uncommitted. "108/108" was measured with those files
in the working tree. So the committed contracts accept an empty note while
the committed client still demands 40 characters. Commit those files next,
and re-run both suites on a clean copy, before any redeploy.

Not blocking: when the leader errors, validators return `False`. That forces
a rotation, which is right for `[LLM_ERROR]`. Business errors are raised
before the nondet block, so nothing deterministic reaches it.

**Closed by `18751e5`** (client half). Checked on a clean copy: typecheck, unit
227/227, `tools/genlayer-vitest.config.ts` 94/94, direct contract tests 18/18,
and the production build all pass. The UI wording followed in `62ec88e` (the
note is labelled optional; Review is enabled with an empty note). The
contracts and client now agree. Next: a redeploy plan for the eight site
contracts, run only with the user's approval, then a live StudioNet review
per site to show the validators actually agree.

## Review of `docs/REDEPLOY-PLAN.md` (Codex, uncommitted)

Checked against the code. Correct as written:
- The deploy order and constructor dependencies match `requires` in
  `contracts/sites/manifest.json`.
- The eight `configure_dependents` mappings are each parent's direct
  children. Beacon is a leaf, so its empty `{}` is right: the contract
  requires the mapping to exactly match `_CHILDREN`.
- Connected saves, recovery tickets and unknown-submission rows are keyed by
  chain + contract address (`save.ts`, `unknown-submission.ts`), so v4 starts
  a separate namespace and v3 tickets can't be replayed against it.

Add before approval:
1. **Don't ship the front end from `main` until v4 is live.** Since
   `a0ffd79`, `site-contract-meta.ts` carries the new code hashes, and the
   adapter rejects any address whose deployed source hash differs
   (`adapter.ts:174`). A Vercel build from current `main` against the v3 map
   would turn connected mode off for everyone. The only front-end release is
   the one that carries the v4 map.
2. **Count the signatures up front:** 8 deploys + 8 `configure_dependents`
   from the deployer account, then 8 player reviews, plus possible
   `retry_dependency_notifications`. Each deployer write is shown and
   approved by the user, not run unattended.
3. **The versioned-output change to the deploy scripts is code: commit it
   and send it for review first.** Include a dry run that prints the exact
   constructor arguments and `configure_dependents` payloads, without
   broadcasting.
4. **Live test coverage:** submit at least one site with an empty note (the
   new path), and record each site's validator votes, not only the final
   status.
5. **Commit the plan** with these changes so the approved version is fixed.

## Review of `5f2af11` (redeploy plan + deployment safeguards)

The plan now covers all five points: the front-end freeze, the 16 + 8
transaction budget, the Pump empty-note review, and per-validator votes taken
from the receipt. The dry run (`node tools/plan-site-deployment.mjs`) is
offline. It shows `{}` for the three root sites and marks the five dependents
and the eight configuration payloads as unresolved, with no placeholder
addresses. Correct.

Before `--execute`, fix these in the scripts:
1. **Make the typed confirmation impossible to automate.**
   `deploy-site.mjs` and `configure-site-dependents.mjs` read the
   confirmation from stdin, so an agent could pipe `DEPLOY pier_hoist` in.
   Refuse when `!process.stdin.isTTY`. The user runs the command
   in their own terminal and types each confirmation.
2. **Make the v3 guard path-safe.** It compares raw strings, so
   `./artifacts/deployment/v3-studionet`, an absolute path or a different
   case gets past it. Compare `resolve()`d, lower-cased paths, and refuse
   every historical directory (`sites`, `v2-studionet`, `v3-studionet`).
3. **The configure step should check source hashes too.**
   `configure-site-dependents.mjs` accepts any finalized report without
   checking `row.codeHash === manifest[site].codeHash`, unlike the planner.
   Add the check. Its error text still says "v3".
4. **The fee gate is still open.** `deploy-preflight.mjs` only estimates EVM
   gas. Show the GenLayer fee estimate, or evidence that StudioNet charges
   none, before the first `DEPLOY`.

## Review of `252192e`, and evidence on StudioNet fees

The `252192e` safeguards are right:
- The TTY-only confirmations work.
- The path guard uses resolved, lower-cased paths and covers `sites`,
  `v2-studionet` and `v3-studionet`.
- The configure step now checks each report's site ID and code hash.
- Parent addresses are read from the new output folder. That was a real
  bug: it would have wired v4 children to v3 parents.

**Fee evidence (read-only RPC, 2026-10-16).** The deployer
`0x797d…d655` has sent or received 352 StudioNet transactions between
2026-08-12 and 2026-10-15:
- 110 deployments and 236 contract writes, including the whole v3
  deploy + `configure_dependents` set made with these same scripts.
- Every record shows `gasPrice` 0, `value` 0 and no fee field.

The only value movements are 9 explicit transfers:

| Direction | Amount |
| --- | --- |
| In | 0.1 + 0.1 + 0.002 = 0.202 GEN |
| Out | 4 × 0.1 + 2 × 0.005 = 0.410 GEN |

The current balance is exactly 0.792 GEN = 1.000 − 0.208. So 346
deploys and writes cost nothing beyond those explicit transfers. The
1 GEN starting balance is inferred, not read; it matches the arithmetic
exactly.

This is strong empirical evidence that StudioNet charged no protocol fees
as of 2026-10-15. It is not a promise that it never will.

**Proposed replacement for the fail-closed fee gate:** a balance gate.
- Before each broadcast, read the deployer balance and print it with the
  confirmation prompt.
- After finalization, read it again.
- If it fell by anything at all, write the difference into the report
  and stop before the next transaction.

With 0.792 GEN in the account, the worst case is one charged transaction,
and it's caught immediately. The user decides whether to accept this
instead of waiting for an SDK fee estimator.

**`c9d2c96` (balance tripwire) checked.**
- The balance is read on chain 61999 at the prompt and again just before
  sending. Broadcasting is refused if it moved in between.
- The balance is read again after finalization; both values go into each
  report. Any decrease stops the run, including on resume.
- The watched address is the signer: `site-deployer` refuses any CLI
  account other than `0x797d…d655`.
- Unit tests pass (231/231). The orchestrator's default is still the
  offline dry run, and it writes nothing. `--execute` without a terminal is
  refused.

The scripts are ready. The remaining step is the user's decision to run
`node tools/deploy-async-site-set.mjs --execute` in their own terminal.

## Review of the v4 deployment (`5d3a1a5`)

I verified this independently with read-only RPC on 2026-10-16.

**On chain:** for all eight addresses in `deployments.studionet.json`:
- the chain is 61999;
- the deployed source's sha256 equals the `contracts/sites/manifest.json`
  hash;
- the architecture is `async-notify-v1`;
- the parent dependencies and the configured dependents exactly match the
  graph and the new addresses.

The site sources are unchanged since the reviewed `a0ffd79`. The deployer
balance is still 0.792 GEN, so no fee was charged.

**In the game:** the local game (current `main`) enters connected mode
against v4 with a read-only wallet stub. The adapter's source/protocol proof
passed. The wallet was only asked for `eth_requestAccounts`, `eth_accounts`
and `eth_chainId`; RPC reads were `gen_getContractCode`, `gen_call` and
`sim_getTransactionsForAddress`. No signing.

**Not yet proven:** player reviews, i.e. validator consensus on a real build.
Next: Vercel release of this commit (user approval), then the eight live
reviews in the order set out in the plan.

## Review of `74038ea` (council prompts v5)

**Correct:**
- The prompt is built once, before `leader_fn`/`validator_fn`, for all eight
  sites. Validators compare the decision only.
- The plan is enforced (one line, 15–200 characters) in both the contract
  and `schema.ts`, before any AI call.
- The checked lines are rendered from `_technical`'s own metrics and limits.
- The site facts and questions match the spec. The rehearsal contract
  is ungated.
- Unit tests 239/239, GenLayer vitest 108/108.

**Fix before the rehearsal:**
1. **The Windmill example builds use `bluff_pad`:**
   - `src/genlayer/examples.ts`;
   - `tests/direct/genlayer-cases.json`;
   - the `initialArtifact` in the fixture and catalog.

   As a result, `coast_windmill:good` (expected approve) pairs a bluff-pad
   build with a "service pad" plan, so the AI would correctly revise it. It
   is also the same build as `coast_windmill:bluff-pad`. Switch the valid
   examples to `service_pad`. The starting artifact may stay on
   `bluff_pad` as part of the puzzle.
2. **The Quiet Pump rehearsal build marks every connection
   `channel: 'water'`.** Its `mount→pump` and `housing→pump` edges are
   mechanical. Run against the contract, `village_pump:quiet-good` raises
   `[EXPECTED] Incompatible connection port`, so it can never be judged.
   Take each channel from the port definitions.
3. **`test_village_pump_council.py::test_empty_player_note_is_valid_and_judges_only_the_build`
   fails.** It is a v4 test. Turn it into "an empty or too-short plan is
   rejected before any AI call". The reported 18/18 covered only
   `test_site_contracts.py`; run both site test files.
4. **Small:** the plan sits inside `"""…"""` in the prompt. Replace `"""`
   inside the plan (e.g. with `'''`) so it can't close the quote early.

**Claude's side:** the "Answer the council" step is committed with the
council question, a one-line answer with a 15–200 counter, Enter moving on to
Review, and pasted line breaks turned into spaces.

**`8cb2540` closes all four points.** I verified it myself:
- unit 239/239, GenLayer vitest 109/109, both site direct-test files 26/26;
- the rehearsal has 44 cases;
- `coast_windmill:good` is on `service_pad` and `coast_windmill:bluff-pad`
  on `bluff_pad`;
- the Quiet Pump case uses mechanical channels for the mount and housing.

Next is the StudioNet rehearsal, which needs the user's approval. It is one
deployment of `contracts/council_eval.py` plus 132 `judge` calls.

## Review of the v5 rehearsal (`f010012`)

I verified this independently against StudioNet:
- **Approve cases:** three spot-checked, including one where a validator
  disagreed.
- **Revise cases:** seven spot-checked, covering injection, bluff pad,
  wrong fact and contradicts-build.
- In every one, the on-chain status (FINALIZED), consensus result
  (MAJORITY_AGREE) and recipient (the evaluator), and the leader's decision
  in the transaction's own eq outputs, match `raw-results.json`.

Across all 132 runs:
- every decision matched the expected one;
- 0 rotations;
- 12 disagree votes out of 528 validator slots, concentrated in the Pump
  (5) and Sluice (3) cases;
- 65 runs passed with the leader plus 2 agreeing validators, and 2
  validators idle. That is StudioNet's normal participation, but those
  majorities are bare.
- 15 model families took part. Approve feedback is specific and correct,
  e.g. "service pad mount keeps the windmill back from the edge".

**Follow-ups:**
- Four answers hit the 160-character cap mid-word. The client now applies
  the whole-sentence cleanup at 160 (`src/domain/feedback-text.ts`).
- `raw-results.json` (14 MB) is committed. Slim it (drop the raw
  calldata/receipts, keep IDs, votes and results) or store it outside git.

**Verdict:** v5 is ready for the one real redeploy.

## Review of the v5 deployment (`a719fe1`)

I verified this independently on 2026-10-16 (read-only).

**On chain:** for all eight addresses in `deployments.studionet.json`:
- the deployed source sha256 equals `contracts/sites/manifest.json`;
- the parent dependencies and the configured dependents match the graph;
- the v5 council prompt is present.

The site sources are unchanged since the reviewed `8cb2540`. The deployer
balance is still 0.792 GEN.

**Live site** (`fix-the-island.vercel.app`):
- The bundle has all 8 v5 addresses and none of the v4 ones.
- It has Claude's UI: the council question card, "Answer the council", the
  site councils, and the windmill pad labels.
- With a read-only wallet stub it enters connected mode against v5 (the
  source proof passed), with wallet calls limited to account/network
  queries and no signing.

**Not yet proven:** live player reviews on v5.

## Review of `f803a2d` (retire legacy single-contract mode)

Checked in `C:\dev\fix-the-island`:
- **Contracts unchanged:** the template and pilot-contract edits are
  comment-only. The site contracts, manifest and `site-contract-meta.ts` are
  unchanged since the v5 deploy, and `build-site-contracts.py --check` passes.
- **Unit tests:** 241/241.
- **Full eight-site keyboard journey** on the new adapter: completed, no page
  errors, no mid-run source changes.
- **Connected mode** loads against the live v5 contracts with a read-only
  wallet stub: account and network queries only, no signing.

Leftover (not blocking): `src/main.ts` still passes the old
`VITE_GENLAYER_CONTRACT_ADDRESS` field, which the resolver ignores. Claude
will drop it.
