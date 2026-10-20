# Research: Clerk production on `magkano.online`, dev keys on previews

Ticket: [03-clerk-production-on-magkano-online](../issues/03-clerk-production-on-magkano-online.md). Sources were read on 2026-10-21 from the docs' Markdown endpoints (append `.md` to a Clerk or Vercel docs URL).

## Short answer

- **Production** needs a Clerk production instance whose domain is `magkano.online`. The owner adds the CNAME records that the Clerk Dashboard's **Domains** page lists, then selects **Deploy certificates**. The main record is `clerk.magkano.online` (the Frontend API). Clerk production cannot run on `*.vercel.app`.
- **Previews** use the Clerk development instance on their `*.vercel.app` URLs. This is the setup Clerk calls the "Easiest" option. It works with no domain setup. The main limit is 100 users per development instance, shared with local dev.
- **Keys**: the SPA needs only `VITE_CLERK_PUBLISHABLE_KEY`. Set the `pk_live_` key in Vercel **Production** and the `pk_test_` key in Vercel **Preview** (and in local `.env`). Vite inlines the value at build time, so a change needs a redeploy. No secret key is needed in v1.
- **Social providers**: in development, Clerk supplies shared OAuth credentials. In production, each social provider needs the owner's own OAuth app (for example a Google Cloud OAuth client). Email-based sign-in needs nothing extra.
- **Vercel apex plus `www`**: no conflict. Vercel uses an A record on the apex and a CNAME on `www`, while Clerk's records sit on other subdomains (`clerk.`, `accounts.`, `clkmail.`, DKIM). Two things to watch: no CAA records on the apex, and no wildcard `*.magkano.online` on Vercel.

## 1. Domain requirements for production

**What Clerk requires**
- "You will need to have a domain you own" and "You will need to be able to add DNS records on your domain." ([Clerk: Deploy to production][prod])
- "You will also need a domain that you own, as you cannot use a `*.vercel.app` domain for production." ([Clerk: Deploy to Vercel][vercel]) "It is currently not possible to use Clerk production API keys with your host's provided preview domain." ([Clerk: Managing environments][envs]) This rules out `*.vercel.app` for production.

**Apex or subdomain**
- Clerk's production domain is a root domain, and "When you set a root domain for your production deployment, Clerk's authentication will work across all subdomains. User sessions will also be shared across the subdomains." ([prod])
- Example given there: an app on `example-site.com` with a dashboard on `dashboard.example-site.com`. Passkeys work only in this apex-plus-subdomain scenario: "If you're using passkeys, only the first scenario in the above example will work due to restrictions in the WebAuthn standard." ([prod])
- For an app on a subdomain, the change-domain guide offers two modes. **Primary application** keeps Clerk on the root (`clerk.example.com`). **Secondary application** scopes Clerk to the subdomain (`clerk.app.example.com`). ([Clerk: Change domain][changedomain])
- For magkano, set the Clerk production domain to the apex `magkano.online`. Do this whichever of apex or `www` Vercel treats as canonical.

**DNS records**
- "Clerk uses DNS records to provide session management and emails verified from your domain. To see what DNS records you need, navigate to the Domains page in the Clerk Dashboard." Records "can take up to 48hrs" to propagate. ([prod]) The docs list no record table, so the Dashboard is the source of truth.
- Records the docs do name:
  - **Frontend API**: "in production, FAPI is hosted on a subdomain of your application (e.g., `clerk.example.com`) via a CNAME record". This keeps the app and FAPI on the same site, which is what lets the `__client` cookie be same-site. ([envs]) For magkano this is `clerk.magkano.online`.
  - **Account Portal**: "In production, your Account Portal is usually hosted on a subdomain of your main domain (e.g., accounts.your-domain.com)". ([Clerk: Sign-up and sign-in options][passkeys])
  - **Email (SPF/DKIM)**: "During production instance set up, Clerk will have you set up the required records to configure SPF and DKIM". ([Clerk: Email deliverability][email]) The Apple guide shows the mail subdomain as `clkmail.myapp.com`. ([Clerk: Apple][apple])
