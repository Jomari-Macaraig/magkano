import type { PriceResponse } from "@magkano/api";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { browserStorage, type Draft, loadDraft, pruneDraft, saveDraft } from "./draft";

/** How long the Draft must sit still before it is re-priced. */
const DEBOUNCE_MS = 300;

type DraftContextValue = {
  draft: Draft;
  /** Applies an edit to the Draft; it is saved at once and re-priced after a pause. */
  update: (edit: (draft: Draft) => Draft) => void;
  /** The latest price response for the current Recipes; null for an empty Draft or before the first. */
  pricing: PriceResponse | null;
  /** True while a newer Draft than `pricing` is waiting to be priced. */
  stale: boolean;
  failed: boolean;
};

const DraftContext = createContext<DraftContextValue | null>(null);

/**
 * Holds the Draft for every screen. It lives on the device only, so signing in or out never
 * touches it. After each price response, stale line state is pruned and Recipes the server
 * no longer knows are removed with a toast.
 */
export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(browserStorage()));
  const [pricing, setPricing] = useState<PriceResponse | null>(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    saveDraft(browserStorage(), draft);
    const seq = ++requestSeq.current;
    if (draft.recipes.length === 0) {
      setPricing(null);
      setStale(false);
      setFailed(false);
      return;
    }
    setStale(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.price.$post({ json: draft });
        if (!res.ok) throw new Error(`price: ${res.status}`);
        const body = await res.json();
        // A newer Draft is on its way; this answer is out of date.
        if (seq !== requestSeq.current) return;
        setPricing(body);
        setStale(false);
        setFailed(false);
        // Pruned against the current Draft, so an edit made while waiting is kept.
        setDraft((current) => pruneDraft(current, body).draft);
        const dropped = pruneDraft(draft, body).dropped.length;
        if (dropped > 0) {
          setToast(
            dropped === 1
              ? "A recipe on your list no longer exists, so it was removed."
              : `${dropped} recipes on your list no longer exist, so they were removed.`,
          );
        }
      } catch {
        if (seq === requestSeq.current) {
          setFailed(true);
          setStale(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const value: DraftContextValue = {
    draft,
    update: (edit) => setDraft((current) => edit(current)),
    pricing,
    stale,
    failed,
  };
  return (
    <DraftContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </DraftContext.Provider>
  );
}

export function useDraft(): DraftContextValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft needs a <DraftProvider>");
  return value;
}
