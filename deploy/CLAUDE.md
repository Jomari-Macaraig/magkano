# deploy

## Owner setup wizard: `deploy/setup.sh`

An interactive bash wizard that walks the project owner through the one-time account setup for `magkano.online`. The owner does every step in a browser; the wizard says exactly where to click and what to set, pauses after each step and checks what it can from the terminal. The source of truth for the steps is `.scratch/v1.1/spec.md`, "Owner setup wizard".

### Running and resuming

- `deploy/setup.sh`: all nine steps, from step 1.
- `deploy/setup.sh --from 7`: resume at step 7 (steps are numbered as below, also when resuming). Ctrl-C or `q` at a failed check prints the resume command.
- `deploy/setup.sh --list` prints the steps; `--help` prints usage.
- `DNS_SERVER=1.1.1.1 deploy/setup.sh ...` sends the `dig` checks to that resolver.
- It `cd`s to the repo root itself, so it runs from any directory.

### Steps (the spec's order)

1. OpenAI: project `magkano`, a monthly budget, a project API key (straight into a password manager).
2. GitHub: Settings → General → "Automatically delete head branches".
3. Neon: own account, Free plan, project `magkano`, Postgres 17, `aws-ap-southeast-1`.
4. Vercel: import the repo on Hobby, Vite preset, root directory = repo root; the first deploy may fail. Offers `vercel link` so later checks can run.
5. Neon-Managed integration: Production and Preview only (not Development), automatic branch cleanup on.
6. Vercel env vars: `OPENAI_API_KEY` in Production and Preview, `VITE_CLERK_PUBLISHABLE_KEY` = `pk_test_` in Preview only. The Production `pk_live_` key is explicitly deferred.
7. Clerk production (email only, domain `magkano.online`, Allowed Subdomains `www.magkano.online`), its CNAMEs (`clerk.`, `accounts.`, `clkmail.`, DKIM) and a recommended `_dmarc` TXT at GoDaddy, Deploy certificates. Ends by setting `pk_live_` in Production, which finishes step 6. Clerk DNS can take up to 48 hours, so this comes before the Vercel domain.
8. Vercel domains: apex `magkano.online` canonical, `www` redirecting to it; at GoDaddy, Vercel's apex A and `www` CNAME replace the parked records, and forwarding is turned off.
9. First deploys: redeploy production from `main`, a test PR's preview, then the spec's acceptance checks on the preview and on production.

### What it checks

| Tool | Checks |
|---|---|
| `gh` | the repo has `deleteBranchOnMerge` on (step 2) |
| `vercel` (only when the checkout is linked: `.vercel/project.json`) | Production has `DATABASE_URL` and `DATABASE_URL_UNPOOLED`; Preview and Development have no `DATABASE_URL*` of their own (step 5); the env var names from steps 6 and 7 exist in the right environments |
| `dig` | Clerk CNAMEs point at `clerk.services`, no CAA on the apex (step 7); the apex A matches the IP Vercel shows and `www` CNAMEs to `vercel-dns` (step 8) |
| `curl` | `www.` and `http://` redirect to `https://magkano.online` (steps 8 and 9); on a deployment: `/api/health` returns `{"status":"ok"}`, `/api/recipes/sinigang-na-baboy` returns that Recipe, `/api/nope` returns the JSON `not_found`, and the deep link `/recipes/sinigang-na-baboy` serves HTML (step 9) |

- A missing tool skips its checks with a warning; they're listed at the end under "still to do by hand".
- A failed check offers retry, continue (also listed at the end) or quit (prints `--from N`).
- A `vercel env ls` that errors (logged out, expired) fails the check, never passes it with an empty list. The apex A check needs the IP Vercel shows; without one it's listed for checking by hand.
- `vercel env ls` shows names only; the wizard keeps only the name column. It can't see whether a key is `pk_test_` or `pk_live_`, so the owner checks that by eye.
- Vercel's Deployment Protection can make preview URLs answer 401 to `curl`; the owner then checks in a logged-in browser and continues.

### No-secrets rule

The wizard never reads, prints, writes or stores a secret. It never asks for a key: the owner pastes keys only into the dashboards (and a password manager). The only values it reads are public (the apex IP Vercel shows, a preview URL), and it never reads `.env`. The shared wizard library above the `STAGES` marker is kept verbatim, but its secret helpers (`ask`, `ask_secret`, `write_env`, `set_secret`, `set_var`) are overridden below the marker to exit with an error, so a later edit can't start capturing one.

### Editing it

- Everything above the `STAGES` marker is the wizard library from the `wizard` skill: don't hand-edit it. Steps are the `step_N` functions; check targets are small functions passed to `check`.
- Must pass `bash -n deploy/setup.sh` and `shellcheck deploy/setup.sh`. `deploy/.shellcheckrc` disables SC2329 (check functions are passed by name; the library keeps unused helpers) and SC1087 (a false positive in the library). If shellcheck isn't installed: `docker run --rm -v "$PWD/deploy:/mnt:ro" -w /mnt koalaman/shellcheck:stable setup.sh`.
- It runs on macOS's bash 3.2: no `mapfile`, associative arrays or `${var,,}`, and no `"${arr[@]}"` on an array that may be empty under `set -u`.
