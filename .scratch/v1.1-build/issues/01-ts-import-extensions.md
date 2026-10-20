# 01: `.ts` import extensions in the API

**What to build:** Every relative import in the API workspace (source, scripts, tests and its config files) ends in `.ts`, so the API code can run under Vercel's classic Node builder, which compiles each file separately and doesn't bundle. A lint rule stops new extensionless imports. Nothing in the app behaves differently. This is the prefactor the other build tickets rely on. Spec: "Function build and layout".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The shared TypeScript config allows `.ts` import extensions.
- [ ] Biome's `useImportExtensions` rule is on as an error.
- [ ] All relative imports in the API workspace (141 today) have `.ts`. Biome's autofix can do the bulk of the rewrite.
- [ ] The web app's own imports are unchanged, and its type-only import of the API still typechecks.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass, and `pnpm dev` and `pnpm seed` still work locally.
