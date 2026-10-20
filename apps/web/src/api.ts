import type { AppType } from "@magkano/api";
import { hc } from "hono/client";

/** Typed client for the API. Same origin: Vite proxies /api in dev. */
export const api = hc<AppType>("/").api;
