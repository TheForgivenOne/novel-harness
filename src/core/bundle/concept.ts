import { parseDocument } from "./frontmatter.ts";
import { conceptIdFromPath, toPosix } from "./paths.ts";

export interface Concept {
  /** Bundle-relative path without the `.md` suffix, for example `characters/elena-voss`. */
  id: string;
  /** Bundle-relative path with the `.md` suffix. */
  path: string;
  /** Absolute path on disk. */
  absPath: string;
  /** Parsed YAML frontmatter. `type` may be missing; validation reports that. */
  frontmatter: Record<string, unknown>;
  /** Markdown body after the frontmatter block. */
  body: string;
  /** The original file contents. */
  raw: string;
}

export function parseConcept(absPath: string, relPath: string, raw: string): Concept {
  const path = toPosix(relPath);
  const doc = parseDocument(raw);
  return {
    id: conceptIdFromPath(path),
    path,
    absPath,
    frontmatter: doc.data,
    body: doc.body,
    raw,
  };
}

export function getType(concept: Concept): string | undefined {
  const value = concept.frontmatter.type;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function getTitle(concept: Concept): string {
  const value = concept.frontmatter.title;
  if (typeof value === "string" && value.trim() !== "") return value;
  return concept.id;
}
