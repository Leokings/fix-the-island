import type { SiteFixture, SiteId } from '../genlayer';

// PLAN.md coordination facts only. Backend owns the immutable option/slot/
// port catalogs and validators; these records must not become another judge.
export interface PlannedSite {
  readonly id: SiteId;
  readonly title: string;
  readonly family: string;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly requires: readonly SiteId[];
  readonly budget: number;
  readonly constraintBrief: string;
  readonly consequence: string;
}

export const SITE_PLAN: readonly PlannedSite[] = Object.freeze([
  { id: 'pier_hoist', title: 'Landing Hoist', family: 'load-balance', position: { x: -38, y: 2, z: 40 }, requires: [], budget: 16,
    constraintBrief: 'Crank→pulley→boom, anchored rope and guard; load moment 6; balance within 0.25. Example: 3 units at 1m plus 2 at 1.5m. Avoid shoreline nests.',
    consequence: 'Level the gangway, lift bridge-brace stock, open the west workshop shortcut.' },
  { id: 'village_pump', title: 'Spring Pump', family: 'pressure-routing', position: { x: -18, y: 4, z: 22 }, requires: [], budget: 14,
    constraintBrief: 'Screen and relief in water path, no trunk bypass; inlet 4=12, bypass 1=2, outlet 3=6. Pressure 3–5 and trunk flow ≥6; example pressure 4.',
    consequence: 'Stop leaks, supply upland trunk, drain bridge approach.' },
  { id: 'tidal_sluice', title: 'Reedbed Sluice', family: 'ecological-flow', position: { x: 30, y: 2, z: 38 }, requires: [], budget: 14,
    constraintBrief: 'Source 8; nursery 2–3, creek ≥5, erodible bank 0. Example bank_shield/creek_open and nursery stop 3: 3/5/0. Nursery stays connected; debris goes in rack.',
    consequence: 'Divert backflow, refill reed pools, expose tidal boardwalk.' },
  { id: 'creek_bridge', title: 'Splitbank Bridge', family: 'structural-assembly', position: { x: 0, y: 6, z: -2 }, requires: ['pier_hoist', 'village_pump', 'tidal_sluice'], budget: 18,
    constraintBrief: 'Continuous deck/support graph, both bank shoes, bracing load path, capacity ≥8 fixed load units, rail clearance; opposing diagonals. No new riverbed supports.',
    consequence: 'Replace and brace the deck; enable the woodland crossing.' },
  { id: 'coast_windmill', title: 'Headland Windmill', family: 'mechanical-transmission', position: { x: 40, y: 9, z: -14 }, requires: ['creek_bridge'], budget: 16,
    constraintBrief: 'Fixed shaft 60rpm; 12/24/36-tooth choices; output 100–140rpm, complete guarded shaft path. Example 24:12 gives 120rpm; safe bluff mounting.',
    consequence: 'Restart guarded generation and power woodland distribution.' },
  { id: 'woodland_pathlight', title: 'Fern Path Light', family: 'protected-power', position: { x: 18, y: 12, z: -24 }, requires: ['coast_windmill'], budget: 12,
    constraintBrief: '12V source, 12V/6W lamp, 1A fuse; source→fuse→regulator→lamp→return with no shorts/bypass. Example path_edge/downshield/sleeved_route; protect nocturnal habitat.',
    consequence: 'Light the shaded path and release the maintenance gate latch.' },
  { id: 'upland_waterworks', title: 'Ridge Cistern', family: 'water-distribution', position: { x: -26, y: 17, z: -34 }, requires: ['creek_bridge', 'village_pump'], budget: 16,
    constraintBrief: 'Supply 6; village 4 plus habitat 2, no filter bypass; fixed capacities/elevation rules. Example filtered_split, village_4/habitat_2; filter maintenance access.',
    consequence: 'Restore filtered village/habitat flow, drain upper walkway and west return.' },
  { id: 'ridge_beacon', title: 'Lookout Beacon', family: 'signal-alignment', position: { x: 12, y: 22, z: -52 }, requires: ['woodland_pathlight', 'upland_waterworks'], budget: 14,
    constraintBrief: 'Protected power path plus mechanically seated lens/shield; coastal_sector detent excludes fixed inland/nesting sectors; safe plinth mount.',
    consequence: 'Restore the shielded coastal signal and enable the complete-island ending.' },
].map((site) => Object.freeze({ ...site, position: Object.freeze(site.position), requires: Object.freeze(site.requires) })));

export interface SiteCatalogConsumer {
  readonly plan: PlannedSite;
  readonly fixture: SiteFixture | null;
  readonly diagnostic: string | null;
}

export function consumeSiteCatalog(fixtures: readonly SiteFixture[]): readonly SiteCatalogConsumer[] {
  const known = new Set(SITE_PLAN.map((site) => site.id));
  const seen = new Set<string>();
  for (const fixture of fixtures) {
    if (!known.has(fixture.id) || seen.has(fixture.id)) throw new Error(`Unexpected/duplicate backend site: ${fixture.id}`);
    seen.add(fixture.id);
  }
  return Object.freeze(SITE_PLAN.map((plan) => {
    const fixture = fixtures.find((candidate) => candidate.id === plan.id) ?? null;
    const matches = fixture && JSON.stringify([...fixture.requires].sort()) === JSON.stringify([...plan.requires].sort());
    const diagnostic = !fixture ? 'Backend catalog pending' : !matches ? 'Backend dependency mismatch; submission disabled' : null;
    return Object.freeze({ plan, fixture: matches ? fixture : null, diagnostic });
  }));
}
