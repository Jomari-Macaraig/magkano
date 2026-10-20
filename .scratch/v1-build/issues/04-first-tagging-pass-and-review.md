# 04: Run the first tagging pass and review it

**What to build:** The real reviewed Tag Assignments for v1. The project owner runs the LLM over every Ingredient and Commodity, settles the disagreements with the existing reviewed Tags, and commits the result, so `seed` has a complete reviewed dataset. Spec: "Data files and scripts → Review", "Order". Expected time: 10–20 minutes. Expected cost: about $0.05.

**Blocked by:** 03 (Tag script and check).

**Status:** ready-for-human

- [ ] `OPENAI_API_KEY` is set in `.env`, and `tag` has run over all Ingredients and Commodities.
- [ ] `tag --check` has run, and the agreement rates for Ingredients and Commodities are recorded in a comment on this ticket.
- [ ] Every disagreement is settled: the entry's `tag` corrected if needed, then `status: "reviewed"`.
- [ ] Every `proposedNewTag` is either added to the vocabulary and pointed to, or replaced by an existing Tag (or a reviewed `tag: null`).
- [ ] `tag` exits 0 because nothing is `proposed`, `reference-tags.json` is deleted, and `tag-assignments.json` is committed.
