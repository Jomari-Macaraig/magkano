// Drizzle tables for the v1 data model. Postgres is a copy of the committed data files,
// rebuilt by `seed`. Integer ids change on every re-seed, so nothing on the device stores them.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

/** The 15 units an Ingredient quantity can be written in. */
export const units = [
  "g",
  "kg",
  "ml",
  "L",
  "tsp",
  "tbsp",
  "cup",
  "piece",
  "clove",
  "head",
  "thumb",
  "stalk",
  "bundle",
  "can",
  "pack",
] as const;
export type Unit = (typeof units)[number];
export const unitEnum = pgEnum("unit", units);

/** What a Unit Conversion converts to. */
export const baseUnits = ["g", "ml"] as const;
export type BaseUnit = (typeof baseUnits)[number];
export const baseUnitEnum = pgEnum("base_unit", baseUnits);

/** What a price basis or Purchase Unit is measured in. */
export const measureUnits = ["g", "ml", "piece"] as const;
export type MeasureUnit = (typeof measureUnits)[number];
export const measureUnitEnum = pgEnum("measure_unit", measureUnits);

export const countUnits = ["piece", "head", "bundle"] as const;
export type CountUnit = (typeof countUnits)[number];
export const countUnitEnum = pgEnum("count_unit", countUnits);

export const sources = ["DA", "DTI"] as const;
export type Source = (typeof sources)[number];
export const sourceEnum = pgEnum("source", sources);

export const chunkKinds = ["title", "ingredients"] as const;
export type ChunkKind = (typeof chunkKinds)[number];
export const chunkKindEnum = pgEnum("chunk_kind", chunkKinds);

const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();
const decimal = (name: string) => numeric(name, { precision: 10, scale: 3, mode: "number" });

// ---- Tags ----

/** A food. Single-parent tree, at most 3 levels deep. */
export const tags = pgTable("tags", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => tags.id),
});

/** Tagalog and other English names. Unique across all Tags, ignoring case. */
export const tagAliases = pgTable(
  "tag_aliases",
  {
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [uniqueIndex("tag_aliases_alias_lower_unique").on(sql`lower(${t.alias})`)],
);

/** unit → amount in g or ml, inherited down the Tag chain. */
export const unitConversions = pgTable(
  "unit_conversions",
  {
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    unit: unitEnum("unit").notNull(),
    amount: decimal("amount").notNull(),
    baseUnit: baseUnitEnum("base_unit").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.unit] })],
);

// ---- Recipes ----

/** A Recipe's id is its seed key, e.g. `chicken-adobo`. */
export const recipes = pgTable("recipes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  servings: smallint("servings").notNull(),
});

export const ingredients = pgTable(
  "ingredients",
  {
    id: id(),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    /** Empty quantity and unit mean "to taste". */
    quantity: numeric("quantity", { precision: 8, scale: 3, mode: "number" }),
    unit: unitEnum("unit"),
    prepNote: text("prep_note"),
    optional: boolean("optional").notNull().default(false),
    tagId: integer("tag_id").references(() => tags.id),
  },
  (t) => [index("ingredients_recipe_id_idx").on(t.recipeId)],
);

/** A Recipe's two search chunks: title (name + description) and bilingual Ingredients. */
export const recipeChunks = pgTable(
  "recipe_chunks",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    kind: chunkKindEnum("kind").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.kind] }),
    index("recipe_chunks_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

// ---- Publications, Commodities and prices ----

export const publications = pgTable(
  "publications",
  {
    id: id(),
    source: sourceEnum("source").notNull(),
    title: text("title").notNull(),
    publishedOn: date("published_on").notNull(),
    fileHash: text("file_hash").notNull(),
  },
  (t) => [uniqueIndex("publications_source_published_on_unique").on(t.source, t.publishedOn)],
);

/** A priced item as a source lists it. `key` = `<source>:<category>:<name>:<spec>`, whitespace collapsed. */
export const commodities = pgTable(
  "commodities",
  {
    id: id(),
    key: text("key").notNull().unique(),
    source: sourceEnum("source").notNull(),
    category: text("category").notNull(),
    name: text("name").notNull(),
    spec: text("spec").notNull(),
    origin: text("origin"),
    brand: text("brand"),
    sizeLabel: text("size_label"),
    priceBasisAmount: decimal("price_basis_amount").notNull(),
    priceBasisUnit: measureUnitEnum("price_basis_unit").notNull(),
    purchaseUnitAmount: decimal("purchase_unit_amount").notNull(),
    purchaseUnitUnit: measureUnitEnum("purchase_unit_unit").notNull(),
    countUnit: countUnitEnum("count_unit"),
    countWeightG: decimal("count_weight_g"),
    tagId: integer("tag_id").references(() => tags.id),
  },
  (t) => [index("commodities_tag_id_idx").on(t.tagId)],
);

/** One price per Commodity per Publication. An `n/a` price writes no row. */
export const priceObservations = pgTable(
  "price_observations",
  {
    commodityId: integer("commodity_id")
      .notNull()
      .references(() => commodities.id, { onDelete: "cascade" }),
    publicationId: integer("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    priceCentavos: integer("price_centavos").notNull(),
  },
  (t) => [primaryKey({ columns: [t.commodityId, t.publicationId] })],
);
