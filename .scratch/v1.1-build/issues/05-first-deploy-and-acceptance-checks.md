# 05: First deploy and acceptance checks

**What to build:** Magkano runs online. A test pull request gets a working preview with its own Neon branch, and `https://magkano.online` serves production. The spec's eight acceptance checks are run and the results recorded here. A spec fallback is applied only when a check fails. Spec: "Testing Decisions → Acceptance checks", plus the fallbacks in "Function build and layout", "`vercel.json`" and "Database client and URLs".

**Blocked by:** 03 (Vercel project config), 04 (Owner setup wizard), and the owner having run the wizard.

**Status:** ready-for-human

- [x] The preview build log shows lint, typecheck, test, migrate and seed (`env=preview`, a `preview/...` host) and the web build all passing.
- [x] Preview: `/api/health` and `/api/recipes/<id>` answer correctly, a deep link and a refresh load the Recipe page, and `/api/nope` returns the JSON `not_found` error.
- [x] Preview: search for "manok" returns results without the "basic search" note, pricing a Draft works, and dev-instance sign-in works.
- [ ] A second push to the PR reuses its Neon branch, and after the merge and branch deletion the next preview deploy removes that branch.
- [ ] Production: the site loads, `www.` and `http://` redirect, migrate and seed log `env=production` with Neon `main`'s host, email sign-up and sign-in work with `pk_live_`, and search and pricing work.
- [ ] Any fallback applied is described here and in the deployment doc.

## Results

### Preview (PR #11, `plan/v1.1` at `5a725f9`, https://magkano-24uo3qvop-jomari1.vercel.app)

- **Build log:** lint (99 files), typecheck, 237 tests, `migrate: env=preview host=ep-dry-star-aoila7u2.c-2.ap-southeast-1.aws.neon.tech`, `seed:` on the same host (174 Tags, 20 Recipes, 177 Ingredients, 40 Recipe chunks, 0 newly embedded), web build: all passed. Node 22.x from `engines` (overrides the project's 24.x). The owner confirmed in the Neon Console that the host is the `preview/plan/v1.1` branch.
- **API:** `/api/health` → `{"status":"ok"}`; `/api/recipes/sinigang-na-baboy` → the Recipe (Hono sees the original path; the classic builder runs the `.ts` imports); `/api/nope` → 404 JSON `not_found`. `x-vercel-id: sin1::sin1`.
- **Deep link:** `/recipes/sinigang-na-baboy` serves the SPA HTML; the owner checked it and a refresh in the browser.
- **Search and pricing:** "manok" → 5 results, `fallback: false`; `POST /api/price` for Sinigang ×4 → ₱386.69. Dev-instance sign-in works (owner, in the browser).
- **No fallbacks applied.**

### Problems found on the way (fixed)

- The first preview failed at `pnpm lint`: Vercel's build tree has `.pnpm-store/` and a minified `vercel.json`. `biome.json` now excludes both (and `.vercel`).
- A preview was blocked with `COMMIT_AUTHOR_REQUIRED`: the commit author email wasn't linked to the Vercel account (Hobby). New commits use the account's email.
- Redeploying `main` before the merge fails (`vite: command not found`): `main` has no `vercel.json` yet. The wizard's step 9 now runs the preview first.

### Follow-up

- The first search on a cold Function fell back to text search (`embedding failed … timed out after 3000 ms`); later searches used embeddings. Designed v1 behaviour, but first visitors after an idle spell can see "Basic search" once. Consider a longer timeout for a cold Function's first OpenAI call.
