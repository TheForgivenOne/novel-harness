import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Bundle } from "../bundle/bundle.ts";
import { conceptIdFromPath } from "../bundle/paths.ts";
import { parseDocument, serializeDocument } from "../bundle/frontmatter.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import { newConceptDraft, type NewConceptOptions } from "./new-concept.ts";
import { getTypeDefBySlug } from "../schema/catalog.ts";

export interface ImportRow {
  type: string;
  [field: string]: string;
}

export interface ImportSummary {
  created: string[];
  skipped: { row: number; path: string; reason: string }[];
}

export interface ImportProject {
  bundle: Bundle;
  bundlePath: string;
  author: string;
}

const MAPPED_KEYS = new Set([
  "type",
  "title",
  "name",
  "chapter",
  "pov",
  "cast",
  "when",
  "location",
  "tags",
  "sequence",
  "role",
  "fate",
  "origin",
  "divergence",
  "diverges_at",
  "category",
  "kind",
  "resource",
  "characters",
  "aliases",
  "source_works",
  "fandom",
  "canon_type",
]);

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
        continue;
      }
      field += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeKey(key: string): string {
  return key.trim().replace(/-/g, "_");
}

function coerce(value: unknown, row: number, key: string): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(",");
  if (typeof value === "object") throw new Error(`row ${row}: ${key} must be a scalar or list`);
  return String(value);
}

export function parseImport(source: string, filename: string): ImportRow[] {
  const extension = extname(filename).toLowerCase();
  const trimmed = source.trimStart();
  const looksYaml = extension === ".yaml" || extension === ".yml" || trimmed.startsWith("-");

  const records: Record<string, string>[] = [];
  if (looksYaml) {
    const parsed = parseYaml(source);
    if (!Array.isArray(parsed)) throw new Error("import file must be a list of mappings");
    parsed.forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        throw new Error(`row ${index + 1}: must be a mapping`);
      }
      const record: Record<string, string> = {};
      for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
        record[normalizeKey(key)] = coerce(value, index + 1, key);
      }
      records.push(record);
    });
  } else {
    const rows = parseCsv(source);
    const header = rows[0];
    if (header === undefined) throw new Error("import file is empty");
    const keys = header.map(normalizeKey);
    for (let index = 1; index < rows.length; index++) {
      const values = rows[index] ?? [];
      const record: Record<string, string> = {};
      keys.forEach((key, position) => {
        record[key] = (values[position] ?? "").trim();
      });
      records.push(record);
    }
  }

  return records.map((record, index) => {
    if (record.type === undefined || record.type === "") {
      throw new Error(`row ${index + 1}: type is required`);
    }
    return record as ImportRow;
  });
}

export async function importConcepts(
  project: ImportProject,
  rows: ImportRow[],
  options: { dryRun?: boolean; source?: string } = {},
): Promise<ImportSummary> {
  const working: Bundle = { ...project.bundle, concepts: [...project.bundle.concepts] };
  const drafts: { row: number; path: string; content: string; data: Record<string, unknown> }[] = [];
  const skipped: ImportSummary["skipped"] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const def = getTypeDefBySlug(row.type);
    if (!def) throw new Error(`row ${rowNumber}: unknown concept type "${row.type}"`);

    const optionsForRow: NewConceptOptions = {
      name: row.title !== undefined && row.title !== "" ? row.title : row.name,
      author: project.author,
      pov: row.pov,
      chapter: row.chapter,
      category: row.category,
      when: row.when,
      resource: row.resource,
      role: row.role,
      fate: row.fate,
      kind: row.kind,
      characters: row.characters,
      cast: row.cast,
      location: row.location,
      origin: row.origin,
      divergesAt: row.diverges_at,
      fandom: row.fandom,
      canonType: row.canon_type,
      sourceWorks: row.source_works,
      tags: row.tags,
      aliases: row.aliases,
      sequence: row.sequence === undefined || row.sequence === "" ? undefined : Number(row.sequence),
      divergence: row.divergence,
    };
    if (optionsForRow.sequence !== undefined && !Number.isFinite(optionsForRow.sequence)) {
      throw new Error(`row ${rowNumber}: sequence must be a number`);
    }
    if (optionsForRow.aliases !== undefined && optionsForRow.aliases === "") {
      optionsForRow.aliases = undefined;
    }

    let draft;
    try {
      draft = newConceptDraft(working, def, optionsForRow);
    } catch (error) {
      throw new Error(`row ${rowNumber}: ${(error as Error).message}`);
    }

    if (working.concepts.some((concept) => concept.path === draft.path)) {
      skipped.push({ row: rowNumber, path: draft.path, reason: "already exists" });
      return;
    }

    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (MAPPED_KEYS.has(key) || key === "") continue;
      if (value === "") continue;
      extra[key] = value;
    }

    let content = draft.content;
    let data = draft.data;
    if (Object.keys(extra).length > 0) {
      const doc = parseDocument(draft.content);
      data = { ...doc.data, ...extra };
      content = serializeDocument({ data, body: doc.body });
    }

    drafts.push({ row: rowNumber, path: draft.path, content, data });
    working.concepts.push({
      id: conceptIdFromPath(draft.path),
      path: draft.path,
      absPath: join(project.bundlePath, draft.path),
      frontmatter: data,
      body: "",
      raw: content,
    });
  });

  if (options.dryRun !== true) {
    for (const draft of drafts) {
      const abs = join(project.bundlePath, draft.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, draft.content, "utf8");
    }
    await regenerateIndexes(working);
    const source = options.source ?? "import";
    await appendLog(working, "", {
      date: today(),
      action: "Creation",
      message: `Imported ${drafts.length} concept(s) from ${source}.`,
    });
  }

  return { created: drafts.map((draft) => draft.path), skipped };
}
