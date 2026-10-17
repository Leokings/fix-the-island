// Configure the finalized-notification graph using the CLI account. Every write
// requires an individual human confirmation and a fresh versioned report set.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { resolveFreshDeploymentOutputDir } from './deployment-output-dir.mjs';
import { assertBalanceMatches, balanceEvidence, readDeployerBalance } from './studionet-balance.mjs';

const manifest = JSON.parse(readFileSync('contracts/sites/manifest.json', 'utf8'));
const flags=process.argv.slice(2),outputIndex=flags.indexOf('--output-dir');
if(outputIndex>=0&&!flags[outputIndex+1])throw new Error('--output-dir needs a path');
const requestedOutputDir=outputIndex>=0?flags[outputIndex+1]:'artifacts/deployment/v4-studionet';
const outputDir=resolveFreshDeploymentOutputDir(requestedOutputDir);
if(!flags.includes('--execute'))throw new Error('No broadcast: pass --execute after reviewing the offline deployment plan.');
if(flags.some((flag,index)=>flag!=='--execute'&&flag!=='--output-dir'&&index!==outputIndex+1))throw new Error('Usage: node tools/configure-site-dependents.mjs --output-dir <fresh-dir> --execute');
if(stdin.isTTY!==true)throw new Error('Refusing configuration writes without a real interactive terminal. Run this command directly in your terminal and type each confirmation yourself.');
const balanceClient=createClient({chain:studionet});
if(Number(await balanceClient.getChainId())!==61999)throw new Error('Wrong chain while reading the deployer balance.');
const directory = resolve(outputDir);
mkdirSync(directory, { recursive: true });
const addresses = {};
for (const site of Object.keys(manifest)) {
  const row = JSON.parse(readFileSync(resolve(directory, `${site}.json`), 'utf8'));
  if (row.site !== site || row.codeHash !== manifest[site].codeHash || row.network !== 'studionet' || row.state !== 'finalized-success' || !/^0x[0-9a-fA-F]{40}$/.test(row.address ?? '') || !/^\d+$/.test(row.balanceAfterWei ?? '') || row.balanceDecreaseWei !== '0') {
    throw new Error(`${site} is not a finalized StudioNet deployment of the reviewed source hash.`);
  }
  addresses[site] = row.address;
}

