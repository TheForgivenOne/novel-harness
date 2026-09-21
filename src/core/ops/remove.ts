import { unlink } from "node:fs/promises";
import type { Bundle } from "../bundle/bundle.ts";
import { loadBundle } from "../bundle/bundle.ts";
import { getTitle } from "../bundle/concept.ts";
import { conceptLinks, extractBundleLinks } from "../bundle/links.ts";
import { linkTargetId } from "../bundle/paths.ts";
import { resolveConcept } from "../bundle/resolve.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import type { OpsProject } from "./link-rewrite.ts";
import { pruneEmptyDirs } from "./prune.ts";

export interface InboundLink {
  path: string;
  source: "frontmatter" | "body";
}

export function inboundLinks(bundle: Bundle, id: string): InboundLink[] {
  const links: InboundLink[] = [];
  for (const concept of bundle.concepts) {
    if (concept.id === id) continue;
    if (conceptLinks(concept).some((link) => linkTargetId(link) === id)) {
      links.push({ path: concept.path, source: "frontmatter" });
      continue;
    }
    if (extractBundleLinks(concept.body, concept.path).some((link) => linkTargetId(link) === id)) {
      links.push({ path: concept.path, source: "body" });
    }
  }
  return links;
}

export async function removeConcept(
  project: OpsProject,
  conceptName: string,
  options: { force?: boolean; dryRun?: boolean } = {},
): Promise<{ path: string; inbound: InboundLink[] }> {
  const concept = resolveConcept(project.bundle, conceptName);
  if (!concept) throw new Error(`concept not found: ${conceptName}`);

  const inbound = inboundLinks(project.bundle, concept.id);
  if (inbound.length > 0 && options.force !== true) {
    throw new Error(
      `${inbound.length} concept(s) link to ${concept.id}; use --force to remove anyway: ` +
        inbound.map((link) => link.path).join(", "),
    );
  }

  if (options.dryRun !== true) {
    await unlink(concept.absPath);
    await pruneEmptyDirs(project.bundle.root, concept.path);
    const fresh = await loadBundle(project.bundle.root);
    await regenerateIndexes(fresh);
    await appendLog(fresh, "", {
      date: today(),
      action: "Deprecation",
      message: `Removed ${getTitle(concept)} (/${concept.path}).`,
    });
  }

  return { path: concept.path, inbound };
}
