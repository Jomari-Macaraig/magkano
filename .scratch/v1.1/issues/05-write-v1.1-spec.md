# Write the v1.1 spec

Type: task
Status: resolved
Blocked by: 04

## Question

Write `.scratch/v1.1/spec.md` from the map and the resolved tickets, ready for `/to-tickets`: user stories, the deployment decisions, the env var matrix, the build order, testing (how a preview and production are checked), and the split between agent build work (about 1 hour) and the human `wizard` setup. Confirm any small gaps with the owner.

## Answer

Resolved 2026-10-21: [spec.md](../spec.md) is written and marked `ready-for-agent`, so it's ready for `/to-tickets`. It contains:
- 18 user stories;
- the deployment decisions from tickets 01–04, plus `vercel.json` in full;
- the env var matrix;
- the 9-step `deploy/setup.sh` wizard;
- 8 acceptance checks, each with its fallback;
- a 5-step build order (steps 1–4 are about 1 hour of agent work; step 5 waits on the owner's setup).

The owner settled three small gaps while it was written:
- **Embeddings in the build**: `seed` still embeds missing Recipe chunks on Vercel, and also warns that the vectors are discarded with the build, so the owner should commit `embeddings.json` after a local `pnpm seed`.
- **Location**: the wizard and deployment docs live in `deploy/` (`deploy/setup.sh`, `deploy/CLAUDE.md`).
- **Clerk key check**: `vite build` fails when `VITE_CLERK_PUBLISHABLE_KEY` is unset, instead of shipping a blank page.

Smaller calls made in the spec:
- a root `tsconfig.json` so that `typecheck` covers `api/`;
- a pure DB URL helper shared by `drizzle.config.ts` and `seed` (it logs the host only, never the password);
- `drizzle.config.ts` throws instead of falling back to `""`.
