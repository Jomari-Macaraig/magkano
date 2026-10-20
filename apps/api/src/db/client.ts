import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

/** A Drizzle client over postgres.js, with `close()` to end the pool. */
export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10, connect_timeout: 5, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return Object.assign(db, { close: () => client.end({ timeout: 5 }) });
}

export type Db = ReturnType<typeof createDb>;
