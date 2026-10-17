import {describe,expect,it} from 'vitest';
import {loadPracticeSession,parseDraftRationale,previousPracticeKey,saveKey,storeSave} from '../../src/domain/save';
import {World} from '../../src/domain/world';
import {SMOKE_LEVEL} from '../../src/content/smoke-level';
import {FIXTURE_VERSION,REPAIR_SCENARIOS} from '../../src/genlayer';

describe('practice new game and previous game',()=>{
  it('accepts an empty optional explanation while preserving the size bound',()=>{
    expect(parseDraftRationale('')).toBe('');
    expect(parseDraftRationale('a'.repeat(800))).toHaveLength(800);
    expect(()=>parseDraftRationale('a'.repeat(801))).toThrow();
  });
  it('keeps the previous expedition when starting a new one and can load it again',()=>{
    const rows=new Map<string,string>(),storage={getItem:(k:string)=>rows.get(k)??null,setItem:(k:string,v:string)=>{rows.set(k,v);},removeItem:(k:string)=>{rows.delete(k);}};
    const key=saveKey('practice',FIXTURE_VERSION),world=new World(SMOKE_LEVEL,REPAIR_SCENARIOS);
    world.tick(1/60,[{kind:'Move',right:1,up:0,brisk:false}]);
    const original=world.exportSave(),expected={mode:'practice' as const,levelId:SMOKE_LEVEL.id,context:null};
    storeSave(storage,key,original);
    expect(loadPracticeSession(storage,key,'new',expected)).toBeNull();
    expect(storage.getItem(key)).toBeNull();expect(storage.getItem(previousPracticeKey(key))).not.toBeNull();
    storeSave(storage,key,new World(SMOKE_LEVEL,REPAIR_SCENARIOS).exportSave());
    expect(loadPracticeSession(storage,key,'previous',expected)).toEqual(original);
    expect(()=>loadPracticeSession(storage,'fix-island:connected:61999','new',expected)).toThrow();
  });
});
