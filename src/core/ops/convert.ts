import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadBundle } from "../bundle/bundle.ts";
import { getType, type Concept } from "../bundle/concept.ts";
import { ensureGenerated, parseDocument, serializeDocument } from "../bundle/frontmatter.ts";
import { basename } from "../bundle/paths.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import { getTypeDefBySlug, type TypeDef } from "../schema/catalog.ts";
import { resolveConcept } from "../bundle/resolve.ts";
import { rewriteBundleLinks, type OpsProject } from "./link-rewrite.ts";

export interface ConvertedConcept {
  from: string;
  to: string;
}

export interface SkippedConcept {
  path: string;
  reason: string;
}

export interface ConvertResult {
  converted: ConvertedConcept[];
  skipped: SkippedConcept[];
}

interface Move {
  concept: Concept;
  toId: string;
  toPath: string;
  content: string;
}

function hasChildConcepts(project: OpsProject, concept: Concept): boolean {
  if (project.bundle.concepts.some((candidate) => candidate.id.startsWith(`${concept.id}/`))) {
    return true;
  }
  return existsSync(join(project.bundle.root, concept.id));
}

function refusalReason(project: OpsProject, fromDef: TypeDef, toDef: TypeDef, concept: Concept): string | undefined {
  if (toDef.singleton) return "singleton types cannot be conversion targets";
  if (fromDef.type === "Scene") return "scenes require manual conversion";
  if (fromDef.type === "Chapter" && hasChildConcepts(project, concept)) {
    return `chapter owns a scene directory at ${concept.id}/; convert it by hand`;
  }
  return undefined;
}

export async function convertConcepts(
  project: OpsProject,
  fromSlug: string,
  toSlug: string,
  options: { file?: string } = {},
): Promise<ConvertResult> {
  const fromDef = getTypeDefBySlug(fromSlug);
  if (!fromDef) throw new Error(`unknown concept type: ${fromSlug}`);
  const toDef = getTypeDefBySlug(toSlug);
  if (!toDef) throw new Error(`unknown concept type: ${toSlug}`);

  const result: ConvertResult = { converted: [], skipped: [] };
  if (fromDef.type === toDef.type) return result;

  const targets: Concept[] = [];
  if (options.file !== undefined) {
    const concept = resolveConcept(project.bundle, options.file);
    if (!concept) throw new Error(`concept not found: ${options.file}`);
    targets.push(concept);
  } else {
    targets.push(...project.bundle.concepts.filter((concept) => getType(concept) === fromDef.type));
  }

  const author = project.config?.author?.trim() || "human:author";
  const moves: Move[] = [];

  for (const concept of targets) {
    if (getType(concept) !== fromDef.type) {
      result.skipped.push({ path: concept.path, reason: `not a ${fromDef.type}` });
      continue;
    }
    const reason = refusalReason(project, fromDef, toDef, concept);
    if (reason) {
      result.skipped.push({ path: concept.path, reason });
      continue;
    }

    const toId = `${toDef.home}/${basename(concept.id)}`;
    const toPath = `${toId}.md`;
    if (toPath !== concept.path && existsSync(join(project.bundle.root, toPath))) {
      result.skipped.push({ path: concept.path, reason: `target already exists: ${toPath}` });
      continue;
    }

    const doc = parseDocument(concept.raw);
    const data: Record<string, unknown> = { ...doc.data, type: toDef.type };
    if (toDef.narrative) {
      if (typeof data.status !== "string" || data.status.trim() === "") data.status = "draft";
      ensureGenerated(data, author);
    }

    moves.push({
      concept,
      toId,
      toPath,
      content: serializeDocument({ data, body: doc.body }),
    });
  }

  for (const move of moves) {
    const abs = join(project.bundle.root, move.toPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, move.content, "utf8");
    if (move.toPath !== move.concept.path) await unlink(move.concept.absPath);
  }

  if (moves.length > 0) {
    let fresh = await loadBundle(project.bundlePath);
    for (const move of moves) {
      await rewriteBundleLinks(fresh, move.concept.id, move.toId);
    }
    fresh = await loadBundle(project.bundlePath);
    await regenerateIndexes(fresh);
    for (const move of moves) {
      fresh = await loadBundle(project.bundlePath);
      await appendLog(fresh, "", {
        date: today(),
        action: "Convert",
        message: `Converted ${move.concept.path} to ${toDef.type}.`,
      });
      result.converted.push({ from: move.concept.path, to: move.toPath });
    }
  }

  return result;
}
