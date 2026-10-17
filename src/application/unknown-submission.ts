import {createRepairArtifact,FIXTURE_VERSION,getRepairScenario,normalizeAddress,normalizeNonce,normalizeRationale} from '../genlayer';
import type {PreparedRepair} from '../genlayer';
import type {ConnectedContext} from '../domain/world';
import type {StoragePort} from '../domain/save';
export const unknownSubmissionKey=(context:ConnectedContext)=>`fix-island:connected:${context.chainId}:${context.contractAddress.toLowerCase()}:${context.caller.toLowerCase()}:${context.expeditionId}:${FIXTURE_VERSION}:unknown-submission-v2`;
export interface UnknownSubmissions {readonly uncertain:boolean;readonly prepared:readonly PreparedRepair[]}
const hash=(value:unknown)=>{if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))throw new Error('Invalid uncertainty digest.');return value as PreparedRepair['digest'];};
/** A safety latch, never progress or approval evidence. Corruption remains
 * blocked until explicit wallet-activity acknowledgement, not reconnect. */
export class UnknownSubmissionStore {
  constructor(private readonly storage:Pick<StoragePort,'getItem'|'setItem'|'removeItem'>){}
  read(context:ConnectedContext):UnknownSubmissions {
    try {
      const raw=this.storage.getItem(unknownSubmissionKey(context));if(raw===null)return {uncertain:false,prepared:[]};
      if(raw.length>100000)throw new Error('Oversized uncertainty record.');
      const rows:unknown=JSON.parse(raw);if(!Array.isArray(rows)||rows.length<1||rows.length>8)throw new Error('Invalid uncertainty records.');
      const prepared=rows.map((row)=>{
        if(!row||Object.keys(row).sort().join(',')!=='chainId,contractAddress,expeditionId,fixtureVersion,prepared,version'||row.version!==2||row.chainId!==context.chainId||row.contractAddress!==context.contractAddress.toLowerCase()||row.expeditionId!==context.expeditionId||row.fixtureVersion!==FIXTURE_VERSION)throw new Error('Uncertainty binding mismatch.');
        const p=row.prepared;if(!p||Object.keys(p).sort().join(',')!=='artifact,caller,digest,expeditionId,fixtureVersion,nonce,rationale,siteId,technicalFlags,technicallyValid'||p.expeditionId!==context.expeditionId||p.fixtureVersion!==FIXTURE_VERSION||normalizeAddress(p.caller)!==context.caller.toLowerCase()||typeof p.technicallyValid!=='boolean'||!p.technicalFlags||typeof p.technicalFlags!=='object'||Array.isArray(p.technicalFlags)||Object.values(p.technicalFlags).some((flag)=>typeof flag!=='boolean'))throw new Error('Invalid uncertainty submission.');
        const site=getRepairScenario(p.siteId);
        return Object.freeze({siteId:site.id,artifact:createRepairArtifact(p.artifact,site),rationale:normalizeRationale(p.rationale),caller:normalizeAddress(p.caller),expeditionId:context.expeditionId,nonce:normalizeNonce(p.nonce),digest:hash(p.digest),fixtureVersion:FIXTURE_VERSION,technicalFlags:Object.freeze({...p.technicalFlags}),technicallyValid:p.technicallyValid}) as PreparedRepair;
      });return {uncertain:true,prepared:Object.freeze(prepared)};
    }catch{return {uncertain:true,prepared:[]};}
  }
  mark(context:ConnectedContext,prepared:PreparedRepair):void {
    const prior=this.read(context);
    if(prior.uncertain&&!prior.prepared.length)throw new Error('Uncertainty storage is unreadable. Check original wallet activity before retrying.');
    const entries=[...prior.prepared.filter((p)=>p.nonce!==prepared.nonce||p.digest!==prepared.digest),prepared];
    if(entries.length>8)throw new Error('Uncertainty archive is full. Resolve original wallet activity first.');
    this.write(context,entries);
    const read=this.read(context);if(!read.prepared.some((p)=>p.digest===prepared.digest&&p.nonce===prepared.nonce))throw new Error('Could not persist the pre-wallet safety marker. No wallet request made.');
  }
  resolveVerified(context:ConnectedContext,nonce:string,digest:string):void {
    const records=this.read(context);if(!records.prepared.length)return;
    this.write(context,records.prepared.filter((p)=>p.nonce!==nonce||p.digest.toLowerCase()!==digest.toLowerCase()));
  }
  acknowledgeNoBroadcast(context:ConnectedContext):void {this.storage.removeItem(unknownSubmissionKey(context));}
  private write(context:ConnectedContext,entries:readonly PreparedRepair[]):void {
    if(!entries.length){this.storage.removeItem(unknownSubmissionKey(context));return;}
    const value=JSON.stringify(entries.map((prepared)=>({version:2,chainId:context.chainId,contractAddress:context.contractAddress.toLowerCase(),expeditionId:context.expeditionId,fixtureVersion:FIXTURE_VERSION,prepared})));
    if(value.length>100000)throw new Error('Uncertainty archive exceeded its bound.');this.storage.setItem(unknownSubmissionKey(context),value);
  }
}
