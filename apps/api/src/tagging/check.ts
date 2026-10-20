import type { TagAssignments } from "./tag.ts";

/** The reviewed Tags `tag --check` compares against, keyed like `tag-assignments.json`. */
export type ReferenceTags = Record<string, { tag: string | null }>;

export type Disagreement = {
  key: string;
  tag: string | null;
  proposedNewTag: string | null;
  referenceTag: string | null;
};

export type AgreementRate = { agreed: number; checked: number };

export type CheckResult = {
  assignments: TagAssignments;
  /** Proposals whose Tag differs from the reference, sorted by key. */
  disagreements: Disagreement[];
  /** Proposals with no reference entry, sorted by key. */
  noReference: string[];
  /** Over the proposals that had a reference entry. */
  rates: { ingredients: AgreementRate; commodities: AgreementRate };
};

/**
 * Compares every `proposed` entry with the reference: an equal Tag with no proposed new
 * Tag becomes `reviewed`; anything else stays `proposed`. Reviewed entries are never touched or counted.
 */
export function runCheck(assignments: TagAssignments, reference: ReferenceTags): CheckResult {
  const next = { ...assignments };
  const disagreements: Disagreement[] = [];
  const noReference: string[] = [];
  const rates = { ingredients: { agreed: 0, checked: 0 }, commodities: { agreed: 0, checked: 0 } };

  for (const key of Object.keys(assignments).sort()) {
    const entry = assignments[key];
    if (entry?.status !== "proposed") continue;
    const ref = reference[key];
    if (!ref) {
      noReference.push(key);
      continue;
    }
    const rate = key.startsWith("ingredient:") ? rates.ingredients : rates.commodities;
    rate.checked++;
    // A proposal that still carries a new Tag needs the owner, whatever the reference says.
    if (entry.tag === ref.tag && entry.proposedNewTag === null) {
      rate.agreed++;
      next[key] = { ...entry, status: "reviewed" };
    } else {
      disagreements.push({
        key,
        tag: entry.tag,
        proposedNewTag: entry.proposedNewTag,
        referenceTag: ref.tag,
      });
    }
  }

  return { assignments: next, disagreements, noReference, rates };
}
