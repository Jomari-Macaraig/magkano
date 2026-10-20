import type { InferResponseType } from "hono/client";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "./api";
import { AddToDraft } from "./DraftControls";
import { SearchBox, useRecipeSearch } from "./RecipeSearch";
import { type Loaded, useApi } from "./useApi";

type RecipeCard = InferResponseType<typeof api.recipes.$get, 200>[number];

/**
 * A search box over the Recipe cards: search results while there's a query, otherwise every
 * Seeded Recipe sorted by name. Each card links to its Recipe page and has "+ Add".
 */
export function HomePage() {
  const browse = useApi<RecipeCard[]>("recipes", () => api.recipes.$get());
  const [query, setQuery] = useState("");
  const search = useRecipeSearch(query);
  const recipes: Loaded<RecipeCard[]> =
    search.state === "idle"
      ? browse
      : search.state === "ready"
        ? { state: "ready", data: search.data.results }
        : search;

  return (
    <section>
      <h1>How much will dinner cost?</h1>
      <p className="muted">Pick a Filipino recipe to see what it needs.</p>
      <SearchBox value={query} onChange={setQuery} />
      {search.state === "ready" && search.data.fallback && (
        <p className="muted small">Basic search: smart search is unavailable right now.</p>
      )}
      {recipes.state === "loading" && <p className="muted">Loading recipes…</p>}
      {recipes.state === "error" && <p role="alert">Couldn't load recipes. Try again later.</p>}
      {recipes.state === "ready" && recipes.data.length === 0 && (
        <p className="muted">No recipes match "{query.trim()}".</p>
      )}
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
