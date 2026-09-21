import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getTitle, getType } from "../bundle/concept.ts";
import { parseDocument, serializeDocument } from "../bundle/frontmatter.ts";
import { loadBundle } from "../bundle/bundle.ts";
import { basename, parentDir } from "../bundle/paths.ts";
import { resolveConcept } from "../bundle/resolve.ts";
import { nextSequence } from "../bundle/sort.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import { rewriteBundleLinks, type OpsProject } from "./link-rewrite.ts";
import { moveChapterFolder } from "./folder.ts";
import { pruneEmptyDirs } from "./prune.ts";
import { slugify } from "../text/slug.ts";

export async function moveConcept(
  project: OpsProject,
  conceptName: string,
  options: { to: string; sequence?: number; dryRun?: boolean },
): Promise<{ from: string; to: string; rewritten: string[] }> {
  const concept = resolveConcept(project.bundle, conceptName);
  if (!concept) throw new Error(`concept not found: ${conceptName}`);
  const type = getType(concept);
  if (type === "Chapter") {
    const slug = slugify(options.to);
    if (slug === "") throw new Error(`cannot derive a slug from "${options.to}"`);
    const newId = `chapters/${slug}`;
    if (newId === concept.id) throw new Error(`chapter is already ${newId}`);
    if (existsSync(join(project.bundle.root, `${newId}.md`))) {
      throw new Error(`target exists: ${newId}.md`);
    }
    if (options.dryRun === true) return { from: concept.id, to: newId, rewritten: [] };

    const newAbs = join(project.bundle.root, `${newId}.md`);
    await mkdir(dirname(newAbs), { recursive: true });
    await writeFile(newAbs, concept.raw, "utf8");
    await unlink(concept.absPath);

    const rewritten = await moveChapterFolder(project, concept, newId);
    await regenerateIndexes(await loadBundle(project.bundle.root));
    await appendLog(await loadBundle(project.bundle.root), "", {
      date: today(),
      action: "Update",
      message: `Moved ${getTitle(concept)} from /${concept.path} to /${newId}.md.`,
    });
    return { from: concept.id, to: newId, rewritten };
  }
  if (type !== "Scene") {
    throw new Error("only scenes or chapters can be moved; use `novel rename` or `novel convert`");
  }

  const chapter = resolveConcept(project.bundle, options.to);
  if (!chapter || getType(chapter) !== "Chapter") {
    throw new Error(`chapter not found: ${options.to}`);
  }

  const newId = `${chapter.id}/scenes/${basename(concept.id)}`;
  if (newId === concept.id) throw new Error(`scene is already in ${chapter.id}`);
  const newPath = `${newId}.md`;
  if (existsSync(join(project.bundle.root, newPath))) {
    throw new Error(`target exists: ${newPath}`);
  }

  const sequence =
    options.sequence ??
    nextSequence(
      project.bundle.concepts.filter(
        (candidate) =>
          getType(candidate) === "Scene" && parentDir(candidate.path) === `${chapter.id}/scenes`,
      ),
    );
  if (options.dryRun === true) return { from: concept.id, to: newId, rewritten: [] };

  const doc = parseDocument(concept.raw);
  const abs = join(project.bundle.root, newPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, serializeDocument({ data: { ...doc.data, sequence }, body: doc.body }), "utf8");
  await unlink(concept.absPath);

  const fresh = await loadBundle(project.bundle.root);
  const rewritten = await rewriteBundleLinks(fresh, concept.id, newId);
  await pruneEmptyDirs(project.bundle.root, concept.path);
  await regenerateIndexes(fresh);
  await appendLog(fresh, "", {
    date: today(),
    action: "Update",
    message: `Moved ${getTitle(concept)} from /${concept.path} to /${newPath}.`,
  });

  return { from: concept.id, to: newId, rewritten };
}
