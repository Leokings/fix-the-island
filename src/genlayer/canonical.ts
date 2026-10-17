import { createRepairArtifact, normalizeAddress, normalizeNonce, normalizeRationale, RepairValidationError } from './schema';
import type { Hash, RepairArtifact, RepairBinding } from './types';

export const REPAIR_DIGEST_DOMAIN = 'fix-island-repair-v1';
type Json = string | number | readonly Json[] | { readonly [key: string]: Json };

function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const object = value as { readonly [key: string]: Json };
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key]!)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizedArtifact(input: RepairArtifact): Json {
  const artifact = createRepairArtifact(input);
  const parts = [...artifact.parts].sort((a, b) => compare(a.id, b.id)).map((part) => ({ ...part }));
  const connections = [...artifact.connections].sort((a, b) =>
    compare(a.channel, b.channel) || compare(a.from.partId, b.from.partId) ||
    compare(a.from.portId, b.from.portId) || compare(a.to.partId, b.to.partId) ||
    compare(a.to.portId, b.to.portId),
  ).map((edge) => ({ channel: edge.channel, from: { ...edge.from }, to: { ...edge.to } }));
  return { schemaVersion: artifact.schemaVersion, parts, connections, configuration: { ...artifact.configuration } };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonicalizeRepairArtifact(artifact: RepairArtifact): string {
  return canonicalJson(normalizedArtifact(artifact));
}

/** Public binding bytes only; computing a digest never submits or approves a repair. */
export function canonicalizeRepairSubmission(binding: RepairBinding, artifact: RepairArtifact, rationale: string): string {
  if ((binding.chainId !== 4221 && binding.chainId !== 61999) || (binding.nativeChainId !== undefined && binding.nativeChainId !== 1 && binding.nativeChainId !== 4221 && binding.nativeChainId !== 61999) || typeof binding.siteId !== 'string' || binding.siteId.length < 1 || binding.siteId.length > 40 || /[^a-z0-9_-]/.test(binding.siteId) ||
      typeof binding.fixtureVersion !== 'string' || binding.fixtureVersion.length > 64 || !/^[a-z0-9]/.test(binding.fixtureVersion) || /[^a-z0-9_.-]/.test(binding.fixtureVersion)) {
    throw new RepairValidationError([{ path: 'binding', code: 'shape', message: 'Unsupported chain, site ID or fixture version.' }]);
  }
  if (!/^0x[0-9a-f]{64}$/.test(binding.expeditionId)) {
    throw new RepairValidationError([{ path: 'binding.expeditionId', code: 'shape', message: 'Expedition ID must be a 32-byte hex value.' }]);
  }
  return canonicalJson({
    domain: REPAIR_DIGEST_DOMAIN,
    chainId: binding.nativeChainId ?? binding.chainId,
    contractAddress: normalizeAddress(binding.contractAddress),
    caller: normalizeAddress(binding.caller),
    expeditionId: binding.expeditionId,
    fixtureVersion: binding.fixtureVersion,
    siteId: binding.siteId,
    nonce: normalizeNonce(binding.nonce),
    artifact: normalizedArtifact(artifact),
    rationale: normalizeRationale(rationale),
  });
}

export async function digestRepairSubmission(binding: RepairBinding, artifact: RepairArtifact, rationale: string): Promise<Hash> {
  const bytes = new TextEncoder().encode(canonicalizeRepairSubmission(binding, artifact, rationale));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
