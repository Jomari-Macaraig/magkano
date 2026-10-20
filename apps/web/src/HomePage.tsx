import { useEffect, useState } from "react";
import { api } from "./api";

/** Placeholder home until search and browse land; shows the API is reachable. */
export function HomePage() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "unreachable">("checking");

  useEffect(() => {
    let cancelled = false;
    api.health
      .$get()
      .then(async (res) => {
        const body = res.ok ? await res.json() : null;
        if (!cancelled) setApiStatus(body?.status === "ok" ? "ok" : "unreachable");
      })
      .catch(() => {
        if (!cancelled) setApiStatus("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1>How much will dinner cost?</h1>
      <p className="muted">Recipes and market prices are coming soon.</p>
      <p className="muted small">API: {apiStatus}</p>
    </section>
  );
}
