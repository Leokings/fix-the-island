import { validateRepairLocally } from '../genlayer';
import type { IslandSiteFixture, RepairArtifact, RepairDraft } from '../genlayer';
import { siteCopy, slotLabel } from './player-copy';

export interface RepairLearning {
  readonly summary:string;readonly ratio:number;readonly balanced:boolean;
  readonly steps:readonly {label:string;done:boolean;slot:string;tab:'parts'|'configure'|'connect'}[];
  readonly issues:readonly string[];readonly detail:string;
}
const cache=new WeakMap<RepairArtifact,{siteId:string;value:RepairLearning}>();

/** Explanatory draft preview only. It never tests, submits, installs or grants progress. */
export function describeRepair(fixture:IslandSiteFixture,draft:RepairDraft):RepairLearning {
  const cached=cache.get(draft.artifact);if(cached?.siteId===fixture.id)return cached.value;
  const artifact=draft.artifact,live=validateRepairLocally(fixture.id,artifact);
  const flags={inventory:!!live.flags.inventory,connections:!!live.flags.connections,operation:!!live.flags.operation};
  const part=(slot:string)=>artifact.parts.find(p=>p.slotId===slot);
  const setting=(slot:string)=>part(slot)?.settingId??'';
  const rotation=(slot:string)=>part(slot)?.orientationQuarterTurns??0;
  const fact=(slot:string,name:string)=>Number(fixture.options.find(o=>o.id===part(slot)?.optionId)?.facts[name]??0);
  const n=(key:string)=>Number(fixture.technical[key]??0);
  const lookup=(key:string,value:string)=>Number((fixture.technical[key]as Record<string,number>|undefined)?.[value]??0);
  let summary='Check the construction',ratio=0,balanced=false,detail=siteCopy(fixture.id)?.hint??'';
  let operatingReason='Check the selected settings and orientations.';
  let labels:readonly [string,string,string]=['Fit the parts','Connect the path','Tune and test'];
  let slots:readonly [string,string,string]=[fixture.slotIds[0]!,fixture.slotIds[0]!,fixture.slotIds[0]!];
  let checks:readonly boolean[]=[flags.inventory,flags.connections,flags.operation];
  let tabs:readonly ('parts'|'configure'|'connect')[]=['parts','connect','configure'];
  switch(fixture.id){
    case 'pier_hoist': {
      const a=fact('weight_a','mass')*lookup('rails',setting('weight_a')),b=fact('weight_b','mass')*lookup('rails',setting('weight_b')),target=n('loadMoment');
      ratio=target?(a+b)/target:0;balanced=Math.abs(a+b-target)<=n('momentTolerance');
      summary=balanced?'Cargo balanced':ratio<1?'Cargo side too heavy':'Counterweight side too heavy';
      detail=`Weight A supplies ${Math.round(target?a/target*100:0)}% and B ${Math.round(target?b/target*100:0)}% of the cargo’s pull. Aim for the centre mark. Moving a weight farther out increases its pull.`;
      operatingReason=ratio<1?'The cargo pulls harder. Move a weight farther from the pivot or choose a heavier weight.':'The weights pull too hard. Bring a weight nearer the pivot or choose a lighter weight.';
      labels=['Fit rope and guard','Join the rope anchors','Balance the cargo'];slots=['rope','rope','weight_b'];break;
    }
    case 'village_pump': {
      const pressure=lookup('settings',setting('inlet'))-lookup('settings',setting('bypass'))-lookup('settings',setting('outlet')),flow=lookup('settings',setting('outlet'));
      balanced=pressure>=n('pressureMin')&&pressure<=n('pressureMax')&&flow>=n('trunkMin');ratio=flow/n('trunkMin');
      summary=pressure>n('pressureMax')?'Pressure too high':pressure<n('pressureMin')?'Pressure too low':flow<n('trunkMin')?'Village supply too weak':'Safe pressure · village supplied';
      detail='The inlet brings water in. The village outlet uses it; the relief drain releases excess pressure.';operatingReason=summary+'. Adjust the outlet and relief drain, then test.';
      labels=['Fit screen and relief','Connect the water path','Supply water safely'];slots=['screen','pump','outlet'];break;
    }
    case 'tidal_sluice': {
      const nursery=lookup('settings',setting('nursery_gate')),bank=setting('bank_baffle')==='bank_shield'?0:n('bankOpenFlow'),creek=setting('creek_baffle')==='creek_open'?n('sourceFlow')-nursery-bank:0;
      balanced=nursery>=n('nurseryMin')&&nursery<=n('nurseryMax')&&creek>=n('creekMin')&&bank===0;ratio=creek/n('creekMin');
      summary=bank?'Water erodes the bank':creek<n('creekMin')?'Creek flow too weak':nursery<n('nurseryMin')?'Nursery needs water':nursery>n('nurseryMax')?'Nursery takes too much':'Creek and nursery share the flow';
      detail='Shield the bank, share water between the creek and nursery, and store debris in its rack.';operatingReason=setting('rack')!=='stored'?'Debris still obstructs the flow. Move it into the rack.':summary+'. Adjust the baffles and nursery gate.';
      labels=['Shield the bank','Share the water','Store debris'];slots=['bank_baffle','nursery_gate','rack'];tabs=['configure','configure','configure'];checks=[bank===0,balanced,setting('rack')==='stored'&&flags.connections&&flags.inventory];break;
    }
    case 'creek_bridge': {
      const opposed=!!part('brace_left')&&!!part('brace_right')&&(rotation('brace_left')+rotation('brace_right'))%2===1,capacity=fact('brace_left','capacity')+fact('brace_right','capacity'),rail=setting('rail')==='tensioned'&&fact('rail','clearance')>=n('minRailClearance');
      ratio=capacity/n('fixedLoad');balanced=opposed&&rail&&capacity>=n('fixedLoad');summary=!opposed?'Braces lean the same way':!rail?'Handrail is loose':capacity<n('fixedLoad')?'Supports too weak':'Braced and secured';
      detail='The two diagonal braces must oppose one another. The joined deck transfers load to both bank shoes.';operatingReason=summary+'. Select the highlighted brace or rail and use Adjust.';
      labels=['Join both deck halves','Oppose the braces','Secure the handrail'];slots=['deck_left','brace_right','rail'];tabs=['connect','configure','configure'];checks=[flags.connections,opposed,rail&&capacity>=n('fixedLoad')&&flags.inventory];break;
    }
    case 'coast_windmill': {
      const driver=fact('driver','teeth'),driven=fact('driven','teeth'),speed=driven?n('shaftRpm')*driver/driven:0;
      ratio=speed/((n('rpmMin')+n('rpmMax'))/2);balanced=speed>=n('rpmMin')&&speed<=n('rpmMax');summary=!driven?'Fit an output gear':balanced?'Output speed in the working band':speed<n('rpmMin')?'Output turns too slowly':'Output turns too fast';
      detail=`Preview: ${Math.round(speed)} turns per minute. A larger input gear driving a smaller output gear speeds up the output.`;operatingReason=summary+'. Change the gear pair, not just its orientation.';
      labels=['Fit the gear pair','Link shaft and guard','Reach working speed'];slots=['driver','coupling','driven'];break;
    }
    case 'woodland_pathlight': {
      const down=!!part('shield')&&rotation('shield')===0,sleeved=artifact.configuration.routeId==='sleeved_route';balanced=down&&sleeved&&flags.operation;ratio=balanced?1:.25;
      summary=!down?'Shade points away from the path':!sleeved?'Cable is exposed':live.flags.connections?'Path light is protected':'Power path has a break';
      detail='Follow power through the fuse and regulator to the lamp, then back to the source. Turn the shade downward.';operatingReason=summary+'. Check the shield’s actual rotation and the protected cable route.';
      labels=['Connect protected power','Turn shade downward','Sleeve the cable'];slots=['fuse','shield','lamp'];tabs=['connect','configure','configure'];checks=[flags.connections,down,flags.inventory&&sleeved&&flags.operation];break;
    }
    case 'upland_waterworks': {
      const village=lookup('settings',setting('village_valve')),habitat=lookup('settings',setting('habitat_valve'));
      ratio=(village+habitat)/Math.max(1,fact('cistern','supply'));balanced=flags.operation;
      summary=village<n('villageMin')?'Village delivery too weak':habitat<n('habitatMin')?'Habitat delivery too weak':village+habitat>fact('cistern','supply')?'Not enough supply for both':'Village and habitat supplied';
      detail='Filter the supply before it divides. Give both destinations water and keep the overflow connected.';operatingReason=summary+'. Adjust each delivery valve without bypassing the filter.';
      labels=['Connect the filter path','Supply the village','Supply the habitat'];slots=['filter','village_valve','habitat_valve'];tabs=['connect','configure','configure'];checks=[flags.connections,village>=n('villageMin'),habitat>=n('habitatMin')&&flags.operation&&flags.inventory];break;
    }
    case 'ridge_beacon': {
      const sector=(lookup('sectors',setting('reflector'))+rotation('reflector')+rotation('lens'))%4,coastal=!!part('reflector')&&!!part('lens')&&sector===n('requiredSector'),shielded=!!part('shield')&&rotation('shield')===0,seated=setting('lens')==='clear';
      ratio=coastal?1:.25;balanced=coastal&&shielded&&seated&&flags.operation;
      summary=!coastal?'Effective beam points away from the coast':!shielded?'Shield turned away':!seated?'Lens is not clear and seated':'Coastal beam shielded';
      detail='Reflector setting AND reflector/lens rotations determine the beam. Keep it coastal, with the shield in its working orientation.';operatingReason=summary+'. Check the actual reflector, lens and shield orientations.';
      labels=['Connect protected power','Aim the coastal beam','Seat and shield the lens'];slots=['fuse','reflector','shield'];tabs=['connect','configure','configure'];checks=[flags.connections,coastal,shielded&&seated&&flags.operation&&flags.inventory];break;
    }
  }
  const issues:string[]=[];
  if(!live.flags.schema)issues.push('This construction contains an unsupported part or setting. Check the fitted stock.');
  if(!live.flags.inventory){const missing=fixture.slotIds.filter(slot=>!part(slot));issues.push(missing.length?`Empty sockets: ${missing.map(slot=>slotLabel(fixture.id,slot)).join(', ')}.`:'Some required parts are duplicated or misplaced.');}
  if(!live.flags.budget)issues.push('Too many materials are used. Choose a less costly part.');
  if(!live.flags.connections){const byId=new Map(artifact.parts.map(p=>[p.id,p.slotId]));const links=new Set(artifact.connections.map(e=>[byId.get(e.from.partId),e.from.portId,byId.get(e.to.partId),e.to.portId].join(':'))),missing=fixture.technical.requiredEdges.filter(e=>!links.has(e.join(':')));
    issues.push(missing.length?`Missing link: ${slotLabel(fixture.id,missing[0]![0]!)} → ${slotLabel(fixture.id,missing[0]![2]!)}. Choose those ports in Connect.`:'Remove the extra or bypass link; keep the protected path.');}
  if(flags.inventory&&!flags.operation)issues.push(operatingReason);
  const value:RepairLearning={summary,ratio:Number.isFinite(ratio)?ratio:0,balanced,detail,steps:labels.map((label,i)=>({label,done:!!checks[i],slot:slots[i]!,tab:tabs[i]!})),issues};
  cache.set(artifact,{siteId:fixture.id,value});return value;
}
