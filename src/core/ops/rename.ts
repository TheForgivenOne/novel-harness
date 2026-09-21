import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadBundle } from "../bundle/bundle.ts";
import { getTitle, getType } from "../bundle/concept.ts";
import { parseDocument, serializeDocument } from "../bundle/frontmatter.ts";
import { parentDir } from "../bundle/paths.ts";
import { writeConcept } from "../bundle/write.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import { resolveConcept } from "../bundle/resolve.ts";
import { rewriteBundleLinks, type OpsProject } from "./link-rewrite.ts";
import { moveChapterFolder } from "./folder.ts";
import { slugify } from "../text/slug.ts";

export interface RenameResult {
  from: string;
  to: string;
  rewritten: string[];
}

export async function renameConcept(
  project: OpsProject,
  conceptName: string,
  newName: string,
): Promise<RenameResult> {
  const title = newName.trim();
  if (title === "") throw new Error("new name is required");

  const slug = slugify(title);
  if (slug === "") throw new Error(`cannot derive a slug from "${newName}"`);

  const concept = resolveConcept(project.bundle, conceptName);
  if (!concept) throw new Error(`concept not found: ${conceptName}`);

  const dir = parentDir(concept.id);
  const newId = dir === "" ? slug : `${dir}/${slug}`;
  const newPath = `${newId}.md`;

  if (newId === concept.id) {
    if (getTitle(concept) === title) return { from: concept.id, to: newId, rewritten: [] };
    const doc = parseDocument(concept.raw);
    const data = { ...doc.data, title };
    await writeConcept(project.bundle, concept, data, doc.body);
    const fresh = await loadBundle(project.bundlePath);
    await regenerateIndexes(fresh);
    await appendLog(fresh, "", {
      date: today(),
      action: "Rename",
      message: `Renamed [${title}](/${newPath}) from /${concept.path}.`,
    });
    return { from: concept.id, to: newId, rewritten: [] };
  }

  const newAbs = join(project.bundle.root, newPath);
  if (existsSync(newAbs)) throw new Error(`target already exists: ${newPath}`);

  const doc = parseDocument(concept.raw);
  const data = { ...doc.data, title };
  await mkdir(dirname(newAbs), { recursive: true });
  await writeFile(newAbs, serializeDocument({ data, body: doc.body }), "utf8");
  if (getType(concept) === "Chapter") {
    await moveChapterFolder(project, concept, newId);
  }
  await unlink(concept.absPath);

  let fresh = await loadBundle(project.bundlePath);
  const rewritten = await rewriteBundleLinks(fresh, concept.id, newId);
  fresh = await loadBundle(project.bundlePath);
  await regenerateIndexes(fresh);
  await appendLog(fresh, "", {
    date: today(),
    action: "Rename",
    message: `Renamed [${title}](/${newPath}) from /${concept.path}.`,
  });

  return { from: concept.id, to: newId, rewritten };
}
