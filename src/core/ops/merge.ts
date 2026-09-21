import { unlink } from "node:fs/promises";
import { loadBundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { ensureGenerated, parseDocument } from "../bundle/frontmatter.ts";
import { writeConcept } from "../bundle/write.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import { isRecord, mergeUnique, stringList } from "../text/guards.ts";
import { resolveConcept } from "../bundle/resolve.ts";
import { rewriteBundleLinks, type OpsProject } from "./link-rewrite.ts";

export interface MergePlan {
  primary: string;
  secondary: string;
  aliases: string[];
  tags: string[];
  sources: unknown[];
  apply: boolean;
}

function stringArray(value: unknown): string[] {
  return stringList(value);
}

function sourceArray(concept: Concept): unknown[] {
  const value = concept.frontmatter.sources;
  return Array.isArray(value) ? value : [];
}

function sourceKey(source: unknown): string {
  if (isRecord(source) && typeof source.id === "string") return `id:${source.id}`;
  return `json:${JSON.stringify(source)}`;
}

function mergeSources(primary: unknown[], secondary: unknown[]): unknown[] {
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const source of [...primary, ...secondary]) {
    const key = sourceKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(source);
  }
  return merged;
}

export async function mergeConcepts(
  project: OpsProject,
  primaryName: string,
  secondaryName: string,
  apply: boolean,
): Promise<MergePlan> {
  const primary = resolveConcept(project.bundle, primaryName);
  if (!primary) throw new Error(`concept not found: ${primaryName}`);
  const secondary = resolveConcept(project.bundle, secondaryName);
  if (!secondary) throw new Error(`concept not found: ${secondaryName}`);
  if (primary.id === secondary.id) throw new Error("cannot merge a concept into itself");

  const primaryType = getType(primary);
  const secondaryType = getType(secondary);
  if (!primaryType || !secondaryType) throw new Error("both concepts need a type to merge");
  if (primaryType !== secondaryType) {
    throw new Error(`cannot merge ${secondaryType} into ${primaryType}`);
  }

  const aliases = mergeUnique(
    stringArray(primary.frontmatter.aliases),
    [getTitle(secondary)],
    stringArray(secondary.frontmatter.aliases),
  );
  const tags = mergeUnique(
    stringArray(primary.frontmatter.tags),
    stringArray(secondary.frontmatter.tags),
  );
  const sources = mergeSources(sourceArray(primary), sourceArray(secondary));

  const plan: MergePlan = {
    primary: primary.path,
    secondary: secondary.path,
    aliases,
    tags,
    sources,
    apply,
  };
  if (!apply) return plan;

  const doc = parseDocument(primary.raw);
  const data: Record<string, unknown> = { ...doc.data };
  if (aliases.length > 0) data.aliases = aliases;
  if (tags.length > 0) data.tags = tags;
  if (sources.length > 0) data.sources = sources;

  ensureGenerated(data, "human:author", { forceAt: true });

  const secondaryBody = secondary.body.trim();
  let body = doc.body.replace(/\s+$/, "");
  if (secondaryBody !== "") {
    body = `${body}\n\n## From ${getTitle(secondary)}\n\n${secondaryBody}`;
  }

  await writeConcept(project.bundle, primary, data, body);
  await unlink(secondary.absPath);

  let fresh = await loadBundle(project.bundlePath);
  await rewriteBundleLinks(fresh, secondary.id, primary.id);
  fresh = await loadBundle(project.bundlePath);
  await regenerateIndexes(fresh);
  await appendLog(fresh, "", {
    date: today(),
    action: "Merge",
    message: `Merged /${secondary.path} into /${primary.path}.`,
  });

  return plan;
}