for (const site of Object.keys(manifest)) {
  const children = Object.fromEntries(Object.keys(manifest)
    .filter(child => manifest[child].requires.includes(site))
    .map(child => [child, addresses[child]]));
  const reportPath = resolve(directory, `${site}.dependents.json`);
  let resumeTxId, balanceBeforeWei;
  if (existsSync(reportPath)) {
    const previous = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (previous.site !== site || previous.address !== addresses[site] || JSON.stringify(previous.dependents) !== JSON.stringify(children)) {
      throw new Error(`${site} has a saved configuration record for a different deployment or graph.`);
    }
    if (BigInt(previous.balanceDecreaseWei ?? '0') > 0n) throw new Error(`${site} recorded a balance decrease; stop and investigate before any further transaction.`);
    if (previous.state === 'finalized-success') {
      if (!/^\d+$/.test(previous.balanceAfterWei ?? '')) throw new Error(`${site} has a finalized record without post-transaction balance evidence; reconcile it before proceeding.`);
      console.log(JSON.stringify({ site, address: addresses[site], state: previous.state, resumed: true }));
      continue;
    }
    if(previous.evmTxHash&&!previous.txId)throw new Error(`${site} has an EVM broadcast without a GenLayer transaction ID; reconcile the saved hash before any retry.`);
    if(previous.txId&&!/^\d+$/.test(previous.balanceBeforeWei??''))throw new Error(`${site} has a saved transaction but no pre-transaction balance snapshot; reconcile it manually before resuming.`);
    if(previous.txId&&previous.balanceBeforeWei!==undefined)balanceBeforeWei=BigInt(previous.balanceBeforeWei);
    resumeTxId = previous.txId;
  }
  const balanceAtApprovalWei=await readDeployerBalance(balanceClient);
  balanceBeforeWei??=balanceAtApprovalWei;
  const preBalance=balanceEvidence(balanceBeforeWei,balanceAtApprovalWei);
  const request = { operation: 'configure_dependents', site, address: addresses[site], dependentsJson: JSON.stringify(children), ...(resumeTxId ? { resumeTxId } : {}) };
  request.balanceBeforeWei=balanceBeforeWei.toString();request.balanceAtApprovalWei=balanceAtApprovalWei.toString();
  console.log(JSON.stringify({ action: resumeTxId ? 'resume-configure_dependents' : 'configure_dependents', network: 'studionet', chainId: 61999, site, address: addresses[site], dependents: children, dependentsJson: JSON.stringify(children), resumeTxId: resumeTxId ?? null, balance:preBalance, balanceCheckWarning:'Tripwire only; a possible first charge is not capped.' }, null, 2));
  const terminal=createInterface({input:stdin,output:stdout});
  let approval;
  try{approval=await terminal.question(`Current balance ${preBalance.balanceAfterGEN} GEN. Type CONFIGURE ${site} to ${resumeTxId?'resume this saved transaction':'approve this configuration write'} (tripwire only; a first charge is not capped): `);}finally{terminal.close();}
  if(approval!==`CONFIGURE ${site}`)throw new Error(`Stopped before ${site}; no configuration transaction was started for this site.`);
  assertBalanceMatches(request.balanceAtApprovalWei,await readDeployerBalance(balanceClient));
  writeFileSync(reportPath,JSON.stringify({site,network:'studionet',chainId:61999,address:addresses[site],dependents:children,
    balanceBeforeWei:request.balanceBeforeWei,balanceAtApprovalWei:request.balanceAtApprovalWei,
    ...(resumeTxId?{txId:resumeTxId}:{}),state:resumeTxId?'resuming':'not-broadcast'},null,2));
  const child = spawn(process.execPath, ['C:/Users/leoki/AppData/Roaming/npm/node_modules/genlayer/dist/index.js', 'deploy'], {
    cwd: resolve('tools/site-deployer'), env: { ...process.env, ISLAND_DEPLOY_REQUEST: JSON.stringify(request) },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '', buffer = '', evidence = {};
  const collect = chunk => {
    output += chunk.toString(); buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/); buffer = lines.pop();
    for (const line of lines) if (line.startsWith('ISLAND_DEPLOY ')) {
      const event = JSON.parse(line.slice(14)); evidence = { ...evidence, ...event };
      const status = event.receipt?.status_name ?? event.receipt?.statusName ?? event.receipt?.status;
      const execution = event.receipt?.txExecutionResultName ?? event.receipt?.txExecutionResult;
      const leaderReceipts = event.receipt?.consensus_data?.leader_receipt;
      const succeeded = execution === 'FINISHED_WITH_RETURN' || execution === 1 || event.receipt?.result_name === 'MAJORITY_AGREE' &&
        Array.isArray(leaderReceipts) && leaderReceipts.some(item => item?.execution_result === 'SUCCESS' && item?.genvm_result?.error_code == null);
      const report = { site, network: 'studionet', chainId: 61999, address: addresses[site], dependents: children,
        balanceBeforeWei:request.balanceBeforeWei,balanceAtApprovalWei:request.balanceAtApprovalWei,...evidence,
        state: status === 'FINALIZED' || status === 7 ? succeeded ? 'finalized-success' : 'finalized-error' : event.txId ? 'submitted' : event.evmTxHash ? 'broadcast-no-txid' : 'not-broadcast' };
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ site, txId: event.txId, state: report.state }));
    }
  };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  const exitCode = await new Promise(resolveExit => child.on('close', resolveExit));
  if (!existsSync(reportPath)) writeFileSync(reportPath, JSON.stringify({ site, address: addresses[site], dependents: children, state: 'not-broadcast', output: output.slice(-4000) }, null, 2));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  if (BigInt(report.balanceDecreaseWei ?? '0') > 0n) throw new Error(`${site} finalized but the deployer balance decreased by ${report.balanceDecreaseGEN ?? 'an unknown amount'} GEN; stopped before the next transaction.`);
  if (report.state === 'finalized-success' && (!/^\d+$/.test(report.balanceBeforeWei ?? '') || !/^\d+$/.test(report.balanceAfterWei ?? '') || report.balanceDecreaseWei !== '0')) throw new Error(`${site} finalized without complete balance evidence; stop before the next transaction.`);
  if (exitCode !== 0 || report.state !== 'finalized-success') {
    throw new Error(`${site} dependent configuration did not finalize successfully; preserve its report and resume, do not rebroadcast blindly.`);
  }
}
console.log(JSON.stringify({ network: 'studionet', chainId: 61999, configuredContracts: Object.keys(addresses).length, state: 'all-finalized' }));
