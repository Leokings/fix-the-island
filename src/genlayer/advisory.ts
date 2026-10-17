import { getRepairScenario } from './catalog';
import { createRepairArtifact, validateRepairArtifact } from './schema';
import type { LocalRepairAdvice, RepairArtifact, RepairConnection, RepairPart, SiteFixture } from './types';

export function createInitialArtifact(siteId: string): RepairArtifact {
  return createRepairArtifact(getRepairScenario(siteId).initialArtifact);
}

/** Advisory technical feedback for connected drafting or explicitly labelled local practice. */
export function validateRepairLocally(siteId: string, input: unknown): LocalRepairAdvice {
  const site = getRepairScenario(siteId);
  const validation = validateRepairArtifact(input, site);
  const flags: Record<string, boolean> = { schema: validation.valid, inventory: false, budget: false, connections: false, operation: false };
  const metrics: Record<string, number> = {};
  if (!validation.valid) return Object.freeze({ mode: 'advisory', valid: false, flags: Object.freeze(flags), materialCost: 0, budget: site.budget, metrics: Object.freeze(metrics), feedback: Object.freeze(validation.issues.map((issue) => issue.message)) });
  const artifact = validation.artifact;
  const options = new Map(site.options.map((option) => [option.id, option]));
  const slots = new Map(artifact.parts.map((part) => [part.slotId, part]));
  const design = site.family === 'village_pump'
    ? site.technical.designs?.find((candidate) => candidate.slotIds.length === slots.size && candidate.slotIds.every((slot) => slots.has(slot)))
    : undefined;
  const byId = new Map(artifact.parts.map((part) => [part.id, part.slotId]));
  const number = (value: unknown): number => typeof value === 'number' ? value : 0;
  const fact = (slot: string, key: string): number => number(options.get(slots.get(slot)?.optionId ?? '')?.facts[key]);
  const setting = (slot: string): string => slots.get(slot)?.settingId ?? '';
  const rotation = (slot: string): number => slots.get(slot)?.orientationQuarterTurns ?? 0;
  const rules = design ?? site.technical;
  const values = (key: string): Readonly<Record<string, number>> => rules[key] as Readonly<Record<string, number>>;
  const n = (key: string): number => number((design as unknown as Record<string, unknown> | undefined)?.[key] ?? site.technical[key]);
  flags.inventory = design
    ? design.slotIds.every((slot) => slots.has(slot)) && artifact.parts.length === design.slotIds.length
    : site.family === 'village_pump' ? false : site.slotIds.every((slot) => slots.has(slot)) && artifact.parts.length === site.slotIds.length;
  const materialCost = artifact.parts.reduce((total, part) => total + number(options.get(part.optionId)?.facts.cost), 0);
  const budget = design?.budget ?? site.budget;
  flags.budget = materialCost <= budget;
  if (design) flags.operation = artifact.configuration.mountZoneId === design.mountZoneId && artifact.configuration.outputModeId === design.outputModeId && artifact.configuration.routeId === design.routeId;
  const required = new Set((design?.requiredEdges ?? site.technical.requiredEdges).map((edge) => edge.join(':')));
  const actual = new Set(artifact.connections.map((edge) => [byId.get(edge.from.partId), edge.from.portId, byId.get(edge.to.partId), edge.to.portId].join(':')));
  flags.connections = required.size === actual.size && [...required].every((edge) => actual.has(edge));
  if (flags.inventory) {
    switch (site.family) {
      case 'pier_hoist': {
        const moment = fact('weight_a', 'mass') * number(values('rails')[setting('weight_a')]) + fact('weight_b', 'mass') * number(values('rails')[setting('weight_b')]);
        metrics.counterweightMoment = moment;
        metrics.loadMoment = n('loadMoment');
        flags.operation = Math.abs(moment - n('loadMoment')) <= n('momentTolerance');
        break;
      }
      case 'village_pump': {
        if (!design) break;
        if (design.operation === 'pressure_flow' || design.operation === 'quiet_pressure_flow') {
          const inlet = number(values('settings')[setting('inlet')]);
          const bypass = number(values('settings')[setting('bypass')]);
          const trunk = number(values('settings')[setting('outlet')]);
          metrics.pressure = inlet - bypass - trunk;
          metrics.trunkFlow = trunk;
          flags.operation = (flags.operation ?? false) && metrics.pressure >= n('pressureMin') && metrics.pressure <= n('pressureMax') && trunk >= n('trunkMin');
          if (design.operation === 'quiet_pressure_flow') {
            metrics.disturbance = n('disturbanceBase') - fact('housing', 'attenuation');
            flags.operation = (flags.operation ?? false) && metrics.disturbance <= n('disturbanceMax') && setting('housing') === 'hatch_serviceable';
          }
        } else {
          const rainInput = fact('roof', 'yield');
          const firstFlush = fact('first_flush', 'discard');
          const stored = Math.min(fact('cistern', 'capacity'), rainInput - firstFlush);
          const villageFlow = fact('delivery_valve', 'capacity');
          const reserve = stored - villageFlow;
          Object.assign(metrics, { rainInput, firstFlush, stored, villageFlow, reserve });
          flags.operation = (flags.operation ?? false) && rainInput === n('rainInput') && firstFlush === n('firstFlushDiscard') && villageFlow >= n('minimumDelivery') && reserve >= n('minimumReserve');
        }
        break;
      }
      case 'tidal_sluice': {
        const nursery = number(values('settings')[setting('nursery_gate')]);
        const bank = setting('bank_baffle') === 'bank_shield' ? 0 : n('bankOpenFlow');
        const creek = setting('creek_baffle') === 'creek_open' ? n('sourceFlow') - nursery - bank : 0;
        Object.assign(metrics, { nurseryFlow: nursery, creekFlow: creek, bankFlow: bank });
        flags.operation = nursery >= n('nurseryMin') && nursery <= n('nurseryMax') && creek >= n('creekMin') && bank === 0 && setting('rack') === 'stored';
        break;
      }
      case 'creek_bridge': {
        const capacity = fact('brace_left', 'capacity') + fact('brace_right', 'capacity');
        metrics.capacity = capacity;
        flags.operation = (rotation('brace_left') + rotation('brace_right')) % 2 === 1 && capacity >= n('fixedLoad') && fact('rail', 'clearance') >= n('minRailClearance') && setting('rail') === 'tensioned';
        break;
      }
      case 'coast_windmill': {
        const numerator = n('shaftRpm') * fact('driver', 'teeth');
        const denominator = fact('driven', 'teeth');
        Object.assign(metrics, { rpmNumerator: numerator, rpmDenominator: denominator });
        flags.operation = denominator > 0 && numerator >= n('rpmMin') * denominator && numerator <= n('rpmMax') * denominator;
        break;
      }
      case 'woodland_pathlight':
        metrics.lampWatts = fact('lamp', 'watts');
        flags.operation = fact('source', 'voltage') === fact('lamp', 'voltage') && fact('regulator', 'voltage') === fact('lamp', 'voltage') && fact('lamp', 'watts') <= fact('source', 'voltage') * fact('fuse', 'amps') && rotation('shield') === 0 && artifact.configuration.routeId === 'sleeved_route';
        break;
      case 'upland_waterworks': {
        const village = number(values('settings')[setting('village_valve')]);
        const habitat = number(values('settings')[setting('habitat_valve')]);
        Object.assign(metrics, { villageFlow: village, habitatFlow: habitat, supply: fact('cistern', 'supply') });
        const gravity = artifact.connections.every((edge) => fact(byId.get(edge.from.partId)!, 'elevation') >= fact(byId.get(edge.to.partId)!, 'elevation'));
        flags.operation = village >= n('villageMin') && habitat >= n('habitatMin') && village + habitat <= fact('cistern', 'supply') && village + habitat <= fact('filter', 'capacity') && village <= fact('village_valve', 'capacity') && habitat <= fact('habitat_valve', 'capacity') && gravity;
        break;
      }
      case 'ridge_beacon': {
        const sector = (number(values('sectors')[setting('reflector')]) + rotation('reflector') + rotation('lens')) % 4;
        metrics.beamSector = sector;
        flags.operation = sector === n('requiredSector') && setting('lens') === 'clear' && rotation('shield') === 0 && artifact.configuration.mountZoneId === 'safe_plinth' && fact('source', 'voltage') === fact('lens', 'voltage') && fact('regulator', 'voltage') === fact('lens', 'voltage') && fact('lens', 'watts') <= fact('source', 'voltage') * fact('fuse', 'amps');
        break;
      }
    }
  }
  const descriptions: Record<string, string> = { inventory: 'Fill every required socket with its supported catalog part.', budget: 'Reduce the selected material cost to the site budget.', connections: 'Complete the protected routes; remove missing, bypassed or extra connections.', operation: site.requirements.find((rule) => rule.id === 'operation')?.description ?? 'Revise the operating settings.' };
  return Object.freeze({ mode: 'advisory', valid: Object.values(flags).every(Boolean), flags: Object.freeze(flags), materialCost, budget, ...(site.family === 'village_pump' ? { designId: design?.id ?? null } : {}), metrics: Object.freeze(metrics), feedback: Object.freeze(Object.entries(flags).filter(([, valid]) => !valid).map(([key]) => descriptions[key] ?? 'Revise the construction.')) });
}

