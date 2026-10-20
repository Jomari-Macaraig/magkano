import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { api } from "./api";
import type { Loaded } from "./useApi";

export type SearchResponse = InferResponseType<typeof api.search.$get, 200>;

/** How long typing must pause before a search is sent. */
const DEBOUNCE_MS = 300;

/**
 * Searches Recipes for `query`, debounced. `idle` while the box is empty (the page shows the
 * browse list then). While a new search is in flight the previous results stay up.
 */
export function useRecipeSearch(query: string): { state: "idle" } | Loaded<SearchResponse> {
  const q = query.trim();
  const [loaded, setLoaded] = useState<Loaded<SearchResponse>>({ state: "loading" });

  useEffect(() => {
    if (!q) {
      setLoaded({ state: "loading" });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.search
        .$get({ query: { q } })
        .then(async (res) => {
          const next: Loaded<SearchResponse> = res.ok
            ? { state: "ready", data: await res.json() }
            : { state: "error", status: res.status };
          if (!cancelled) setLoaded(next);
        })
        .catch(() => {
          if (!cancelled) setLoaded({ state: "error", status: null });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  return q ? loaded : { state: "idle" };
}

/** The search box above the Recipe cards. */
export function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <input
      type="search"
      className="search"
      aria-label="Search recipes"
      placeholder="Search: adobo, bawang, something with pork…"
      value={value}
      maxLength={200}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
