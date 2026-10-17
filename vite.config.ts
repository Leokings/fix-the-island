import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
let commit = process.env.BUILD_SOURCE_COMMIT?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || '';
if (!commit) {
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { commit = 'unavailable'; }
}

export default defineConfig({
  define: { __BUILD_COMMIT__: JSON.stringify(commit) },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
  },
});
