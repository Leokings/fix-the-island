import {abi} from 'genlayer-js';
import {calldataAddress,invalid,object,preparedEvidence,submissionArgs} from './evidence';
import {GenLayerClientError} from './config';
import type {Address,GenLayerChainId,PreparedRepair} from './types';

export interface DependencyRuntimeRequest {
  readonly method:'gen_call';
  readonly params:[{readonly type:'read';readonly to:Address;readonly from:Address;
    readonly data:`0x${string}`;readonly transaction_hash_variant:'latest-final'}];
}

/** Only prepare_repair: no AI, write, signing or progress grant. Raw calldata
 * avoids Studio's incorrect multi-byte outer-RLP prefix parser. */
export function dependencyRuntimeRequest(prepared:PreparedRepair,address:Address):DependencyRuntimeRequest {
  const encoded=abi.calldata.encode(abi.calldata.makeCalldataObject('prepare_repair',
    [calldataAddress(prepared.caller),...submissionArgs(prepared)],undefined));
  // The raw parser treats a terminal zero as an RLP envelope. Sorted calldata
  // ends in the method name; fail closed if the encoder ever changes this.
  if(encoded.at(-1)===0)invalid();
  return {method:'gen_call',params:[{type:'read',to:address,from:prepared.caller,
    data:abi.transactions.serializeOne(encoded),transaction_hash_variant:'latest-final'}]};
}

function jsonValue(value:unknown,depth=0):unknown {
  if(depth>16)invalid();
  if(value instanceof Map)return Object.fromEntries([...value].map(([key,item])=>{
    if(typeof key!=='string'||key==='__proto__'||key==='constructor'||key==='prototype')invalid();
    return [key,jsonValue(item,depth+1)];
  }));
  if(Array.isArray(value))return value.map(item=>jsonValue(item,depth+1));
  if(typeof value==='bigint') {
    const number=Number(value);
    if(!Number.isSafeInteger(number))invalid();
    return number;
  }
  if(value===null||['string','boolean','number'].includes(typeof value))return value;
  invalid();
}

// The pinned SDK's decoder trusts declared collection sizes. Validate the
// binary structure first so a malformed RPC reply cannot allocate or loop
// indefinitely before the normal schema/digest checks run.
function validateEncoding(bytes:Uint8Array):void {
  let cursor=0,nodes=0;
  const integer=():bigint=>{
    let value=0n;
    for(let index=0;index<10;index++) {
      if(cursor>=bytes.length)invalid();
      const byte=bytes[cursor++]!;value|=BigInt(byte&127)<<BigInt(index*7);
      if(byte<128)return value;
    }
    invalid();
  };
  const skip=(count:bigint):void=>{
    if(count>BigInt(bytes.length-cursor))invalid();
    cursor+=Number(count);
  };
  const visit=(depth:number):void=>{
    if(depth>16||++nodes>8192)invalid();
    const header=integer(),type=Number(header&7n),count=header>>3n;
    if(type===0) {if(header===24n)skip(20n);else if(![0n,8n,16n].includes(header))invalid();return;}
    if(type===1||type===2)return;
    if(type===3||type===4){skip(count);return;}
    if(type!==5&&type!==6)invalid();
    if(count>BigInt(bytes.length-cursor)||count>8192n)invalid();
    const keys=new Set<string>();
    for(let index=0;index<Number(count);index++) {
      if(type===6) {
        const start=cursor,length=integer(),keyStart=cursor;skip(length);
        if(cursor===start)invalid();
        const key=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(keyStart,cursor));
        if(keys.has(key))invalid();keys.add(key);
      }
      visit(depth+1);
    }
  };
  visit(0);if(cursor!==bytes.length)invalid();
}

export async function verifyRuntimePreparation(input:unknown,expected:PreparedRepair,address:Address,
  nativeChainId:1|GenLayerChainId,chainId:GenLayerChainId):Promise<void> {
  let data:unknown=input;
  if(typeof input==='object'&&input!==null) {
    const response=object(input);
    if(response.status!==undefined&&object(response.status).code!==0)throw runtimeUnavailable();
    data=response.data;
  }
  if(typeof data!=='string'||data.length>128000)invalid();
  const hex=data.startsWith('0x')?data.slice(2):data;
  if(!hex||hex.length%2||/[^a-f0-9]/i.test(hex))invalid();
  const bytes=Uint8Array.from(hex.match(/../g)!,byte=>Number.parseInt(byte,16));
  let decoded:unknown;
  try{validateEncoding(bytes);decoded=jsonValue(abi.calldata.decode(bytes));}catch{invalid();}
  const identity=object(decoded);
  if(identity.siteId!==expected.siteId||identity.caller!==expected.caller||identity.nonce!==expected.nonce)invalid();
  const actual=await preparedEvidence(decoded,address,nativeChainId,chainId);
  if(actual.digest!==expected.digest||actual.siteId!==expected.siteId||actual.caller!==expected.caller||
    actual.nonce!==expected.nonce||!actual.technicallyValid||
    Object.entries(expected.technicalFlags).some(([key,value])=>actual.technicalFlags[key]!==value))invalid();
}

export function runtimeUnavailable():GenLayerClientError {
  return new GenLayerClientError('RUNTIME_UNAVAILABLE',
    'The network could not complete this site’s finalized prerequisite checks. This matches a known StudioNet runtime issue. Your build and existing approvals are saved. Nothing was submitted; no wallet signature is needed.');
}
