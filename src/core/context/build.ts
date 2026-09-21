import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { refEntries } from "../bundle/entries.ts";
import { serializeDocument } from "../bundle/frontmatter.ts";
import { conceptLinks, extractBundleLinks } from "../bundle/links.ts";
import { linkTargetId, parentDir } from "../bundle/paths.ts";
import { compareSequence } from "../bundle/sort.ts";
import { compareWhen, timelineEntries, type TimelineEventConcept } from "../bundle/timeline.ts";
import { typeRank } from "../schema/catalog.ts";
import { parseKnowledgeBody, rowsAtOrBefore } from "./knowledge.ts";

export interface ContextOptions {
  /** Truncate non-target bodies to this many characters. 0 disables truncation. */
  maxBodyChars?: number;
  /** Append a reader-state section: who knows what at the scene's when. */
  soFar?: boolean;
}

export interface ContextResult {
  concept: Concept;
  included: Concept[];
  missing: string[];
  markdown: string;
}

function truncate(body: string, max: number): string {
  const trimmed = body.trim();
  if (max <= 0 || trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}\n\n… (truncated)`;
}

function renderConceptBlock(concept: Concept, label: string, maxBodyChars: number): string {
  const body = truncate(concept.body, maxBodyChars);
  const file = serializeDocument({
    data: concept.frontmatter,
    body,
  }).trimEnd();

  const refLines: string[] = [];
  for (const entry of refEntries(concept)) {
    const kind = entry.kind !== undefined ? ` — ${entry.kind}` : "";
    refLines.push(`* [${entry.title}](${entry.url})${kind}`);
  }
  const refBlock =
    refLines.length > 0
      ? `\nWeb references (fetch for detail):\n\n${refLines.join("\n")}\n`
      : "";

  return `## ${label}: ${getTitle(concept)} — \`${concept.path}\`\n\n${file}\n${refBlock}`;
}

export function buildContext(
  bundle: Bundle,
  id: string,
  options: ContextOptions = {},
): ContextResult {
  const maxBodyChars = options.maxBodyChars ?? 1200;
  const byId = new Map(bundle.concepts.map((concept) => [concept.id, concept]));
  const target = byId.get(id);
  if (!target) {
    throw new Error(`concept not found: ${id}`);
  }

  const neighborIds: string[] = [];
  const missing: string[] = [];

  const push = (link: string): void => {
    const targetId = linkTargetId(link);
    if (!byId.has(targetId)) {
      if (!missing.includes(link)) missing.push(link);
      return;
    }
    if (targetId === id || neighborIds.includes(targetId)) return;
    neighborIds.push(targetId);
  };

  let sceneWhen: string | undefined;
  if (getType(target) === "Scene") {
    const chapterId = parentDir(target.path);
    const chapter = byId.get(chapterId);
    if (chapter) neighborIds.push(chapterId);

    const siblings = bundle.concepts
      .filter((candidate) => getType(candidate) === "Scene" && parentDir(candidate.path) === chapterId)
      .sort(compareSequence);
    const index = siblings.findIndex((sibling) => sibling.id === id);
    const previous = index > 0 ? siblings[index - 1] : undefined;
    const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;
    if (previous) push(previous.path);
    if (next) push(next.path);

    const rawWhen = target.frontmatter.when;
    sceneWhen = typeof rawWhen === "string" && rawWhen.trim() !== "" ? rawWhen : undefined;
    if (sceneWhen) {
      for (const entry of timelineEntries(bundle)) {
        if (!entry.when || compareWhen(entry.when, sceneWhen) > 0) continue;
        push(entry.path);
        const event = byId.get(entry.id);
        const arc = event?.frontmatter.arc;
        const episode = event?.frontmatter.episode;
        if (typeof arc === "string") push(arc);
        if (typeof episode === "string") push(episode);
      }
    }
  }

  for (const link of conceptLinks(target)) push(link);
  for (const link of extractBundleLinks(target.body, target.path)) push(link);

  for (const other of bundle.concepts) {
    if (other.id === id) continue;
    const links = [...conceptLinks(other), ...extractBundleLinks(other.body, other.path)];
    if (links.some((link) => linkTargetId(link) === id)) push(other.path);
  }

  const neighbors = neighborIds
    .map((neighborId) => byId.get(neighborId))
    .filter((concept): concept is Concept => concept !== undefined);

  const reader = options.soFar && sceneWhen ? readerState(bundle, sceneWhen) : "";
  return {
    concept: target,
    included: neighbors,
    missing,
    markdown: `${renderContextMarkdown(target, neighbors, missing, maxBodyChars)}${reader}`,
  };
}

