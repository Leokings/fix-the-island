// Authorized CLI deployment. The CLI alone accesses its existing OS-keystore account.
// No keys are imported, exported, or handled by this wrapper.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { resolveFreshDeploymentOutputDir } from './deployment-output-dir.mjs';
import { assertBalanceMatches, balanceEvidence, readDeployerBalance } from './studionet-balance.mjs';
const site = process.argv[2];
if (!/^[a-z_]+$/.test(site ?? '')) throw new Error('Expected site ID');
const outputDirectory = resolveFreshDeploymentOutputDir(process.argv[4] ?? 'artifacts/deployment/v4-studionet');
if (!process.argv.slice(5).includes('--execute')) throw new Error('No broadcast: pass --execute after reviewing the deployment plan.');
if (process.argv.slice(5).some(flag => flag !== '--execute')) throw new Error('Usage: node tools/deploy-site.mjs <site> <constructorArgsJson> [output-dir] --execute');
if (stdin.isTTY !== true) throw new Error('Refusing deployment without a real interactive terminal. Run this command directly in your terminal and type the confirmation yourself.');
const manifest = JSON.parse(readFileSync('contracts/sites/manifest.json', 'utf8'));
const entry = manifest[site];
if (!entry) throw new Error('Unknown site');
const constructorArgs = process.argv[3] ? JSON.parse(process.argv[3]) : entry.constructorArgs;
const source = readFileSync(entry.file, 'utf8');
const reportDirectory = outputDirectory;
const reportPath = resolve(reportDirectory, `${site}.json`);
const hash = '0x' + createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
if (hash !== entry.codeHash) throw new Error('Untested source hash');
let resumeTxId, balanceBeforeWei;
if (existsSync(reportPath)) {
  const previous = JSON.parse(readFileSync(reportPath, 'utf8'));
  if (previous.txId || previous.evmTxHash) {
    if (previous.network !== 'studionet' || previous.codeHash !== hash || JSON.stringify(previous.constructorArgs) !== JSON.stringify(constructorArgs)) {
      throw new Error('Existing broadcast belongs to a different network, source, or constructor args; reconcile it before deploying.');
    }
    if (previous.state === 'finalized-success') throw new Error('This contract is already finalized; use its saved address.');
    if (BigInt(previous.balanceDecreaseWei ?? '0') > 0n) throw new Error('A prior balance decrease was recorded; stop and investigate before continuing.');
    if (!/^\d+$/.test(previous.balanceBeforeWei ?? '')) throw new Error('Existing broadcast has no saved pre-transaction balance; reconcile it manually before resuming.');
    balanceBeforeWei = BigInt(previous.balanceBeforeWei);
    resumeTxId = previous.txId;
    if (!resumeTxId) throw new Error('Existing EVM broadcast has no GenLayer transaction ID; inspect its report before continuing.');
  }
}
const client = createClient({ chain: studionet });
if (Number(await client.getChainId()) !== 61999) throw new Error('Wrong chain while reading the deployer balance.');
const balanceAtApprovalWei = await readDeployerBalance(client);
balanceBeforeWei ??= balanceAtApprovalWei;
const cli = 'C:/Users/leoki/AppData/Roaming/npm/node_modules/genlayer/dist/index.js';
const args = [cli, 'deploy'];
const before = balanceEvidence(balanceBeforeWei, balanceAtApprovalWei);
console.log(JSON.stringify({ site, network: 'studionet', chainId: 61999, codeHash: hash, bytes: Buffer.byteLength(source), constructorArgs, action: resumeTxId ? 'resume' : 'deploy', balance: before, balanceCheckWarning: 'Tripwire only; this does not cap a possible charge from this transaction.' }));
const terminal = createInterface({ input: stdin, output: stdout });
let approval;
try { approval = await terminal.question(`Current balance ${before.balanceAfterGEN} GEN. Type DEPLOY ${site} to ${resumeTxId ? 'resume this saved transaction' : 'approve this deployment'} (tripwire only; a possible first charge is not capped): `); }
finally { terminal.close(); }
if (approval !== `DEPLOY ${site}`) throw new Error(`Stopped before ${site}; no deployment transaction was started.`);
const request = { site, file: resolve(entry.file), codeHash: hash, constructorArgs, balanceBeforeWei: balanceBeforeWei.toString(), balanceAtApprovalWei: balanceAtApprovalWei.toString(), ...(resumeTxId ? { resumeTxId } : {}) };
assertBalanceMatches(request.balanceAtApprovalWei, await readDeployerBalance(client));
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(reportPath, JSON.stringify({ site, network: 'studionet', chainId: 61999, codeHash: hash, constructorArgs,
  balanceBeforeWei: request.balanceBeforeWei, balanceAtApprovalWei: request.balanceAtApprovalWei,
  ...(resumeTxId ? { txId: resumeTxId } : {}),
  state: resumeTxId ? 'resuming' : 'not-broadcast' }, null, 2));
