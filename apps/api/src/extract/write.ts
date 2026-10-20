import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractPublication, formatPublicationFile, publicationFileName } from "./extract";

/**
 * Extracts one PDF and writes its Publication file into `outDir`, returning the path. The
 * file is written only after the whole PDF has been read, so any failure writes nothing.
 */
export async function writePublicationFile(pdfPath: string, outDir: string): Promise<string> {
  const file = await extractPublication(new Uint8Array(await readFile(pdfPath)));
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, publicationFileName(file));
  await writeFile(path, formatPublicationFile(file));
  return path;
}
