import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialArtifact, createRepairArtifact, createRepairExampleDraft, FIXTURE_VERSION, getRepairScenario, getSlotOptions,
  REPAIR_SCENARIOS, updateRepairPart, validateRepairLocally, connectRepairPorts, disconnectRepairPorts,
  placeRepairPart, removeRepairPart, updateRepairConfiguration } from '../../src/genlayer';
import type { RepairArtifact, RepairDraft } from '../../src/genlayer';

const cases = JSON.parse(readFileSync(new URL('./genlayer-cases.json', import.meta.url), 'utf8')) as RepairDraft[];
const ids = ['pier_hoist', 'village_pump', 'tidal_sluice', 'creek_bridge', 'coast_windmill', 'woodland_pathlight', 'upland_waterworks', 'ridge_beacon'];
const metrics = [
  { counterweightMoment: 6000, loadMoment: 6000 }, { pressure: 4, trunkFlow: 6 },
  { nurseryFlow: 3, creekFlow: 5, bankFlow: 0 }, { capacity: 8 },
  { rpmNumerator: 1440, rpmDenominator: 12 }, { lampWatts: 6 },
  { villageFlow: 4, habitatFlow: 2, supply: 6 }, { beamSector: 0 },
];

describe('frozen PLAN fixtures and deterministic advisory', () => {
  it('freezes all eight IDs, budgets, prerequisites and contract review manifest', () => {
    expect(REPAIR_SCENARIOS.map((site) => site.id)).toEqual(ids);
    expect(REPAIR_SCENARIOS.map((site) => site.budget)).toEqual([16, 20, 14, 18, 16, 12, 16, 14]);
    expect(REPAIR_SCENARIOS.map((site) => site.requires)).toEqual([[], [], [], ids.slice(0, 3), ['creek_bridge'], ['coast_windmill'], ['creek_bridge', 'village_pump'], ['woodland_pathlight', 'upland_waterworks']]);
    const manifest = JSON.parse(readFileSync(new URL('../../contracts/island_fixtures.json', import.meta.url), 'utf8'));
    expect(REPAIR_SCENARIOS).toEqual(manifest);
    for (const site of REPAIR_SCENARIOS) {
      expect(site.version).toBe(FIXTURE_VERSION);
      expect(Object.isFrozen(site.options[0]!.facts)).toBe(true);
      expect(Object.isFrozen(site.initialArtifact.parts[0])).toBe(true);
      expect(Object.isFrozen(site.technical.requiredEdges)).toBe(true);
      expect(site.rubric.map((rule) => rule.id)).toEqual(['groundedInArtifact', 'explainsTradeoff', 'protectsHabitat', 'safeUseAndMaintenance']);
    }
    expect(() => getRepairScenario('unknown')).toThrow();
  });

  for (const [index, siteId] of ids.entries()) {
    it(`${siteId}: diagnoses initial damage and derives the repaired quantities, not a claimed output`, () => {
      const initial = createInitialArtifact(siteId);
      expect(initial).not.toBe(getRepairScenario(siteId).initialArtifact);
      expect(validateRepairLocally(siteId, initial).valid).toBe(false);
      const draft = cases[index]!;
      expect(createRepairExampleDraft(siteId, 'valid')).toEqual(draft);
      expect(validateRepairLocally(siteId, createRepairExampleDraft(siteId, 'initial-damage').artifact).valid).toBe(false);
      const artifact = createRepairArtifact(draft.artifact, getRepairScenario(siteId));
      const advice = validateRepairLocally(siteId, artifact);
      expect(advice).toMatchObject({ mode: 'advisory', valid: true, metrics: metrics[index] });
      expect(advice.materialCost).toBeLessThanOrEqual(advice.budget);
      expect(advice).not.toHaveProperty('approved');
      expect(advice).not.toHaveProperty('contextFlags');
      expect(validateRepairLocally(siteId, { ...artifact, completed: true }).valid).toBe(false);
      expect(validateRepairLocally(siteId, { ...artifact, connections: artifact.connections.slice(1) })).toMatchObject({ valid: false, flags: { connections: false } });
    });
  }

  it('uses the safe service pad for the Windmill example but keeps the puzzle start damaged', () => {
    expect(createRepairExampleDraft('coast_windmill', 'valid').artifact.configuration.mountZoneId).toBe('service_pad');
    expect(createInitialArtifact('coast_windmill').configuration.mountZoneId).toBe('bluff_pad');
  });

  it('supports multiple technically valid choices, not a single hard-coded answer', () => {
    const sluice = updateRepairPart('tidal_sluice', cases[2]!.artifact, 'nursery_gate', { settingId: 'nursery_2' });
    expect(validateRepairLocally('tidal_sluice', sluice)).toMatchObject({ valid: true, metrics: { nurseryFlow: 2, creekFlow: 6 } });
    const bridge = createRepairArtifact({ ...cases[3]!.artifact, parts: cases[3]!.artifact.parts.map((part) => ({ ...part,
      orientationQuarterTurns: part.slotId === 'brace_left' ? 1 : part.slotId === 'brace_right' ? 0 : part.orientationQuarterTurns,
    })) }, getRepairScenario('creek_bridge'));
    expect(validateRepairLocally('creek_bridge', bridge).valid).toBe(true);
    const renamed = createRepairArtifact({ ...sluice, parts: sluice.parts.map((part) => ({ ...part, id: `p_${part.id}` })),
      connections: sluice.connections.map((edge) => ({ ...edge, from: { ...edge.from, partId: `p_${edge.from.partId}` }, to: { ...edge.to, partId: `p_${edge.to.partId}` } })) });
    expect(validateRepairLocally('tidal_sluice', renamed).valid).toBe(true);
  });

  it('supports actual place/remove/rotate/configure/connect/disconnect actions immutably', () => {
    const original = cases[5]!.artifact, connection = original.connections[0]!;
    const disconnected = disconnectRepairPorts('woodland_pathlight', original, connection);
    expect(validateRepairLocally('woodland_pathlight', disconnected).valid).toBe(false);
    expect(validateRepairLocally('woodland_pathlight', connectRepairPorts('woodland_pathlight', disconnected, connection)).valid).toBe(true);
    expect(original.connections).toHaveLength(disconnected.connections.length + 1);
    const removed = removeRepairPart('woodland_pathlight', original, 'fuse');
    expect(removed.parts.some((part) => part.slotId === 'fuse')).toBe(false);
    expect(removed.connections.some((edge) => edge.from.partId === 'fuse' || edge.to.partId === 'fuse')).toBe(false);
    const replaced = placeRepairPart('woodland_pathlight', removed, original.parts.find((part) => part.slotId === 'fuse')!);
    expect(validateRepairLocally('woodland_pathlight', replaced).valid).toBe(false); // placing a part does not reconnect it
    expect(() => connectRepairPorts('woodland_pathlight', disconnected, { ...connection, to: { partId: 'lamp', portId: 'nonexistent' } })).toThrow();
    const unsafe = updateRepairConfiguration('ridge_beacon', cases[7]!.artifact, { mountZoneId: 'unstable_edge' });
    expect(validateRepairLocally('ridge_beacon', unsafe).valid).toBe(false);
    expect(Object.isFrozen(replaced.parts)).toBe(true);
  });

  it('rejects mis-slotted inventory, unsupported settings, bypasses and extra routes', () => {
    const draft = cases[0]!.artifact;
    expect(() => updateRepairPart('pier_hoist', draft, 'weight_a', { optionId: 'weight_b_3' })).toThrow();
    expect(() => updateRepairPart('pier_hoist', draft, 'weight_a', { settingId: 'rail_2000' })).toThrow();
    const water = cases[6]!.artifact;
    const bypass: RepairArtifact = { ...water, connections: water.connections.map((edge) => edge.from.partId === 'cistern' && edge.to.partId === 'filter' ? { ...edge, to: { partId: 'splitter', portId: 'in' } } : edge) };
    expect(validateRepairLocally('upland_waterworks', bypass)).toMatchObject({ valid: false, flags: { connections: false } });
    expect(getSlotOptions('coast_windmill', 'driver').map((option) => option.id)).toEqual(['driver_gear_12', 'driver_gear_24', 'driver_gear_36']);
  });

  it('checks electrical protection, beam geometry, integer ratio and material budget independently', () => {
    expect(validateRepairLocally('woodland_pathlight', updateRepairPart('woodland_pathlight', cases[5]!.artifact, 'shield', { orientationQuarterTurns: 1 }))).toMatchObject({ valid: false, flags: { operation: false } });
    expect(validateRepairLocally('ridge_beacon', updateRepairPart('ridge_beacon', cases[7]!.artifact, 'reflector', { orientationQuarterTurns: 1 }))).toMatchObject({ valid: false, metrics: { beamSector: 1 } });
    expect(validateRepairLocally('coast_windmill', updateRepairPart('coast_windmill', cases[4]!.artifact, 'driven', { optionId: 'driven_gear_36' }))).toMatchObject({ valid: false, metrics: { rpmNumerator: 1440, rpmDenominator: 36 } });
    const heavy = updateRepairPart('pier_hoist', cases[0]!.artifact, 'weight_b', { optionId: 'weight_b_3' });
    expect(validateRepairLocally('pier_hoist', heavy)).toMatchObject({ valid: false, flags: { budget: false }, materialCost: 17 });
  });
});
