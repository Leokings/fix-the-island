import { describe, expect, it } from 'vitest';
import { World } from '../../src/domain/world';
import { ISLAND_LEVEL } from '../../src/content/island-level';
import { getRepairScenario, REPAIR_SCENARIOS, validateRepairLocally } from '../../src/genlayer';
import { nextObjective, objectiveWaitLabel, repairGuidance, REPAIR_OUTCOMES } from '../../src/ui/quest-guide';
import { STATUS_COPY } from '../../src/ui/player-copy';
import { restorationPresentation } from '../../src/render/restoration-feedback';

describe('landing guidance and presentation without approval shortcuts',()=>{
  const snapshot=()=>new World(ISLAND_LEVEL,REPAIR_SCENARIOS).snapshot();
  it('starts at the hoist and suggests another available repair while review continues',()=>{
    const initial=snapshot();expect(nextObjective(initial)?.id).toBe('pier_hoist');
    for(const phase of ['pending','restoring','restored']as const){
      const busy={...initial,sites:initial.sites.map(site=>site.id==='pier_hoist'?{...site,phase}:site)};
      expect(nextObjective(busy)?.id).toBe('village_pump');expect(busy.restoredSiteIds).toEqual([]);
    }
  });
  it('never treats a provisional phase as a completed dependency',()=>{
    const initial=snapshot(),busy={...initial,sites:initial.sites.map(site=>['pier_hoist','village_pump','tidal_sluice'].includes(site.id)?{...site,phase:'pending' as const}:site)};
    expect(nextObjective(busy)).toBeNull();expect(busy.restoredSiteIds).toEqual([]);expect(objectiveWaitLabel(busy)).toBe('Reviews pending — keep exploring');
  });
  it('reports real missing stock and advisory balance without choosing a winning setting',()=>{
    const fixture=getRepairScenario('pier_hoist'),initial=snapshot().sites[0]!.draft!,draft={...initial,artifact:{...initial.artifact,parts:initial.artifact.parts.filter(part=>part.slotId!=='rope')}};
    expect(repairGuidance(fixture,draft,null,'practice')).toContain('anchor rope is missing');
    const repairedStock={...draft,artifact:{...draft.artifact,parts:[...draft.artifact.parts,{id:'rope',slotId:'rope',optionId:'rope_standard',orientationQuarterTurns:0 as const,settingId:'fixed'}]}};
    const advice=validateRepairLocally(fixture.id,repairedStock.artifact);
    expect(repairGuidance(fixture,repairedStock,advice,'practice')).toContain('link is missing');
    const connected={...advice,flags:{...advice.flags,connections:true}};
    expect(repairGuidance(fixture,repairedStock,connected,'practice')).toContain('Cargo side too heavy');
    expect(repairGuidance(fixture,repairedStock,connected,'practice')).not.toContain('rail_1500');
  });
  it('distinguishes local success from independent connected review',()=>{
    const fixture=getRepairScenario('pier_hoist'),draft=snapshot().sites[0]!.draft!,advice={...validateRepairLocally(fixture.id,draft.artifact),valid:true};
    expect(repairGuidance(fixture,draft,advice,'practice')).toContain('local repair');
    expect(repairGuidance(fixture,draft,advice,'connected')).toContain('independent review');
    expect(STATUS_COPY.pending.detail).toContain('Explore freely');
    expect(STATUS_COPY.pending.detail).not.toContain('Routes');
    expect(REPAIR_OUTCOMES.creek_bridge).not.toContain('crossing');
  });
  it('keeps cargo down during pending/revision and lifts only on authoritative installation',()=>{
    for(const phase of ['damaged','pending','revision']as const){const view=restorationPresentation({phase,crew:phase==='revision'?'paused':'working',restorationSeconds:99});expect(view.lift).toBe(0);expect(view.spark).toBe(0);expect(view.working).toBe(false);}
    const half=restorationPresentation({phase:'restoring',crew:'finishing',restorationSeconds:1.5});expect(half.lift).toBe(.5);expect(half.spark).toBe(1);
    const done=restorationPresentation({phase:'restored',crew:'none',restorationSeconds:3});expect(done.lift).toBe(1);expect(done.spark).toBe(0);expect(done.working).toBe(true);
  });
});
