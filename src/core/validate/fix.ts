import { readFile } from "node:fs/promises";
import type { Bundle } from "../bundle/bundle.ts";
import { getType } from "../bundle/concept.ts";
import { parseDocument } from "../bundle/frontmatter.ts";
import { writeConcept } from "../bundle/write.ts";
import { fixQuotedSources } from "../ops/audit-sources.ts";

export interface QuickFix {
  code: string;
  path: string;
  message: string;
}

export async function applyValidateFixes(bundle: Bundle): Promise<QuickFix[]> {
  const fixes: QuickFix[] = [];

  for (const path of await fixQuotedSources(bundle)) {
    fixes.push({
      code: "profile/sources-quoted",
      path,
      message: "stripped quotes from a source resource",
    });
  }

  for (const concept of bundle.concepts) {
    if (getType(concept) !== "Timeline Event") continue;

    const raw = await readFile(concept.absPath, "utf8");
    const doc = parseDocument(raw);
    if (doc.data.divergence !== "added") continue;
    const origin = doc.data.origin;
    if (origin !== undefined && origin !== null && origin !== "") continue;

    await writeConcept(bundle, concept, { ...doc.data, origin: "fanon" }, doc.body, {
      replace: true,
    });
    fixes.push({
      code: "profile/added-origin",
      path: concept.path,
      message: "set origin: fanon on an added fanon event",
    });
  }

  return fixes;
}
