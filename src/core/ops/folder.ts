import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../bundle/bundle.ts";
import type { Concept } from "../bundle/concept.ts";
import { basename } from "../bundle/paths.ts";
import { rewriteBundleLinks, type OpsProject } from "./link-rewrite.ts";

export async function moveChapterFolder(
  project: OpsProject,
  chapter: Concept,
  newId: string,
): Promise<string[]> {
  if (newId === chapter.id) return [];
  const oldDir = join(project.bundle.root, chapter.id);
  const newDir = join(project.bundle.root, newId);
  if (existsSync(oldDir)) {
    await rename(oldDir, newDir);
  }
  const fresh = await loadBundle(project.bundlePath);
  const rewritten = await rewriteBundleLinks(fresh, chapter.id, newId);
  for (const moved of fresh.concepts.filter((candidate) =>
    candidate.id.startsWith(`${newId}/`),
  )) {
    const oldId = `${chapter.id}/${moved.id.slice(newId.length + 1)}`;
    if (oldId !== moved.id) {
      rewritten.push(...(await rewriteBundleLinks(fresh, oldId, moved.id)));
    }
    const legacyId = `${chapter.id}/${basename(moved.id)}`;
    if (legacyId !== moved.id) {
      rewritten.push(...(await rewriteBundleLinks(fresh, legacyId, moved.id)));
    }
  }
  return rewritten;
}