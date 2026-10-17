// Independent Node JSON/SHA oracle. Reads public test fixtures; writes no files.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { CalldataAddress } from 'genlayer-js/types';

const cases = JSON.parse(readFileSync(new URL('../tests/direct/genlayer-cases.json', import.meta.url), 'utf8'));
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function normalized(input) {
  const artifact = structuredClone(input);
  artifact.parts.sort((a, b) => compare(a.id, b.id));
  artifact.connections.sort((a, b) => compare(a.channel, b.channel) || compare(a.from.partId, b.from.partId) || compare(a.from.portId, b.from.portId) || compare(a.to.partId, b.to.partId) || compare(a.to.portId, b.to.portId));
  return artifact;
}
const binding = { chainId: 4221, contractAddress: `0x${'2'.repeat(40)}`, caller: `0x${'1'.repeat(40)}`, expeditionId: `0x${'e'.repeat(64)}`, fixtureVersion: 'island-2026-10-16-v5' };
const result = [0, 6].map((index) => {
  const draft = cases[index], nonce = String(index * 7), artifact = normalized(draft.artifact);
  const rationale = index ? `${draft.rationale} I preserve water for reeds and birds 🌿.` : draft.rationale;
  const payload = { ...binding, domain: 'fix-island-repair-v1', siteId: draft.siteId, nonce, artifact, rationale };
  const canonical = stable(payload), artifactJson = stable(artifact);
  const args = [binding.expeditionId, draft.siteId, artifactJson, rationale, BigInt(nonce)];
  const call = abi.calldata.encode(abi.calldata.makeCalldataObject('submit_repair', args, undefined));
  return { binding: { ...binding, siteId: draft.siteId, nonce }, artifact, rationale, canonical,
    digest: `0x${createHash('sha256').update(canonical).digest('hex')}`,
    calldataHex: `0x${Buffer.from(call).toString('hex')}`,
    addressCalldataHex: `0x${Buffer.from(abi.calldata.encode(new CalldataAddress(Uint8Array.from(Buffer.from(binding.caller.slice(2), 'hex'))))).toString('hex')}`,
  };
});
const output = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--write')) writeFileSync(new URL('../tests/direct/genlayer-golden.json', import.meta.url), output, 'utf8');
else process.stdout.write(output);
