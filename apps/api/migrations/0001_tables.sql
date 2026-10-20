CREATE TYPE "public"."base_unit" AS ENUM('g', 'ml');--> statement-breakpoint
CREATE TYPE "public"."chunk_kind" AS ENUM('title', 'ingredients');--> statement-breakpoint
CREATE TYPE "public"."count_unit" AS ENUM('piece', 'head', 'bundle');--> statement-breakpoint
CREATE TYPE "public"."measure_unit" AS ENUM('g', 'ml', 'piece');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('DA', 'DTI');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('g', 'kg', 'ml', 'L', 'tsp', 'tbsp', 'cup', 'piece', 'clove', 'head', 'thumb', 'stalk', 'bundle', 'can', 'pack');--> statement-breakpoint
CREATE TABLE "commodities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commodities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"source" "source" NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"spec" text NOT NULL,
	"origin" text,
	"brand" text,
	"size_label" text,
	"price_basis_amount" numeric(10, 3) NOT NULL,
	"price_basis_unit" "measure_unit" NOT NULL,
	"purchase_unit_amount" numeric(10, 3) NOT NULL,
	"purchase_unit_unit" "measure_unit" NOT NULL,
	"count_unit" "count_unit",
	"count_weight_g" numeric(10, 3),
	"tag_id" integer,
	CONSTRAINT "commodities_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingredients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"recipe_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(8, 3),
	"unit" "unit",
	"prep_note" text,
	"optional" boolean DEFAULT false NOT NULL,
	"tag_id" integer
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"commodity_id" integer NOT NULL,
	"publication_id" integer NOT NULL,
	"price_centavos" integer NOT NULL,
	CONSTRAINT "price_observations_commodity_id_publication_id_pk" PRIMARY KEY("commodity_id","publication_id")
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "publications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" "source" NOT NULL,
	"title" text NOT NULL,
	"published_on" date NOT NULL,
	"file_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_chunks" (
	"recipe_id" text NOT NULL,
	"kind" "chunk_kind" NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	CONSTRAINT "recipe_chunks_recipe_id_kind_pk" PRIMARY KEY("recipe_id","kind")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"servings" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_aliases" (
	"tag_id" integer NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "unit_conversions" (
	"tag_id" integer NOT NULL,
	"unit" "unit" NOT NULL,
	"amount" numeric(10, 3) NOT NULL,
	"base_unit" "base_unit" NOT NULL,
	CONSTRAINT "unit_conversions_tag_id_unit_pk" PRIMARY KEY("tag_id","unit")
);
--> statement-breakpoint
ALTER TABLE "commodities" ADD CONSTRAINT "commodities_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_chunks" ADD CONSTRAINT "recipe_chunks_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_aliases" ADD CONSTRAINT "tag_aliases_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_parent_id_tags_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commodities_tag_id_idx" ON "commodities" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "ingredients_recipe_id_idx" ON "ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_source_published_on_unique" ON "publications" USING btree ("source","published_on");--> statement-breakpoint
CREATE INDEX "recipe_chunks_embedding_hnsw" ON "recipe_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tag_aliases_alias_lower_unique" ON "tag_aliases" USING btree (lower("alias"));