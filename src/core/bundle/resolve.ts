import type { Bundle } from "./bundle.ts";
import { getTitle, type Concept } from "./concept.ts";
import { basename } from "./paths.ts";
import { normalizeName } from "../text/slug.ts";

function aliasValues(concept: Concept): string[] {
  const aliases = concept.frontmatter.aliases;
  if (!Array.isArray(aliases)) return [];
  return aliases.filter((alias): alias is string => typeof alias === "string");
}

export function resolveConcept(bundle: Bundle, needle: string): Concept | undefined {
  const cleaned = needle.trim().replace(/^\/+/, "").replace(/\.md$/i, "");
  if (cleaned === "") return undefined;

  const exact = bundle.concepts.find(
    (concept) =>
      concept.id === cleaned ||
      basename(concept.id) === cleaned ||
      getTitle(concept) === cleaned ||
      aliasValues(concept).includes(cleaned),
  );
  if (exact) return exact;

  const target = normalizeName(cleaned);
  if (target === "") return undefined;
  return bundle.concepts.find((concept) => {
    const candidates = [concept.id, basename(concept.id), getTitle(concept), ...aliasValues(concept)];
    return candidates.some((value) => normalizeName(value) === target);
  });
}
