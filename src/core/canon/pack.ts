import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadBundle, type Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { regenerateIndexes } from "../index/generate.ts";

export const PACK_FILE = "pack.json";

export interface PackMeta {
  name: string;
  fandom?: string;
  source_works: string[];
  exportedAt: string;
  concepts: number;
}

export interface ImportOptions {
  force?: boolean;
}

export interface ImportResult {
  added: string[];
  updated: string[];
  unchanged: string[];
  keptLocal: string[];
  conflicts: string[];
}

/** A canon pack holds imported canon plus the references (source works, voice). */
export function isCanonConcept(concept: Concept): boolean {
  if (concept.path.startsWith("references/")) return true;
  return concept.frontmatter.origin === "source";
}

export function selectCanonConcepts(bundle: Bundle): Concept[] {
  return bundle.concepts.filter(isCanonConcept);
}

export async function exportPack(
  bundle: Bundle,
  outDir: string,
  now = new Date().toISOString(),
): Promise<{ meta: PackMeta; files: string[] }> {
  const target = resolve(outDir);
  const root = resolve(bundle.root);
  if (target === root || target.startsWith(`${root}/`)) {
    throw new Error("refusing to export a canon pack inside the story bundle");
  }

  const concepts = selectCanonConcepts(bundle);
  const novel = bundle.concepts.find((concept) => getType(concept) === "Novel");
  const frontmatter = novel?.frontmatter ?? {};
  const fandom = typeof frontmatter.fandom === "string" ? frontmatter.fandom : undefined;
  const sourceWorks = Array.isArray(frontmatter.source_works)
    ? frontmatter.source_works.filter((link): link is string => typeof link === "string")
    : [];
  const name = fandom ?? (novel ? getTitle(novel) : "canon");

  const meta: PackMeta = {
    name,
    ...(fandom ? { fandom } : {}),
    source_works: sourceWorks,
    exportedAt: now,
    concepts: concepts.length,
  };

  const files: string[] = [];
  for (const concept of concepts) {
    const abs = join(target, concept.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, concept.raw, "utf8");
    files.push(concept.path);
  }

  await mkdir(target, { recursive: true });
  await writeFile(join(target, PACK_FILE), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  await regenerateIndexes(await loadBundle(target));

  files.sort();
  return { meta, files };
}

export async function readPackMeta(packDir: string): Promise<PackMeta> {
  const raw = await readFile(join(packDir, PACK_FILE), "utf8").catch(() => undefined);
  if (!raw) throw new Error(`not a canon pack (missing ${PACK_FILE}): ${packDir}`);
  return JSON.parse(raw) as PackMeta;
}

export async function importPack(
  bundlePath: string,
  packDir: string,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const pack = await loadBundle(packDir);
  const local = await loadBundle(bundlePath);
  const localById = new Map(local.concepts.map((concept) => [concept.id, concept]));

  const result: ImportResult = {
    added: [],
    updated: [],
    unchanged: [],
    keptLocal: [],
    conflicts: [],
  };

  for (const concept of pack.concepts) {
    const dest = join(bundlePath, concept.path);
    const existing = localById.get(concept.id);

    if (!existing) {
      if (existsSync(dest)) {
        result.conflicts.push(concept.path);
        continue;
      }
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, concept.raw, "utf8");
      result.added.push(concept.path);
      continue;
    }

    if (existing.raw === concept.raw) {
      result.unchanged.push(concept.path);
      continue;
    }

    const origin = existing.frontmatter.origin;
    if (origin !== undefined && origin !== "source") {
      result.keptLocal.push(concept.path);
      continue;
    }

    if (!options.force) {
      result.conflicts.push(concept.path);
      continue;
    }

    await writeFile(join(bundlePath, existing.path), concept.raw, "utf8");
    result.updated.push(existing.path);
  }

  for (const list of Object.values(result)) list.sort();
  return result;
}
