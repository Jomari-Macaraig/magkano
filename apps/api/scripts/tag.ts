// Usage: pnpm tag            propose a Tag for every Ingredient and Commodity with no entry
//        pnpm tag --check    accept proposals that agree with reference-tags.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { recipes } from "../data/recipes";
import { tags } from "../data/tags";
import { type AgreementRate, runCheck } from "../src/tagging/check";
import {
  formatTagAssignments,
  loadPublicationFiles,
  referenceTagsSchema,
  tagAssignmentsSchema,
  taggingItems,
} from "../src/tagging/files";
import { createOpenAiTaggingClient } from "../src/tagging/openai";
import { runTag, type TagAssignments } from "../src/tagging/tag";

const dataPath = (name: string) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));
const assignmentsPath = dataPath("tag-assignments.json");
const referencePath = dataPath("reference-tags.json");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Writes the file, then fails the run while anything is still `proposed`. */
function save(assignments: TagAssignments) {
  writeFileSync(assignmentsPath, formatTagAssignments(assignments));
  const proposed = Object.values(assignments).filter((a) => a.status === "proposed").length;
  if (proposed > 0) {
    console.log(
      `\n${proposed} Tag Assignments are still proposed: review them in tag-assignments.json.`,
    );
    process.exitCode = 1;
  }
}

const formatRate = ({ agreed, checked }: AgreementRate) =>
  checked === 0
    ? "nothing checked"
    : `${agreed}/${checked} (${((agreed / checked) * 100).toFixed(1)}%)`;

const assignments = existsSync(assignmentsPath)
  ? tagAssignmentsSchema.parse(readJson(assignmentsPath))
  : {};

if (process.argv.includes("--check")) {
  if (!existsSync(referencePath))
    fail("tag --check: reference-tags.json is gone; nothing to check.");
  if (!existsSync(assignmentsPath))
    fail("tag --check: no tag-assignments.json yet; run `pnpm tag` first.");
  const result = runCheck(assignments, referenceTagsSchema.parse(readJson(referencePath)));
  for (const d of result.disagreements) {
    const proposal = d.proposedNewTag ? `${d.tag} (new Tag: ${d.proposedNewTag})` : `${d.tag}`;
    console.log(`${d.key}\n  proposed: ${proposal}\n  reference: ${d.referenceTag}`);
  }
  for (const key of result.noReference) console.log(`${key}\n  no reference Tag`);
  console.log(`\nIngredients agree: ${formatRate(result.rates.ingredients)}`);
  console.log(`Commodities agree: ${formatRate(result.rates.commodities)}`);
  save(result.assignments);
} else {
  const items = taggingItems(recipes, loadPublicationFiles(dataPath("publications")));
  const missing = items.filter((item) => !(item.key in assignments)).length;
  const apiKey = process.env.OPENAI_API_KEY || undefined;
  if (missing > 0 && !apiKey)
    fail(`tag: ${missing} items need a Tag, but OPENAI_API_KEY is unset.`);
  if (missing > 0) console.log(`Asking for ${missing} Tag Assignments...`);
  const result = await runTag({
    items,
    tagSlugs: tags.map((t) => t.slug),
    assignments,
    client: createOpenAiTaggingClient(apiKey),
  });
  for (const key of result.stale) console.log(`Stale (item no longer exists): ${key}`);
  for (const { key, reason } of result.unresolved) console.log(`Not tagged (${reason}): ${key}`);
  if (result.unresolved.length > 0) process.exitCode = 1;
  save(result.assignments);
}
