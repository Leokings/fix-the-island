import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { abi } from 'genlayer-js';
import { canonicalizeRepairSubmission, digestRepairSubmission } from '../src/genlayer';
import type { RepairArtifact, RepairBinding } from '../src/genlayer';
import { calldataAddress, submissionArgs } from '../src/genlayer/evidence';

const vectors = JSON.parse(readFileSync(new URL('../tests/direct/genlayer-golden.json', import.meta.url), 'utf8')) as {
  binding: RepairBinding; artifact: RepairArtifact; rationale: string; canonical: string; digest: `0x${string}`;
  calldataHex: string; addressCalldataHex: string;
}[];
describe('fixed cross-language canonical and actual SDK calldata vectors', () => {
  for (const vector of vectors) it(`${vector.binding.siteId}: JSON, SHA-256, method arguments and address type`, async () => {
    expect(canonicalizeRepairSubmission(vector.binding, vector.artifact, vector.rationale)).toBe(vector.canonical);
    expect(await digestRepairSubmission(vector.binding, vector.artifact, vector.rationale)).toBe(vector.digest);
    const prepared = { ...vector.binding, artifact: vector.artifact, rationale: vector.rationale, digest: vector.digest, technicalFlags: {}, technicallyValid: false };
    const bytes = abi.calldata.encode(abi.calldata.makeCalldataObject('submit_repair', submissionArgs(prepared), undefined));
    expect(`0x${Buffer.from(bytes).toString('hex')}`).toBe(vector.calldataHex);
    expect(`0x${Buffer.from(abi.calldata.encode(calldataAddress(vector.binding.caller))).toString('hex')}`).toBe(vector.addressCalldataHex);
  });
});
