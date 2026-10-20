// What gets embedded for search: two chunks per Recipe, and the query (spec: Search).
import type { ChunkKind } from "../db/schema.ts";

/** A Tag as search needs it. `aliases` holds the display name first, then the other names. */
export type SearchTag = { slug: string; parent: string | null; aliases: string[] };

/** A Recipe as chunking needs it: each Ingredient with its Tag's slug (or none). */
export type ChunkSource = {
  name: string;
  description: string;
  ingredients: { name: string; tag: string | null }[];
};

/**
 * The text of a Recipe's two chunks. Title: name plus description. Ingredients: each
 * Ingredient bilingually, as its name and its Tag's names, then each ancestor's names
 * ("liempo / Pork belly (a kind of Pork / baboy / karne ng baboy)").
 */
export function recipeChunkTexts(
  tags: SearchTag[],
  recipe: ChunkSource,
): Record<ChunkKind, string> {
  const bySlug = new Map(tags.map((t) => [t.slug, t]));
  const lines = recipe.ingredients.map(({ name, tag }) => {
    const chain = tagChain(bySlug, tag);
    const [own, ...ancestors] = chain;
    if (!own) return name;
    const names = distinct([name, ...own.aliases]).join(" / ");
    if (ancestors.length === 0) return names;
    return `${names} (a kind of ${ancestors.map((a) => distinct(a.aliases).join(" / ")).join("; ")})`;
  });
  return {
    title: `${recipe.name}. ${recipe.description}`.trim(),
    ingredients: `Ingredients: ${lines.join("; ")}.`,
  };
}

/**
 * The text a query is embedded as: its normalised words, each known food (an exact Tag alias,
 * longest match first) followed by its Tag's names ("something with pork (pork / baboy /
 * karne ng baboy)"). Empty for a query with no words.
 */
export function expandQuery(tags: SearchTag[], query: string): string {
  const words = toWords(query);
  const out: string[] = [];
  let at = 0;
  for (const { tag, start, length } of findFoods(tags, words)) {
    out.push(...words.slice(at, start + length));
    out.push(`(${distinct(tag.aliases.map((a) => toWords(a).join(" "))).join(" / ")})`);
    at = start + length;
  }
  out.push(...words.slice(at));
  return out.join(" ");
}

/** The Tag and its ancestors, most specific first; empty for no Tag or an unknown slug. */
export function tagChain(bySlug: Map<string, SearchTag>, slug: string | null): SearchTag[] {
  const chain: SearchTag[] = [];
  for (let t = slug === null ? undefined : bySlug.get(slug); t && !chain.includes(t); ) {
    chain.push(t);
    t = t.parent === null ? undefined : bySlug.get(t.parent);
  }
  return chain;
}

/** Lowercase words without accents or punctuation: "Adobó!" → ["adobo"]. */
export function toWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** A run of query words that is one of a Tag's aliases. */
export type FoodMention = { tag: SearchTag; start: number; length: number };

/** Where the words name foods, trying the longest aliases first, left to right. */
export function findFoods(tags: SearchTag[], words: string[]): FoodMention[] {
  const byAlias = new Map<string, SearchTag>();
  let longest = 1;
  for (const tag of tags) {
    for (const alias of tag.aliases) {
      const key = toWords(alias).join(" ");
      if (!key || byAlias.has(key)) continue;
      byAlias.set(key, tag);
      longest = Math.max(longest, key.split(" ").length);
    }
  }
  const found: FoodMention[] = [];
  for (let i = 0; i < words.length; ) {
    let matched = 0;
    for (let n = Math.min(longest, words.length - i); n > 0 && !matched; n--) {
      const tag = byAlias.get(words.slice(i, i + n).join(" "));
      if (tag) {
        found.push({ tag, start: i, length: n });
        matched = n;
      }
    }
    i += matched || 1;
  }
  return found;
}

/** Keeps the first of each name, ignoring case. */
function distinct(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((n) => {
    const key = n.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
