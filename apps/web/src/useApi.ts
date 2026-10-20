import { useEffect, useState } from "react";

/** What a page shows while a request is in flight, after it fails, or once it answers. */
export type Loaded<T> =
  | { state: "loading" }
  | { state: "error"; status: number | null }
  | { state: "ready"; data: T };

/**
 * Runs `request` when `key` changes and tracks its result. A non-OK response becomes an
 * error with its status (404 for an unknown Recipe); a network failure has status null.
 */
export function useApi<T>(key: string, request: () => Promise<Response>): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ state: "loading" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` identifies the request.
  useEffect(() => {
    let cancelled = false;
    setLoaded({ state: "loading" });
    request()
      .then(async (res) => {
        const next: Loaded<T> = res.ok
          ? { state: "ready", data: (await res.json()) as T }
          : { state: "error", status: res.status };
        if (!cancelled) setLoaded(next);
      })
      .catch(() => {
        if (!cancelled) setLoaded({ state: "error", status: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return loaded;
}
