import {getRepairScenario,siteContractAddress,REPAIR_SCENARIOS} from '../genlayer';
import type {GenLayerAdapter,RecoveryTicket} from '../genlayer';
import {sameSession,type SubmissionSession} from './submit-repair';

type RecoveryPort=Pick<GenLayerAdapter,'getApprovalEvidence'|'getRecoveryTickets'|'reverifyApproval'|'resume'>;
export interface RecoveryWorld {
  readonly restored:()=>readonly string[];
  readonly savedTickets:()=>readonly RecoveryTicket[];
  readonly waitForRestored:(siteId:string,signal:AbortSignal)=>Promise<void>;
}
export function boundTickets(adapter:Pick<GenLayerAdapter,'getRecoveryTickets'>,session:SubmissionSession,saved:readonly RecoveryTicket[]):readonly RecoveryTicket[] {
  const unique=new Map<string,RecoveryTicket>();
  for(const ticket of [...adapter.getRecoveryTickets(session.context.caller),...saved]) {
    if(ticket.chainId===session.context.chainId&&ticket.prepared.caller.toLowerCase()===session.context.caller.toLowerCase()&&ticket.contractAddress.toLowerCase()===siteContractAddress(session.context,ticket.prepared.siteId).toLowerCase())unique.set(ticket.evmTxHash,ticket);
  }
  return [...unique.values()].slice(0,32);
}
/** Explicit read-only operation. One adapter owns one pollController, so never
 * parallelize these calls. Untrusted cache entries are not enqueued as states. */
export async function recoverRepairs(adapter:RecoveryPort,kind:'approvals'|'reviews'|'all',session:SubmissionSession,current:()=>SubmissionSession|null,world:RecoveryWorld,signal:AbortSignal):Promise<number> {
  const active=()=>!signal.aborted&&sameSession(session,current());
  let checked=0;
  if(kind==='all') {
    const candidates=new Map<string,ReturnType<RecoveryPort['getApprovalEvidence']>[number]|RecoveryTicket>();
    for(const ticket of boundTickets(adapter,session,world.savedTickets()))candidates.set(ticket.evmTxHash,ticket);
    for(const proof of adapter.getApprovalEvidence(session.context.caller))candidates.set(proof.evmTxHash,proof);
    // Catalog order ensures finalized parent repairs are installed before their
    // children. A failed independent site must not stop the other sites.
    for(const site of REPAIR_SCENARIOS) {
      for(const ticket of candidates.values()) {
        if(!active())return checked;
        if(ticket.prepared.siteId!==site.id||world.restored().includes(site.id))continue;
        const result='kind'in ticket?await adapter.reverifyApproval(ticket,signal,{once:true}):await adapter.resume(ticket,signal,{once:true});checked++;
        if(!active())return checked;
        if(result.status==='finalized-success') {
          // Domain validation still owns dependency authority.
          if(site.requires.every(id=>world.restored().includes(id))) {
            try{await world.waitForRestored(site.id,signal);}catch{if(!active())return checked;}
          }
        }
      }
    }
    return checked;
  }
  if(kind==='approvals') {
    for(const evidence of adapter.getApprovalEvidence(session.context.caller).slice(0,8)) {
      if(!active())break;
      const site=getRepairScenario(evidence.prepared.siteId);
      if(world.restored().includes(site.id))continue; // No repeated history pulse.
      if(!site.requires.every((parent)=>world.restored().includes(parent)))continue;
      const result=await adapter.reverifyApproval(evidence,signal);checked++;
      if(!active())break;
      if(result.status!=='finalized-success')continue;
      // Its verified grant still goes through the world's boundary. Wait for
      // the actual installation, not an invented approved-progress cache.
      await world.waitForRestored(site.id,signal);
    }
  } else {
    for(const ticket of boundTickets(adapter,session,world.savedTickets())) {
      if(!active())break;
      if(world.restored().includes(ticket.prepared.siteId))continue;
      const site=getRepairScenario(ticket.prepared.siteId);
      if(!site.requires.every((parent)=>world.restored().includes(parent)))continue;
      const result=await adapter.resume(ticket,signal);checked++;
      if(!active())break;
      if(result.status==='finalized-success')await world.waitForRestored(site.id,signal);
      if(['timed-out','network-error','recovery-needed'].includes(result.status))break;
    }
  }
  return checked;
}