- Not verified in docs: the DKIM record names. From past Dashboard setups, Clerk asks for five CNAMEs: `clerk`, `accounts`, `clkmail`, `clk._domainkey` and `clk2._domainkey`. Copy whatever the Dashboard shows.
- DMARC is the owner's job: "Clerk sets up SPF and DKIM, but DMARC is your responsibility." Without it, Gmail can reject verification emails. ([Clerk: Domain warm-up][warmup]) Add a `_dmarc` TXT record. The deliverability guide gives an example policy. ([email])
- If the domain's DNS is on Cloudflare, set the Clerk subdomains to "DNS only". A proxied record fails Clerk's CNAME check. ([prod], Troubleshooting)
- "If you're unable to add a CNAME record for the Frontend API, you can use a proxy instead." ([prod]; [Clerk: Proxy FAPI][proxy]) Magkano doesn't need the proxy.
- Finish: "Once you have completed all of the necessary steps, a **Deploy certificates** button will appear." ([prod])

## 2. Development instance on Vercel preview URLs

- Clerk names this the "**Easiest**" option: "Use your host's provided preview domain, like \*.vercel.app or \*.netlify.app, with development API keys from Clerk." ([envs])
- Clerk's Vercel guide uses the same split: production on production keys, and "preview and development Vercel deployments use your development Clerk API keys." ([vercel])
- Limits that matter here ([envs]):
  - "Development instances are capped at 100 users, and user data can not be transferred between instances." Local dev and every preview share this one pool. Fine for testing, but users made on a preview will not exist in production.
  - Sessions work differently in development. FAPI lives on `<slug>.accounts.dev`, which is cross-site from the app, so Clerk passes the dev token through the `__clerk_db_jwt` query string rather than a cookie. This works on any origin, `*.vercel.app` included. It is "not secure enough for production use", which is fine for previews.
  - Hosted pages and OAuth consent screens show an `accounts.dev` domain, and email and SMS templates carry an environment prefix. These are cosmetic for previews.
  - "All paid functionality is available in a Development instance. However, when you deploy your application to Production, you will be asked to upgrade to a Pro account if you are using paid features." ([envs]) Keep production on free-plan features, or budget for Pro.
- Alternatives exist: previews on a custom suffix that share production users, or a second root domain. Both need Vercel's **Preview Deployment Suffix**, which is "available on Enterprise and Pro plans". ([envs]; [Vercel: Generated URLs][genurls]) Neither is needed here.

## 3. Keys the SPA needs, scoped per Vercel environment

- Clerk has a publishable key and a secret key. The publishable key is "Formatted as `pk_test_` in development and `pk_live_` in production. This is passed to the `<ClerkProvider>`." The secret key (`sk_…`) is "used to access Clerk's Backend API". ([prod])
- v1 has Clerk only in the SPA (`apps/web/src/main.tsx` passes `VITE_CLERK_PUBLISHABLE_KEY` to `<ClerkProvider>`), and `apps/api` has no Clerk code. **So only the publishable key is needed, and no `CLERK_SECRET_KEY`.**
- The publishable key encodes the FAPI host: "it consists of your FAPI URL encoded in base64, prefixed with an environment identifier". ([Clerk: How Clerk works][how]) So the `pk_live_` key is bound to `clerk.magkano.online` and will not work on `*.vercel.app`. This is the mechanism behind section 2.
- Vercel scoping: "For each Environment Variable, you can select one or more Environments". **Production** applies to production deployments, and **Preview** to "deployments from any Git branch that does not match the Production Branch". ([Vercel: Environment variables][vercelenv])
- Redeploys: "Any change you make to environment variables are not applied to previous deployments, they only apply to new deployments." ([vercelenv]) On top of that, Vite statically replaces `import.meta.env.VITE_*` "at build time" ([Vite: Env variables][vite]). A key change therefore needs a new build, and a plain redeploy of the same build artifact will not pick it up.
- The publishable key is public by design (Vite warns that `VITE_*` values ship in the bundle ([vite])). Mark it a Vercel **Config** variable rather than a **Secret** ([vercelenv]), so it stays readable.

**Recommendation**

| Where | `VITE_CLERK_PUBLISHABLE_KEY` |
| --- | --- |
| Vercel Production | `pk_live_…` (production instance, `magkano.online`) |
| Vercel Preview (all branches) | `pk_test_…` (development instance) |
| Local `.env` | `pk_test_…` (same development instance) |

