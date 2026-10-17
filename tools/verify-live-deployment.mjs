// Read-only live identity check. No account, key, signing, or write call.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';
const address = process.argv[2];
assert.match(address ?? '', /^0x[0-9a-fA-F]{40}$/);
if (!process.argv[3]) throw new Error('Usage: node tools/verify-live-deployment.mjs <address> <contract-file> [site-id]');
const client = createClient({ chain: studionet });
const expected = readFileSync(resolve(process.argv[3]), 'utf8');
const site = process.argv[4];
const hash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const bounded = promise => Promise.race([promise, new Promise((_, reject) => {
  const timer = setTimeout(() => reject(new Error('Public RPC read timed out')), 25000); timer.unref();
})]);
const [chainId, source, schema, protocol] = await bounded(Promise.all([
  client.request({ method: 'eth_chainId' }), client.getContractCode(address), client.getContractSchema(address),
  client.readContract({ address, functionName: 'get_protocol', args: [], jsonSafeReturn: true,
    leaderOnly: false, transactionHashVariant: TransactionHashVariant.LATEST_FINAL }),
]));
assert.equal(Number(chainId), 61999);
assert.equal(hash(source), hash(expected), 'Deployed source differs from tested contract');
assert.equal(protocol.protocolVersion, 'repair-v2');
// On Studionet the wallet and observed GenVM context both report 61999.
// Bradbury per-site deployments historically reported native context 1 instead.
// Keep network-specific observations explicit rather than infer either value.
assert.equal(protocol.chainId, 61999);
assert.equal(protocol.sites.length, site ? 1 : 8);
if (site) { assert.deepEqual(protocol.sites, [site]); assert.equal(protocol.architecture, 'async-notify-v1'); }
console.log(JSON.stringify({ address, chainId: Number(chainId), sourceHash: `0x${hash(source)}`,
  sourceMatches: true, protocol, schema }, null, 2));
