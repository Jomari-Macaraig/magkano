# Decide the deployment shape for this codebase

Type: grilling
Status: open
Blocked by: 01, 02, 03

## Question

Given the research, how exactly does this codebase change to deploy? Each decision should be precise enough for the spec.

Covers:
- The Vercel Function entry and how it shares `createApp` wiring with the local `server.ts`.
- The DB client for Functions (driver, pool, connection URL per use: Function, migrate, seed).
- The build command, step by step, and the `vercel.json` settings.
- The env var matrix (local, preview, production), including `OPENAI_API_KEY` at runtime and in the build.
- Domain setup: `magkano.online` apex or `www`, the redirect, and the Clerk DNS records.
- Whether local dev changes at all (see the map's Not yet specified).
- What the human `wizard` ticket walks through, in order.
