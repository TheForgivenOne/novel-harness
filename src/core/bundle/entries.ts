import type { Bundle } from "./bundle.ts";
import type { Concept } from "./concept.ts";
import { linkTargetId, normalizeBundlePath } from "./paths.ts";

export interface SourceEntry {
  resource: string;
  title?: string;
  author?: string;
  id?: string;
  usage_count?: number;
  last_modified?: string;
}

export interface RefEntry {
  title: string;
  url: string;
  kind?: string;
}

export function sourceEntries(concept: Concept): SourceEntry[] {
  const raw = concept.frontmatter.sources;
  if (!Array.isArray(raw)) return [];
  const entries: SourceEntry[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const resource = record.resource;
    if (typeof resource !== "string" || resource.trim() === "") continue;
    entries.push({
      resource,
      ...(typeof record.title === "string" ? { title: record.title } : {}),
      ...(typeof record.author === "string" ? { author: record.author } : {}),
      ...(typeof record.id === "string" ? { id: record.id } : {}),
      ...(typeof record.usage_count === "number" ? { usage_count: record.usage_count } : {}),
      ...(typeof record.last_modified === "string" ? { last_modified: record.last_modified } : {}),
    });
  }
  return entries;
}

export function refEntries(concept: Concept): RefEntry[] {
  const raw = concept.frontmatter.refs;
  if (!Array.isArray(raw)) return [];
  const entries: RefEntry[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.url !== "string") continue;
    entries.push({
      title: typeof record.title === "string" ? record.title : record.url,
      url: record.url,
      ...(typeof record.kind === "string" ? { kind: record.kind } : {}),
    });
  }
  return entries;
}

export function resolveSourceResource(
  bundle: Bundle,
  resource: string,
  fromPath = "",
): string | undefined {
  const trimmed = resource.trim();
  const resolved = trimmed.startsWith("/") ? trimmed : normalizeBundlePath(trimmed, fromPath);
  if (resolved === undefined) return undefined;
  const id = linkTargetId(resolved);
  return bundle.concepts.some((concept) => concept.id === id) ? id : undefined;
}