/** MOCK ONLY: isolated visual previews. Never import into live approval/save logic. */
import { COUNCIL_SCHEMA_VERSION, COUNCIL_CATALOG_VERSION, COUNCIL_SCENARIO_ID,
  DESIGN_CONSEQUENCES, NO_CONSEQUENCES, deriveCouncilPerspectives } from './types';
import type { CouncilResult, MockCouncilPresentation } from './types';

const base = {
  schemaVersion: COUNCIL_SCHEMA_VERSION, catalogVersion: COUNCIL_CATALOG_VERSION,
  siteId: 'village_pump', scenarioId: COUNCIL_SCENARIO_ID,
} as const;
const acceptable = {
  ...base, chosenDesignId: 'direct_pump', decision: 'approve', quality: 'acceptable',
  perspectives: deriveCouncilPerspectives('direct_pump', 'approve'), consequences: DESIGN_CONSEQUENCES.direct_pump,
} as const satisfies CouncilResult;
const good = {
  ...base, chosenDesignId: 'quiet_pump', decision: 'approve', quality: 'good',
  perspectives: deriveCouncilPerspectives('quiet_pump', 'approve'), consequences: DESIGN_CONSEQUENCES.quiet_pump,
} as const satisfies CouncilResult;
const excellent = {
  ...base, chosenDesignId: 'quiet_pump', decision: 'approve', quality: 'excellent',
  perspectives: deriveCouncilPerspectives('quiet_pump', 'approve'), consequences: DESIGN_CONSEQUENCES.quiet_pump,
} as const satisfies CouncilResult;
const revise = {
  ...base, chosenDesignId: 'rain_cistern', decision: 'revise', quality: null,
  perspectives: deriveCouncilPerspectives('rain_cistern', 'revise'), consequences: NO_CONSEQUENCES,
} as const satisfies CouncilResult;

const presentation = {
  schemaVersion: COUNCIL_SCHEMA_VERSION, source: 'mock', authority: 'display-only',
  siteId: 'village_pump', chosenDesignId: 'quiet_pump',
} as const;
const completed = (result: CouncilResult): MockCouncilPresentation => ({
  ...presentation, chosenDesignId: result.chosenDesignId, status: 'finalized', result,
  message: 'MOCK PREVIEW — simulated final result; no real progress is awarded.',
});
export const VILLAGE_PUMP_COUNCIL_MOCKS = {
  approveAcceptable: completed(acceptable),
  approveGood: completed(good),
  approveExcellent: completed(excellent),
  revise: completed(revise),
  timeout: { ...presentation, status: 'timed_out', result: null,
    recoveryAction: 'check_existing_transaction',
    message: 'MOCK PREVIEW — still no verified decision. Check the existing transaction; do not submit again.' },
  pending: { ...presentation, status: 'pending', result: null,
    message: 'MOCK PREVIEW — the council is deliberating; there is no decision yet.' },
  accepted: { ...presentation, status: 'accepted', result: null,
    message: 'MOCK PREVIEW — a provisional result exists, but finality is still pending.' },
  failed: { ...presentation, status: 'failed', reason: 'consensus_unresolved', result: null,
    message: 'MOCK PREVIEW — review processing failed. This is not a council rejection.' },
} as const satisfies Readonly<Record<string, MockCouncilPresentation>>;
