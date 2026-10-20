import type { PricedLine, PricedMatch } from "@magkano/api";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { formatAmount } from "./amount";
import { useDraft } from "./DraftProvider";
import { pickMatch, setLineState } from "./draft";
import { formatBuy, formatNeed, formatPeso, formatSource, parsePesos } from "./line-format";

/** The line page's address; line keys can hold spaces and colons. */
export const linePath = (key: string) => `/list/${encodeURIComponent(key)}`;

/**
 * One Grocery List line (`/list/:lineKey`): the need per Recipe, every match to pick from, a
 * Price Override, the include toggle and Have It. Everything comes from the price response
 * the list already holds; an unknown key goes back to the list.
 */
export function LinePage() {
  const { lineKey } = useParams();
  const { draft, pricing, stale, failed } = useDraft();

  if (draft.recipes.length === 0) return <Navigate to="/list" replace />;
  if (!pricing) {
    return (
      <section>
        <BackLink />
        {failed ? (
          <p role="alert">Couldn't price your list. Try again later.</p>
        ) : (
          <p className="muted">Pricing your list…</p>
        )}
      </section>
    );
  }
  const line = pricing.lines.find((l) => l.key === lineKey);
  if (!line) return <Navigate to="/list" replace />;

  return (
    <section className={stale ? "line-page stale" : "line-page"}>
      <BackLink />
      <h1>{line.name}</h1>
      {failed && <p role="alert">Couldn't update prices. Showing the last estimate.</p>}
      <LineSummary line={line} />
      <LineToggles line={line} />
      {line.pickUnavailable && (
        <p className="note">Your pick is no longer available, using the cheapest.</p>
      )}
      {line.price.rough && (
        <p className="note estimate-note">
          <span className="badge estimate">estimate</span> We don't know how much a piece weighs, so
          this is the price of one Purchase Unit.
        </p>
      )}
      <MatchPicker line={line} />
      <OverrideForm key={line.price.overridden ? "set" : "unset"} line={line} />
    </section>
  );
}

function BackLink() {
  return (
    <Link to="/list" className="muted small">
      ← Grocery List
    </Link>
  );
}

/** Each Recipe's share, the total needed, "You'll buy" and the line's price. */
function LineSummary({ line }: { line: PricedLine }) {
  return (
    <div className="total-card">
      <ul className="need-parts">
        {line.fromRecipes.map((part, i) => (
          // A Recipe can list the same food twice, so the index keeps keys apart.
          // biome-ignore lint/suspicious/noArrayIndexKey: parts have no id of their own
          <li key={`${part.id}-${i}`}>
            <span>
              {part.name}
              {part.optional && <span className="badge">optional</span>}
            </span>
            <span>{partAmount(part.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="need-row">
        <span className="muted small">Total needed</span>
        <strong>{formatNeed(line.need)}</strong>
      </div>
      {line.price.buy && (
        <div className="need-row">
          <span className="muted small">You'll buy</span>
          <strong>{formatBuy(line.price.buy)}</strong>
        </div>
      )}
      <div className="need-row">
        <span className="muted small">{statusLabel[line.status]}</span>
        <strong>
          {line.price.lineCentavos !== null ? formatPeso(line.price.lineCentavos) : "no price"}
          {line.price.overridden && <span className="badge yours">your price</span>}
        </strong>
      </div>
    </div>
  );
}

const statusLabel: Record<PricedLine["status"], string> = {
  priced: "Line cost",
  noPrice: "Needs price",
  haveIt: "Have it · not in total",
  optionalExcluded: "Optional · not in total",
};

/** A Recipe's part as written: "2 cloves", "to taste", plus any prep note. */
function partAmount(amount: PricedLine["fromRecipes"][number]["amount"]): string {
  if (amount.quantity === null) return amount.note || "to taste";
  const text = formatAmount(amount.quantity, amount.unit);
  return amount.note ? `${text}, ${amount.note}` : text;
}

/** The include toggle for optional lines, and "I already have this" for every line. */
function LineToggles({ line }: { line: PricedLine }) {
  const { update } = useDraft();
  return (
    <div className="line-toggles">
      {line.optional && (
        <label>
          <input
            type="checkbox"
            checked={line.included}
            onChange={(e) =>
              update((d) => setLineState(d, line.key, { includeOptional: e.target.checked }))
            }
          />{" "}
          Include this optional item
        </label>
      )}
      <label>
        <input
          type="checkbox"
          checked={line.haveIt}
          onChange={(e) => update((d) => setLineState(d, line.key, { haveIt: e.target.checked }))}
        />{" "}
        I already have this
      </label>
    </div>
  );
}

/** "Pick a price": every match, cheapest first, unpriced ones shown but not pickable. */
function MatchPicker({ line }: { line: PricedLine }) {
  const { update } = useDraft();
  const selected = line.price.overridden ? null : line.price.commodityKey;
  return (
    <>
      <h2>Pick a price</h2>
      {line.matches.length === 0 ? (
        <p className="muted">No DA or DTI price matches this item.</p>
      ) : (
        <ul className="matches">
          {line.matches.map((m) => (
            <li key={m.commodityKey}>
              <label className={m.commodityKey === selected ? "match selected" : "match"}>
                <input
                  type="radio"
                  name="match"
                  checked={m.commodityKey === selected}
                  disabled={m.lineCentavos === null}
                  onChange={() => update((d) => pickMatch(d, line.key, m.commodityKey))}
                />
                <MatchDetails match={m} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function MatchDetails({ match: m }: { match: PricedMatch }) {
  return (
    <>
      <span className="line-body">
        <span className="line-name">
          {m.name}
          {m.cheapest && <span className="badge cheapest">cheapest</span>}
          {m.rough && <span className="badge estimate">estimate</span>}
        </span>
        {m.spec && <span className="muted small">{m.spec}</span>}
        <span className="small">
          {formatBuy(m.buy)}
          {m.unitPriceCentavos !== null && <> · {formatPeso(m.unitPriceCentavos)} each</>}
        </span>
        <span className="muted small">
          {formatSource(m.source, m.publishedOn)}
          {m.publicationTitle && <> · {m.publicationTitle}</>}
        </span>
      </span>
      <span className="line-price">
        {m.lineCentavos !== null ? formatPeso(m.lineCentavos) : "no price"}
      </span>
    </>
  );
}

/** "Or enter your own price": a Price Override for the whole line, with Clear. */
function OverrideForm({ line }: { line: PricedLine }) {
  const { update } = useDraft();
  const current = line.price.overridden ? line.price.lineCentavos : null;
  const [text, setText] = useState(current === null ? "" : (current / 100).toFixed(2));
  const centavos = parsePesos(text);

  return (
    <>
      <h2>Or enter your own price</h2>
      <form
        className="override-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (centavos !== null) {
            update((d) => setLineState(d, line.key, { overrideCentavos: centavos }));
          }
        }}
      >
        <label className="peso-field">
          <span aria-hidden="true">₱</span>
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={text}
            aria-label={`Your price for all of ${line.name}`}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button type="submit" className="button primary" disabled={centavos === null}>
          Use my price
        </button>
        {line.price.overridden && (
          <button
            type="button"
            className="button"
            onClick={() => {
              setText("");
              update((d) => setLineState(d, line.key, { overrideCentavos: undefined }));
            }}
          >
            Clear
          </button>
        )}
      </form>
    </>
  );
}
