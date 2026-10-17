import { describe, expect, it } from 'vitest';
import { getRepairScenario, validateRepairLocally } from '../../src/genlayer';
import type { RepairArtifact } from '../../src/genlayer';

const pump = getRepairScenario('village_pump');
function artifactFor(designId: string): RepairArtifact {
  const design = pump.technical.designs!.find(item => item.id === designId)!;
  const options = new Map(pump.options.map(option => [option.id, option]));
  const parts = design.slotIds.map(slotId => {
    const option = pump.options.find(candidate => candidate.allowedSlots?.includes(slotId))!;
    const settingId = ({ inlet: 'inlet_4', bypass: 'bypass_1', outlet: 'outlet_3', housing: 'hatch_serviceable',
      roof: 'yield_10', first_flush: 'discard_2', cistern: 'capacity_8', delivery_valve: 'deliver_6' } as Record<string, string>)[slotId] ?? 'fixed';
    return { id: slotId, slotId, optionId: option.id, settingId, orientationQuarterTurns: 0 as const };
  });
  const bySlot = new Map(parts.map(part => [part.slotId, part]));
  const connections = design.requiredEdges.map(edge => {
    const [fromSlot, fromPort, toSlot, toPort] = edge as readonly [string, string, string, string];
    const option = options.get(bySlot.get(fromSlot)!.optionId)!;
    return { channel: option.ports.find(port => port.id === fromPort)!.channel,
      from: { partId: fromSlot, portId: fromPort }, to: { partId: toSlot, portId: toPort } };
  });
  return { schemaVersion: 'repair-v1', parts, connections,
    configuration: { mountZoneId: design.mountZoneId, outputModeId: design.outputModeId, routeId: design.routeId } };
}

describe('pump design catalogue and deterministic technical checks', () => {
  it.each([
    ['direct_pump', 14, { pressure: 4, trunkFlow: 6 }],
    ['quiet_pump', 19, { pressure: 4, trunkFlow: 6, disturbance: 1 }],
    ['rain_cistern', 20, { rainInput: 10, firstFlush: 2, stored: 8, villageFlow: 6, reserve: 2 }],
  ] as const)('%s is a complete, physically distinct build', (designId, cost, metrics) => {
    const advice = validateRepairLocally('village_pump', artifactFor(designId));
    expect(advice.valid).toBe(true);
    expect(advice.designId).toBe(designId);
    expect(advice.materialCost).toBe(cost);
    expect(advice.metrics).toEqual(metrics);
  });

  it('does not infer a supported design from an incomplete or hybrid slot set', () => {
    const direct = artifactFor('direct_pump');
    const hybrid = { ...direct, parts: [...direct.parts, ...artifactFor('quiet_pump').parts.filter(part => part.slotId === 'mount')] };
    const advice = validateRepairLocally('village_pump', hybrid);
    expect(advice.valid).toBe(false);
    expect(advice.designId).toBeNull();
  });
});
