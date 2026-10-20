# Every deploy reseeds its database from the committed data files, production included

The committed files under `apps/api/data/` are Magkano's dataset, and Postgres is only a copy of them. So every deploy runs the migrations and then `seed` (a one-transaction wipe and reload) against its own database, preview and production alike. Merging a data change then updates production by itself, and production can't drift from the reviewed files. We chose this over seeding production by hand, which saves a step but goes stale whenever someone forgets to run it after a data PR. The rule describes the deploy pipeline, not a host: it holds on Vercel and Neon today and should carry over unchanged if Magkano moves to AWS or GCP.

## Consequences

- Production holds only data that `seed` can rebuild. Anything users create (saved Grocery Lists in v2, user Recipes in v3) would be wiped, so this decision must be revisited before the first such table ships. Either the reseed is limited to the dataset tables, or production stops reseeding.
- A deploy whose build gets production's connection string reseeds production. Previews must never be given it (production's database variables live only in the Production environment).
- Migrations run before the new code is live, so they are add-only and the running deployment keeps working. Seed's `TRUNCATE` briefly blocks requests while it runs.
