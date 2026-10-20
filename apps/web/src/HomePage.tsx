import type { InferResponseType } from "hono/client";
import { Link } from "react-router";
import { api } from "./api";
import { AddToDraft } from "./DraftControls";
import { useApi } from "./useApi";

type RecipeCard = InferResponseType<typeof api.recipes.$get, 200>[number];

/** Every Seeded Recipe as a card, sorted by name, each linking to its Recipe page, with "+ Add". */
export function HomePage() {
  const recipes = useApi<RecipeCard[]>("recipes", () => api.recipes.$get());

  return (
    <section>
      <h1>How much will dinner cost?</h1>
      <p className="muted">Pick a Filipino recipe to see what it needs.</p>
      {recipes.state === "loading" && <p className="muted">Loading recipes…</p>}
      {recipes.state === "error" && <p role="alert">Couldn't load recipes. Try again later.</p>}
      {recipes.state === "ready" && (
        <ul className="cards">
          {recipes.data.map((recipe) => (
            <li key={recipe.id} className="card">
              <Link to={`/recipes/${recipe.id}`} className="card-link">
                <span className="card-name">{recipe.name}</span>
                <span className="muted">{recipe.description}</span>
                <span className="muted small">Serves {recipe.servings}</span>
              </Link>
              <AddToDraft recipe={recipe} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
