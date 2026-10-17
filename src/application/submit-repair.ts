import type {Address,GenLayerAdapter,PreparedRepair,RepairDraft,RepairState} from '../genlayer';
import type {ConnectedContext} from '../domain/world';
export interface SubmissionSession {readonly owner:object;readonly context:ConnectedContext;readonly epoch:number}
export const sameContext=(a:ConnectedContext,b:ConnectedContext)=>a.chainId===b.chainId&&a.contractAddress.toLowerCase()===b.contractAddress.toLowerCase()&&a.caller.toLowerCase()===b.caller.toLowerCase()&&JSON.stringify(a.siteAddresses??null)===JSON.stringify(b.siteAddresses??null);
export const sameSession=(a:SubmissionSession,b:SubmissionSession|null):boolean=>!!b&&a.owner===b.owner&&a.epoch===b.epoch&&sameContext(a.context,b.context);
export function submissionAvailable(state:RepairState,context:ConnectedContext|null,wallet:Address|null,busy:boolean,unresolved:boolean,unknownBroadcast:boolean,siteId?:string):boolean {
  if(!context||!wallet||wallet.toLowerCase()!==context.caller.toLowerCase()||busy||unresolved||unknownBroadcast)return false;
  if(siteId&&'ticket'in state&&state.ticket&&state.ticket.prepared.siteId!==siteId)return true;
  // A chain-finalized no-majority result is terminal and has no contract
  // receipt to recover; allow a fresh nonce-bound submission. Non-final
  // consensus timeouts and unknown broadcasts remain recovery-only.
  return state.status==='ready'||state.status==='queued'||state.status==='rejected'||state.status==='wallet-rejected'||state.status==='finalized-success'||state.status==='failed'&&(state.reason==='execution'||state.reason==='no-majority');
}
/** Called only after explicit Submit in ready state. queued is the expected
 * preparation result, not a reason to silently discard a registered design. */
export async function submitRepair(adapter:Pick<GenLayerAdapter,'prepare'|'submit'>,draft:RepairDraft,session:SubmissionSession,current:()=>SubmissionSession|null,beforeSubmit:(prepared:PreparedRepair)=>void=()=>{}):Promise<RepairState|null> {
  const owning={...session,context:Object.freeze({...session.context})};
  const prepared=await adapter.prepare(Object.freeze({...draft}));
  if(!sameSession(owning,current())||prepared.caller.toLowerCase()!==owning.context.caller.toLowerCase())return null;
  if(!prepared.technicallyValid)throw new Error('Prepared design failed its technical checks. Nothing was submitted.');
  beforeSubmit(prepared); // Durable uncertainty marker must succeed before a wallet request.
  return adapter.submit(prepared);
}
