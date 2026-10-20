# apps/web

Vite + React + TypeScript SPA with React Router and Clerk. Mobile-first, English UI.

## Run

- `pnpm --filter @magkano/web dev` (port 5173). Reads env from the **root** `.env` (`envDir: "../.."`).
- Vite proxies `/api` to `http://localhost:$API_PORT` (default 8787), so the browser only talks to one origin.
- Tests: `pnpm vitest run --project web` (`src/**/*.test.ts`).

## Key files

- `src/main.tsx`: wraps the app in `<ClerkProvider>` and the router. Throws on start if `VITE_CLERK_PUBLISHABLE_KEY` is unset.
- `src/Layout.tsx`: the header (app name; Clerk `<SignInButton>` / `<SignUpButton>` when signed out, `<UserButton>` with sign out when signed in) and an `<Outlet />`. Uses Clerk 6's `<Show when="signed-in" | "signed-out">`. Nothing is gated behind an account.
- `src/HomePage.tsx` (`/`): every Recipe card (name, description, servings) from `GET /api/recipes`, each linking to its Recipe page.
- `src/RecipePage.tsx` (`/recipes/:id`): the Recipe's Ingredients, rescaled on the client by a 1–20 servings stepper that starts at the Recipe's servings. Prep notes, an "optional" badge, and a "to taste" note in place of the amount. No prices. An unknown id shows "There's no such recipe."
- `src/amount.ts`: `scaleQuantity`, `formatQuantity` (kitchen fractions like "2½", else a 2-decimal number), `formatAmount` (unit plurals), `ingredientLine` (one row: amount + note). Tested in `amount.test.ts`.
- `src/Stepper.tsx`: the − n + servings control (1–20).
- `src/useApi.ts`: `useApi(key, request)` → `loading | error (status) | ready (data)`.
- `src/api.ts`: `api = hc<AppType>("/").api`, the typed Hono RPC client. `@magkano/api` is a dev dependency used for types only.
- `src/styles.css`: colour tokens on `:root` with a dark-mode variant.

## Env

- `VITE_CLERK_PUBLISHABLE_KEY` (required; the app refuses to start without it).
- `API_PORT` (optional, default 8787): where the dev proxy sends `/api`.
