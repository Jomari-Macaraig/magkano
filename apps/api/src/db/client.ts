import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

/** postgres.js pool settings; anything unset keeps the local defaults. */
export type DbOptions = { max?: number; idle_timeout?: number; connect_timeout?: number };

/** A Drizzle client over postgres.js, with `close()` to end the pool. */
export function createDb(databaseUrl: string, options: DbOptions = {}) {
  const client = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 5,
    ...options,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  return Object.assign(db, { close: () => client.end({ timeout: 5 }) });
}

export type Db = ReturnType<typeof createDb>;
