import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publicationFileSchema } from "./extract.ts";
import { writePublicationFile } from "./write.ts";

const samplePath = (name: string) =>
  new URL(`../../../../sample/${name}`, import.meta.url).pathname;

describe("writePublicationFile", () => {
  it("writes <source>-<date>.json, and the same bytes on a re-run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "extract-"));
    const path = await writePublicationFile(
      samplePath("Daily-Price-Index-October-8-2026.pdf"),
      dir,
    );
    expect(path).toBe(join(dir, "da-2026-10-08.json"));
    const first = readFileSync(path, "utf8");
    expect(publicationFileSchema.parse(JSON.parse(first)).commodities).toHaveLength(202);

    await writePublicationFile(samplePath("Daily-Price-Index-October-8-2026.pdf"), dir);
    expect(readFileSync(path, "utf8")).toBe(first);
  });

  it("writes nothing when the PDF can't be read with certainty", async () => {
    const dir = mkdtempSync(join(tmpdir(), "extract-"));
    const notAPublication = join(dir, "blank.pdf");
    writeFileSync(notAPublication, "not a pdf");
    await expect(writePublicationFile(notAPublication, join(dir, "out"))).rejects.toThrow();
    expect(readdirSync(dir)).toEqual(["blank.pdf"]);
  });
});
