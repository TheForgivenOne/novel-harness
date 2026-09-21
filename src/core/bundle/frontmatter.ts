import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { isRecord } from "../text/guards.ts";

export interface ParsedDocument {
  data: Record<string, unknown>;
  body: string;
}

export class FrontmatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrontmatterError";
  }
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

const PREFERRED_KEY_ORDER = [
  "okf_version",
  "type",
  "title",
  "description",
  "resource",
  "tags",
  "status",
  "origin",
  "fate",
  "role",
  "category",
  "kind",
  "fandom",
  "canon_type",
  "source_works",
  "diverges_at",
  "divergence",
  "sequence",
  "when",
  "pov",
  "location",
  "cast",
  "aliases",
  "affiliations",
  "relationships",
  "characters",
  "genre",
  "tense",
  "themes",
  "participants",
  "stakes",
  "question",
  "refs",
  "sources",
  "generated",
  "verified",
  "stale_after",
];

export function canonicalizeKeys(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PREFERRED_KEY_ORDER) {
    if (Object.hasOwn(data, key)) out[key] = data[key];
  }
  const rest = Object.keys(data)
    .filter((key) => !PREFERRED_KEY_ORDER.includes(key))
    .sort();
  for (const key of rest) out[key] = data[key];
  return out;
}

export interface DetectedDocument {
  data: Record<string, unknown>;
  body: string;
  /** True when the document started with a frontmatter block. */
  hasFrontmatter: boolean;
}

export function detectDocument(raw: string): DetectedDocument {
  const source = raw.replace(/^\uFEFF/, "");
  if (!source.startsWith("---")) {
    return { data: {}, body: source, hasFrontmatter: false };
  }
  const match = FRONTMATTER_RE.exec(source);
  if (!match) {
    throw new FrontmatterError("unterminated YAML frontmatter block");
  }
  const yamlSource = match[1] ?? "";
  let data: unknown;
  try {
    data = parseYaml(yamlSource);
  } catch (error) {
    throw new FrontmatterError(`invalid YAML: ${(error as Error).message}`);
  }
  if (data === null || data === undefined) data = {};
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new FrontmatterError("frontmatter must be a YAML mapping");
  }
  return {
    data: canonicalizeKeys(data as Record<string, unknown>),
    body: source.slice(match[0].length),
    hasFrontmatter: true,
  };
}

export function parseDocument(raw: string): ParsedDocument {
  const detected = detectDocument(raw);
  if (!detected.hasFrontmatter) {
    throw new FrontmatterError("missing YAML frontmatter block");
  }
  return { data: detected.data, body: detected.body };
}

export function serializeDocument(doc: ParsedDocument): string {
  const yamlText = stringifyYaml(canonicalizeKeys(doc.data), {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  }).trimEnd();
  const body = doc.body.replace(/^\n+/, "").replace(/\s*$/, "");
  const trailing = body.length > 0 ? `${body}\n` : "";
  return `---\n${yamlText}\n---\n\n${trailing}`;
}

export function ensureGenerated(
  data: Record<string, unknown>,
  actor: string,
  options: { forceAt?: boolean } = {},
): Record<string, unknown> {
  const generated = isRecord(data.generated) ? (data.generated as Record<string, unknown>) : undefined;
  const hasValidBy =
    generated !== undefined &&
    typeof generated.by === "string" &&
    generated.by.trim() !== "";
  const hasValidAt =
    generated !== undefined &&
    typeof generated.at === "string" &&
    generated.at.trim() !== "";
  if (!options.forceAt && hasValidBy && hasValidAt) {
    return data;
  }
  data.generated = {
    ...(generated ?? {}),
    by: hasValidBy ? (generated as Record<string, unknown>).by : actor,
    at: new Date().toISOString(),
  };
  return data;
}
