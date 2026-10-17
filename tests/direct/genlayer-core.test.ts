import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { testnetBradbury } from 'genlayer-js/chains';
import {
  canonicalizeRepairArtifact, canonicalizeRepairSubmission, createGenLayerAdapter, createRepairArtifact,
  digestRepairSubmission, GenLayerUnavailableError, normalizeAddress, normalizeNonce, normalizeRationale,
  parseRepairArtifact, REPAIR_LIMITS, REPAIR_SCENARIOS, RepairValidationError, resolveGenLayerConfig, siteContractAddress, validateRepairArtifact,
} from '../../src/genlayer';
import type { Address, PreparedRepair, RecoveryTicket, RepairArtifact, RepairBinding, RepairCatalog } from '../../src/genlayer';

const caller: Address = '0x1111111111111111111111111111111111111111';
const contractAddress: Address = '0x2222222222222222222222222222222222222222';
const rationale = 'This arrangement protects the habitat while keeping the maintenance route accessible.';
const binding: RepairBinding = { chainId: 4221, contractAddress, caller, expeditionId: `0x${'e'.repeat(64)}`, fixtureVersion: 'test-v1', siteId: 'test_site', nonce: '0' };

// Synthetic schema input only; no island fixture, real site fact or approval is defined here.
function artifact(): RepairArtifact {
  return {
    schemaVersion: 'repair-v1',
    parts: [
      { id: 'source', optionId: 'source_option', slotId: 'source_slot', orientationQuarterTurns: 0, settingId: 'fixed' },
      { id: 'load', optionId: 'load_option', slotId: 'load_slot', orientationQuarterTurns: 1, settingId: 'fixed' },
    ],
    configuration: { mountZoneId: 'zone', outputModeId: 'mode', routeId: 'route' },
    connections: [{ channel: 'electrical', from: { partId: 'source', portId: 'out' }, to: { partId: 'load', portId: 'in' } }],
  };
}

const catalog: RepairCatalog = {
  options: [
    { id: 'source_option', label: 'Source', kind: 'test', facts: {}, ports: [{ id: 'out', channel: 'electrical', direction: 'out' }] },
    { id: 'load_option', label: 'Load', kind: 'test', facts: {}, ports: [{ id: 'in', channel: 'electrical', direction: 'in' }] },
  ],
  slotIds: ['source_slot', 'load_slot'],
  configurationOptions: { mountZoneIds: ['zone'], outputModeIds: ['mode'], routeIds: ['route'], settingIds: ['fixed'] },
};

