import { asc, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { ingredients, recipes, type Unit } from "./db/schema";

/** What the browse list shows for a Recipe. */
export type RecipeCard = { id: string; name: string; description: string; servings: number };

/** A Recipe page: the card plus its Ingredients in order. No prices. */
export type RecipeDetail = RecipeCard & {
  ingredients: {
    name: string;
    /** null with a null unit means "to taste". */
    quantity: number | null;
    unit: Unit | null;
    prepNote: string | null;
    optional: boolean;
  }[];
};

/** Where routes read Recipes from. Route tests pass a stub; the server passes Postgres. */
export interface RecipeStore {
  /** Every Recipe card, sorted by name. */
  list(): Promise<RecipeCard[]>;
  /** The Recipe with this id, or null. */
  get(id: string): Promise<RecipeDetail | null>;
}

const cardColumns = {
  id: recipes.id,
  name: recipes.name,
  description: recipes.description,
  servings: recipes.servings,
};

export function createRecipeStore(db: Db): RecipeStore {
  return {
    list: () => db.select(cardColumns).from(recipes).orderBy(asc(recipes.name), asc(recipes.id)),
    async get(id) {
      const [card] = await db.select(cardColumns).from(recipes).where(eq(recipes.id, id));
      if (!card) return null;
      const rows = await db
        .select({
          name: ingredients.name,
          quantity: ingredients.quantity,
          unit: ingredients.unit,
          prepNote: ingredients.prepNote,
          optional: ingredients.optional,
        })
        .from(ingredients)
        .where(eq(ingredients.recipeId, id))
        .orderBy(asc(ingredients.position));
      return { ...card, ingredients: rows };
    },
  };
}
