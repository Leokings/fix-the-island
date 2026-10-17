import type { SiteSnapshot, WorldSnapshot } from '../domain/world';
import type { IslandSiteFixture, LocalRepairAdvice, Mode, RepairDraft } from '../genlayer';
import { siteCopy } from './player-copy';
import { describeRepair } from './repair-learning';

/** Presentation only: completed prerequisites come from the domain, never a cached verdict. */
export function nextObjective(snapshot: WorldSnapshot): SiteSnapshot | null {
  const done = new Set(snapshot.restoredSiteIds);
  return snapshot.sites.find(site => site.catalogReady && ['damaged', 'revision'].includes(site.phase)
    && site.requires.every(id => done.has(id))) ?? null;
}
export function objectiveWaitLabel(snapshot:WorldSnapshot):string {
  return snapshot.sites.some(site=>site.phase==='restoring')?(snapshot.mode==='practice'?'Installing the local repair…':'Installing the approved repair…'):
    snapshot.sites.some(site=>site.phase==='pending')?'Reviews pending — keep exploring':
    snapshot.restoredSiteIds.length===snapshot.sites.length?'All repairs complete':'Earlier repairs need attention';
}

export const REPAIR_OUTCOMES: Readonly<Record<string, string>> = {
  pier_hoist: 'Cargo secured. The landing hoist is working.',
  village_pump: 'The pump supplies water with pressure relief.',
  tidal_sluice: 'Water is shared with the reedbed habitat.',
  creek_bridge: 'The bridge assembly is braced and its rail secured.',
  coast_windmill: 'The guarded windmill is generating power.',
  woodland_pathlight: 'The shielded lamp lights the path.',
  upland_waterworks: 'Filtered water is shared with the village and habitat.',
  ridge_beacon: 'The shielded beacon points toward the coast.',
};

/** Guidance reports the existing advisory, not another validator or a solved design. */
export function repairGuidance(fixture: IslandSiteFixture, draft: RepairDraft, advice: LocalRepairAdvice | null, mode: Mode): string {
  if (advice?.valid) return mode === 'practice'
    ? 'Test passed. Answer the council in one line, then finish this local repair.'
    : 'Local test passed. Answer the council in one line, then submit for independent review.';
  if (fixture.id === 'pier_hoist') {
    if (!draft.artifact.parts.some(part => part.slotId === 'rope'))
      return 'The anchor rope is missing. Choose its socket, pick a rope, then tap the socket or Place.';
    if (advice && !advice.flags.connections)
      return 'A link is missing. In Connect, follow the rope anchors and join the matching ends.';
    if (advice && !advice.flags.operation)
      return `${describeRepair(fixture,draft).summary}. Select a weight and use Adjust; farther out gives more pull.`;
    return 'Balance the cargo with the two weights, check the rope links, then Test. Make one change at a time.';
  }
  return advice && !advice.valid ? describeRepair(fixture,draft).issues[0]??'Check Details, adjust the construction and test again.'
    : siteCopy(fixture.id)?.instruction ?? 'Pick a socket, make one change, then test.';
}