describe('bounded artifact schema', () => {
  it('takes an immutable copy without freezing or retaining the original draft', () => {
    const input = artifact();
    const snapshot = createRepairArtifact(input, catalog);
    expect(snapshot).toEqual(input);
    expect(snapshot).not.toBe(input);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.parts)).toBe(true);
    expect(Object.isFrozen(snapshot.parts[0])).toBe(true);
    expect(Object.isFrozen(snapshot.configuration)).toBe(true);
    expect(Object.isFrozen(snapshot.connections[0]?.from)).toBe(true);
    (input.parts[0] as { id: string }).id = 'edited';
    expect(snapshot.parts[0]?.id).toBe('source');
  });

  it('rejects untrusted completion flags, wrong scalar types and absent fields', () => {
    expect(validateRepairArtifact({ ...artifact(), completed: true }).valid).toBe(false);
    const input = artifact();
    expect(validateRepairArtifact({ ...input, parts: [{ ...input.parts[0], orientationQuarterTurns: true }] }).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, parts: [{ ...input.parts[0], orientationQuarterTurns: 0.5 }] }).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, parts: [{ ...input.parts[0], orientationQuarterTurns: -0 }] }).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, configuration: { mountZoneId: 'zone' } }).valid).toBe(false);
    expect(validateRepairArtifact(null).valid).toBe(false);
    expect(validateRepairArtifact(new Date()).valid).toBe(false);
  });

  it('does not execute object accessors and rejects identifiers with trailing whitespace', () => {
    const getter = vi.fn(() => true);
    const input = artifact();
    Object.defineProperty(input, 'completed', { get: getter, enumerable: true });
    expect(validateRepairArtifact(input).valid).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(validateRepairArtifact({ ...artifact(), parts: [{ ...artifact().parts[0], id: 'source\n' }] }).valid).toBe(false);
  });

  it('rejects duplicate parts/slots/connections, missing references and self-connected ports', () => {
    const input = artifact();
    expect(validateRepairArtifact({ ...input, parts: [input.parts[0], input.parts[0]] }).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, parts: [input.parts[0], { ...input.parts[1], slotId: 'source_slot' }] }).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, connections: [input.connections[0], input.connections[0]] }).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, parts: [input.parts[0]] }).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, connections: [{ channel: 'electrical', from: { partId: 'source', portId: 'out' }, to: { partId: 'source', portId: 'out' } }] }).valid).toBe(false);
  });

  it('checks catalog options/settings/slots and port direction/channel without declaring technical approval', () => {
    const input = artifact();
    expect(validateRepairArtifact(input, catalog).valid).toBe(true);
    expect(validateRepairArtifact({ ...input, parts: [{ ...input.parts[0], optionId: 'invented' }, input.parts[1]] }, catalog).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, configuration: { ...input.configuration, routeId: 'invented' } }, catalog).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, parts: [{ ...input.parts[0], settingId: 'invented' }, input.parts[1]] }, catalog).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, connections: [{ ...input.connections[0], channel: 'water' }] }, catalog).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, connections: [{ channel: 'electrical', from: { partId: 'load', portId: 'in' }, to: { partId: 'source', portId: 'out' } }] }, catalog).valid).toBe(false);
    expect(validateRepairArtifact(input, catalog)).not.toHaveProperty('approved');
  });

  it('enforces array and serialized byte limits', () => {
    const input = artifact();
    expect(validateRepairArtifact({ ...input, parts: Array(25).fill(input.parts[0]) }).valid).toBe(false);
    expect(validateRepairArtifact({ ...input, connections: Array(49).fill(input.connections[0]) }).valid).toBe(false);
    expect(() => parseRepairArtifact(`${JSON.stringify(input)}${' '.repeat(REPAIR_LIMITS.artifactBytes)}`)).toThrow(RepairValidationError);
    const parts = Array.from({ length: 24 }, (_, i) => ({ ...input.parts[0]!, id: `p${i}`, slotId: `s${i}`, optionId: 'a'.repeat(40), settingId: 'b'.repeat(40) }));
    const connections = Array.from({ length: 48 }, (_, i) => ({ channel: 'electrical' as const, from: { partId: `p${i % 24}`, portId: `out_${i}_${'c'.repeat(30)}` }, to: { partId: `p${(i + 1) % 24}`, portId: 'd'.repeat(40) } }));
    expect(validateRepairArtifact({ ...input, parts, connections }).valid).toBe(false);
  });

  it('retains duplicate-key evidence including escaped and nested keys', () => {
    const json = JSON.stringify(artifact());
    expect(() => parseRepairArtifact(json.replace('"schemaVersion":', '"schemaVersion":"repair-v1","schemaVersion":'))).toThrow(/duplicate key/);
    expect(() => parseRepairArtifact(json.replace('"id":"source"', '"id":"source","\\u0069d":"other"'))).toThrow(/duplicate key/);
    expect(() => parseRepairArtifact(json.replace('"mountZoneId":"zone"', '"mountZoneId":"zone","mountZoneId":"other"'))).toThrow(/duplicate key/);
    expect(parseRepairArtifact(json, catalog)).toEqual(artifact());
  });

  it.each(['0.0', '0e0', '-0', '-1'])('rejects noncanonical JSON number token %s', (token) => {
    expect(() => parseRepairArtifact(JSON.stringify(artifact()).replace('"orientationQuarterTurns":0', `"orientationQuarterTurns":${token}`))).toThrow(RepairValidationError);
  });

  it.each(['{} trailing', '{', '[', 'null', '{"__proto__":{}}'])('rejects malformed or unsupported JSON: %s', (json) => {
    expect(() => parseRepairArtifact(json)).toThrow(RepairValidationError);
  });
});

