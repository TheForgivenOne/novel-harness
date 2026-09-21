import type { Concept } from "./concept.ts";
import { sourceEntries } from "./entries.ts";
import { normalizeBundlePath } from "./paths.ts";

const MD_LINK_RE = /\]\(([^)\s]+)\)/g;

export const LINK_FIELDS = [
  "pov",
  "location",
  "dies_in",
  "diverges_at",
  "arc",
  "episode",
] as const;
export const LINK_LIST_FIELDS = [
  "cast",
  "characters",
  "participants",
  "themes",
  "affiliations",
  "relationships",
  "source_works",
] as const;

/** Bundle-relative markdown links from a body: `/path/to/concept.md`. */
export function extractBundleLinks(text: string, fromPath?: string): string[] {
  const links: string[] = [];
  for (const match of text.matchAll(MD_LINK_RE)) {
    const target = match[1];
    if (!target || !target.endsWith(".md")) continue;
    if (target.startsWith("/")) {
      links.push(target);
      continue;
    }
    if (fromPath !== undefined) {
      const resolved = normalizeBundlePath(target, fromPath);
      if (resolved !== undefined) links.push(resolved);
    }
  }
  return links;
}

/** All bundle-relative links declared in a concept's frontmatter. */
export function conceptLinks(concept: Concept): string[] {
  const frontmatter = concept.frontmatter;
  const links: string[] = [];

  for (const field of LINK_FIELDS) {
    const value = frontmatter[field];
    if (typeof value === "string" && value.startsWith("/")) links.push(value);
  }
  for (const field of LINK_LIST_FIELDS) {
    const value = frontmatter[field];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry === "string" && entry.startsWith("/")) links.push(entry);
    }
  }

  for (const entry of sourceEntries(concept)) {
    const resource = entry.resource;
    if (!resource.endsWith(".md")) continue;
    const resolved = resource.startsWith("/")
      ? resource
      : normalizeBundlePath(resource, concept.path);
    if (resolved !== undefined) links.push(resolved);
  }

  return links;
}
