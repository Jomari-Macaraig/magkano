# 05: First deploy and acceptance checks

**What to build:** Magkano runs online. A test pull request gets a working preview with its own Neon branch, and `https://magkano.online` serves production. The spec's eight acceptance checks are run and the results recorded here. A spec fallback is applied only when a check fails. Spec: "Testing Decisions → Acceptance checks", plus the fallbacks in "Function build and layout", "`vercel.json`" and "Database client and URLs".

**Blocked by:** 03 (Vercel project config), 04 (Owner setup wizard), and the owner having run the wizard.

**Status:** ready-for-human

- [ ] The preview build log shows lint, typecheck, test, migrate and seed (`env=preview`, a `preview/...` host) and the web build all passing.
- [ ] Preview: `/api/health` and `/api/recipes/<id>` answer correctly, a deep link and a refresh load the Recipe page, and `/api/nope` returns the JSON `not_found` error.
- [ ] Preview: search for "manok" returns results without the "basic search" note, pricing a Draft works, and dev-instance sign-in works.
- [ ] A second push to the PR reuses its Neon branch, and after the merge and branch deletion the next preview deploy removes that branch.
- [ ] Production: the site loads, `www.` and `http://` redirect, migrate and seed log `env=production` with Neon `main`'s host, email sign-up and sign-in work with `pk_live_`, and search and pricing work.
- [ ] Any fallback applied is described here and in the deployment doc.
