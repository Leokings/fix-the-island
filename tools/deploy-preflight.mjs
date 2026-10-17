// Read-only EVM-layer deployment preflight. It does not quote GenLayer protocol fees,
// load a key, or broadcast a transaction; the deployment flow uses balance tripwires.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { abi } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { createPublicClient, http, encodeFunctionData, zeroAddress, formatEther } from 'viem';

const account = '0x797d3b25fb2cca0ff93f60df1910267f3822d655';
const chain = studionet;
const client = createPublicClient({ chain, transport: http(undefined, { timeout: 15000, retryCount: 0 }) });
if (!process.argv[2]) throw new Error('Usage: node tools/deploy-preflight.mjs <contract-file> [constructor-args-json]');
const code = readFileSync(resolve(process.argv[2]), 'utf8');
const constructorArgs = process.argv[3] ? JSON.parse(process.argv[3]) : [];
const constructor = abi.calldata.encode(abi.calldata.makeCalldataObject(undefined, constructorArgs));
const payload = abi.transactions.serialize([code, constructor, false]);
const fn = chain.consensusMainContract.abi.find(item => item.type === 'function' && item.name === 'addTransaction');
const args = [account, zeroAddress, chain.defaultNumberOfInitialValidators, chain.defaultConsensusMaxRotations, payload];
if (fn.inputs.length === 6) args.push(BigInt(Math.floor(Date.now() / 1000) + 3600));
const data = encodeFunctionData({ abi: [fn], functionName: 'addTransaction', args });
const [chainId, balance, gasPrice, gas] = await Promise.all([
  client.getChainId(), client.getBalance({ address: account }), client.getGasPrice(),
  client.estimateGas({ account, to: chain.consensusMainContract.address, data, value: 0n }),
]);
if (chainId !== 61999) throw new Error('Wrong chain; do not deploy.');
console.log(JSON.stringify({ chainId, account, consensus: chain.consensusMainContract.address,
  abiInputs: fn.inputs.length, sourceBytes: Buffer.byteLength(code), value: '0',
  gas: gas.toString(), gasPrice: gasPrice.toString(), estimatedGasCostGEN: formatEther(gas * gasPrice),
  balanceGEN: formatEther(balance), protocolFeeQuote: 'not available; historical fee evidence is in docs/BACKEND-DIRECTION.md',
  safety: 'Per-transaction pre/post balance tripwire; does not cap a first unexpected charge.', evmCompatibilityEstimatePassed: true }, null, 2));
