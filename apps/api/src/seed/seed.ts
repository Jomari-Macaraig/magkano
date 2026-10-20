import { z } from "zod";
import { type BaseUnit, baseUnits, type Unit, units } from "../db/schema.ts";
import { type PublicationFile, publicationFileSchema } from "../extract/extract.ts";
import { commodityAssignmentKey, ingredientKey, tagAssignmentsSchema } from "../tagging/files.ts";
import type { TagAssignments } from "../tagging/tag.ts";

/** The raw dataset: hand-edited TypeScript and script-written JSON, all checked before use. */
export type SeedInput = {
  tags: unknown;
  recipes: unknown;
  tagAssignments: unknown;
  publications: { file: string; content: unknown }[];
};

/** Everything `seed` writes, keyed by slugs and Commodity keys (the writer maps them to ids). */
export type SeedPlan = {
  /** Parents before children. */
  tags: {
    slug: string;
    name: string;
    parent: string | null;
    /** The display name first, then the aliases; unique ignoring case. */
    aliases: string[];
    conversions: { unit: Unit; amount: number; baseUnit: BaseUnit }[];
  }[];
  recipes: {
    id: string;
    name: string;
    description: string;
    servings: number;
    ingredients: {
      position: number;
      name: string;
      quantity: number | null;
      unit: Unit | null;
      prepNote: string | null;
      optional: boolean;
      tag: string | null;
    }[];
  }[];
  /** `file` is the Publication's file name, which `priceObservations` refer to. */
  publications: (PublicationFile["publication"] & { file: string })[];
  commodities: {
    key: string;
    source: PublicationFile["publication"]["source"];
    category: string;
    name: string;
    spec: string;
    origin: string | null;
    brand: string | null;
    sizeLabel: string | null;
    priceBasisAmount: number;
    priceBasisUnit: PublicationFile["commodities"][number]["priceBasis"]["unit"];
    purchaseUnitAmount: number;
    purchaseUnitUnit: PublicationFile["commodities"][number]["purchaseUnit"]["unit"];
    countUnit: PublicationFile["commodities"][number]["countUnit"];
    countWeightG: number | null;
    tag: string | null;
  }[];
  /** One per priced Commodity per Publication; `n/a` has none. */
  priceObservations: { commodityKey: string; publicationFile: string; priceCentavos: number }[];
};

export type SeedResult = { ok: true } | { ok: false; problems: string[] };

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case");
const conversionsSchema = z.partialRecord(z.enum(units), z.number().positive()).optional();

const tagSeedSchema = z.strictObject({
  slug: slugSchema,
  name: z.string().trim().min(1),
  parent: slugSchema.optional(),
  aliases: z.array(z.string().trim().min(1)),
  g: conversionsSchema,
  ml: conversionsSchema,
});

const ingredientSeedSchema = z
  .tuple([
    z.string().trim().min(1),
    z.number().positive().nullable(),
    z.enum(units).nullable(),
    z
      .strictObject({ optional: z.boolean().optional(), prepNote: z.string().min(1).optional() })
      .optional(),
  ])
  .refine(([, quantity, unit]) => quantity !== null || unit === null, {
    message: 'a "to taste" Ingredient (no quantity) has no unit',
  });

const recipeSeedSchema = z.strictObject({
  seedKey: slugSchema,
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  servings: z.number().int().min(1).max(20),
  ingredients: z.array(ingredientSeedSchema).min(1),
});

type TagSeed = z.infer<typeof tagSeedSchema>;
type RecipeSeed = z.infer<typeof recipeSeedSchema>;

/** `path: message` for each zod issue, prefixed with where the value came from. */
function zodProblems(where: string, error: z.ZodError): string[] {
  return error.issues.map(
    (issue) =>
      `${where}${issue.path.length ? ` at ${issue.path.join(".")}` : ""}: ${issue.message}`,
  );
}

/**
 * Checks the whole dataset and, only when every check passes, hands `write` the plan.
 * On failure it returns every problem found and never calls `write`.
 */
