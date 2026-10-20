import type { Unit } from "../db/schema.ts";
import type { CatalogTag } from "./catalog.ts";

export type TagNode = CatalogTag & {
  /** This Tag first, then its parent, then its grandparent. */
  chain: TagNode[];
};

export type TagTree = {
  get(slug: string): TagNode | undefined;
  /** One `unit` of this Tag, from the Tag itself or the nearest ancestor that sets one. */
  conversion(slug: string, unit: Unit): CatalogTag["conversions"][number] | undefined;
  /**
   * The Ingredient Matches for an Ingredient's Tag: Commodities whose Tag lies on the same
   * ancestor chain, kept only at the most specific shared Tag. Siblings never match.
   */
  matches<C extends { tag: string | null }>(ingredientTag: string | null, commodities: C[]): C[];
};

/** The in-memory Tag tree, with ancestor chains worked out once. */
export function buildTagTree(tags: CatalogTag[]): TagTree {
  const bySlug = new Map<string, TagNode>(tags.map((t) => [t.slug, { ...t, chain: [] }]));
  for (const tag of bySlug.values()) {
    for (
      let t: TagNode | undefined = tag;
      t && !tag.chain.includes(t);
      t = t.parent === null ? undefined : bySlug.get(t.parent)
    ) {
      tag.chain.push(t);
    }
  }
  return {
    get: (slug) => bySlug.get(slug),
    conversion(slug, unit) {
      for (const tag of bySlug.get(slug)?.chain ?? []) {
        const found = tag.conversions.find((c) => c.unit === unit);
        if (found) return found;
      }
      return undefined;
    },
    matches(ingredientTag, commodities) {
      const ingredient = ingredientTag === null ? undefined : bySlug.get(ingredientTag);
      if (!ingredient) return [];
      const candidates: { commodity: (typeof commodities)[number]; depth: number }[] = [];
      for (const commodity of commodities) {
        const tag = commodity.tag === null ? undefined : bySlug.get(commodity.tag);
        if (!tag) continue;
        // The shared Tag is the more general of the two.
        if (tag.chain.includes(ingredient)) {
          candidates.push({ commodity, depth: ingredient.chain.length });
        } else if (ingredient.chain.includes(tag)) {
          candidates.push({ commodity, depth: tag.chain.length });
        }
      }
      const deepest = Math.max(-1, ...candidates.map((c) => c.depth));
      return candidates.filter((c) => c.depth === deepest).map((c) => c.commodity);
    },
  };
}
