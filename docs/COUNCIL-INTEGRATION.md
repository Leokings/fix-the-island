# Village-pump council integration

The village-pump repair and its council assessment are one GenLayer transaction. The contract first checks the submitted physical build with deterministic rules. If those checks pass, validators independently judge one bounded question: whether the selected, technically valid design is a plausible fit for the fixed water-shortage/nesting-season scenario. They compare only the fixed `approve` / `revise` decision. The contract validates the response, derives the fixed presentation fields, and stores them in the same repair receipt as the decision.

The separate council-review contract is not part of the app's pump flow. A player connects and approves one `submit_repair` transaction; there is no second review submission or second wallet prompt. The council characters are presentation of deterministic island perspectives, not the validators themselves. `quality`, perspectives, and consequences are fixed contract-derived data; validator prose cannot award rewards or mutate the world.

Restoration authority remains the existing repair adapter's finalized-success grant. A `rejected` receipt can be shown as a finalized `revise` assessment, but it grants no progress. Pending, accepted, timeout, canceled, and failed execution states have no council result to project. The UI labels a presentation `verified` only after the adapter has verified the finalized transaction and receipt. The projected council result is display-only and cannot itself unlock a site.

## Trust boundary and deployment status

Local contract tests and generated-code checks do not prove live consensus. This change does not deploy the updated contract. Before using it on Bradbury, deploy the exact generated pump source, update the public per-site address and code-hash metadata, check any dependent contracts that pin the pump address, then exercise finalized approve and revise cases plus timeout/recovery using a real wallet-approved browser transaction. Keep the old deployment labeled historical; do not call a provisional result finalized.
