import { getType, type Concept } from "../bundle/concept.ts";
import { parseDocument, serializeDocument } from "../bundle/frontmatter.ts";

export interface NovelMetaDefaults {
  sourceWorks?: string[];
  fandom?: string;
}

/**
 * Return the Novel file contents with pack metadata applied: `source_works`
 * entries appended and `fandom` filled when missing. Idempotent.
 */
export function applyNovelMeta(novel: Concept, meta: NovelMetaDefaults): string {
  if (getType(novel) !== "Novel") {
    throw new Error(`expected a Novel concept, found ${getType(novel) ?? "unknown"}`);
  }
  const doc = parseDocument(novel.raw);
  const current = Array.isArray(doc.data.source_works) ? doc.data.source_works : [];
  const links = current.filter((entry): entry is string => typeof entry === "string");
  for (const link of meta.sourceWorks ?? []) {
    if (!links.includes(link)) links.push(link);
  }

  const data: Record<string, unknown> = { ...doc.data };
  if (links.length > 0) data.source_works = links;
  if (meta.fandom && !data.fandom) data.fandom = meta.fandom;

  return serializeDocument({ data, body: doc.body });
}

/** Return the Novel file contents with `link` appended to `source_works`. */
export function applySourceWork(novel: Concept, link: string): string {
  return applyNovelMeta(novel, { sourceWorks: [link] });
}