export function getSlotOptions(siteId: string, slotId: string): SiteFixture['options'] {
  return Object.freeze(getRepairScenario(siteId).options.filter((option) => option.allowedSlots?.includes(slotId)));
}

/** An edit helper preserves the immutable snapshot and validates catalog membership, not approval. */
export function updateRepairPart(siteId: string, artifact: RepairArtifact, slotId: string, change: Partial<Pick<RepairPart, 'optionId' | 'orientationQuarterTurns' | 'settingId'>>): RepairArtifact {
  const site = getRepairScenario(siteId);
  if (!artifact.parts.some((part) => part.slotId === slotId)) throw new Error('Unknown occupied repair slot.');
  return createRepairArtifact({ ...artifact, parts: artifact.parts.map((part) => part.slotId === slotId ? { ...part, ...change } : part) }, site);
}

export function placeRepairPart(siteId: string, artifact: RepairArtifact, part: RepairPart): RepairArtifact {
  const previous = artifact.parts.find((item) => item.slotId === part.slotId);
  return createRepairArtifact({ ...artifact, parts: [...artifact.parts.filter((item) => item.slotId !== part.slotId), part],
    connections: previous && previous.id !== part.id ? artifact.connections.filter((edge) => edge.from.partId !== previous.id && edge.to.partId !== previous.id) : artifact.connections,
  }, getRepairScenario(siteId));
}

