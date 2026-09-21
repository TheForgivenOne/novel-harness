import type { Bundle } from "../bundle/bundle.ts";
import type { Concept } from "../bundle/concept.ts";
import { resolveSourceResource, sourceEntries } from "../bundle/entries.ts";
import { writeConcept } from "../bundle/write.ts";
import { isBundleLink, SCHEME_RE } from "../bundle/paths.ts";

export interface SourceAuditEntry {
  path: string;
  id?: string;
  resource: string;
  category: string;
  resolved?: boolean;
}

export interface SourceAudit {
  totals: Record<string, number>;
  entries: SourceAuditEntry[];
}

export const SOURCE_CATEGORIES = [
  "url",
  "bundle",
  "quoted",
  "bare-wiki",
  "non-followable",
] as const;

export function classifySource(resource: string): string {
  const value = resource.trim();
  if (/^https?:\/\//i.test(value)) return "url";
  const asUnknown: unknown = value;
  if (isBundleLink(asUnknown)) return "bundle";
  const quote = value[0];
  if (
    value.length >= 2 &&
    quote !== undefined &&
    (quote === '"' || quote === "'") &&
    value.endsWith(quote)
  ) {
    return "quoted";
  }
  if (value.endsWith(".md") && !SCHEME_RE.test(value) && !/\s/.test(value)) return "bundle";
  if (!value.includes("/") && !SCHEME_RE.test(value) && (/wiki/i.test(value) || !/\s/.test(value))) {
    return "bare-wiki";
  }
  return "non-followable";
}

function sourceResources(concept: Concept): string[] {
  return sourceEntries(concept).map((entry) => entry.resource);
}

function unquote(resource: string): string {
  const value = resource.trim();
  const quote = value[0];
  if (
    quote !== undefined &&
    (quote === '"' || quote === "'") &&
    value.length >= 2 &&
    value.endsWith(quote)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function auditSources(bundle: Bundle): SourceAudit {
  const entries: SourceAuditEntry[] = [];
  const totals: Record<string, number> = {
    total: 0,
    url: 0,
    bundle: 0,
    quoted: 0,
    "bare-wiki": 0,
    "non-followable": 0,
    resolved: 0,
    unresolved: 0,
  };

  for (const concept of bundle.concepts) {
    for (const resource of sourceResources(concept)) {
      const category = classifySource(resource);
      totals.total = (totals.total ?? 0) + 1;
      totals[category] = (totals[category] ?? 0) + 1;

      const entry: SourceAuditEntry = { path: concept.path, resource, category };
      if (category === "bundle") {
        const id = resolveSourceResource(bundle, resource, concept.path);
        if (id !== undefined) {
          entry.id = id;
          entry.resolved = true;
        } else {
          entry.resolved = false;
        }
        const key = entry.resolved ? "resolved" : "unresolved";
        totals[key] = (totals[key] ?? 0) + 1;
      }
      entries.push(entry);
    }
  }

  return { totals, entries };
}

export async function fixQuotedSources(bundle: Bundle): Promise<string[]> {
  const fixed: string[] = [];

  for (const concept of bundle.concepts) {
    const raw = concept.frontmatter.sources;
    if (!Array.isArray(raw)) continue;

    let changed = false;
    const sources = raw.map((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
      const record = entry as Record<string, unknown>;
      const resource = record.resource;
      if (typeof resource !== "string" || classifySource(resource) !== "quoted") return entry;
      changed = true;
      return { ...record, resource: unquote(resource) };
    });

    if (!changed) continue;
    await writeConcept(bundle, concept, { sources }, concept.body);
    fixed.push(concept.path);
  }

  return fixed;
}
