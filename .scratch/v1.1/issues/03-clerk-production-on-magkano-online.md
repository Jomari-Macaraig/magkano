# Research Clerk production on magkano.online with dev keys on previews

Type: research
Status: open
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