export function removeRepairPart(siteId: string, artifact: RepairArtifact, slotId: string): RepairArtifact {
  const part = artifact.parts.find((item) => item.slotId === slotId);
  if (!part) throw new Error('Unknown occupied repair slot.');
  return createRepairArtifact({ ...artifact, parts: artifact.parts.filter((item) => item.id !== part.id),
    connections: artifact.connections.filter((edge) => edge.from.partId !== part.id && edge.to.partId !== part.id),
  }, getRepairScenario(siteId));
}

export function updateRepairConfiguration(siteId: string, artifact: RepairArtifact, change: Partial<RepairArtifact['configuration']>): RepairArtifact {
  return createRepairArtifact({ ...artifact, configuration: { ...artifact.configuration, ...change } }, getRepairScenario(siteId));
}

export function connectRepairPorts(siteId: string, artifact: RepairArtifact, connection: RepairConnection): RepairArtifact {
  return createRepairArtifact({ ...artifact, connections: [...artifact.connections, connection] }, getRepairScenario(siteId));
}

export function disconnectRepairPorts(siteId: string, artifact: RepairArtifact, connection: RepairConnection): RepairArtifact {
  const matches = (edge: RepairConnection) => edge.channel === connection.channel && edge.from.partId === connection.from.partId && edge.from.portId === connection.from.portId && edge.to.partId === connection.to.partId && edge.to.portId === connection.to.portId;
  if (!artifact.connections.some(matches)) throw new Error('Unknown repair connection.');
  return createRepairArtifact({ ...artifact, connections: artifact.connections.filter((edge) => !matches(edge)) }, getRepairScenario(siteId));
}
