// Vercel Function: vercel.json rewrites /api/* here (see deploy/CLAUDE.md).
import { buildApp } from "../apps/api/src/build-app.ts";

// One pool per Function instance, created once when the module loads. Small and quick to let go
// of idle connections, since Neon's pooler sits in front and instances come and go.
export default buildApp(process.env, {
  db: { max: 5, idle_timeout: 5, connect_timeout: 10 },
});
