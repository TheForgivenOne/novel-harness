import { getType, type Concept } from "../bundle/concept.ts";
import { parentDir } from "../bundle/paths.ts";
import { compareSequence } from "../bundle/sort.ts";
import { compareWhen as compareWhenStrings } from "../bundle/timeline.ts";
import { writeConcept } from "../bundle/write.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import type { OpsProject } from "./link-rewrite.ts";

export type RenumberGroup = "chapter" | "scene" | "timeline";

export type RenumberSort = "sequence" | "when";

export const RENUMBER_GROUPS: RenumberGroup[] = ["chapter", "scene", "timeline"];

export const RENUMBER_SORTS: RenumberSort[] = ["sequence", "when"];

const GROUP_TYPE: Record<RenumberGroup, string> = {
  chapter: "Chapter",
  scene: "Scene",
  timeline: "Timeline Event",
};

const GROUP_ALIASES: Record<string, RenumberGroup> = {
  chapter: "chapter",
  chapters: "chapter",
  scene: "scene",
  scenes: "scene",
  timeline: "timeline",
  "timeline-event": "timeline",
  "timeline-events": "timeline",
  event: "timeline",
  events: "timeline",
};

export interface RenumberChange {
  path: string;
  from?: number;
  to: number;
}

export interface RenumberResult {
  changes: RenumberChange[];
  groups: Record<RenumberGroup, number>;
}

export function parseRenumberGroups(value: string | undefined): RenumberGroup[] {
  if (value === undefined || value.trim() === "") return [...RENUMBER_GROUPS];
  const groups: RenumberGroup[] = [];
  for (const raw of value.split(",")) {
    const name = raw.trim().toLowerCase().replace(/[ _]+/g, "-");
    if (name === "") continue;
    const group = GROUP_ALIASES[name];
    if (group === undefined) {
      throw new Error(`unknown renumber type: ${raw.trim()} (chapter, scene, timeline)`);
    }
    if (!groups.includes(group)) groups.push(group);
  }
  if (groups.length === 0) return [...RENUMBER_GROUPS];
  return groups;
}

export function parseRenumberSort(value: string | undefined): RenumberSort {
  if (value === undefined || value.trim() === "") return "sequence";
  const name = value.trim().toLowerCase();
  if (!RENUMBER_SORTS.includes(name as RenumberSort)) {
    throw new Error(`unknown sort field: ${value.trim()} (sequence, when)`);
  }
  return name as RenumberSort;
}

function compareWhen(a: Concept, b: Concept): number {
  const rawA = a.frontmatter.when;
  const rawB = b.frontmatter.when;
  const order = compareWhenStrings(String(rawA ?? ""), String(rawB ?? ""));
  return order !== 0 ? order : compareSequence(a, b);
}

export async function renumberSequences(
  project: OpsProject,
  options: { groups?: RenumberGroup[]; start?: number; step?: number; sort?: RenumberSort; dryRun?: boolean } = {},
): Promise<RenumberResult> {
  const start = options.start ?? 1;
  const step = options.step ?? 1;
  if (!Number.isInteger(start) || start < 1) {
    throw new Error(`start must be a positive integer: ${String(options.start)}`);
  }
  if (!Number.isInteger(step) || step < 1) {
    throw new Error(`step must be a positive integer: ${String(options.step)}`);
  }
  const groups = options.groups ?? [...RENUMBER_GROUPS];
  const sort = options.sort ?? "sequence";

  const changes: RenumberChange[] = [];
  const counts: Record<RenumberGroup, number> = { chapter: 0, scene: 0, timeline: 0 };

  for (const group of groups) {
    const buckets = new Map<string, Concept[]>();
    for (const concept of project.bundle.concepts) {
      if (getType(concept) !== GROUP_TYPE[group]) continue;
      const key = group === "scene" ? parentDir(concept.path) : "";
      const bucket = buckets.get(key) ?? [];
      bucket.push(concept);
      buckets.set(key, bucket);
    }
    for (const bucket of buckets.values()) {
      const ordered = [...bucket].sort(
        group === "timeline" && sort === "when" ? compareWhen : compareSequence,
      );
      ordered.forEach((concept, index) => {
        const to = start + index * step;
        const raw = concept.frontmatter.sequence;
        const from =
          typeof raw === "number" && Number.isFinite(raw) && Number.isInteger(raw)
            ? raw
            : undefined;
        if (from === to) return;
        changes.push({ path: concept.path, ...(from !== undefined ? { from } : {}), to });
        counts[group] += 1;
      });
    }
  }

  if (options.dryRun !== true && changes.length > 0) {
    const byPath = new Map(project.bundle.concepts.map((concept) => [concept.path, concept]));
    for (const change of changes) {
      const concept = byPath.get(change.path);
      if (concept === undefined) continue;
      await writeConcept(project.bundle, concept, { sequence: change.to });
    }
    await regenerateIndexes(project.bundle);
    await appendLog(project.bundle, "", {
      date: today(),
      action: "Update",
      message: `Renumbered ${changes.length} concept(s): ${groups.join(", ")}.`,
    });
  }

  return { changes, groups: counts };
}