function readerState(bundle: Bundle, when: string): string {
  const knowledge = bundle.concepts.find((concept) => getType(concept) === "Knowledge");
  if (!knowledge) return "";
  const rows = rowsAtOrBefore(parseKnowledgeBody(knowledge.body), when);
  if (rows.length === 0) return "";
  const lines = [
    "",
    "# Reader state (so far)",
    "",
    "Who knows what at the scene's `when`, from `story/knowledge.md`:",
    "",
    "| Character | Knows about | Since | How they learned |",
    "| --------- | ----------- | ----- | ---------------- |",
  ];
  for (const row of rows) {
    lines.push(`| ${row.character} | ${row.knows} | ${row.since ?? ""} | ${row.learned} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderContextMarkdown(
  target: Concept,
  neighbors: Concept[],
  missing: string[],
  maxBodyChars: number,
): string {
  const lines: string[] = [];
  lines.push(`# Context: ${getTitle(target)}`, "");
  lines.push(`Target concept: \`${target.path}\``);
  lines.push(`Type: ${getType(target) ?? "unknown"}`);
  if (missing.length > 0) {
    lines.push(`Missing link targets: ${missing.join(", ")}`);
  }
  lines.push("");
  lines.push(renderConceptBlock(target, "Target", 0));

  if (neighbors.length > 0) {
    lines.push("# Related concepts", "");
    const ordered = [...neighbors].sort(
      (a, b) => typeRank(getType(a)) - typeRank(getType(b)) || getTitle(a).localeCompare(getTitle(b)),
    );
    for (const neighbor of ordered) {
      const type = getType(neighbor) ?? "Concept";
      lines.push(renderConceptBlock(neighbor, type, maxBodyChars));
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function buildStoryContext(
  bundle: Bundle,
  options: ContextOptions = {},
): ContextResult {
  const ofType = (type: string): Concept[] => bundle.concepts.filter((concept) => getType(concept) === type);
  const novel = ofType("Novel")[0];
  const plan = ofType("Plan")[0];
  const outline = ofType("Outline")[0];
  const threads = ofType("Plot Thread");
  const arcs = ofType("Arc");
  const events = timelineEntries(bundle);

  const included = [novel, plan, outline, ...threads, ...arcs].filter(
    (concept): concept is Concept => concept !== undefined,
  );

  return {
    concept: novel ?? outline ?? plan ?? bundle.concepts[0]!,
    included,
    missing: [],
    markdown: renderStoryMarkdown(novel, plan, outline, threads, arcs, events, options.maxBodyChars ?? 1200),
  };
}

function renderStoryMarkdown(
  novel: Concept | undefined,
  plan: Concept | undefined,
  outline: Concept | undefined,
  threads: Concept[],
  arcs: Concept[],
  events: TimelineEventConcept[],
  maxBodyChars: number,
): string {
  const lines: string[] = [];
  lines.push("# Story context", "");
  lines.push(
    "Whole-story slice for outline decisions. Nothing here is gated by a scene's date;",
    "it is the full spine of the story.",
    "",
  );

  const blocks: Array<[string, Concept | undefined]> = [
    ["Novel", novel],
    ["Plan", plan],
    ["Outline", outline],
  ];
  for (const [label, concept] of blocks) {
    if (concept) lines.push(renderConceptBlock(concept, label, 0));
  }

  if (threads.length > 0) {
    lines.push("## Plot threads", "");
    for (const thread of threads) {
      const kind = typeof thread.frontmatter.kind === "string" ? thread.frontmatter.kind : "";
      const status = typeof thread.frontmatter.status === "string" ? thread.frontmatter.status : "";
      const meta = [kind && `kind: ${kind}`, status && `status: ${status}`]
        .filter(Boolean)
        .join(" · ");
      lines.push(`* [${getTitle(thread)}](/${thread.path})${meta ? ` — ${meta}` : ""}`);
    }
    lines.push("");
  }

  if (arcs.length > 0) {
    lines.push("## Arcs", "");
    for (const arc of arcs) lines.push(`* [${getTitle(arc)}](/${arc.path})`);
    lines.push("");
  }

  if (events.length > 0) {
    lines.push("## Timeline", "");
    for (const event of events) {
      const when = event.when ? `${event.when} — ` : "";
      lines.push(`* ${when}[${event.title}](/${event.path})`);
    }
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
