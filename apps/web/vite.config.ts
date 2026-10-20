import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
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
