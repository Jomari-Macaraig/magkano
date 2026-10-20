import type { PricedLine } from "@magkano/api";
import { useState } from "react";
import { Link } from "react-router";
import { DraftRecipeRow } from "./DraftControls";
import { useDraft } from "./DraftProvider";
import { setLineState } from "./draft";
import { linePath } from "./LinePage";
import {
  coverage,
  filterLines,
  formatBuy,
  formatNeed,
  formatPeso,
  formatSource,
  type ListFilter,
  parsePesos,
} from "./line-format";

const filters: { id: ListFilter; label: string }[] = [
  { id: "toBuy", label: "To buy" },
  { id: "needsPrice", label: "Needs price" },
  { id: "haveIt", label: "Have it" },
];

/** The Grocery List (`/list`): the total, the Recipes on the list, filters and lines. */
export function ListPage() {
  const { draft, pricing, stale, failed } = useDraft();
  const [filter, setFilter] = useState<ListFilter>("toBuy");

  if (draft.recipes.length === 0) {
    return (
      <section>
        <ListHeader />
        <p>Your list is empty.</p>
        <Link to="/" className="button primary">
          Find recipes to add
        </Link>
      </section>
    );
  }
  if (!pricing) {
    return (
      <section>
        <ListHeader />
        {failed ? (
          <p role="alert">Couldn't price your list. Try again later.</p>
        ) : (
          <p className="muted">Pricing your list…</p>
        )}
      </section>
    );
  }

  const { counts } = pricing.total;
  const bar = coverage(counts);
  const shown = filterLines(pricing.lines, filter);
  const filterCounts: Record<ListFilter, number> = {
    toBuy: counts.priced + counts.noPrice,
    needsPrice: counts.noPrice,
    haveIt: counts.haveIt,
  };

  return (
    <section className={stale ? "list stale" : "list"}>
      <ListHeader />
      {failed && <p role="alert">Couldn't update prices. Showing the last estimate.</p>}

      <div className="total-card">
        <span className="muted small">Estimated total</span>
        <strong className="total">{formatPeso(pricing.total.centavos)}</strong>
        <div className="coverage" aria-hidden="true">
          <span className="coverage-priced" style={{ width: `${bar.priced}%` }} />
          <span className="coverage-noprice" style={{ width: `${bar.noPrice}%` }} />
          <span className="coverage-haveit" style={{ width: `${bar.haveIt}%` }} />
        </div>
        <span className="muted small">
          {counts.priced} priced · {counts.noPrice} no price · {counts.haveIt} have it ·{" "}
          {counts.estimated} estimated
        </span>
      </div>

      <h2>Recipes on this list</h2>
      <ul className="draft-recipes">
        {pricing.recipes.map((r) => (
          <DraftRecipeRow key={r.id} recipe={r} />
        ))}
      </ul>

      <div className="filters" role="tablist" aria-label="Filter lines">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? "button primary" : "button"}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({filterCounts[f.id]})
          </button>
        ))}
      </div>

      {shown.main.length === 0 && shown.optional.length === 0 && (
        <p className="muted">Nothing here.</p>
      )}
      <ul className="lines">
        {shown.main.map((line) => (
          <LineRow key={line.key} line={line} />
        ))}
      </ul>
      {shown.optional.length > 0 && (
        <>
          <h2 className="muted small">Optional · not in total</h2>
          <ul className="lines">
            {shown.optional.map((line) => (
              <LineRow key={line.key} line={line} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ListHeader() {
  return (
    <>
      <Link to="/" className="muted small">
        ← Recipes
      </Link>
      <h1>Grocery List</h1>
    </>
  );
}

function LineRow({ line }: { line: PricedLine }) {
  const { update } = useDraft();
  const chosen = line.matches.find((m) => m.commodityKey === line.price.commodityKey);
  const recipes = [...new Set(line.fromRecipes.map((r) => r.name))].join(", ");
  const excluded = line.status === "optionalExcluded";

  return (
    <li className={line.haveIt ? "line have-it" : "line"}>
      <input
        type="checkbox"
        className="have-it-box"
        checked={line.haveIt}
        aria-label={`I already have ${line.name}`}
        onChange={(e) => update((d) => setLineState(d, line.key, { haveIt: e.target.checked }))}
      />
      <div className="line-body">
        <Link to={linePath(line.key)} className="line-name">
          {line.name}
        </Link>
        <span className="small">
          {formatNeed(line.need)}
          {line.price.buy && <> → {formatBuy(line.price.buy)}</>}
        </span>
        <span className="muted small">{recipes}</span>
        <span className="line-badges">
          {chosen && !line.price.overridden && (
            <span className="badge">{formatSource(chosen.source, chosen.publishedOn)}</span>
          )}
          {line.price.rough && <span className="badge estimate">estimate</span>}
          {line.price.overridden && <span className="badge yours">your price</span>}
        </span>
      </div>
      <div className="line-price">
        {line.status === "noPrice" ? (
          <OverrideField lineKey={line.key} name={line.name} />
        ) : (
          line.price.lineCentavos !== null && <span>{formatPeso(line.price.lineCentavos)}</span>
        )}
        <Link to={linePath(line.key)} className="line-open" aria-label={`Open ${line.name}`}>
          ›
        </Link>
        {excluded && (
          <button
            type="button"
            className="button"
            onClick={() => update((d) => setLineState(d, line.key, { includeOptional: true }))}
          >
            + Add
          </button>
        )}
      </div>
    </li>
  );
}

/** The inline ₱ field on a "Needs price" line: sets a Price Override on Enter or blur. */
function OverrideField({ lineKey, name }: { lineKey: string; name: string }) {
  const { update } = useDraft();
  const [text, setText] = useState("");
  const commit = () => {
    const centavos = parsePesos(text);
    if (centavos !== null) update((d) => setLineState(d, lineKey, { overrideCentavos: centavos }));
  };
  return (
    <label className="peso-field">
      <span aria-hidden="true">₱</span>
      <input
        inputMode="decimal"
        placeholder="0.00"
        value={text}
        aria-label={`Your price for ${name}`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
    </label>
  );
}
