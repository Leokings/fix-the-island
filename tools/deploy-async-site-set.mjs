// Safe by default: an offline dry run. --execute is required to begin the
// separately confirmed deployment/configuration transactions.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolveFreshDeploymentOutputDir } from './deployment-output-dir.mjs';
const flags=process.argv.slice(2);
const outputIndex=flags.indexOf('--output-dir');
if(outputIndex>=0&&!flags[outputIndex+1])throw new Error('--output-dir needs a path');
const requestedOutputDir=outputIndex>=0?flags[outputIndex+1]:'artifacts/deployment/v4-studionet';
const outputDir=resolveFreshDeploymentOutputDir(requestedOutputDir);
const execute=flags.includes('--execute');
const dryRun=flags.includes('--dry-run')||!execute;
if(execute&&flags.includes('--dry-run'))throw new Error('Choose either --dry-run or --execute, not both.');
if(flags.some((flag,index)=>flag!=='--execute'&&flag!=='--dry-run'&&flag!=='--output-dir'&&index!==outputIndex+1))throw new Error('Usage: node tools/deploy-async-site-set.mjs [--output-dir artifacts/deployment/v4-studionet] [--dry-run|--execute]');
if(dryRun){
  const preview=spawnSync(process.execPath,['tools/plan-site-deployment.mjs','--output-dir',outputDir],{encoding:'utf8',windowsHide:true});
  if(preview.stdout)process.stdout.write(preview.stdout);if(preview.stderr)process.stderr.write(preview.stderr);
  if(preview.status!==0)throw new Error(`Dry run failed (exit ${preview.status}). No transaction was sent.`);
  process.exit(0);
}
const manifest=JSON.parse(readFileSync('contracts/sites/manifest.json','utf8'));
const run=args=>{
  const result=spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true});
  if(result.status!==0)throw new Error(`Stopped at ${args.join(' ')} (exit ${result.status}). Preserve reports; the scripts are resumable.`);
};
for(const site of ['pier_hoist','village_pump','tidal_sluice']){
  const args=JSON.stringify(manifest[site].constructorArgs);
  run(['tools/deploy-preflight.mjs',manifest[site].file,args]);
  run(['tools/deploy-site.mjs',site,args,outputDir,'--execute']);
  const report=JSON.parse(readFileSync(`${outputDir}/${site}.json`,'utf8'));
  if(report.state!=='finalized-success')throw new Error(`${site} is not finalized successfully.`);
  if(BigInt(report.balanceDecreaseWei??'0')>0n)throw new Error(`${site} finalized but the deployer balance decreased; stop before the next transaction.`);
  if(!/^\d+$/.test(report.balanceAfterWei??''))throw new Error(`${site} has no post-transaction balance evidence; stop before the next transaction.`);
  run(['tools/verify-live-deployment.mjs',report.address,manifest[site].file,site]);
}
run(['tools/deploy-remaining-sites.mjs','--output-dir',outputDir,'--execute']);
run(['tools/configure-site-dependents.mjs','--output-dir',outputDir,'--execute']);
run(['tools/verify-site-set.mjs','--output-dir',outputDir]);
console.log(`The contract set in ${outputDir} is deployed and configured. Update the StudioNet address manifest only after the verification report is reviewed.`);
