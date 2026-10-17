/** UI data contract only. No value in this module is authority to restore a site. */
export const COUNCIL_SCHEMA_VERSION = 'island-council-v2' as const;
export const COUNCIL_CATALOG_VERSION = 'village-pump-council-2' as const;
export const COUNCIL_SCENARIO_ID = 'water-shortage-nesting-season' as const;
export const COUNCIL_ROLES = ['fisher', 'farmer', 'engineer', 'elder'] as const;
export const VILLAGE_PUMP_DESIGN_IDS = ['direct_pump', 'quiet_pump', 'rain_cistern'] as const;
export type CouncilRole = typeof COUNCIL_ROLES[number];
export type VillagePumpDesignId = typeof VILLAGE_PUMP_DESIGN_IDS[number];
export type QualityBand = 'acceptable' | 'good' | 'excellent';
export type Stance = 'supports' | 'mixed' | 'concerned';
export type Level = 'worse' | 'same' | 'better' | 'much_better';
/** Validators agree on one suitability decision; all presentation fields are deterministic. */
export const COUNCIL_CONSENSUS_FIELDS = ['decision'] as const;
export interface Consequences {
  readonly water: Level;
  readonly habitat: Level;
  /** Better = less upkeep; worse = more upkeep. */
  readonly maintenance: Level;
}
export interface CouncilPerspective {
  readonly role: CouncilRole;
  readonly stance: Stance;
  readonly text: string;
}
export type CouncilPerspectives = readonly [
  CouncilPerspective & { readonly role: 'fisher' },
  CouncilPerspective & { readonly role: 'farmer' },
  CouncilPerspective & { readonly role: 'engineer' },
  CouncilPerspective & { readonly role: 'elder' },
];
interface CouncilResultBase {
  readonly schemaVersion: typeof COUNCIL_SCHEMA_VERSION;
  readonly catalogVersion: typeof COUNCIL_CATALOG_VERSION;
  readonly siteId: 'village_pump';
  readonly scenarioId: typeof COUNCIL_SCENARIO_ID;
  readonly chosenDesignId: VillagePumpDesignId;
  readonly perspectives: CouncilPerspectives;
}
export type CouncilResult = CouncilResultBase & (
  | { readonly decision: 'approve'; readonly quality: QualityBand; readonly consequences: Consequences }
  | { readonly decision: 'revise'; readonly quality: null;
      readonly consequences: { readonly water: 'same'; readonly habitat: 'same'; readonly maintenance: 'same' } }
);
/** Compact on-chain assessment. Fixed council dialogue/effects are projected by this versioned client schema. */
export type CouncilAssessment = Pick<CouncilResultBase, 'schemaVersion' | 'catalogVersion' | 'siteId' | 'scenarioId' | 'chosenDesignId'> &
  ({ readonly decision: 'approve'; readonly quality: 'good' } | { readonly decision: 'revise'; readonly quality: null });

/** Versioned game-balance table. Must match the future contract exactly. */
export const DESIGN_CONSEQUENCES: Readonly<Record<VillagePumpDesignId, Consequences>> = Object.freeze({
  direct_pump: Object.freeze({ water: 'much_better', habitat: 'worse', maintenance: 'worse' }),
  quiet_pump: Object.freeze({ water: 'better', habitat: 'better', maintenance: 'worse' }),
  rain_cistern: Object.freeze({ water: 'better', habitat: 'much_better', maintenance: 'better' }),
});
export const NO_CONSEQUENCES = Object.freeze({ water: 'same', habitat: 'same', maintenance: 'same' } as const);

const APPROVED_PERSPECTIVES: Readonly<Record<VillagePumpDesignId, Readonly<Record<CouncilRole, readonly [Stance, string]>>>> = Object.freeze({
  direct_pump: Object.freeze({
    fisher: ['concerned', 'This direct intake draws heavily on the creek.'] as const,
    farmer: ['supports', 'The village receives the full target supply.'] as const,
    engineer: ['mixed', 'Safe pressure works, but the relief path needs upkeep.'] as const,
    elder: ['mixed', 'Urgent water returns with a visible habitat trade-off.'] as const,
  }),
  quiet_pump: Object.freeze({
    fisher: ['supports', 'The housing reduces disturbance near the nesting area.'] as const,
    farmer: ['supports', 'The pump delivers the village target.'] as const,
    engineer: ['mixed', 'The housing reduces noise but needs regular service.'] as const,
    elder: ['supports', 'This balances reliable water with a quieter creek edge.'] as const,
  }),
  rain_cistern: Object.freeze({
    fisher: ['supports', 'Stored rain avoids drawing down the creek.'] as const,
    farmer: ['mixed', 'The target is met, with only a small storage reserve.'] as const,
    engineer: ['mixed', 'The filter and overflow need routine cleaning.'] as const,
    elder: ['supports', 'The cistern protects habitat while planning for limits.'] as const,
  }),
});
const REVISE_TEXT = 'The submitted plan needs revision before this repair can be accepted.';
export function deriveCouncilPerspectives(designId: VillagePumpDesignId, decision: 'approve' | 'revise'): CouncilPerspectives {
  return COUNCIL_ROLES.map((role) => {
    const [approvedStance, approvedText] = APPROVED_PERSPECTIVES[designId][role];
    return { role, stance: decision === 'approve' ? approvedStance : 'concerned',
      text: decision === 'approve' ? approvedText : REVISE_TEXT };
  }) as unknown as CouncilPerspectives;
}