## 4. Settings that differ between dev and production

- **Social / OAuth**: "In development, for most social providers, Clerk provides you with a set of shared OAuth credentials. In production, these are not secure and you will need to provide your own." ([prod]) For Google: "For production instances, you must provide custom credentials." The steps are:
  - Create a Google Cloud OAuth client.
  - Add **Authorized JavaScript origins** `https://magkano.online` and `https://www.magkano.online`.
  - Paste Clerk's **Authorized Redirect URI** (copied from the Dashboard's **SSO connections** page) into Google's **Authorized Redirect URIs**.
  - Paste the client ID and secret back into Clerk.

  ([Clerk: Google][google]) A provider that is enabled in production without its own credentials blocks sign-up and sign-in with that provider.
- **What doesn't carry over**: when you create the production instance you can clone the development settings, but "SSO connections, Integrations, and Paths settings do not copy over." ([prod]) So social connections must be set up again in production anyway. Magkano uses `<SignInButton mode="modal">` and `<SignUpButton mode="modal">` (`apps/web/src/Layout.tsx`), so it has no custom sign-in paths to re-enter.
- **Not relevant to v1**: webhooks (none), `authorizedParties` (backend-only, and there is no backend Clerk), and CSP (magkano sets none). If a CSP is added later, `script-src` and `connect-src` must include `https://clerk.magkano.online` plus Clerk's other hosts. ([prod]; [Clerk: CSP][csp])
- **Subdomain allowlist**: FAPI "accepts cross-origin requests from **any** subdomain of your configured root domain", and Clerk "strongly recommended" an allowlist. ([prod]; [Clerk: Subdomain allowlist][allowlist]) Enable **Allowed Subdomains** and list only `www.magkano.online`. "Your primary domain is always allowed." ([allowlist])
- **Email deliverability**: on a new domain, production verification emails depend on the SPF and DKIM CNAMEs being verified, plus DMARC. ([email]; [warmup])

## 5. Vercel apex plus `www` versus Clerk's DNS records

- **Vercel**: "If you're using an Apex domain (e.g. example.com), you will need to configure it with an A record". The value is usually `76.76.21.21`, but "use whatever [the project's domain card] displays". A subdomain such as `www` uses a CNAME. ([Vercel: Add a domain][addomain]; [Vercel KB: A records and CAA][caa]) Redirects between apex and `www` are set under Project Settings → Domains → **Redirect to**. ([Vercel: Redirecting domains][redirect])
- **Clerk** uses CNAMEs on `clerk`, `accounts`, `clkmail` and the DKIM labels. None of these is the apex or `www`, so the hostnames don't overlap. Vercel's only conflict rule is per hostname: "Do not add both an A and a CNAME record for the same hostname." ([Vercel: Managing DNS records][dns])
- **Where to add the records**:
  - If the domain uses Vercel nameservers, add the Clerk CNAMEs in Vercel DNS. "You can point a subdomain to a service hosted elsewhere by adding the DNS records that service provides. You do not need to add the subdomain to a Vercel project." ([dns])
  - Otherwise, add them at the current DNS provider, alongside the Vercel A and `www` CNAME records.
- **Watch: no wildcard domain on Vercel.** Adding `*.magkano.online` to the project would switch to Vercel nameservers and route unknown subdomains to Vercel. ([addomain]) It isn't needed, so don't add it.
- **Watch: CAA.**
  - Vercel needs Let's Encrypt allowed. ([caa])
  - Clerk issues through Let's Encrypt or Google Trust Services and says the primary domain should have no CAA records that block either. Its check is `dig magkano.online +short CAA`, which should return nothing. ([prod], "Deployment stuck in certificate issuance")
  - Recommendation: no CAA records. If the owner wants CAA, it must allow both `letsencrypt.org` and `pki.goog`.
- **Apex or `www` as canonical**:
  - Vercel recommends `www` as primary, with the apex redirecting to it. ([redirect])
  - The ticket says apex plus a `www` redirect. Either way works for Clerk: its domain stays `magkano.online`, so sessions cover both.
  - Choosing `www` as canonical would change only the Google OAuth origins (list both anyway) and the subdomain allowlist (the apex is always allowed, so list `www`).

