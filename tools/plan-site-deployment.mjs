// Offline deployment-plan preview. Reads only the manifest and saved reports;
// it never contacts GenLayer, loads a key, signs, or broadcasts.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
let directory = 'artifacts/deployment/v4-studionet';
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--output-dir') {
    if (!args[i + 1]) throw new Error('--output-dir needs a path');
    directory = args[++i];
  } else if (args[i] === '--help') {
    console.log('Usage: node tools/plan-site-deployment.mjs [--output-dir artifacts/deployment/v4-studionet]');
    process.exit(0);
  } else throw new Error(`Unknown option: ${args[i]}`);
}
const root = resolve(directory);
const manifest = JSON.parse(readFileSync('contracts/sites/manifest.json', 'utf8'));
const sites = Object.keys(manifest);
const reports = {};
for (const site of sites) {
  const path = resolve(root, `${site}.json`);
  if (!existsSync(path)) continue;
  const row = JSON.parse(readFileSync(path, 'utf8'));
  if (row.site !== site || row.network !== 'studionet' || row.chainId !== 61999 ||
      row.state !== 'finalized-success' || row.codeHash !== manifest[site].codeHash ||
      !/^0x[0-9a-fA-F]{40}$/.test(row.address ?? '')) {
    throw new Error(`${site} report is not a finalized, hash-matched StudioNet deployment: ${path}`);
  }
  reports[site] = row;
}

const planned = sites.map(site => {
  const meta = manifest[site];
  const parents = Object.fromEntries(meta.requires.map(parent => [parent, reports[parent]?.address ?? null]));
  const resolved = meta.requires.every(parent => reports[parent]);
  return {
    site,
    action: reports[site] ? 'already-finalized-verified' : resolved ? 'deploy-ready' : 'blocked-on-parent-addresses',
    file: meta.file,
    sourceHash: meta.codeHash,
    constructorArgs: reports[site] || !resolved ? null : meta.requires.length ? [JSON.stringify(parents)] : meta.constructorArgs,
    unresolvedParentIds: resolved ? [] : meta.requires.filter(parent => !reports[parent]),
    address: reports[site]?.address ?? null,
  };
});

const allDeployed = sites.every(site => reports[site]);
const dependentCalls = sites.map(site => ({
  site,
  address: reports[site]?.address ?? null,
  payload: allDeployed ? Object.fromEntries(sites
    .filter(child => manifest[child].requires.includes(site))
    .map(child => [child, reports[child].address])) : null,
  unresolvedChildIds: allDeployed ? [] : sites.filter(child => manifest[child].requires.includes(site) && !reports[child]),
}));

console.log(JSON.stringify({
  mode: 'offline-dry-run',
  network: 'studionet',
  chainId: 61999,
  outputDirectory: root,
  noNetwork: true,
  noKeyAccess: true,
  noBroadcast: true,
  deployments: planned,
  configureDependents: {
    ready: allDeployed,
    calls: dependentCalls,
  },
}, null, 2));
