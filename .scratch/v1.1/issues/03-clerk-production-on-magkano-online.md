# Research Clerk production on magkano.online with dev keys on previews

Type: research
Status: resolved
Blocked by: none

## Question

What does it take to run a Clerk production instance on `magkano.online` while preview deployments use the Clerk development instance?

Covers:
- Domain requirements for production (apex versus subdomain, required DNS records such as the Frontend API CNAME, and whether `*.vercel.app` is ruled out).
- Whether a development instance works on Vercel preview URLs (`*.vercel.app`) and any limits that matter here.
- Which keys the SPA needs (publishable key only, since Clerk is frontend-only in v1) and how they are scoped per Vercel environment.
- Social providers or other settings that differ between dev and production instances and would affect sign-up or sign-in.
- Whether `magkano.online` on Vercel (apex plus `www` redirect) conflicts with Clerk's DNS records.

Cite primary sources (Clerk docs, Vercel domain docs).

## Answer

Resolved by research, 2026-10-21. Full findings with citations: branch `research/clerk-production-domain`, file `.scratch/v1.1/research/03-clerk-production-on-magkano-online.md`.

- Clerk production can't use `*.vercel.app`. Set the domain to `magkano.online` and add the Dashboard's CNAMEs (`clerk.`, `accounts.`, `clkmail.`, plus DKIM records copied from the Dashboard), then deploy certificates. DNS may take up to 48 hours.
- Previews use the dev instance on `*.vercel.app` (Clerk's "easiest" option). Its limit is 100 users, shared with local dev.
- Only `VITE_CLERK_PUBLISHABLE_KEY` is needed: `pk_live_` in Production, `pk_test_` in Preview and local. It's baked in at build time. No code changes.
- Social providers in production need the owner's own OAuth apps (SSO settings don't copy). Allowed Subdomains: `www.magkano.online`.
- No DNS conflict with Vercel (A record on the apex, CNAME on `www`). Avoid CAA records, a `*` wildcard and proxied Clerk subdomains.
- Open: production sign-in methods; apex or `www` canonical; DNS at Vercel or the registrar; whether any paid Clerk features are in use.