export async function runSeed(
  input: SeedInput,
  write: (plan: SeedPlan) => Promise<void>,
): Promise<SeedResult> {
  const problems: string[] = [];

  const parse = <T>(where: string, schema: z.ZodType<T>, value: unknown): T | undefined => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    problems.push(...zodProblems(where, result.error));
    return undefined;
  };

  const parsedTags = parse("tags.ts", z.array(tagSeedSchema), input.tags);
  const recipes = parse("recipes.ts", z.array(recipeSeedSchema), input.recipes) ?? [];
  const parsedAssignments = parse(
    "tag-assignments.json",
    tagAssignmentsSchema,
    input.tagAssignments,
  );
  const tags = parsedTags ?? [];
  const assignments: TagAssignments = parsedAssignments ?? {};
  const publications = input.publications.flatMap(({ file, content }) => {
    const parsed = parse(`publications/${file}`, publicationFileSchema, content);
    return parsed ? [{ file, ...parsed }] : [];
  });

  problems.push(...vocabularyProblems(tags));
  problems.push(...duplicateProblems(recipes, publications));
  // Checks against a file that failed its schema would only repeat that failure.
  if (parsedTags && parsedAssignments) {
    problems.push(
      ...assignmentProblems(assignments, new Set(tags.map((t) => t.slug)), recipes, publications),
    );
  }

  if (problems.length > 0) return { ok: false, problems };
  await write(buildPlan(tags, recipes, assignments, publications));
  return { ok: true };
}

const maxDepth = 3;

/** Slugs unique, parents known, no cycles, at most 3 levels, aliases unique ignoring case. */
function vocabularyProblems(tags: TagSeed[]): string[] {
  const problems: string[] = [];
  const parentOf = new Map<string, string | undefined>();
  for (const t of tags) {
    if (parentOf.has(t.slug))
      problems.push(`tags.ts: slug "${t.slug}" is used by more than one Tag`);
    else parentOf.set(t.slug, t.parent);
  }

  for (const t of tags) {
    if (t.parent && !parentOf.has(t.parent)) {
      problems.push(`tags.ts: Tag "${t.slug}" has unknown parent "${t.parent}"`);
    }
  }

  const inCycle = new Set<string>();
  for (const t of tags) {
    if (inCycle.has(t.slug)) continue;
    // Walk up the chain; stop at the root, an unknown parent or a loop.
    const chain = [t.slug];
    let next = parentOf.get(t.slug);
    while (next && parentOf.has(next) && !chain.includes(next)) {
      chain.push(next);
      next = parentOf.get(next);
    }
    if (next === t.slug) {
      for (const slug of chain) inCycle.add(slug);
      problems.push(
        `tags.ts: Tag "${t.slug}" is in a parent cycle (${[...chain, t.slug].join(" → ")})`,
      );
    } else if (!next || !chain.includes(next)) {
      if (chain.length > maxDepth) {
        problems.push(
          `tags.ts: Tag "${t.slug}" is ${chain.length} levels deep (at most ${maxDepth})`,
        );
      }
    }
  }

  const ownerOf = new Map<string, string>();
  for (const t of tags) {
    for (const alias of aliasesOf(t)) {
      const owner = ownerOf.get(alias.toLowerCase());
      if (owner === undefined) ownerOf.set(alias.toLowerCase(), t.slug);
      else if (owner !== t.slug) {
        problems.push(`tags.ts: alias "${alias}" of "${t.slug}" is already an alias of "${owner}"`);
      }
    }
  }
  return problems;
}

/** Seed keys, Commodity keys within a file, and (source, date) Publications are unique. */
function duplicateProblems(
  recipes: RecipeSeed[],
  publications: (PublicationFile & { file: string })[],
): string[] {
  const problems: string[] = [];
  const seedKeys = new Set<string>();
  for (const { seedKey } of recipes) {
    if (seedKeys.has(seedKey)) {
      problems.push(`recipes.ts: seed key "${seedKey}" is used by more than one Recipe`);
    }
    seedKeys.add(seedKey);
  }

  const fileOf = new Map<string, string>();
  for (const { file, publication, commodities } of publications) {
    const keys = new Set<string>();
    for (const { key } of commodities) {
      if (keys.has(key)) {
        problems.push(`publications/${file}: Commodity key "${key}" appears more than once`);
      }
      keys.add(key);
    }
    const id = `${publication.source} ${publication.publishedOn}`;
    const other = fileOf.get(id);
    if (other) problems.push(`publications/${file}: ${id} is already in publications/${other}`);
    else fileOf.set(id, file);
  }
  return problems;
}

