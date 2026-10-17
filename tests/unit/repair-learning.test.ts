import { describe,expect,it } from 'vitest';
import { describeRepair } from '../../src/ui/repair-learning';
import { createRepairExampleDraft,getRepairScenario,REPAIR_SCENARIOS } from '../../src/genlayer';
import { World } from '../../src/domain/world';
import { ISLAND_LEVEL } from '../../src/content/island-level';
import type { RepairDraft } from '../../src/genlayer';
const view=(draft:RepairDraft)=>describeRepair(getRepairScenario(draft.siteId),draft);
const change=(draft:RepairDraft,slot:string,patch:object):RepairDraft=>({...draft,artifact:{...draft.artifact,parts:draft.artifact.parts.map(part=>part.slotId===slot?{...part,...patch}:part)}});
describe('all-eight plain-language construction previews',()=>{
  for(const fixture of REPAIR_SCENARIOS)it(`${fixture.id}: actual valid examples complete steps without granting anything`,()=>{
    const draft=createRepairExampleDraft(fixture.id,'valid'),before=JSON.stringify(draft),preview=view(draft);
    expect(preview.steps).toHaveLength(3);expect(preview.steps.every(step=>step.done)).toBe(true);expect(preview.issues).toEqual([]);expect(Number.isFinite(preview.ratio)).toBe(true);expect(JSON.stringify(draft)).toBe(before);
  });
  it('previews authentic balanced weight contributions even with the rope missing',()=>{
    const valid=createRepairExampleDraft('pier_hoist','valid'),draft={...valid,artifact:{...valid.artifact,parts:valid.artifact.parts.filter(part=>part.slotId!=='rope'),connections:valid.artifact.connections.filter(edge=>edge.from.partId!=='rope'&&edge.to.partId!=='rope')}};
    const preview=view(draft);expect(preview.ratio).toBe(1);expect(preview.summary).toBe('Cargo balanced');expect(preview.issues.some(issue=>issue.includes('Anchor rope'))).toBe(true);expect(preview.issues.join(' ')).not.toContain('pull too hard');expect(preview.steps.every(step=>step.done)).toBe(false);
  });
  it('maps every sluice step to its actual setting control',()=>{expect(view(createRepairExampleDraft('tidal_sluice','valid')).steps.map(step=>step.tab)).toEqual(['configure','configure','configure']);});
  it('evaluates brace parity, not setting labels',()=>{const valid=createRepairExampleDraft('creek_bridge','valid');expect(view(valid).steps[1]!.done).toBe(true);expect(view(change(valid,'brace_right',{orientationQuarterTurns:valid.artifact.parts.find(p=>p.slotId==='brace_left')!.orientationQuarterTurns})).steps[1]!.done).toBe(false);});
  it('recognizes a rotated shield and combined reflector/lens beam direction',()=>{
    const light=createRepairExampleDraft('woodland_pathlight','valid');expect(view(change(light,'shield',{orientationQuarterTurns:1})).summary).toContain('Shade points away');
    const beacon=createRepairExampleDraft('ridge_beacon','valid');expect(view(change(beacon,'lens',{orientationQuarterTurns:1})).summary).toContain('away from the coast');
    const compensated=change(change(beacon,'reflector',{orientationQuarterTurns:3}),'lens',{orientationQuarterTurns:1});expect(view(compensated).steps[1]!.done).toBe(true);
  });
  it('invalidates the actual tested result after editing while keeping an honest new preview',()=>{
    const world=new World(ISLAND_LEVEL,REPAIR_SCENARIOS),dt=1/60;
    for(let i=0;i<25;i++)world.tick(dt,[{kind:'Move',right:1,up:1,brisk:true}]);
    world.tick(dt,[{kind:'Inspect'},{kind:'SetSetting',partId:'weight_b',settingId:'rail_1500'},{kind:'FocusPort',role:'source',endpoint:{partId:'rope',portId:'anchor'}},{kind:'FocusPort',role:'target',endpoint:{partId:'boom',portId:'anchor'}},{kind:'JoinPorts'},{kind:'TestDraft'}]);
    expect(world.snapshot().sites[0]!.advice?.valid).toBe(true);for(let i=0;i<151;i++)world.tick(dt,[]);
    world.tick(dt,[{kind:'SetSetting',partId:'weight_b',settingId:'rail_1000'}]);const site=world.snapshot().sites[0]!;
    expect(site.advice).toBeNull();expect(view(site.draft!).summary).toBe('Cargo side too heavy');expect(world.snapshot().restoredSiteIds).toEqual([]);
  });
});
