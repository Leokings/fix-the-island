import type { ConnectedContext, SaveData } from './world';
import { createRepairArtifact, normalizeAddress, normalizeNonce, REPAIR_SCENARIOS, siteContractAddress } from '../genlayer';
import type { Mode, RepairDraft, RecoveryTicket, SiteFixture } from '../genlayer';

export interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export interface SaveExpectation {readonly mode:Mode;readonly levelId:string;readonly context:ConnectedContext|null;readonly compatibleLevelIds?:readonly string[]}
const hash=(value:unknown):string=>{if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))throw new Error('Invalid saved hash.');return value;};
const text=(value:unknown):string=>{if(typeof value!=='string')throw new Error('Saved identifier must be text.');return value;};
function object(value:unknown,keys:readonly string[],optional:readonly string[]=[]):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw new Error('Malformed save record.');
  const record=value as Record<string,unknown>;
  if(keys.some((key)=>!Object.hasOwn(record,key))||Object.keys(record).some((key)=>!keys.includes(key)&&!optional.includes(key)))throw new Error('Unexpected or missing save field.');
  return record;
}
function rationale(value:unknown):string {
  if(typeof value!=='string')throw new Error('Saved rationale must be text.');
  const chars=Array.from(value);
  if(chars.length>800||new TextEncoder().encode(value).length>2048||chars.some((char)=>{const code=char.codePointAt(0)!;return code>=0xd800&&code<=0xdfff;}))throw new Error('Saved rationale is outside scalar/UTF-8 bounds.');
  return value;
}
export const parseDraftRationale=(value:unknown):string=>rationale(value);
function draft(value:unknown,fixture:SiteFixture):RepairDraft {
  const row=object(value,['siteId','artifact','rationale']);if(row.siteId!==fixture.id)throw new Error('Saved draft has a different site.');
  return Object.freeze({siteId:fixture.id,artifact:createRepairArtifact(row.artifact as Parameters<typeof createRepairArtifact>[0],fixture),rationale:rationale(row.rationale)});
}
export function parseRecoveryTicket(value:unknown,fixture:SiteFixture,context:ConnectedContext):RecoveryTicket {
  const row=object(value,['version','chainId','contractAddress','prepared','evmTxHash'],['txId']);
  if(row.version!==2||row.chainId!==context.chainId||normalizeAddress(text(row.contractAddress))!==siteContractAddress(context,fixture.id).toLowerCase())throw new Error('Saved ticket has a different contract/network.');
  const prepared=object(row.prepared,['siteId','artifact','rationale','caller','expeditionId','nonce','digest','fixtureVersion','technicalFlags','technicallyValid']);
  if(normalizeAddress(text(prepared.caller))!==context.caller.toLowerCase()||prepared.expeditionId!==context.expeditionId||prepared.fixtureVersion!==fixture.version||typeof prepared.technicallyValid!=='boolean')throw new Error('Saved ticket caller/run/version is mismatched.');
  const bindingDraft=draft({siteId:prepared.siteId,artifact:prepared.artifact,rationale:prepared.rationale},fixture);
  if(!prepared.technicalFlags||typeof prepared.technicalFlags!=='object'||Array.isArray(prepared.technicalFlags)||Object.values(prepared.technicalFlags).some((flag)=>typeof flag!=='boolean'))throw new Error('Invalid saved technical flags.');
  const ticket:RecoveryTicket={version:2,chainId:context.chainId,contractAddress:siteContractAddress(context,fixture.id),
    prepared:{...bindingDraft,caller:context.caller,expeditionId:context.expeditionId,nonce:normalizeNonce(text(prepared.nonce)),digest:hash(prepared.digest) as RecoveryTicket['prepared']['digest'],fixtureVersion:fixture.version,technicalFlags:Object.freeze({...prepared.technicalFlags as Record<string,boolean>}),technicallyValid:prepared.technicallyValid},
    evmTxHash:hash(row.evmTxHash) as RecoveryTicket['evmTxHash'],...(row.txId!==undefined?{txId:hash(row.txId) as NonNullable<RecoveryTicket['txId']>}:{})};
  // Structural/domain binding is not cryptographic or chain verification.
  // The saved job stays inactive until the adapter re-hashes and reads evidence.
  return Object.freeze(ticket);
}
export function parseSave(value:unknown,fixtures:readonly SiteFixture[]=REPAIR_SCENARIOS,expected?:SaveExpectation):SaveData {
  const root=object(value,['version','levelId','mode','position','sites']);
  if(root.version!==1||typeof root.levelId!=='string'||typeof root.mode!=='string'||!['practice','connected'].includes(root.mode)||expected&&(root.mode!==expected.mode||root.levelId!==expected.levelId&&!expected.compatibleLevelIds?.includes(root.levelId)))throw new Error('Save version/level/mode mismatch.');
  const position=object(root.position,['x','y','z']);if(Object.values(position).some((value)=>typeof value!=='number'||!Number.isFinite(value)))throw new Error('Invalid saved standing position.');
  if(!Array.isArray(root.sites)||root.sites.length!==fixtures.length||fixtures.length!==8)throw new Error('Save must contain exactly eight sites.');
  const seen=new Set<string>();
  const sites=root.sites.map((value)=>{
    const row=object(value,['id','discovered','draft','completedArtifact','ticket']);
    const fixture=fixtures.find((f)=>f.id===row.id);if(!fixture||seen.has(fixture.id)||typeof row.discovered!=='boolean')throw new Error('Unknown/duplicate site or invalid discovery flag.');seen.add(fixture.id);
    const savedDraft=row.draft===null?null:draft(row.draft,fixture);
    const completedArtifact=row.completedArtifact===null?null:createRepairArtifact(row.completedArtifact as Parameters<typeof createRepairArtifact>[0],fixture);
    let ticket:RecoveryTicket|null=null;
    if(row.ticket!==null) {
      if(root.mode!=='connected'||!expected?.context)throw new Error('Recovery ticket is outside a connected caller namespace.');
      ticket=parseRecoveryTicket(row.ticket,fixture,expected.context);
    }
    return Object.freeze({id:fixture.id,discovered:row.discovered,draft:savedDraft,completedArtifact,ticket});
  });
  return Object.freeze({version:1,levelId:root.levelId,mode:root.mode as Mode,position:Object.freeze({x:position.x as number,y:position.y as number,z:position.z as number}),sites:Object.freeze(sites)});
}
export function saveKey(mode:Mode,version:string,context:ConnectedContext|null=null):string {
  if(mode==='practice')return `fix-island:practice:${version}`;
  if(!context)throw new Error('Connected save needs its caller-bound context.');
  return `fix-island:connected:${context.chainId}:${context.contractAddress.toLowerCase()}:${context.caller.toLowerCase()}:${context.expeditionId}:${version}`;
}
export function loadSave(storage:StoragePort,key:string,expected?:SaveExpectation):SaveData|null {
  const raw=storage.getItem(key);if(!raw)return null;if(raw.length>180000)throw new Error('Save is over its bounded size.');
  return parseSave(JSON.parse(raw),REPAIR_SCENARIOS,expected);
}
export function storeSave(storage:StoragePort,key:string,data:SaveData):void {storage.setItem(key,JSON.stringify(data));}
export const previousPracticeKey=(key:string)=>`${key}:previous`;
export function loadPracticeSession(storage:StoragePort,key:string,choice:'new'|'resume'|'previous',expected:SaveExpectation):SaveData|null {
  if(expected.mode!=='practice'||!key.startsWith('fix-island:practice:'))throw new Error('New games are local practice sessions.');
  if(choice==='new') {
    const existing=storage.getItem(key);
    if(existing!==null)storage.setItem(previousPracticeKey(key),existing);
    storage.removeItem(key);
    return null;
  }
  return loadSave(storage,choice==='previous'?previousPracticeKey(key):key,expected);
}
