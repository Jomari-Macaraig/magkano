import { Link } from "react-router";
import { useDraft } from "./DraftProvider";
import { addRecipe, MAX_RECIPES, removeRecipe, setServings } from "./draft";
import { formatPeso } from "./line-format";
import { Stepper } from "./Stepper";

/** A card's "+ Add", which becomes "✓ on list" with a servings stepper once added. */
export function AddToDraft({ recipe }: { recipe: { id: string; name: string; servings: number } }) {
  const { draft, update } = useDraft();
  const onList = draft.recipes.find((r) => r.id === recipe.id);

  if (!onList) {
    return (
      <button
        type="button"
        className="button primary"
        disabled={draft.recipes.length >= MAX_RECIPES}
        aria-label={`Add ${recipe.name} to the list`}
        onClick={() => update((d) => addRecipe(d, recipe.id, recipe.servings))}
      >
        + Add
      </button>
    );
  }
  return (
    <div className="on-list">
      <span className="on-list-label">✓ on list</span>
      <Stepper
        value={onList.servings}
        onChange={(n) => update((d) => setServings(d, recipe.id, n))}
        label="Servings"
      />
    </div>
  );
}

/** The "Recipes on this list" row: name, servings stepper and Remove. */
export function DraftRecipeRow({ recipe }: { recipe: { id: string; name: string } }) {
  const { draft, update } = useDraft();
  const onList = draft.recipes.find((r) => r.id === recipe.id);
  if (!onList) return null;
  return (
    <li className="draft-recipe">
      <Link to={`/recipes/${recipe.id}`}>{recipe.name}</Link>
      <Stepper
        value={onList.servings}
        onChange={(n) => update((d) => setServings(d, recipe.id, n))}
        label="Servings"
      />
      <button
        type="button"
        className="button"
        onClick={() => update((d) => removeRecipe(d, recipe.id))}
      >
        Remove
      </button>
    </li>
  );
}

/** The sticky "View Grocery List · n recipes · ₱total" button, shown when the Draft isn't empty. */
export function ViewListButton() {
  const { draft, pricing } = useDraft();
  const n = draft.recipes.length;
  if (n === 0) return null;
  return (
    <div className="sticky-bar">
      <Link to="/list" className="button primary sticky-button">
        View Grocery List · {n} {n === 1 ? "recipe" : "recipes"}
        {pricing && ` · ${formatPeso(pricing.total.centavos)}`}
      </Link>
    </div>
  );
}