describe('canonical submission binding', () => {
  it('canonicalizes object keys and part/connection ordering with no locale dependency', () => {
    const input = artifact();
    expect(canonicalizeRepairArtifact(input)).toBe('{"configuration":{"mountZoneId":"zone","outputModeId":"mode","routeId":"route"},"connections":[{"channel":"electrical","from":{"partId":"source","portId":"out"},"to":{"partId":"load","portId":"in"}}],"parts":[{"id":"load","optionId":"load_option","orientationQuarterTurns":1,"settingId":"fixed","slotId":"load_slot"},{"id":"source","optionId":"source_option","orientationQuarterTurns":0,"settingId":"fixed","slotId":"source_slot"}],"schemaVersion":"repair-v1"}');
    expect(canonicalizeRepairArtifact({ ...input, parts: [...input.parts].reverse() })).toBe(canonicalizeRepairArtifact(input));
    const twoEdges = { ...input, connections: [...input.connections, { channel: 'electrical' as const, from: { partId: 'source', portId: 'other' }, to: { partId: 'load', portId: 'other' } }] };
    expect(canonicalizeRepairArtifact({ ...twoEdges, connections: [...twoEdges.connections].reverse() })).toBe(canonicalizeRepairArtifact(twoEdges));
  });

  it('preserves meaningful Unicode and rationale text, and rejects multi-line plans', () => {
    const mixedAddress: Address = '0xabcdefABCDEFabcdefABCDEFabcdefABCDEFabcd';
    expect(normalizeAddress(mixedAddress)).toBe(mixedAddress.toLowerCase());
    expect(normalizeRationale('🌱'.repeat(40))).toBe('🌱'.repeat(40));
    expect(normalizeRationale(`${rationale} é`)).not.toBe(normalizeRationale(`${rationale} e\u0301`));
    expect(() => normalizeRationale(`${rationale}\uD800`)).toThrow(RepairValidationError);
    expect(() => normalizeRationale('')).toThrow(RepairValidationError);
    expect(() => normalizeRationale('a'.repeat(14))).toThrow(RepairValidationError);
    expect(() => normalizeRationale(`${'a'.repeat(15)}\nmore`)).toThrow(RepairValidationError);
    expect(() => normalizeRationale(`${'a'.repeat(15)}\r\nmore`)).toThrow(RepairValidationError);
    expect(normalizeRationale('🌱'.repeat(15))).toBe('🌱'.repeat(15));
    expect(normalizeRationale('a'.repeat(200))).toBe('a'.repeat(200));
    expect(() => normalizeRationale('a'.repeat(201))).toThrow(RepairValidationError);
  });

  it('sorts connection fields as a tuple, including prefix IDs', () => {
    const input = artifact();
    const ids = ['a_0', 'a-0', 'a'];
    const parts = ids.map((id) => ({ ...input.parts[0]!, id, slotId: id }));
    const connections = ids.map((id) => ({ channel: 'electrical' as const, from: { partId: id, portId: 'out' }, to: { partId: 'load', portId: 'in' } }));
    const normalized = JSON.parse(canonicalizeRepairArtifact({ ...input, parts: [...parts, input.parts[1]!], connections })) as RepairArtifact;
    expect(normalized.connections.map((edge) => edge.from.partId)).toEqual(['a', 'a-0', 'a_0']);
  });

  it('computes standard SHA-256 over exactly the documented UTF-8 canonical bytes', async () => {
    const json = canonicalizeRepairSubmission(binding, artifact(), rationale);
    const digest = await digestRepairSubmission(binding, artifact(), rationale);
    expect(digest).toBe(`0x${createHash('sha256').update(json, 'utf8').digest('hex')}`);
    expect(JSON.parse(json)).toMatchObject({ domain: 'fix-island-repair-v1', chainId: 4221, caller, contractAddress, nonce: '0' });
  });

  it('changes the digest with caller, contract, site, fixture version, nonce, construction or explanation', async () => {
    const input = artifact();
    const original = await digestRepairSubmission(binding, input, rationale);
    for (const changed of [
      { ...binding, caller: contractAddress }, { ...binding, contractAddress: caller },
      { ...binding, siteId: 'other_site' }, { ...binding, fixtureVersion: 'test-v2' }, { ...binding, nonce: '1' },
    ]) expect(await digestRepairSubmission(changed, input, rationale)).not.toBe(original);
    expect(await digestRepairSubmission(binding, { ...input, configuration: { ...input.configuration, routeId: 'other_route' } }, rationale)).not.toBe(original);
    expect(await digestRepairSubmission(binding, input, `${rationale} Revised.`)).not.toBe(original);
  });

  it('rejects ambiguous/non-uint256 nonces, zero addresses and invalid binding domains', () => {
    expect(normalizeNonce(((1n << 256n) - 1n).toString())).toBe(((1n << 256n) - 1n).toString());
    for (const nonce of ['01', '-1', '1.0', '1e2', '0\n', (1n << 256n).toString()]) expect(() => normalizeNonce(nonce)).toThrow(RepairValidationError);
    expect(() => normalizeAddress(`0x${'0'.repeat(40)}`)).toThrow(RepairValidationError);
    expect(() => normalizeAddress(`${caller}\n`)).toThrow(RepairValidationError);
    expect(() => canonicalizeRepairSubmission({ ...binding, siteId: 'test_site\n' }, artifact(), rationale)).toThrow(RepairValidationError);
    expect(() => canonicalizeRepairSubmission({ ...binding, fixtureVersion: '' }, artifact(), rationale)).toThrow(RepairValidationError);
    expect(() => canonicalizeRepairSubmission({ ...binding, chainId: 1 } as unknown as RepairBinding, artifact(), rationale)).toThrow(RepairValidationError);
  });
});

