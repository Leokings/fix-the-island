# Live GenLayer readiness

This replaces the retired single-contract preflight. The current app uses eight
independent site contracts; it has no `VITE_GENLAYER_CONTRACT_ADDRESS` fallback
and no deployable `contracts/island_repairs.py` monolith.

## Configuration

Connected mode requires the exact eight-key public JSON map
`VITE_GENLAYER_SITE_ADDRESSES`, or the committed per-network address map loaded
by the app. Each site address is checked against the generated code hash and its
protocol, fixture version, dependency and dependent configuration. Missing or
invalid per-site addresses disable connected mode; local practice is separate.

The shared readable source at `contracts/island_repairs.source.py` is only a
template for `tools/build-site-contracts.py`. Do not deploy it directly. Current
architecture and operational test commands are in
[GENLAYER-PER-SITE.md](GENLAYER-PER-SITE.md); deployment evidence and historical
release status are in [PUBLIC-DEPLOYMENT.md](PUBLIC-DEPLOYMENT.md).

Local tests and source checks do not prove live validator agreement. Only a
finalized network transaction with matching receipt and original broadcast
evidence can grant a restoration. No deployment or review is authorized by this
readiness note.