interface CouncilPresentationBase {
  readonly schemaVersion: typeof COUNCIL_SCHEMA_VERSION;
  readonly source: 'mock' | 'genlayer';
  readonly authority: 'display-only';
  readonly siteId: 'village_pump';
  readonly chosenDesignId: VillagePumpDesignId;
  readonly message: string;
  readonly proof?: CouncilProof;
}
export interface CouncilProof {
  readonly chainId: 4221 | 61999;
  readonly contractAddress: `0x${string}`;
  readonly txId: `0x${string}`;
  readonly evmTxHash: `0x${string}`;
  readonly pumpContractAddress: `0x${string}`;
  readonly pumpDigest: `0x${string}`;
  readonly evidenceQuote?: string;
  readonly feedback: string;
}
export type CouncilPresentation = CouncilPresentationBase & (
  | { readonly status: 'pending' | 'accepted'; readonly result: null }
  | { readonly status: 'timed_out'; readonly result: null; readonly recoveryAction: 'check_existing_transaction' }
  | { readonly status: 'failed'; readonly result: null;
      readonly reason: 'execution_error' | 'consensus_unresolved' | 'canceled' }
  | { readonly status: 'finalized'; readonly result: CouncilResult }
);
export type MockCouncilPresentation = CouncilPresentation & { readonly source: 'mock' };

/** Shape validation ONLY, not validator consensus, signature/chain verification or a restoration grant. */
export function assertCouncilResult(input: unknown): asserts input is CouncilResult {
  const fail = (): never => { throw new Error('Invalid council result'); };
  const record = (value: unknown): Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail();
    return value as Record<string, unknown>;
  };
  const keys = (value: Record<string, unknown>, expected: readonly string[]) => {
    if (Object.keys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) fail();
  };
  const value = record(input);
  keys(value, ['schemaVersion','catalogVersion','siteId','scenarioId','chosenDesignId','decision','quality','perspectives','consequences']);
  if (value.schemaVersion !== COUNCIL_SCHEMA_VERSION || value.catalogVersion !== COUNCIL_CATALOG_VERSION ||
      value.siteId !== 'village_pump' || value.scenarioId !== COUNCIL_SCENARIO_ID ||
      !VILLAGE_PUMP_DESIGN_IDS.includes(value.chosenDesignId as VillagePumpDesignId)) fail();
  if (value.decision !== 'approve' && value.decision !== 'revise') fail();
  const decision = value.decision as 'approve' | 'revise';
  if (value.decision === 'revise' ? value.quality !== null :
      !['acceptable','good','excellent'].includes(value.quality as string)) fail();
  if (!Array.isArray(value.perspectives) || value.perspectives.length !== 4) return fail();
  value.perspectives.forEach((item: unknown, index: number) => {
    const perspective = record(item); keys(perspective, ['role','stance','text']);
    if (perspective.role !== COUNCIL_ROLES[index] ||
        !['supports','mixed','concerned'].includes(perspective.stance as string) ||
        typeof perspective.text !== 'string' || !perspective.text.trim() || perspective.text.length > 240) fail();
  });
  const expectedPerspectives = deriveCouncilPerspectives(value.chosenDesignId as VillagePumpDesignId, decision);
  if (JSON.stringify(value.perspectives) !== JSON.stringify(expectedPerspectives)) fail();
  const effects = record(value.consequences); keys(effects, ['water','habitat','maintenance']);
  const expected = value.decision === 'revise' ? NO_CONSEQUENCES : DESIGN_CONSEQUENCES[value.chosenDesignId as VillagePumpDesignId];
  for (const field of ['water','habitat','maintenance'] as const) if (effects[field] !== expected[field]) fail();
}

/** Expands a bounded contract assessment into fixed, non-authoritative UI data. */
export function materializeCouncilResult(input: unknown): CouncilResult {
  const fail = (): never => { throw new Error('Invalid council assessment'); };
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail();
  const value = input as Record<string, unknown>;
  const fields = ['schemaVersion','catalogVersion','siteId','scenarioId','chosenDesignId','decision','quality'];
  if (Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field)) ||
      value.schemaVersion !== COUNCIL_SCHEMA_VERSION || value.catalogVersion !== COUNCIL_CATALOG_VERSION ||
      value.siteId !== 'village_pump' || value.scenarioId !== COUNCIL_SCENARIO_ID ||
      !VILLAGE_PUMP_DESIGN_IDS.includes(value.chosenDesignId as VillagePumpDesignId)) return fail();
  const decision = value.decision;
  if ((decision === 'approve' && value.quality !== 'good') || (decision === 'revise' && value.quality !== null) ||
      (decision !== 'approve' && decision !== 'revise')) return fail();
  const chosenDesignId = value.chosenDesignId as VillagePumpDesignId;
  const result: CouncilResult = decision === 'approve'
    ? { schemaVersion: COUNCIL_SCHEMA_VERSION, catalogVersion: COUNCIL_CATALOG_VERSION, siteId: 'village_pump',
        scenarioId: COUNCIL_SCENARIO_ID, chosenDesignId, decision, quality: 'good',
        perspectives: deriveCouncilPerspectives(chosenDesignId, decision), consequences: DESIGN_CONSEQUENCES[chosenDesignId] }
    : { schemaVersion: COUNCIL_SCHEMA_VERSION, catalogVersion: COUNCIL_CATALOG_VERSION, siteId: 'village_pump',
        scenarioId: COUNCIL_SCENARIO_ID, chosenDesignId, decision, quality: null,
        perspectives: deriveCouncilPerspectives(chosenDesignId, decision), consequences: NO_CONSEQUENCES };
  assertCouncilResult(result);
  return Object.freeze(result);
}