## Recommendations for this repo

1. Make no code changes for Clerk. `main.tsx` already reads one `VITE_CLERK_PUBLISHABLE_KEY` and fails fast without it. Keep the secret key out of v1.1.
2. Env vars in Vercel: `pk_live_` in Production and `pk_test_` in Preview, both as Config variables. Local `.env` stays `pk_test_`. Say in the v1.1 spec that a key change needs a fresh build.
3. The wizard ticket's Clerk steps:
   1. Create the production instance by cloning dev.
   2. Set its domain to `magkano.online`.
   3. Copy every record from Dashboard → Domains into the DNS host.
   4. Add a `_dmarc` TXT record.
   5. Check `dig magkano.online +short CAA` returns nothing.
   6. Wait for verification, then select **Deploy certificates**.
   7. Set up custom OAuth credentials for each social provider enabled in dev.
   8. Enable Allowed Subdomains with only `www.magkano.online`.
   9. Copy `pk_live_` into Vercel Production.

   The wizard should verify DNS with `dig CNAME clerk.magkano.online` and the same for the other records.
4. Ordering: the Clerk certificates can take time (DNS "up to 48hrs"). Production's first deploy must not hard-depend on Clerk being live. Note it in the spec as a known wait.
5. Don't add a wildcard domain or CAA records. Don't put the Clerk subdomains behind any CDN proxy.

## Open decisions this raises

- **Which sign-in methods production enables.** Email only needs no extra setup. Google (or any social provider) adds a Google Cloud OAuth client to the wizard. Check what the dev instance has on today and decide whether production mirrors it.
- **Canonical host**: apex `magkano.online` with `www` redirecting (the ticket's assumption), or Vercel's recommended `www` primary. It doesn't matter to Clerk, but the spec should fix it.
- **DNS host**: Vercel nameservers or the registrar's DNS. This decides where the wizard tells the owner to add the A, CNAME, Clerk and DMARC records.
- **Paid Clerk features**: confirm the dev instance uses none, or production setup will ask for Pro.

## Sources

[prod]: https://clerk.com/docs/guides/development/deployment/production
[vercel]: https://clerk.com/docs/guides/development/deployment/vercel
[envs]: https://clerk.com/docs/guides/development/managing-environments
[changedomain]: https://clerk.com/docs/guides/development/deployment/changing-domains
[passkeys]: https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#domain-restrictions-for-passkeys
[email]: https://clerk.com/docs/guides/development/troubleshooting/email-deliverability
[warmup]: https://clerk.com/docs/guides/development/troubleshooting/email-domain-name-warmup
[apple]: https://clerk.com/docs/guides/configure/auth-strategies/social-connections/apple#configure-email-source-for-apple-private-relay
[proxy]: https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi
[how]: https://clerk.com/docs/guides/how-clerk-works/overview#the-frontend-api
[google]: https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google
[csp]: https://clerk.com/docs/guides/secure/best-practices/csp-headers
[allowlist]: https://clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist
[vercelenv]: https://vercel.com/docs/environment-variables
[genurls]: https://vercel.com/docs/deployments/generated-urls#preview-deployment-suffix
[addomain]: https://vercel.com/docs/domains/working-with-domains/add-a-domain
[redirect]: https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting
[dns]: https://vercel.com/docs/domains/managing-dns-records
[caa]: https://vercel.com/kb/guide/a-record-and-caa-with-vercel
[vite]: https://vite.dev/guide/env-and-mode

- Clerk: [Deploy to production][prod], [Deploy to Vercel][vercel], [Managing environments][envs], [Change domain][changedomain], [Sign-up and sign-in options (passkeys)][passkeys], [Email deliverability][email], [Domain warm-up][warmup], [Apple social connection][apple], [Proxy FAPI][proxy], [How Clerk works][how], [Google social connection][google], [CSP headers][csp], [Subdomain allowlist][allowlist]
- Vercel: [Environment variables][vercelenv], [Generated URLs / Preview Deployment Suffix][genurls], [Add a domain][addomain], [Deploying and redirecting][redirect], [Managing DNS records][dns], [KB: A records and CAA][caa]
- Vite: [Env variables and modes][vite]
