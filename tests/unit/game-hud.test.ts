import { describe, expect, it } from 'vitest';
import { World } from '../../src/domain/world';
import { ISLAND_LEVEL } from '../../src/content/island-level';
import { REPAIR_SCENARIOS } from '../../src/genlayer';
import { completedExpeditionMessage } from '../../src/ui/game-hud';

describe('completed expedition HUD priority',()=>{
  const snapshot=()=>new World(ISLAND_LEVEL,REPAIR_SCENARIOS).snapshot();
  it('shows the all-eight message even when the saved notification is the landing introduction',()=>{
    const initial=snapshot(),restoredSiteIds=initial.sites.map(site=>site.id);
    const completed={...initial,restoredSiteIds,notification:'Inspect the storm damage. Three coastal jobs are open.'};
    expect(completedExpeditionMessage(completed)).toBe('All eight repairs complete. Explore freely or replay.');
    expect(initial.restoredSiteIds).toEqual([]);
  });
  it('does not announce completion for seven repairs or an unrelated eighth ID',()=>{
    const initial=snapshot(),seven=initial.sites.slice(0,7).map(site=>site.id);
    expect(completedExpeditionMessage({...initial,restoredSiteIds:seven})).toBeNull();
    expect(completedExpeditionMessage({...initial,restoredSiteIds:[...seven,'unrelated']})).toBeNull();
  });
  it('does not treat a pending final review or installation as completed',()=>{
    const initial=snapshot();
    for(const phase of ['pending','restoring'] as const){
      const sites=initial.sites.map((site,index)=>({...site,phase:index===7?phase:'restored' as const}));
      expect(completedExpeditionMessage({...initial,sites,restoredSiteIds:sites.slice(0,7).map(site=>site.id)})).toBeNull();
    }
  });
});