describe('disabled adapter interface', () => {
  it('resolves only public configuration and agrees with the installed SDK preset', () => {
    expect(resolveGenLayerConfig({})).toEqual({ enabled: false, reason: 'unconfigured' });
    expect(resolveGenLayerConfig({ VITE_GENLAYER_CONTRACT_ADDRESS: contractAddress })).toEqual({ enabled: false, reason: 'unconfigured' });
    const addresses = Object.fromEntries(REPAIR_SCENARIOS.map((site, index) => [site.id,
      index === 0 ? contractAddress : `0x${(index + 20).toString(16).padStart(40, '0')}`]));
    const config = resolveGenLayerConfig({ VITE_GENLAYER_SITE_ADDRESSES: JSON.stringify(addresses) });
    expect(config).toMatchObject({ enabled: true, chainId: testnetBradbury.id, rpcUrl: testnetBradbury.rpcUrls.default.http[0] });
    expect(Object.isFrozen(config)).toBe(true);
    expect(resolveGenLayerConfig({ VITE_GENLAYER_SITE_ADDRESSES: '{"pier_hoist":"0x2222222222222222222222222222222222222222"}' })).toEqual({ enabled: false, reason: 'invalid-address' });
    expect(siteContractAddress({ contractAddress, siteAddresses: addresses as Record<string, Address> }, 'pier_hoist')).toBe(contractAddress);
    expect(REPAIR_SCENARIOS).toHaveLength(8);
    expect(Object.isFrozen(REPAIR_SCENARIOS)).toBe(true);
  });

  it('never contacts a provider or fabricates progress/preparation/submission while unconfigured', async () => {
    const provider = { request: vi.fn(async () => { throw new Error('Wallet access is forbidden in the stub.'); }) };
    const adapter = createGenLayerAdapter(resolveGenLayerConfig({}));
    const observed = vi.fn();
    const unsubscribe = adapter.subscribe(observed);
    expect(observed).toHaveBeenCalledWith({ status: 'disabled', reason: 'unconfigured' });
    expect(await adapter.connect(provider)).toEqual(adapter.getState());
    await expect(adapter.getProgress(caller)).rejects.toBeInstanceOf(GenLayerUnavailableError);
    await expect(adapter.prepare({ siteId: 'test_site', artifact: artifact(), rationale })).rejects.toBeInstanceOf(GenLayerUnavailableError);
    const prepared: PreparedRepair = { ...binding, artifact: createRepairArtifact(artifact()), rationale, digest: await digestRepairSubmission(binding, artifact(), rationale), technicalFlags: {}, technicallyValid: false };
    const ticket: RecoveryTicket = { version: 2, chainId: 4221, contractAddress, prepared, evmTxHash: `0x${'0'.repeat(64)}` };
    expect(await adapter.submit(prepared)).toEqual(adapter.getState());
    expect(await adapter.resume(ticket)).toEqual(adapter.getState());
    expect(await adapter.getScenarios()).toEqual(REPAIR_SCENARIOS);
    unsubscribe();
    adapter.disconnect();
    adapter.dispose();
    expect(provider.request).not.toHaveBeenCalled();
    expect(adapter.getState()).toEqual({ status: 'disabled', reason: 'unconfigured' });
  });
});
