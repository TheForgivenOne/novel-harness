import { writeFile } from "node:fs/promises";
import type { Bundle } from "./bundle.ts";
import type { Concept } from "./concept.ts";
import { parseDocument, serializeDocument } from "./frontmatter.ts";

export interface WriteConceptOptions {
  replace?: boolean;
}

export async function writeConcept(
  bundle: Bundle,
  concept: Concept,
  data: Record<string, unknown>,
  body?: string,
  options: WriteConceptOptions = {},
): Promise<void> {
  if (options.replace === true) {
    await writeFile(concept.absPath, serializeDocument({ data, body: body ?? "" }), "utf8");
    return;
  }
  const doc = parseDocument(concept.raw);
  const merged: Record<string, unknown> = { ...doc.data, ...data };
  await writeFile(
    concept.absPath,
    serializeDocument({ data: merged, body: body ?? doc.body }),
    "utf8",
  );
}