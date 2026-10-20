# 04: Owner setup wizard

**What to build:** An interactive bash wizard that walks the project owner through the account setup, in the spec's order:

1. OpenAI spend limit and key
2. GitHub auto-delete head branches
3. Neon account and project
4. Vercel import
5. Neon-Managed integration
6. Vercel env vars
7. Clerk production and its DNS at GoDaddy
8. Vercel domains and DNS
9. First deploys

It runs only from the spec, so the owner can start it while tickets 01–03 are built; Clerk DNS can take up to 48 hours. Make it with the `wizard` skill. Spec: "Owner setup wizard", "Domain, DNS and Clerk production", "Neon and the integration", "Env var matrix".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The 9 steps run in the spec's order, each with exact dashboard locations and values (region `aws-ap-southeast-1`, Production and Preview only for the Neon integration, `pk_test_` in Preview and `pk_live_` in Production, the apex `magkano.online` canonical with a `www` redirect).
- [ ] It pauses for the owner at every step and can be resumed from a given step.
- [ ] It checks what it can from the terminal: DNS records with `dig`, live URLs with `curl`, and Vercel env scoping with the `vercel` CLI when it's installed (it confirms Preview has no `DATABASE_URL*` of its own).
- [ ] It never writes, echoes or stores a secret.
- [ ] The step 7 / step 6 dependency is handled: the `pk_live_` key is set after the Clerk production instance exists.
- [ ] It passes `bash -n` and shellcheck, if shellcheck is available.
