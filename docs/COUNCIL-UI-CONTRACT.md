# Village pump council — UI handoff v2

Status (2026-10-15): the pump council assessment runs inside the village-pump
Intelligent Contract's `submit_repair` method. The game projects a verified
finalized pump receipt into the council presentation. There is no separate
council transaction or council contract in this flow. The prior v2 pump
deployment and its positive direct-pump review below are historical proof for
that old address. The new async-notification set is deployed at
`0x72FebD7b3D13f547B809D385Bf91673EBacB2F82`; no review has yet been submitted
to that new address. Revise, timeout/recovery and adversarial cases remain to be
proven live. Claude owns the visuals; this document describes the backend/UI
boundary, not a request to change visuals.

StudioNet proof references:

- Chain ID: `61999` (StudioNet)
- Pump contract: `0x7aD8E4Afd29A2A768dA19e2cb57930287C15a2A9`
- Deployment transaction: `0xe70a019dee457d8c0e0724405c628d71160acc4ddda39639769631768c2b5c5d`
- Deployed code hash: `0x95836adfbe992802da6904ffd9000a9038bc5d332880f76c0cfac45d28e4cb1c`
- Example finalized review: `0x4eb78a44432da802dc4943b2fee3c8e9fde7d7c5771c320a072a55d8a8e8e7ca`
  ([StudioNet Explorer](https://explorer-studio.genlayer.com/tx/0x4eb78a44432da802dc4943b2fee3c8e9fde7d7c5771c320a072a55d8a8e8e7ca))

These references prove the historical StudioNet deployment and one finalized
positive example, not the new deployment, production-mainnet readiness, or
complete scenario coverage. The new deployment's addresses, hashes and receipts
are in `docs/GENLAYER-STUDIONET-PROOF.json`.

## Boundary

Player builds a design and optionally explains it -> backend validates the actual
construction against immutable design/scenario facts -> GenLayer evaluates its
suitability -> validators verify the structured assessment -> contract records
the result -> backend verifies transaction finality, successful execution and
request binding -> a separate authority path may apply permanent consequences.

The scene receives a **display-only projection**, never permission to restore a
site. Renderers must not call restoration/save/unlock APIs from this projection.
Mock scenes may alter isolated preview objects only, not the real World or saves.

## Files Claude can use now

- `src/genlayer/council/types.ts`: backend-owned types, enum values and shape validator.
- `src/genlayer/council/mock-fixtures.ts`: labelled examples, no wallet/RPC imports.
- `contracts/sites/village_pump.py`: deployed v2 pump repair and contextual
  council assessment. Its `submit_repair` first checks the physical build, then
  calls `_pump_council` for a technically valid pump.
- `contracts/council/village_pump_council.py`: separate review-only prototype;
  it is not used by the live game flow.
- `src/genlayer/council/live-adapter.ts`:
  `projectFinalizedPumpCouncilPresentation(state)` projects only a finalized
  pump receipt already verified by the repair adapter. `src/main.ts` subscribes
  to adapter state and presents that projection to the council scene.
- `VILLAGE_PUMP_COUNCIL_MOCKS`: `approveAcceptable`, `approveGood`,
  `approveExcellent`, `revise`, `timeout`, plus `pending`, `accepted` and `failed`.

Import types directly from `src/genlayer/council/types`; import mock data only in
an explicitly selected development/demo scene. Do not replace the current live
adapter with these fixtures or silently fall back to them after a network error.
The projection itself does not submit reviews or grant restoration. Submission
and recovery belong to the repair adapter; a successful finalized repair produces
the restoration grant, while the council presentation remains display-only. The
adapter verifies transaction/finality and request bindings before the projector
checks the receipt's pump site, result shape, selected design and decision. The
presentation carries the contract, transaction, pump digest, evidence quote and
feedback for proof-link rendering. Do not treat the council UI projection as the
source of game authority, or a mock as a live result.

## Stable result fields

`CouncilResult` retains Claude's decision, quality, perspectives, consequences
and chosenDesignId fields. It adds schemaVersion, catalogVersion, siteId and
scenarioId. Live `quality` is `good` for an approval and null for revise; this is
deterministic presentation metadata, not an additional validator judgment. Mock
acceptable/excellent grades are simulated examples. A result always contains
exactly four perspectives in this order:
`fisher`, `farmer`, `engineer`, `elder`. Render text as plain text, never HTML.

Pilot design IDs are `direct_pump`, `quiet_pump`, and `rain_cistern`. The v2
fixture now binds each to exact slots, real part options, settings, wiring,
budgets, and deterministic operating metrics. The council contract calls the
pump contract's read-only `prepare_repair` method and rejects any design ID that
does not match the physical build. Existing deployed v1 repair contracts do not
accept v2; the updated source is not deployed. All fixtures are illustrative,
not evidence of live validator decisions.

### Exact meaning of consequence levels

Effects are relative to the site's damaged baseline. They are game states, not
engineering measurements or real-world predictions. `water` means reliable supply;
`habitat` means habitat health; `maintenance` means ease of upkeep. Thus maintenance
`worse` means MORE upkeep, while `better` means LESS upkeep (not more wear).

Approved-design effects are a fixed v1 catalog lookup, independent of prose/grade:

| Design | Water | Habitat | Maintenance ease |
| --- | --- | --- | --- |
| direct_pump | much_better | worse | worse |
| quiet_pump | better | better | worse |
| rain_cistern | better | much_better | better |

For revise, all consequences are `same`: nothing is applied. For pending, accepted,
timeout or execution failure, there is no result and no consequences to apply.
These values are a bounded gameplay specification; any future balance change
requires a new catalog version and matching contract/client tests.

## Consensus and presentation

**Stance and quality are presentation, not validator votes/judgments.** Validators
agree on one bounded assessment: `approve` or `revise`.
The four island-priority characters and their stance/text are deterministic app
presentation mappings from the selected design and decision; they do not
represent validator identities, counts, or independent ballots. Design/site/
scenario IDs come from the verified submission and are not invented by the LLM.
Consequences are derived by ordinary contract code from the pinned table, not
generated by the model. The design ID must exactly match the design bound to the
submitted construction and repair digest. Validators may use different wording,
but independently check that the assessment is grounded in the bounded pump,
scenario and submitted construction. They check a short quote/claim against that
same bounded evidence. In the current contract, validators independently rerun
the assessment and compare the fixed `decision` field (`approve` or `revise`);
they do not vote as the four characters, nor require identical quote/feedback
wording. The contract checks the response shape and that the quote is an exact
substring of the supplied evidence. Player text is treated as untrusted input
and the prompt instructs the model to ignore embedded instructions.
An approved plan may still have a concerned fisher or engineer: approval accepts
an explicit trade-off; it does not mean unanimous enthusiasm or a character vote.

The sole live criterion is whether a deterministic-valid physical build is a
plausible fit for the fixed urgent-water / nesting-season scenario. The contract
returns `approve` or `revise`, a short exact quote from bounded evidence, and
bounded feedback; an empty player explanation is allowed. Contract code sets
quality to `good` for any approval and `null` for revise. Character reactions
and fixed consequences are app/catalog presentation derived from the verified
decision and design, not separate AI or validator outputs. One positive direct-
pump review has finalized on StudioNet. Live revise, timeout/recovery and
adversarial coverage remain outstanding; mock cases and local tests are not live
consensus evidence.

Four characters are island priorities, NOT real validator identities/counts.
No fabricated per-validator ballots or claimed live vote timing. A submitted or
accepted transaction may show deliberation; reveal the live final assessment only
after the adapter has checked FINALIZED + successful execution + matching receipt.

## Lifecycle wrapper, separate from the contract assessment

`CouncilPresentation` has `authority: 'display-only'`, `source: 'mock' | 'genlayer'`,
site/design identifiers, a `status`, a display message and `result`.

- `pending`, `accepted`: result null; deliberation, no final reactions/rewards.
- `timed_out`: result null; client stopped waiting, not a council rejection. Offer
  read-only status recovery for the existing transaction; never automatic rebroadcast.
- `failed`: result null; protocol/execution failure is not `decision: 'revise'`.
- `finalized`: result supplied. With source mock, this is explicitly a SIMULATED
  final result. With source genlayer, only the verified adapter may produce it.

Even a live finalized presentation is not a RestorationGrant. A source label,
status string or JSON parser alone is not evidence. The repair adapter verifies
chain, transaction, execution/finality and request binding; the council projector
validates the receipt fields and physical design binding. The game's existing
repair authority applies restoration from its verified grant, not from this
presentation. Do not wire presentation callbacks to save/unlock APIs.

## Sequence

The pump catalogue binds each design ID to exact physical slots, parts, edges,
settings, budgets and deterministic test numbers. The StudioNet deployment uses
`island-2026-10-13-v2`; the live submission/recovery and finalized-result path is
wired through the existing repair adapter. Remaining validation: exercise live
revise and timeout/recovery paths, adversarial prompt inputs, and wallet flow; keep
the outcomes and transaction links in the proof manifest. Do not deploy the
separate `contracts/council/village_pump_council.py` prototype for the existing
flow. This document update deploys nothing.
