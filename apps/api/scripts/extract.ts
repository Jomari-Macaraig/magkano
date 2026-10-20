// Usage: pnpm --filter @magkano/api extract <pdf>
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writePublicationFile } from "../src/extract/write";

const pdf = process.argv[2];
if (!pdf) {
  console.error("Usage: extract <pdf>");
  process.exit(1);
}
const outDir = fileURLToPath(new URL("../data/publications", import.meta.url));
try {
  // pnpm runs this from apps/api; resolve the PDF from where the command was typed.
  const path = await writePublicationFile(
    resolve(process.env.INIT_CWD ?? process.cwd(), pdf),
    outDir,
  );
  console.log(`Wrote ${path}`);
} catch (error) {
  console.error(
    `extract failed, nothing written: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}
