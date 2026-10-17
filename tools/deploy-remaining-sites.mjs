// Resume the versioned async-notification deployment DAG without repeating broadcasts.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolveFreshDeploymentOutputDir } from './deployment-output-dir.mjs';
const flags=process.argv.slice(2),outputIndex=flags.indexOf('--output-dir');
if(outputIndex>=0&&!flags[outputIndex+1])throw new Error('--output-dir needs a path');
const requestedOutputDir=outputIndex>=0?flags[outputIndex+1]:'artifacts/deployment/v4-studionet';
const outputDir=resolveFreshDeploymentOutputDir(requestedOutputDir);
if(!flags.includes('--execute'))throw new Error('No broadcast: pass --execute after reviewing the offline deployment plan.');
if(flags.some((flag,index)=>flag!=='--execute'&&flag!=='--output-dir'&&index!==outputIndex+1))throw new Error('Usage: node tools/deploy-remaining-sites.mjs --output-dir <fresh-dir> --execute');
const manifest = JSON.parse(readFileSync('contracts/sites/manifest.json', 'utf8'));
const run = args => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`Deployment step failed (exit ${result.status}); preserve reports and resume the saved transaction.`);
  }
};
for (const site of ['creek_bridge','coast_windmill','upland_waterworks','woodland_pathlight','ridge_beacon']) {
  const siteReportPath = `${outputDir}/${site}.json`;
  try {
    const existing = JSON.parse(readFileSync(siteReportPath, 'utf8'));
    if (existing.state === 'finalized-success' && existing.address) {
      if (BigInt(existing.balanceDecreaseWei ?? '0') > 0n) throw new Error(`${site} has a recorded balance decrease; stop and investigate before continuing.`);
      if (!/^\d+$/.test(existing.balanceAfterWei ?? '')) throw new Error(`${site} has no post-transaction balance evidence; reconcile it before continuing.`);
      run(['tools/verify-live-deployment.mjs', existing.address, manifest[site].file, site]);
      console.log(JSON.stringify({ site, address: existing.address, sourceAndProtocolVerified: true, consensusStatus: 'FINALIZED', resumed: true }));
      continue;
    }
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  const parents = {};
  for (const parent of manifest[site].requires) {
    const report = JSON.parse(readFileSync(`${outputDir}/${parent}.json`, 'utf8'));
    if (report.state !== 'finalized-success' || !report.address) throw new Error(`Parent ${parent} is not finalized and source-verified`);
    if (BigInt(report.balanceDecreaseWei ?? '0') > 0n) throw new Error(`Parent ${parent} recorded a balance decrease; stop and investigate before continuing.`);
    if (!/^\d+$/.test(report.balanceAfterWei ?? '')) throw new Error(`Parent ${parent} has no post-transaction balance evidence; reconcile before continuing.`);
    run(['tools/verify-live-deployment.mjs', report.address, manifest[parent].file, parent]);
    parents[parent] = report.address;
  }
  const args = JSON.stringify([JSON.stringify(parents)]);
  run(['tools/deploy-preflight.mjs', manifest[site].file, args]);
  run(['tools/deploy-site.mjs', site, args, outputDir, '--execute']);
  const report = JSON.parse(readFileSync(`${outputDir}/${site}.json`, 'utf8'));
  if (report.state !== 'finalized-success') throw new Error(`${site} did not finalize successfully`);
  run(['tools/verify-live-deployment.mjs', report.address, manifest[site].file, site]);
  console.log(JSON.stringify({ site, address: report.address, sourceAndProtocolVerified: true, consensusStatus: report.receipt.status }));
}
