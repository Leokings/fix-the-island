import { resolve } from 'node:path';

const historicalDirectories = [
  'artifacts/deployment/sites',
  'artifacts/deployment/v2-studionet',
  'artifacts/deployment/v3-studionet',
  'artifacts/deployment/v4-studionet',
].map(path => normalize(resolve(path)));

function normalize(path) {
  return path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
}

export function resolveFreshDeploymentOutputDir(path) {
  const absolute = resolve(path);
  const candidate = normalize(absolute);
  const historical = historicalDirectories.find(directory =>
    candidate === directory || candidate.startsWith(`${directory}/`),
  );
  if (historical) {
    throw new Error(`Historical deployment evidence is read-only (${historical}); choose a fresh output directory.`);
  }
  return absolute;
}
