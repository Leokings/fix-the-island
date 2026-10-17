# Historical monolith compaction record

This file records work on the retired all-sites contract. The generated
`contracts/island_repairs.py` and `tools/build-genlayer-contract.py` have been
removed; their byte-size and gas measurements below are historical and are not
deploy instructions. The readable `contracts/island_repairs.source.py` remains
as the shared authoring template for the eight independent site contracts.

## Current generation path

`contracts/sites/manifest.json` is the source of truth for the eight contracts
and their hashes. `tools/build-site-contracts.py` generates the deployable site
files and `src/genlayer/site-contract-meta.ts`.

```powershell
python tools/build-site-contracts.py
./tools/genlayer-check.ps1
```

Do not use the retired monolith builder or deploy the shared template directly.
The safe direct-test command is:

```powershell
python -m pytest -q -p no:gltest tests/direct/test_site_contracts.py tests/direct/test_village_pump_council.py
```

## Historical candidate (2026-10-08)

- Monolithic deployment source: 23,799 UTF-8 bytes, LF.
- Historical SHA-256: `0x8b068f656f873d9b1c4fdf965ccee9b31036b934b00b027466de0fb088d570b4`.
- The old source passed its then-current linter and scripted checks; none are
  evidence for a current deployment or live validator judgment.
- Earlier Bradbury gas estimates and rejected submissions applied to the old
  monolith and must not be used as estimates for any per-site contract.

The published practice build is a separate frozen artifact. This historical
record does not describe its source or assert that any current source is live.
