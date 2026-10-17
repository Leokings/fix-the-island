import { formatEther } from 'viem';

export const DEPLOYER_ADDRESS = '0x797d3b25fb2cca0ff93f60df1910267f3822d655';

export async function readDeployerBalance(client) {
  return await client.getBalance({ address: DEPLOYER_ADDRESS });
}

export function balanceEvidence(beforeWei, afterWei) {
  const before = BigInt(beforeWei);
  const after = BigInt(afterWei);
  const delta = after - before;
  return {
    balanceBeforeWei: before.toString(),
    balanceBeforeGEN: formatEther(before),
    balanceAfterWei: after.toString(),
    balanceAfterGEN: formatEther(after),
    balanceDeltaWei: delta.toString(),
    balanceDeltaGEN: formatEther(delta),
    balanceDecreaseWei: delta < 0n ? (-delta).toString() : '0',
    balanceDecreaseGEN: delta < 0n ? formatEther(-delta) : '0',
    balanceGate: delta < 0n ? 'decrease-detected-stop' : 'no-decrease-observed',
  };
}

export function assertBalanceMatches(expectedWei, actualWei) {
  if (BigInt(expectedWei) !== BigInt(actualWei)) {
    throw new Error('Deployer balance changed after the confirmation prompt; stop and reconcile before broadcasting.');
  }
}
