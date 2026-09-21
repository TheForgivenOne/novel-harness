import { readFile, writeFile } from "node:fs/promises";
import type { Bundle } from "../bundle/bundle.ts";

export interface OpsProject {
  bundle: Bundle;
  bundlePath: string;
  config?: { author?: string };
}

export async function rewriteBundleLinks(
  bundle: Bundle,
  fromId: string,
  toId: string,
): Promise<string[]> {
  const from = `/${fromId}.md`;
  const to = `/${toId}.md`;
  if (from === to) return [];

  const changed: string[] = [];
  for (const concept of bundle.concepts) {
    const raw = await readFile(concept.absPath, "utf8");
    if (!raw.includes(from)) continue;
    await writeFile(concept.absPath, raw.split(from).join(to), "utf8");
    changed.push(concept.path);
  }
  return changed;
}
