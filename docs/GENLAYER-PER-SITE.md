# Immutable per-site repair contracts

Root contract checkpoint: `cec789e283d3be8c79f5d8464c7accb62379b140`.
The five dependent contracts were subsequently regenerated to remove constructor
subcalls after a live native `invalid_contract absent_runner_comment` error.
Exact source hashes, byte sizes, files and dependencies: `contracts/sites/manifest.json`.
The source remains frozen while main performs deployment. No deployment/signing
was performed by the backend Builder; no hackathon submission is authorized.

## Deploy in dependency order

Every constructor takes **one string** named `dependency_addresses`. It is JSON
mapping exactly the direct prerequisite site IDs to verified deployed addresses.
No caller can change these stored addresses after construction. Dependent
constructors validate only exact mapping keys, address syntax, nonzero/distinct
addresses, and no self-reference; they make no external calls. Main and the
frontend authenticate these bindings against pinned source hashes. Parents must
have usable finalized approvals before a dependent repair can be approved.

| Site | Required keys in constructor JSON |
| --- | --- |
| pier_hoist | none: constructor args `["{}"]` |
| village_pump | none: `["{}"]` |
| tidal_sluice | none: `["{}"]` |
| creek_bridge | pier_hoist, village_pump, tidal_sluice |
| coast_windmill | creek_bridge |
| woodland_pathlight | coast_windmill |
| upland_waterworks | creek_bridge, village_pump |
| ridge_beacon | woodland_pathlight, upland_waterworks |

For a dependent site, construct `constructorArgs = [JSON.stringify(requiredMap)]`;
the outer argument is an array containing a string, not an object argument.
Do not substitute zero addresses or guessed/pending deployment addresses.

Hoist read-only deployment quote: 16,310 source bytes; 13,798,122 gas;
0.0021609804587202 GEN at gas price 156614100. Estimation is not admission or
execution proof. Other sites are 16,120–16,705 bytes, not the aspirational 10 KB.

## Public configuration

The current provisional beta configures eight successfully executed, ACCEPTED
deployments after verifying source/protocol/bindings. Deployment finality and the
real AI review remain pending. Restoration still requires FINALIZED approval.
The public JSON object is in `src/genlayer/deployments.json`:

Replace each placeholder with its verified public address before enabling:

```json
{
  "pier_hoist": "0x…", "village_pump": "0x…", "tidal_sluice": "0x…",
  "creek_bridge": "0x…", "coast_windmill": "0x…", "woodland_pathlight": "0x…",
  "upland_waterworks": "0x…", "ridge_beacon": "0x…"
}
```

It is `null` until ready, and the fallback is wired only in `main.ts` so
`resolveGenLayerConfig({})` remains disabled. Alternatively provide the exact eight-key JSON object
as `VITE_GENLAYER_SITE_ADDRESSES`. No hashes are accepted from deployment config;
the adapter compares source to build-generated, checked-in hash pins. All eight
addresses must be distinct and nonzero. A configured invalid map fails closed.
No wallet is requested on boot. There is no single-contract fallback; all eight
site addresses are mandatory for connected mode.

## Authority and finality

- Each site embeds only its own complete immutable catalog and technical branch.
  Shared input validation, canonical digest and independent contextual judgment
  code come from `contracts/island_repairs.source.py`.
- Each site has its own caller nonce; equal nonce numbers across sites are valid.
  Digests bind chain, actual recipient contract, caller, site, artifact and rationale.
- Parent approvals are obtained by trusted cross-contract view calls explicitly
  using `StorageType.LATEST_FINAL`. There is no duplicated central progress store,
  accepted-state prerequisite, or client-supplied prerequisite boolean.
- Deployment tooling and the client verify parent code hashes, protocol/site/
  version, and the exact immutable dependency maps. Constructor-time parent
  protocol reads were removed; a self-reported protocol would not be a substitute
  for code identity. Existing root bytes are unchanged.
- The adapter reads every site's finalized progress and routes prepare/write,
  receipts, saved tickets and archived broadcasts to the actual site address.
  The hoist address is only a session namespace, never a substitute recipient.
- Accepted/pending/unknown-finality states never grant restoration. A grant still
  requires original EVM broadcast evidence, matching GenLayer transaction identity,
  FINALIZED status, successful execution and a matching approved finalized receipt.
- Bradbury RPC, wallet, tickets and transaction bindings stay on chain 4221.
  These pinned per-site deployments report native `gl.message.chain_id == 1`;
  protocol checks and digest recomputation use the separately pinned context 1.
  The value is never learned from untrusted tickets/protocol data. Read-only live
  hoist preparation verified exact caller and native-1 digest equality. A successful
  `LATEST_FINAL` external view is not proof that its deployment transaction is
  actually finalized; main must inspect transaction status/execution separately.
- Saved installations remain untrusted hints until original broadcasts are
  reverified in dependency order. Invalid network/caller/recipient/digest evidence
  grants nothing; recovery cannot sign or rebroadcast.

## Verification and regeneration

`python tools/build-site-contracts.py --write` regenerates per-site readable and
formatted deployment sources plus hash metadata. It uses installed
python-minifier 3.2.0 with every AST transformation disabled and asserts readable
versus deployment AST equality. Run without `--write` to check freshness.
Do not regenerate/change frozen source after deployment without an explicit new
deployment/version plan. `./tools/genlayer-check.ps1` lints before testing.

Historical checkpoint counts below predate legacy-contract retirement; run the
current safe checks for authoritative counts. Per-site tests cover complete own catalog, final-state dependency
reads, rejected/foreign-caller/wrong-site/version parent evidence, contextual
validator reruns and closure serialization, replay protection and malformed root
constructor mappings. The multisite adapter test covers all eight installations,
independent zero nonces, actual recipient identity and save/reload/reverification.
The updated 11 per-site tests additionally assert zero constructor subcalls.

The old monolith's scripted consensus regression has been removed with that
contract. Direct cross-contract reads are offline tests, not proof of live
cross-contract execution. Live deployment, dependency reads and real contextual
reviews must be verified before claiming live consensus.
