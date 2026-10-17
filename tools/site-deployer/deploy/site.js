import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { assertBalanceMatches, balanceEvidence, readDeployerBalance } from '../../../tools/studionet-balance.mjs';
export default async function deploy(cliClient) {
  const request = JSON.parse(process.env.ISLAND_DEPLOY_REQUEST ?? '{}');
  if (cliClient.account?.address?.toLowerCase() !== '0x797d3b25fb2cca0ff93f60df1910267f3822d655') throw new Error('Unexpected CLI account');
  // Use the complete built-in chain preset, not --rpc. Other local tasks can
  // change the shared CLI network setting between commands.
  const client = createClient({ chain: studionet, account: cliClient.account });
  const rpcChainId = Number(await client.request({ method: 'eth_chainId' }));
  if (Number(client.chain?.id) !== 61999 || rpcChainId !== 61999) throw new Error(`Wrong network: preset=${client.chain?.id}, RPC=${rpcChainId}`);
  if (!/^\d+$/.test(request.balanceBeforeWei ?? '') || !/^\d+$/.test(request.balanceAtApprovalWei ?? '')) throw new Error('Missing saved pre-transaction and approval-time balance snapshots.');
  assertBalanceMatches(request.balanceAtApprovalWei, await readDeployerBalance(client));
  if (request.operation === 'configure_dependents') {
    if (typeof request.address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(request.address) || typeof request.dependentsJson !== 'string') throw new Error('Invalid dependent configuration request');
    const send = client.sendRawTransaction;
    client.sendRawTransaction = async args => {
      const evmTxHash = await send(args);
      console.log('ISLAND_DEPLOY ' + JSON.stringify({ site: request.site, evmTxHash }));
      return evmTxHash;
    };
    const txId = request.resumeTxId ?? await client.writeContract({ address: request.address, functionName: 'configure_dependents', args: [request.dependentsJson], leaderOnly: false });
    console.log('ISLAND_DEPLOY ' + JSON.stringify({ site: request.site, txId, state: 'submitted' }));
    const receipt = await client.waitForTransactionReceipt({ hash: txId, retries: 60, interval: 5000, status: 'FINALIZED' });
    const balance = balanceEvidence(request.balanceBeforeWei, await readDeployerBalance(client));
    console.log('ISLAND_DEPLOY ' + JSON.stringify({ site: request.site, address: request.address, txId, receipt, ...balance }, (_, value) => typeof value === 'bigint' ? value.toString() : value));
    const leaderReceipts = receipt.consensus_data?.leader_receipt;
    const studioExecutionSucceeded = receipt.result_name === 'MAJORITY_AGREE' && Array.isArray(leaderReceipts) &&
      leaderReceipts.some(item => item?.execution_result === 'SUCCESS' && item?.genvm_result?.error_code == null);
    if (receipt.txExecutionResultName !== 'FINISHED_WITH_RETURN' && receipt.txExecutionResult !== 1 && !studioExecutionSucceeded) {
      throw new Error(`Dependent configuration finalized without successful execution: ${receipt.txExecutionResultName ?? receipt.txExecutionResult ?? receipt.result_name}`);
    }
    if (balance.balanceGate === 'decrease-detected-stop') throw new Error(`Balance decreased by ${balance.balanceDecreaseGEN} GEN after ${request.site}; stop before the next transaction.`);
    return;
  }
  const code = readFileSync(request.file, 'utf8');
  if ('0x' + createHash('sha256').update(code.replace(/\r\n/g, '\n')).digest('hex') !== request.codeHash) throw new Error('Source changed after preflight');
  const broadcast = client.sendRawTransaction;
  client.sendRawTransaction = async args => {
    const evmTxHash = await broadcast(args);
    console.log('ISLAND_DEPLOY ' + JSON.stringify({ site: request.site, evmTxHash }));
    return evmTxHash;
  };
  const txId = request.resumeTxId ?? await client.deployContract({ code, args: request.constructorArgs, leaderOnly: false });
  console.log('ISLAND_DEPLOY ' + JSON.stringify({ site: request.site, txId, state: request.resumeTxId ? 'resuming' : 'submitted' }));
  const receipt = await client.waitForTransactionReceipt({ hash: txId, retries: 60, interval: 5000, status: 'FINALIZED' });
  const address = receipt.data?.contract_address ?? receipt.txDataDecoded?.contractAddress ?? receipt.recipient;
  const balance = balanceEvidence(request.balanceBeforeWei, await readDeployerBalance(client));
  console.log('ISLAND_DEPLOY ' + JSON.stringify({ site: request.site, txId, address, receipt, ...balance }, (_, value) => typeof value === 'bigint' ? value.toString() : value));
  const leaderReceipts = receipt.consensus_data?.leader_receipt;
  const studioExecutionSucceeded = receipt.result_name === 'MAJORITY_AGREE' && Array.isArray(leaderReceipts) &&
    leaderReceipts.some(item => item?.execution_result === 'SUCCESS' && item?.genvm_result?.error_code == null);
  if (receipt.txExecutionResultName !== 'FINISHED_WITH_RETURN' && receipt.txExecutionResult !== 1 && !studioExecutionSucceeded) {
    throw new Error(`Finalized deployment execution failed: ${receipt.txExecutionResultName ?? receipt.txExecutionResult ?? receipt.result_name}`);
  }
  if (balance.balanceGate === 'decrease-detected-stop') throw new Error(`Balance decreased by ${balance.balanceDecreaseGEN} GEN after ${request.site}; stop before the next transaction.`);
}
