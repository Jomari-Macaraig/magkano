import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, "../..", "");
  // The key is baked in at build time: without it a deploy would ship a blank page, so fail instead.
  if (command === "build" && !env.VITE_CLERK_PUBLISHABLE_KEY) {
    throw new Error(
      "VITE_CLERK_PUBLISHABLE_KEY is not set: the web build needs it (see .env.example; on Vercel, set it per environment).",
    );
  }
  return {
    plugins: [react()],
    // One .env at the repo root for both apps.
    envDir: "../..",
    server: {
      // Same origin as the API: the browser only ever calls /api/*.
      proxy: { "/api": `http://localhost:${env.API_PORT ?? 8787}` },
    },
  };
});