/** Every Ingredient and Commodity has a reviewed entry, and every entry's Tag exists. */
function assignmentProblems(
  assignments: TagAssignments,
  slugs: Set<string>,
  recipes: RecipeSeed[],
  publications: PublicationFile[],
): string[] {
  const where = "tag-assignments.json";
  const keys = new Set([
    ...recipes.flatMap((r) => r.ingredients.map(([name]) => ingredientKey(r.seedKey, name))),
    ...publications.flatMap((p) => p.commodities.map((c) => commodityAssignmentKey(c.key))),
  ]);
  const problems: string[] = [];
  for (const key of keys) {
    const entry = assignments[key];
    if (!entry) problems.push(`${where}: no entry for ${key}`);
    else if (entry.status !== "reviewed")
      problems.push(`${where}: ${key} is proposed, not reviewed`);
  }
  for (const [key, { tag }] of Object.entries(assignments)) {
    if (tag !== null && !slugs.has(tag)) problems.push(`${where}: ${key} has unknown Tag "${tag}"`);
  }
  return problems;
}

/** How many levels down a Tag sits (a root is 1); only called on a checked vocabulary. */
function depthOf(slug: string, parentOf: Map<string, string | undefined>): number {
  let depth = 1;
  for (let p = parentOf.get(slug); p; p = parentOf.get(p)) depth++;
  return depth;
}

function buildPlan(
  tags: TagSeed[],
  recipes: RecipeSeed[],
  assignments: TagAssignments,
  publications: (PublicationFile & { file: string })[],
): SeedPlan {
  const tagOf = (key: string) => assignments[key]?.tag ?? null;

  const commodities = new Map<string, SeedPlan["commodities"][number]>();
  const priceObservations: SeedPlan["priceObservations"] = [];
  for (const { file, publication, commodities: rows } of publications) {
    for (const c of rows) {
      commodities.set(c.key, {
        key: c.key,
        source: publication.source,
        category: c.category,
        name: c.name,
        spec: c.spec,
        origin: c.origin,
        brand: c.brand,
        sizeLabel: c.sizeLabel,
        priceBasisAmount: c.priceBasis.amount,
        priceBasisUnit: c.priceBasis.unit,
        purchaseUnitAmount: c.purchaseUnit.amount,
        purchaseUnitUnit: c.purchaseUnit.unit,
        countUnit: c.countUnit,
        countWeightG: c.countWeightG,
        tag: tagOf(commodityAssignmentKey(c.key)),
      });
      if (c.priceCentavos !== null) {
        priceObservations.push({
          commodityKey: c.key,
          publicationFile: file,
          priceCentavos: c.priceCentavos,
        });
      }
    }
  }

  const parentOf = new Map(tags.map((t) => [t.slug, t.parent]));
  const parentsFirst = [...tags].sort(
    (a, b) => depthOf(a.slug, parentOf) - depthOf(b.slug, parentOf),
  );

  return {
    tags: parentsFirst.map((t) => ({
      slug: t.slug,
      name: t.name,
      parent: t.parent ?? null,
      aliases: aliasesOf(t),
      conversions: baseUnits.flatMap((baseUnit) =>
        Object.entries(t[baseUnit] ?? {}).map(([unit, amount]) => ({
          unit: unit as Unit,
          amount: amount as number,
          baseUnit,
        })),
      ),
    })),
    recipes: recipes.map((r) => ({
      id: r.seedKey,
      name: r.name,
      description: r.description,
      servings: r.servings,
      ingredients: r.ingredients.map(([name, quantity, unit, extras], position) => ({
        position,
        name,
        quantity,
        unit,
        prepNote: extras?.prepNote ?? null,
        optional: extras?.optional ?? false,
        tag: tagOf(ingredientKey(r.seedKey, name)),
      })),
    })),
    publications: publications.map((p) => ({ file: p.file, ...p.publication })),
    commodities: [...commodities.values()],
    priceObservations,
  };
}

/** The display name and the aliases, each kept once ignoring case. */
function aliasesOf(tag: TagSeed): string[] {
  const seen = new Set<string>();
  return [tag.name, ...tag.aliases].filter((alias) => {
    const lower = alias.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
