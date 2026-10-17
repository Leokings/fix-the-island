# Vercel production — 9 October 2026

Primary game URL: https://fix-the-island.vercel.app/#play

- Status: READY, production, Vite / Node 24.
- Project: `prj_lnZS5fTbhguYClYPhkFucIPDcRUZ` (`fix-the-island`).
- Team: `team_2L0T4LCdFsCTFcckeTFWZRvN` (`leokings588-5902s-projects`).
- Deployment: `dpl_7oUgUQHV6gv5nQ2c234bxcosD8WR`.
- Release source: `82cef23` (runtime source tag supplied at build time).
- CLI deployment completed in 37 seconds; remote build completed in 8 seconds.
- Production URL inspected as READY and aliased to the primary URL above.
- Hosted boot, actual keyboard movement, Save, desktop/landscape screenshots:
  passed, zero browser/HTTP errors.
- Connected-mode source/protocol reads against real Bradbury RPC passed using
  a read-only account-provider stub; no signatures or transactions were made.
  This is not proof of live AI-review completion. GenLayer remains testnet beta.
- The bounded runtime-log query was unsupported by this installed CLI's default
  follow mode; no platform-log scan or monitoring/drain setup is claimed.
- `.vercelignore` excludes local environments, artifacts, tools, tests and wallet
  material. No secrets were exported or requested. `.vercel` stays Git-ignored.

The prior ChatGPT-hosted deployment is unchanged. Browser saves are origin-bound;
saved practice progress on that hostname does not automatically move to Vercel.
No hackathon entry was submitted.

Future releases: use the linked project from this directory, inspect its owner
and ID, then `vercel deploy --prod --scope leokings588-5902s-projects` with the
public `BUILD_SOURCE_COMMIT` build variable set to the intended source commit.
The Vite build uses that variable because uploaded source does not contain `.git`.
