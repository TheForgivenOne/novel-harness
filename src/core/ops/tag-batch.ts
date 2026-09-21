import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { Bundle } from "../bundle/bundle.ts";
import { getType, type Concept } from "../bundle/concept.ts";
import { writeConcept } from "../bundle/write.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import { stringList } from "../text/guards.ts";

export interface TagBatchChange {
  path: string;
  added: string[];
}

export interface TagBatchResult {
  changed: TagBatchChange[];
  unchanged: string[];
  rules: number;
}

interface TagRule {
  match: Record<string, unknown>;
  add: string[];
}

function parseRules(raw: string): TagRule[] {
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new Error(`invalid rules YAML: ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("rules file must be a YAML list of { match, add } rules");
  }

  const rules: TagRule[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error("each rule must be a mapping with `match` and `add`");
    }
    const record = entry as Record<string, unknown>;

    const rawMatch = record.match ?? {};
    if (typeof rawMatch !== "object" || rawMatch === null || Array.isArray(rawMatch)) {
      throw new Error("rule `match` must be a mapping");
    }

    const rawAdd = record.add;
    if (!Array.isArray(rawAdd)) {
      throw new Error("rule `add` must be a list of strings");
    }
    const add: string[] = [];
    for (const tag of rawAdd) {
      if (typeof tag !== "string") throw new Error("rule `add` must be a list of strings");
      add.push(tag);
    }

    rules.push({ match: rawMatch as Record<string, unknown>, add });
  }
  return rules;
}

function fieldMatches(field: unknown, expected: unknown): boolean {
  if (Array.isArray(field)) return field.some((entry) => fieldMatches(entry, expected));
  if (field === null || field === undefined || typeof field === "object") return false;
  if (expected === null || expected === undefined || typeof expected === "object") return false;
  return String(field).toLowerCase() === String(expected).toLowerCase();
}

function ruleMatches(concept: Concept, rule: TagRule): boolean {
  for (const [key, value] of Object.entries(rule.match)) {
    if (key === "type") {
      const type = getType(concept);
      if (type === undefined || type.toLowerCase() !== String(value).toLowerCase()) return false;
      continue;
    }
    if (key === "file") {
      if (!new Bun.Glob(String(value)).match(concept.path)) return false;
      continue;
    }
    if (!fieldMatches(concept.frontmatter[key], value)) return false;
  }
  return true;
}

export async function applyTagRules(bundle: Bundle, rulesPath: string): Promise<TagBatchResult> {
  const raw = await readFile(rulesPath, "utf8");
  const rules = parseRules(raw);

  const changed: TagBatchChange[] = [];
  const unchanged: string[] = [];

  for (const concept of bundle.concepts) {
    const existing = stringList(concept.frontmatter.tags);
    const seen = new Set(existing.map((tag) => tag.toLowerCase()));
    const additions: string[] = [];

    for (const rule of rules) {
      if (!ruleMatches(concept, rule)) continue;
      for (const tag of rule.add) {
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        additions.push(tag);
      }
    }

    if (additions.length === 0) {
      unchanged.push(concept.path);
      continue;
    }

    await writeConcept(bundle, concept, { tags: [...existing, ...additions] }, concept.body);
    changed.push({ path: concept.path, added: additions });
  }

  if (changed.length > 0) {
    await regenerateIndexes(bundle);
    await appendLog(bundle, "", {
      date: today(),
      action: "Tag",
      message: `Tagged ${changed.length} concept(s) via batch rules.`,
    });
  }

  return { changed, unchanged, rules: rules.length };
}
