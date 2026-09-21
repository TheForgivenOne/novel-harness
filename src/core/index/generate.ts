import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { basename, parentDir } from "../bundle/paths.ts";
import { typeRank } from "../schema/catalog.ts";
import { titleCase } from "../text/title.ts";

const TYPE_HEADINGS: Record<string, string> = {
  Novel: "Novel",
  Plan: "Plan",
  Knowledge: "Knowledge",
  Character: "Characters",
  Location: "Locations",
  Faction: "Factions",
  Worldbuilding: "Worldbuilding",
  Item: "Items",
  "Plot Thread": "Plot Threads",
  Arc: "Arcs",
  Episode: "Episodes",
  Chapter: "Chapters",
  Scene: "Scenes",
  "Timeline Event": "Timeline Events",
  Theme: "Themes",
  Relationship: "Relationships",
  Reference: "References",
  "Research Note": "Research Notes",
  Outline: "Outline",
  "Chapter Outline": "Chapter Outlines",
};

export function allDirectories(bundle: Bundle): string[] {
  const dirs = new Set<string>([""]);
  const addAncestors = (path: string): void => {
    let dir = parentDir(path);
    for (;;) {
      dirs.add(dir);
      if (dir === "") return;
      dir = parentDir(dir);
    }
  };
  for (const concept of bundle.concepts) addAncestors(concept.path);
  for (const file of bundle.indexFiles) addAncestors(file.path);
  return [...dirs].sort();
}

export function renderEmptyIndex(dir: string): string {
  const title = dir === "" ? "Novel Bundle" : titleCase(basename(dir));
  return `# ${title}\n\n_No concepts yet._\n`;
}

export function renderIndex(bundle: Bundle, dir: string): string {
  const lines: string[] = [];

  if (dir === "") {
    lines.push("---", 'okf_version: "0.2"', "---", "");
  }

  const concepts = bundle.concepts.filter((concept) => parentDir(concept.path) === dir);
  const subdirs = allDirectories(bundle).filter(
    (candidate) => candidate !== dir && parentDir(candidate) === dir,
  );

  if (concepts.length === 0 && subdirs.length === 0) {
    lines.push(renderEmptyIndex(dir).trimEnd(), "");
    return `${lines.join("\n").replace(/\n+$/, "")}\n`;
  }

  const groups = new Map<string, Concept[]>();
  for (const concept of concepts) {
    const type = getType(concept) ?? "Other";
    const group = groups.get(type) ?? [];
    group.push(concept);
    groups.set(type, group);
  }

  const orderedGroups = [...groups.entries()].sort(
    (a, b) => typeRank(a[0]) - typeRank(b[0]) || a[0].localeCompare(b[0]),
  );

  for (const [type, entries] of orderedGroups) {
    lines.push(`# ${TYPE_HEADINGS[type] ?? type}`, "");
    entries.sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
    for (const concept of entries) {
      const description = concept.frontmatter.description;
      const suffix = typeof description === "string" && description.trim() !== ""
        ? ` - ${description.trim()}`
        : "";
      lines.push(`* [${getTitle(concept)}](${basename(concept.path)})${suffix}`);
    }
    lines.push("");
  }

  if (subdirs.length > 0) {
    lines.push("# Subdirectories", "");
    for (const subdir of subdirs) {
      lines.push(`* [${basename(subdir)}](${basename(subdir)}/)`);
    }
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export interface IndexChange {
  path: string;
  changed: boolean;
}

export function staleIndexPaths(bundle: Bundle): string[] {
  const stale: string[] = [];
  for (const dir of allDirectories(bundle)) {
    const rel = dir === "" ? "index.md" : `${dir}/index.md`;
    const next = renderIndex(bundle, dir);
    const existing = bundle.indexFiles.find((file) => file.path === rel)?.raw;
    if (existing !== next) stale.push(rel);
  }
  return stale;
}

export async function regenerateIndexes(bundle: Bundle): Promise<IndexChange[]> {
  const changes: IndexChange[] = [];
  const stale = new Set(staleIndexPaths(bundle));

  for (const dir of allDirectories(bundle)) {
    const rel = dir === "" ? "index.md" : `${dir}/index.md`;
    if (!stale.has(rel)) {
      changes.push({ path: rel, changed: false });
      continue;
    }

    const next = renderIndex(bundle, dir);
    const abs = join(bundle.root, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, next, "utf8");
    changes.push({ path: rel, changed: true });
  }

  return changes;
}
