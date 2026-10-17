import type { CouncilRole, Level, QualityBand, Stance, VillagePumpDesignId } from '../../genlayer/council/types';

/** Player-facing words for the council scene. Visual copy only; no rules live here. */
export const ROLE_COPY: Record<CouncilRole, { name: string; cares: string }> = {
  fisher: { name: 'Fisher', cares: 'Creek life & nesting turtles' },
  farmer: { name: 'Farmer', cares: 'Water for homes & fields' },
  engineer: { name: 'Engineer', cares: 'Safe, working machinery' },
  elder: { name: 'Elder', cares: 'The island as a whole' },
};

export const STANCE_COPY: Record<Stance, string> = { supports: 'Supports', mixed: 'Mixed', concerned: 'Concerned' };

export const QUALITY_COPY: Record<QualityBand, { title: string; line: string }> = {
  acceptable: { title: 'Acceptable', line: 'It works, and the trade-off is out in the open.' },
  good: { title: 'Good', line: 'A sound plan with a real answer to its main drawback.' },
  excellent: { title: 'Excellent', line: 'A careful plan the island can run and maintain.' },
};

export const DESIGN_COPY: Record<VillagePumpDesignId, { name: string; pitch: string; icon: string }> = {
  direct_pump: { name: 'Direct pump', icon: '⚙', pitch: 'Draws straight from the creek. The most water, the fastest, but loud and close to the nests.' },
  quiet_pump: { name: 'Quiet screened pump', icon: '◎', pitch: 'A gentler intake behind a mesh screen, set away from the nests. The screen needs regular cleaning.' },
  rain_cistern: { name: 'Rain cistern', icon: '☂', pitch: 'Catches rain from a roof into a tank. Kind to wildlife and easy to keep, but it depends on the weather.' },
};

export const CONSEQUENCE_COPY = {
  water: { label: 'Water supply', icon: '💧' },
  habitat: { label: 'Habitat', icon: '🐢' },
  maintenance: { label: 'Upkeep', icon: '🔧' },
} as const;

/** Maintenance is "ease of upkeep": worse means more work for the village. */
export const LEVEL_COPY: Record<'water' | 'habitat' | 'maintenance', Record<Level, string>> = {
  water: { worse: 'Less water', same: 'No change', better: 'More water', much_better: 'Plenty of water' },
  habitat: { worse: 'Disturbed', same: 'No change', better: 'Recovering', much_better: 'Thriving' },
  maintenance: { worse: 'More upkeep', same: 'No change', better: 'Less upkeep', much_better: 'Very little upkeep' },
};
export const LEVEL_PIPS: Record<Level, number> = { worse: -1, same: 0, better: 1, much_better: 2 };

export const SCENARIO_COPY = {
  title: 'The village pump',
  brief: 'The storm cracked the pump and the village is short of water. It is also nesting season: turtles have laid eggs on the creek bank. Choose how to restore the supply.',
};

export const STATUS_COPY = {
  deliberating: { title: 'The council is weighing your plan', line: 'You can keep exploring. Nothing changes until a verified decision arrives.' },
  provisional: { title: 'A result is forming', line: 'The network has a provisional result but it is not final yet. The council waits for finality.' },
  timedOut: { title: 'Still no verified decision', line: 'This is not a rejection. Your plan is still in review; check on it again later.' },
  failed: { title: 'The review could not finish', line: 'Something went wrong while processing. This is not the council rejecting your plan.' },
  revise: { title: 'The council asks for a revision', line: 'Nothing on the island changes yet. Rework the plan with their concerns in mind.' },
};
