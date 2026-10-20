import type { InferResponseType } from "hono/client";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ingredientLine } from "./amount";
import { api } from "./api";
import { Stepper } from "./Stepper";
import { useApi } from "./useApi";

type Recipe = InferResponseType<(typeof api.recipes)[":id"]["$get"], 200>;

/** A Recipe's Ingredients, rescaled on the client by a 1–20 servings stepper. No prices. */
export function RecipePage() {
  const { id = "" } = useParams();
  const recipe = useApi<Recipe>(id, () => api.recipes[":id"].$get({ param: { id } }));

  if (recipe.state === "loading") return <p className="muted">Loading recipe…</p>;
  if (recipe.state === "error") {
    return (
      <section>
        <p role="alert">
          {recipe.status === 404 ? "There's no such recipe." : "Couldn't load this recipe."}
        </p>
        <Link to="/">Back to recipes</Link>
      </section>
    );
  }
  // Keyed so another Recipe starts again at its own servings.
  return <RecipeView key={recipe.data.id} recipe={recipe.data} />;
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  const [servings, setServings] = useState(recipe.servings);

  return (
    <article>
      <Link to="/" className="muted small">
        ← All recipes
      </Link>
      <h1>{recipe.name}</h1>
      <p className="muted">{recipe.description}</p>
      <div className="servings">
        <span>Servings</span>
        <Stepper value={servings} onChange={setServings} label="Servings" />
      </div>
      <h2>Ingredients</h2>
      <ul className="ingredients">
        {recipe.ingredients.map((ingredient, index) => {
          const line = ingredientLine(ingredient, { from: recipe.servings, to: servings });
          return (
            // Ingredients have no id in the API; their order is fixed.
            // biome-ignore lint/suspicious/noArrayIndexKey: the list never reorders.
            <li key={index}>
              <span className="amount">{line.amount}</span>
              <span>
                {ingredient.name}
                {line.note && <span className="muted">, {line.note}</span>}
                {ingredient.optional && <span className="badge">optional</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