const child = spawn(process.execPath, args, { cwd: resolve('tools/site-deployer'), env: { ...process.env, ISLAND_DEPLOY_REQUEST: JSON.stringify(request) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let output = '', buffer = '', evidence = {};
mkdirSync(reportDirectory, { recursive: true });
const deploymentState = value => {
  const receipt = value.receipt;
  if (!receipt) return value.txId ? 'submitted' : 'not-broadcast';
  const status = receipt.status_name ?? receipt.statusName ?? receipt.status;
  const execution = receipt.txExecutionResultName ?? receipt.txExecutionResult;
  const leaderReceipts = receipt.consensus_data?.leader_receipt;
  const studioExecutionSucceeded = receipt.result_name === 'MAJORITY_AGREE' && Array.isArray(leaderReceipts) &&
    leaderReceipts.some(item => item?.execution_result === 'SUCCESS' && item?.genvm_result?.error_code == null);
  const successfulExecution = execution === 'FINISHED_WITH_RETURN' || execution === 1 || studioExecutionSucceeded;
  if (status === 'FINALIZED' || status === 7) return successfulExecution ? 'finalized-success' : 'finalized-error';
  if (status === 'ACCEPTED' || status === 5) return successfulExecution ? 'accepted-pending-finality' : 'accepted-execution-error';
  return `pending-${String(status ?? 'unknown').toLowerCase()}`;
};
const collect = chunk => {
  output += chunk.toString();
  buffer += chunk.toString();
  const lines = buffer.split(/\r?\n/); buffer = lines.pop();
  for (const line of lines) if (line.startsWith('ISLAND_DEPLOY ')) {
    const event = JSON.parse(line.slice(14)); evidence = { ...evidence, ...event };
    const report = { site, network: 'studionet', chainId: 61999, codeHash: hash, constructorArgs,
      balanceBeforeWei: request.balanceBeforeWei, balanceAtApprovalWei: request.balanceAtApprovalWei, ...evidence };
    report.state = deploymentState(report);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ site, txId: evidence.txId, evmTxHash: evidence.evmTxHash, address: evidence.address, state: report.state }));
  }
};
child.stdout.on('data', collect); child.stderr.on('data', collect);
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('close', code => {
  const { txId, address } = evidence;
  const errors = output.split(/\r?\n/).filter(line => /^(Details:|Error:|×|GenLayer RPC error|\s*shortMessage:)/.test(line));
  const report = { site, network: 'studionet', chainId: 61999, codeHash: hash, constructorArgs,
    balanceBeforeWei: request.balanceBeforeWei, balanceAtApprovalWei: request.balanceAtApprovalWei, ...evidence, cliExit: code, errors,
    note: 'CLI exit/address is not proof of finalized execution; independent verification required.' };
  report.state = deploymentState(report);
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, receipt: undefined }));
  const hasBalanceEvidence = /^\d+$/.test(report.balanceBeforeWei ?? '') && /^\d+$/.test(report.balanceAfterWei ?? '') && /^\d+$/.test(report.balanceDecreaseWei ?? '');
  process.exitCode = txId && address && code === 0 && report.state === 'finalized-success' && hasBalanceEvidence && report.balanceGate !== 'decrease-detected-stop' ? 0 : 1;
});
