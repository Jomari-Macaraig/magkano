# Write the v1 spec

Type: task
Status: resolved
Blocked by: 01, 02

## Question

Synthesise the map's Notes (the decisions settled before and while charting) and the resolved tickets into `.scratch/v1/spec.md`, ready for `/to-tickets`.

Covers: problem, solution, user stories for v1 only, implementation decisions, testing decisions, and out of scope. Leave out everything the map rules out of scope. Check that the result fits the 2-hour build budget, and raise any gap found while writing as a question to the user rather than settling it alone.

## Comments

- From [Trim the data model and API to v1](02-trim-data-model-and-api.md): the Recipe page shows **no price**, only Ingredients scaled to the chosen servings, plus "Add to list". Prices appear only on the Grocery List. Drop any user story about a single-Recipe price estimate.

## Answer

Done on 2026-10-21. The spec is at [../spec.md](../spec.md): 57 user stories, implementation decisions, testing decisions and out-of-scope, with `Status: ready-for-agent`.

Gaps found while writing, confirmed by the user:
- "Add to list" on the Recipe page uses the servings chosen there, and updates them if the Recipe is already on the list.
- Routes: `/`, `/recipes/:id`, `/list`, `/list/:lineKey`.
- Clerk sign-in, sign-up and user-menu buttons sit in the header. The Draft is independent of sign-in.
- Money is formatted `₱1,234.50`. Search ties go by name. An empty Draft prompts back to search.
- The 2-hour budget is agent build time only. The owner's review of `tag --check` disagreements is counted separately.
