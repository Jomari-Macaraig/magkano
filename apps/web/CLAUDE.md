# apps/web

Vite + React + TypeScript SPA with React Router and Clerk. Mobile-first, English UI.

## Run

- `pnpm --filter @magkano/web dev` (port 5173). Reads env from the **root** `.env` (`envDir: "../.."`).
- Vite proxies `/api` to `http://localhost:$API_PORT` (default 8787), so the browser only talks to one origin.
- Tests: `pnpm vitest run --project web` (`src/**/*.test.ts`).

## Key files

- `src/main.tsx`: wraps the app in `<ClerkProvider>`, `<DraftProvider>` and the router. Throws on start if `VITE_CLERK_PUBLISHABLE_KEY` is unset.
- `src/Layout.tsx`: the header (app name; Clerk `<SignInButton>` / `<SignUpButton>` when signed out, `<UserButton>` with sign out when signed in) and an `<Outlet />`, plus the sticky "View Grocery List" button on every screen but the list. Uses Clerk 6's `<Show when="signed-in" | "signed-out">`. Nothing is gated behind an account.
- `src/HomePage.tsx` (`/`): a search box over the Recipe cards (name, description, servings), each linking to its Recipe page, with "+ Add" (then "✓ on list" and a servings stepper). With a query it shows the results of `GET /api/search`, plus a "Basic search" note when the response has `fallback: true`. With an empty box it shows every card from `GET /api/recipes`.
- `src/RecipeSearch.tsx`: `useRecipeSearch(query)` (300 ms debounce; `idle` for an empty box; earlier results stay up while the next search loads; replies to old queries are dropped) and `<SearchBox>`.
- `src/RecipePage.tsx` (`/recipes/:id`): the Recipe's Ingredients, rescaled on the client by a 1–20 servings stepper that starts at the Recipe's servings. Prep notes, an "optional" badge, and a "to taste" note in place of the amount. "Add to list" adds it at the chosen servings, or updates them when it is already on the list. No prices. An unknown id shows "There's no such recipe."
- `src/amount.ts`: `scaleQuantity`, `formatQuantity` (kitchen fractions like "2½", else a 2-decimal number), `formatAmount` (unit plurals), `ingredientLine` (one row: amount + note). Tested in `amount.test.ts`.
- `src/ListPage.tsx` (`/list`): the Grocery List. Total card with coverage bar and counts, "Recipes on this list" (stepper, Remove), To buy / Needs price / Have it filters, line rows (Have It box, need → buy, source Recipes, source badge, "estimate" and "your price" badges, inline ₱ field on "Needs price" rows, "Optional · not in total" with "+ Add"). Each row's name and › open its line page. An empty Draft prompts back to search.
- `src/LinePage.tsx` (`/list/:lineKey`, `linePath(key)` URL-encodes the key): one line, read from the `pricing` the list already holds (no extra API call). Per-Recipe parts, total needed, "You'll buy" and line cost with a "your price" badge; the include toggle (optional lines) and "I already have this"; the "Your pick is no longer available" note (`pickUnavailable`) and the Rough Estimate explanation; "Pick a price" (radio per match, cheapest first, "cheapest" and "estimate" pills, unpriced matches disabled); "Or enter your own price" with Clear. An empty Draft or unknown key goes back to `/list`. The sticky "View Grocery List" bar stays hidden here too.
- `src/DraftProvider.tsx`: `useDraft()` → `{ draft, update, pricing, stale, failed }`. Saves every change, re-prices with `POST /api/price` after 300 ms (older answers are ignored), then prunes the Draft and toasts dropped Recipes. Independent of sign-in.
- `src/DraftControls.tsx`: `AddToDraft` (card control), `DraftRecipeRow`, `ViewListButton`.
- `src/draft.ts`: the Draft (the `POST /api/price` request shape) in `localStorage` as `magkano.draft.v1` with `version: 1`; every read and write in try/catch, anything invalid starts empty. Pure edits: `addRecipe`, `setServings`, `removeRecipe`, `setLineState` (false/undefined fields and empty states are dropped), `pickMatch` (sets `pickedCommodityKey` and clears any Price Override in the same edit), `pruneDraft`. Tested in `draft.test.ts`.
- `src/line-format.ts`: `formatPeso` (`₱1,234.50`), `formatNeed`, `formatBuy` ("6 × 250 g", "1 head"), `formatSource` ("DA Oct 8"), `filterLines`, `coverage`, `parsePesos`. No price maths. Tested in `line-format.test.ts`.
- `src/Stepper.tsx`: the − n + servings control (1–20).
- `src/useApi.ts`: `useApi(key, request)` → `loading | error (status) | ready (data)`.
- `src/api.ts`: `api = hc<AppType>("/").api`, the typed Hono RPC client. `@magkano/api` is a dev dependency used for types only.
- `src/styles.css`: colour tokens on `:root` with a dark-mode variant.

## Env

- `VITE_CLERK_PUBLISHABLE_KEY` (required; the app refuses to start without it).
- `API_PORT` (optional, default 8787): where the dev proxy sends `/api`.
