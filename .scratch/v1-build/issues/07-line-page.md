# 07: Line page: compare, pick and override

**What to build:** A shopper taps a Grocery List line and gets a full-screen line page. It shows:
- how much each Recipe needs, the total needed and "You'll buy";
- every Ingredient Match cheapest first, each with its source, Publication and date.

From there the shopper can pick a different match, enter their own price for the whole line, include an optional Ingredient, or mark Have It. The page also explains Rough Estimates and unavailable picks. Spec: "Frontend → Line page", user stories 37–45.

**Blocked by:** 06 (Price a Draft on the Grocery List screen).

**Status:** resolved

- [x] Tapping a line opens its line page at a route keyed by the line key, with back to the list. It needs no extra API call, because `POST /api/price` already returns everything.
- [x] Per-Recipe breakdown of the need, total needed and "You'll buy" in Purchase Units.
- [x] "Pick a price" lists every match cheapest first, each with units × Purchase Unit, price each, source, Publication title and date, line cost and a "cheapest" pill. Picking a match updates the line and the total, and **clears any Price Override** in the same Draft update.
- [x] "Or enter your own price" sets a Price Override for the whole line, with Clear. The line shows a "your price" badge.
- [x] Optional lines have an include toggle, and every line has "I already have this".
- [x] A Rough Estimate line explains: "we don't know how much a piece weighs, so this is the price of one Purchase Unit".
- [x] When `pickUnavailable` is set, the page shows "Your pick is no longer available, using the cheapest."
- [x] An unknown line key, such as a stale link, goes back to the list.
