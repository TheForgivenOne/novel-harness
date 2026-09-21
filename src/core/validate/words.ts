import { collectManuscript } from "../build/manuscript.ts";
import type { Bundle } from "../bundle/bundle.ts";
import { chapterWordState, countWords, parseWordBounds } from "../text/words.ts";
import type { Diagnostic } from "./diagnostics.ts";

const EXEMPT_STATUS = new Set(["draft", "deprecated"]);

function statusOf(frontmatter: Record<string, unknown>): string {
  const value = frontmatter.status;
  return typeof value === "string" ? value.trim().toLowerCase() : "stable";
}

export function validateWordCounts(bundle: Bundle): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const chapter of collectManuscript(bundle).chapters) {
    const concept = chapter.concept;
    if (!concept || concept.frontmatter.words === undefined) continue;

    const parsed = parseWordBounds(concept.frontmatter.words);
    if (!parsed.ok) {
      diagnostics.push({
        severity: "error",
        code: "profile/words",
        path: concept.path,
        message: parsed.message,
      });
      continue;
    }

    const written = chapter.scenes.reduce((total, scene) => total + countWords(scene.body), 0);
    if (written === 0) continue;
    if (EXEMPT_STATUS.has(statusOf(concept.frontmatter))) continue;

    const state = chapterWordState(parsed.bounds, written);
    if (state === "under" && parsed.bounds.min !== undefined) {
      diagnostics.push({
        severity: "warning",
        code: "profile/word-count",
        path: concept.path,
        message:
          `chapter is ${parsed.bounds.min - written} words below its ` +
          `${parsed.bounds.min}-word minimum (${written} written)`,
      });
    } else if (state === "over" && parsed.bounds.max !== undefined) {
      diagnostics.push({
        severity: "warning",
        code: "profile/word-count",
        path: concept.path,
        message:
          `chapter is ${written - parsed.bounds.max} words above its ` +
          `${parsed.bounds.max}-word maximum (${written} written)`,
      });
    }
  }

  return diagnostics;
}
