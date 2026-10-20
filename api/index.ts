// Vercel Function: the whole API under /api/*. vercel.json rewrites every /api/... request here,
// and Vercel's Node runtime serves the default export through its `fetch` method.
import { buildApp } from "../apps/api/src/build-app.ts";

// One pool per Function instance, created once when the module loads. Small and quick to let go
// of idle connections, since Neon's pooler sits in front and instances come and go.
export default buildApp(process.env, {
  db: { max: 5, idle_timeout: 5, connect_timeout: 10 },
});
