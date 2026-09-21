import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { refEntries, sourceEntries, type RefEntry } from "../bundle/entries.ts";
import { conceptLinks, extractBundleLinks } from "../bundle/links.ts";
import { linkTargetId, parentDir } from "../bundle/paths.ts";
import { timelineEntries } from "../bundle/timeline.ts";
import { collectManuscript } from "../build/manuscript.ts";
import { stringList } from "../text/guards.ts";
import { normalizeName } from "../text/slug.ts";
import {
  chapterWordState,
  countWords,
  formatWordBounds,
  parseWordBounds,
  type WordState,
} from "../text/words.ts";
import { TAGS_RECOMMENDED } from "../validate/profile.ts";
import { dateMatches, isStale, parseDateParts } from "./dates.ts";

export type { RefEntry };

export interface QueryResult<T = unknown> {
  title: string;
  markdown: string;
  data: T;
}

export interface Ref {
  id: string;
  path: string;
  title: string;
}

export interface SearchHit extends Ref {
  type: string;
  score: number;
  reason: string;
  snippet?: string;
}

export interface TimelineEntry extends Ref {
  when?: string;
  sequence: number;
  participants: string[];
  tags: string[];
  /** intact | altered | averted | added | unmarked */
  divergence?: string;
}

export interface CharacterReport {
  character: Ref;
  scenes: Array<Ref & { chapter: string; sequence?: number }>;
  events: TimelineEntry[];
  relationships: Array<Ref & { kind?: string }>;
  affiliations: string[];
  locations: string[];
}

export interface LocationReport {
  location: Ref;
  scenes: Array<Ref & { chapter: string; sequence?: number }>;
}

export interface TagReport {
  tag: string;
  groups: Array<{ type: string; concepts: Ref[] }>;
}

export interface ThreadEntry extends Ref {
  kind?: string;
  status?: string;
  scenes: Array<Ref & { chapter: string }>;
}

export interface WhenEntry {
  event: TimelineEntry;
  body: string;
  arc?: Ref;
  episode?: Ref;
  location?: Ref;
  divergesAt?: Ref;
  participants: Ref[];
  previous?: Ref;
  next?: Ref;
}

function listLinks(value: unknown): string[] {
  return stringList(value).filter((entry) => entry.startsWith("/"));
}

function singleLink(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") ? value : undefined;
}

function ref(concept: Concept): Ref {
  return { id: concept.id, path: concept.path, title: getTitle(concept) };
}

function orderedScenes(bundle: Bundle): Concept[] {
  return collectManuscript(bundle).chapters.flatMap((chapter) => chapter.scenes);
}

function sceneRef(scene: Concept): Ref & { chapter: string; sequence?: number } {
  const sequence = scene.frontmatter.sequence;
  return {
    ...ref(scene),
    chapter: parentDir(scene.path),
    ...(typeof sequence === "number" ? { sequence } : {}),
  };
}

function resolveByName(bundle: Bundle, type: string, value: string): Concept | undefined {
  const needle = value.trim().toLowerCase();
  const needleCompact = normalizeName(needle);
  return bundle.concepts.find((concept) => {
    if (getType(concept) !== type) return false;
    const basename = concept.id.split("/").pop() ?? concept.id;
    const names = [
      concept.id,
      basename,
      getTitle(concept),
      ...stringList(concept.frontmatter.aliases),
    ].map((name) => name.toLowerCase());
    return names.includes(needle) || names.some((name) => normalizeName(name) === needleCompact);
  });
}

function snippetAround(text: string, needle: string, radius = 60): string {
  const index = text.toLowerCase().indexOf(needle);
  if (index === -1) {
    const head = text.slice(0, 120).replace(/\s+/g, " ").trim();
    return text.length > 120 ? `${head}…` : head;
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + needle.length + radius);
  const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}`;
}

export function search(
  bundle: Bundle,
  text: string,
  options: { type?: string; tag?: string; limit?: number } = {},
): QueryResult<{ query: string; total: number; hits: SearchHit[] }> {
  const needle = text.trim().toLowerCase();
  const compact = normalizeName(needle);
  const typeFilter = options.type?.toLowerCase();
  const tagFilter = options.tag?.toLowerCase();
  const hits: SearchHit[] = [];

  if (needle !== "") {
    for (const concept of bundle.concepts) {
      if (typeFilter && (getType(concept) ?? "").toLowerCase() !== typeFilter) continue;
      if (
        tagFilter &&
        !stringList(concept.frontmatter.tags).some((tag) => tag.toLowerCase() === tagFilter)
      ) {
        continue;
      }

      const title = getTitle(concept);
      const titleLower = title.toLowerCase();
      const aliases = stringList(concept.frontmatter.aliases);
      const tags = stringList(concept.frontmatter.tags);
      const description = concept.frontmatter.description;
      const body = concept.body;

      let score = 0;
      let reason = "";
      let snippet: string | undefined;

      if (titleLower === needle) {
        score = 100;
        reason = "title";
      } else if (titleLower.includes(needle)) {
        score = 80;
        reason = "title";
      } else if (aliases.some((alias) => alias.toLowerCase() === needle)) {
        score = 90;
        reason = "alias";
      } else if (aliases.some((alias) => alias.toLowerCase().includes(needle))) {
        score = 70;
        reason = "alias";
      } else if (concept.id.toLowerCase().includes(needle)) {
        score = 50;
        reason = "id";
      } else if (tags.some((tag) => tag.toLowerCase().includes(needle))) {
        score = 60;
        reason = "tag";
      } else if (typeof description === "string" && description.toLowerCase().includes(needle)) {
        score = 40;
        reason = "description";
        snippet = description;
      } else if (body.toLowerCase().includes(needle)) {
        score = 20;
        reason = "body";
        snippet = snippetAround(body, needle);
      } else if (
        compact !== "" &&
        (normalizeName(title).includes(compact) ||
          aliases.some((alias) => normalizeName(alias).includes(compact)))
      ) {
        score = 45;
        reason = "close match";
      }

      if (score > 0) {
        hits.push({
          ...ref(concept),
          type: getType(concept) ?? "Unknown",
          score,
          reason,
          ...(snippet ? { snippet } : {}),
        });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const total = hits.length;
  const limited = options.limit && options.limit > 0 ? hits.slice(0, options.limit) : hits;

  const filters = [
    options.type ? `type=${options.type}` : "",
    options.tag ? `tag=${options.tag}` : "",
  ].filter(Boolean);
  const lines = [
    `# Search: ${text}${filters.length > 0 ? ` (${filters.join(", ")})` : ""}`,
    "",
    `${total} result(s)`,
    "",
  ];
  for (const hit of limited) {
    lines.push(`* **${hit.type}** [${hit.title}](/${hit.path}) — ${hit.reason}`);
    if (hit.snippet) lines.push(`  > ${hit.snippet}`);
  }
  lines.push("");

  return {
    title: `Search: ${text}`,
    markdown: lines.join("\n"),
    data: { query: text, total, hits: limited },
  };
}

export { timelineEntries as timelineEvents };

function yearOf(when: string | undefined): number | undefined {
  if (!when) return undefined;
  const match = /\b(\d{4})\b/.exec(when);
  return match?.[1] ? Number(match[1]) : undefined;
}

function inRange(when: string | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const fromYear = from ? Number(from) : undefined;
  const toYear = to ? Number(to) : undefined;
  const numeric = Number.isFinite(fromYear) && Number.isFinite(toYear);
  const year = yearOf(when);

  if (numeric) {
    if (year === undefined) return false;
    if (fromYear !== undefined && year < fromYear) return false;
    if (toYear !== undefined && year > toYear) return false;
    return true;
  }

  const text = (when ?? "").toLowerCase();
  if (from && !text.includes(from.toLowerCase())) return false;
  if (to && !text.includes(to.toLowerCase())) return false;
  return true;
}

export function timeline(
  bundle: Bundle,
  options: { tag?: string; from?: string; to?: string; on?: string } = {},
): QueryResult<{ entries: TimelineEntry[] }> {
  const needle = options.tag?.toLowerCase();
  const onParts = options.on ? parseDateParts(options.on) : undefined;
  const entries = timelineEntries(bundle)
    .filter((entry) => (needle ? entry.tags.some((tag) => tag.toLowerCase() === needle) : true))
    .filter((entry) => (options.on ? dateMatches(entry.when, onParts ?? {}) : true))
    .filter((entry) => inRange(entry.when, options.from, options.to));

  const filters = [
    options.tag ? `tag=${options.tag}` : "",
    options.on ? `on=${options.on}` : "",
    options.from ? `from=${options.from}` : "",
    options.to ? `to=${options.to}` : "",
  ].filter(Boolean);

  const lines = [`# Timeline${filters.length > 0 ? ` (${filters.join(", ")})` : ""}`, ""];
  if (entries.length === 0) lines.push("No timeline events match.", "");
  for (const entry of entries) {
    const when = entry.when ? `${entry.when} — ` : "";
    const tags = entry.tags.length > 0 ? ` [${entry.tags.join(", ")}]` : "";
    const status =
      entry.divergence && entry.divergence !== "intact" ? ` — **${entry.divergence}**` : "";
    lines.push(`* ${when}[${entry.title}](/${entry.path})${tags}${status}`);
  }
  lines.push("");

  return { title: "Timeline", markdown: lines.join("\n"), data: { entries } };
}

export function character(bundle: Bundle, name: string): QueryResult<CharacterReport> {
  const found = resolveByName(bundle, "Character", name);
  if (!found) throw new Error(`character not found: ${name}`);

  const scenes = orderedScenes(bundle).filter((scene) => {
    const links = [
      ...listLinks(scene.frontmatter.cast),
      ...(singleLink(scene.frontmatter.pov) ? [singleLink(scene.frontmatter.pov)!] : []),
    ];
    return links.some((link) => linkTargetId(link) === found.id);
  });

  const events = timelineEntries(bundle)
    .filter((entry) => entry.participants.some((link) => linkTargetId(link) === found.id))
    .sort((a, b) => a.sequence - b.sequence);

  const relationships = bundle.concepts
    .filter(
      (concept) =>
        getType(concept) === "Relationship" &&
        listLinks(concept.frontmatter.characters).some((link) => linkTargetId(link) === found.id),
    )
    .map((concept) => ({
      ...ref(concept),
      ...(typeof concept.frontmatter.kind === "string" ? { kind: concept.frontmatter.kind } : {}),
    }));

  const affiliations = listLinks(found.frontmatter.affiliations);
  const locations = [
    ...new Set(
      scenes
        .map((scene) => singleLink(scene.frontmatter.location))
        .filter((link): link is string => Boolean(link)),
    ),
  ];

  const lines = [`# Character: ${getTitle(found)}`, "", `Concept: \`/${found.path}\``, ""];
  lines.push(`## Scenes (${scenes.length})`, "");
  for (const scene of scenes) {
    lines.push(`* [${getTitle(scene)}](/${scene.path}) — ${parentDir(scene.path)}`);
  }
  lines.push("");
  lines.push(`## Timeline events (${events.length})`, "");
  for (const event of events) {
    lines.push(`* [${event.title}](/${event.path})${event.when ? ` — ${event.when}` : ""}`);
  }
  lines.push("");
  lines.push(`## Relationships (${relationships.length})`, "");
  for (const relationship of relationships) {
    lines.push(`* [${relationship.title}](/${relationship.path}) — ${relationship.kind ?? "link"}`);
  }
  lines.push("");
  if (affiliations.length > 0) {
    lines.push("## Affiliations", "");
    for (const link of affiliations) lines.push(`* ${link}`);
    lines.push("");
  }
  if (locations.length > 0) {
    lines.push("## Locations", "");
    for (const link of locations) lines.push(`* ${link}`);
    lines.push("");
  }

  const report: CharacterReport = {
    character: ref(found),
    scenes: scenes.map(sceneRef),
    events,
    relationships,
    affiliations,
    locations,
  };
  return { title: `Character: ${getTitle(found)}`, markdown: lines.join("\n"), data: report };
}

export function location(bundle: Bundle, name: string): QueryResult<LocationReport> {
  const found = resolveByName(bundle, "Location", name);
  if (!found) throw new Error(`location not found: ${name}`);

  const scenes = orderedScenes(bundle).filter(
    (scene) =>
      singleLink(scene.frontmatter.location) !== undefined &&
      linkTargetId(singleLink(scene.frontmatter.location)!) === found.id,
  );

  const lines = [`# Location: ${getTitle(found)}`, "", `Concept: \`/${found.path}\``, ""];
  lines.push(`## Scenes (${scenes.length})`, "");
  for (const scene of scenes) {
    lines.push(`* [${getTitle(scene)}](/${scene.path}) — ${parentDir(scene.path)}`);
  }
  lines.push("");

  return {
    title: `Location: ${getTitle(found)}`,
    markdown: lines.join("\n"),
    data: { location: ref(found), scenes: scenes.map(sceneRef) },
  };
}

export function tag(bundle: Bundle, value: string): QueryResult<TagReport> {
  const needle = value.trim().toLowerCase();
  const matched = bundle.concepts.filter((concept) =>
    stringList(concept.frontmatter.tags).some((tagValue) => tagValue.toLowerCase() === needle),
  );

  const byType = new Map<string, Ref[]>();
  for (const concept of matched) {
    const type = getType(concept) ?? "Unknown";
    const list = byType.get(type) ?? [];
    list.push(ref(concept));
    byType.set(type, list);
  }

  const groups = [...byType.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, concepts]) => ({
      type,
      concepts: concepts.sort((a, b) => a.title.localeCompare(b.title)),
    }));

  const lines = [`# Tag: ${value}`, "", `${matched.length} concept(s)`, ""];
  for (const group of groups) {
    lines.push(`## ${group.type}`, "");
    for (const concept of group.concepts) {
      lines.push(`* [${concept.title}](/${concept.path})`);
    }
    lines.push("");
  }

  return { title: `Tag: ${value}`, markdown: lines.join("\n"), data: { tag: value, groups } };
}

export function when(
  bundle: Bundle,
  value: string,
): QueryResult<{ query: string; entries: WhenEntry[] }> {
  const all = timelineEntries(bundle).sort(
    (a, b) => a.sequence - b.sequence || (a.when ?? "").localeCompare(b.when ?? ""),
  );
  const byId = new Map(bundle.concepts.map((concept) => [concept.id, concept]));
  const parts = parseDateParts(value);
  const direct = resolveByName(bundle, "Timeline Event", value);

  const matched = direct
    ? all.filter((entry) => entry.id === direct.id)
    : all.filter((entry) => dateMatches(entry.when, parts));

  const resolveLink = (link: string | undefined): Ref | undefined => {
    if (!link) return undefined;
    const concept = byId.get(linkTargetId(link));
    return concept ? ref(concept) : undefined;
  };

  const entries: WhenEntry[] = matched.map((entry) => {
    const index = all.findIndex((candidate) => candidate.id === entry.id);
    const concept = byId.get(entry.id);
    const previous = index > 0 ? all[index - 1] : undefined;
    const next = index >= 0 && index < all.length - 1 ? all[index + 1] : undefined;
    const arc = resolveLink(singleLink(concept?.frontmatter.arc));
    const episode = resolveLink(singleLink(concept?.frontmatter.episode));
    const location = resolveLink(singleLink(concept?.frontmatter.location));
    const divergesAt = resolveLink(singleLink(concept?.frontmatter.diverges_at));

    return {
      event: entry,
      body: concept?.body.trim() ?? "",
      ...(arc ? { arc } : {}),
      ...(episode ? { episode } : {}),
      ...(location ? { location } : {}),
      ...(divergesAt ? { divergesAt } : {}),
      participants: entry.participants
        .map((link) => resolveLink(link))
        .filter((participant): participant is Ref => participant !== undefined),
      ...(previous ? { previous: ref(byId.get(previous.id)!) } : {}),
      ...(next ? { next: ref(byId.get(next.id)!) } : {}),
    };
  });

  const lines = [`# When: ${value}`, ""];
  if (entries.length === 0) lines.push("No timeline events match.", "");

  for (const entry of entries) {
    lines.push(`## ${entry.event.when ? `${entry.event.when} — ` : ""}${entry.event.title}`, "");
    lines.push(`Concept: \`/${entry.event.path}\``);
    if (entry.arc) lines.push(`Arc: [${entry.arc.title}](/${entry.arc.path})`);
    if (entry.episode) lines.push(`Episode: [${entry.episode.title}](/${entry.episode.path})`);
    if (entry.location) lines.push(`Location: [${entry.location.title}](/${entry.location.path})`);
    if (entry.participants.length > 0) {
      lines.push(
        `Participants: ${entry.participants.map((p) => `[${p.title}](/${p.path})`).join(", ")}`,
      );
    }
    if (entry.event.tags.length > 0) lines.push(`Tags: ${entry.event.tags.join(", ")}`);
    if (entry.event.divergence) {
      lines.push(
        `Divergence: ${entry.event.divergence}${
          entry.divergesAt
            ? ` — changed at [${entry.divergesAt.title}](/${entry.divergesAt.path})`
            : ""
        }`,
      );
    }
    lines.push("");
    if (entry.body !== "") lines.push(entry.body, "");

    const neighbours = [
      entry.previous ? `previous: [${entry.previous.title}](/${entry.previous.path})` : "",
      entry.next ? `next: [${entry.next.title}](/${entry.next.path})` : "",
    ].filter(Boolean);
    if (neighbours.length > 0) lines.push(`Neighbours — ${neighbours.join("; ")}`, "");
  }

  return {
    title: `When: ${value}`,
    markdown: lines.join("\n"),
    data: { query: value, entries },
  };
}

export interface RefsReport {
  concept: Ref;
  refs: RefEntry[];
}

export function refs(bundle: Bundle, name: string): QueryResult<RefsReport> {
  const needle = name.trim().toLowerCase();
  const compact = normalizeName(needle);
  const namesOf = (concept: Concept): string[] => {
    const basename = concept.id.split("/").pop() ?? concept.id;
    return [concept.id, basename, getTitle(concept), ...stringList(concept.frontmatter.aliases)].map(
      (value) => value.toLowerCase(),
    );
  };
  const exact = bundle.concepts.find((concept) => namesOf(concept).includes(needle));
  const found =
    exact ?? bundle.concepts.find((concept) => namesOf(concept).some((v) => normalizeName(v) === compact));
  if (!found) throw new Error(`concept not found: ${name}`);

  const entries = refEntries(found);

  const lines = [`# References: ${getTitle(found)}`, "", `Concept: \`/${found.path}\``, ""];
  if (entries.length === 0) lines.push("No web references.", "");
  for (const entry of entries) {
    lines.push(`* [${entry.title}](${entry.url})${entry.kind ? ` — ${entry.kind}` : ""}`);
  }
  lines.push("");

  return {
    title: `References: ${getTitle(found)}`,
    markdown: lines.join("\n"),
    data: { concept: ref(found), refs: entries },
  };
}

export interface StaleEntry extends Ref {
  reason: string;
  since?: string;
}

export function stale(
  bundle: Bundle,
  options: { days?: number; now?: string } = {},
): QueryResult<{ entries: StaleEntry[] }> {
  const now = options.now ? new Date(options.now) : new Date();
  const days = options.days ?? 30;
  const threshold = new Date(now.getTime() - days * 86_400_000);
  const entries: StaleEntry[] = [];

  for (const concept of bundle.concepts) {
    if (concept.frontmatter.origin !== "source") continue;

    if (isStale(concept, now)) {
      const staleAfter = concept.frontmatter.stale_after;
      const since = typeof staleAfter === "string" ? staleAfter : undefined;
      entries.push({ ...ref(concept), reason: "stale_after passed", ...(since ? { since } : {}) });
      continue;
    }

    const generated = concept.frontmatter.generated;
    const at =
      typeof generated === "object" && generated !== null && !Array.isArray(generated)
        ? (generated as Record<string, unknown>).at
        : undefined;
    if (typeof at === "string") {
      const when = new Date(at);
      if (!Number.isNaN(when.getTime()) && when.getTime() <= threshold.getTime()) {
        entries.push({ ...ref(concept), reason: `not refreshed in ${days} days`, since: at });
      }
    }
  }

  entries.sort(
    (a, b) => (a.since ?? "").localeCompare(b.since ?? "") || a.title.localeCompare(b.title),
  );

  const lines = [`# Stale canon (${entries.length})`, ""];
  if (entries.length === 0) lines.push("Nothing stale.", "");
  for (const entry of entries) {
    lines.push(
      `* [${entry.title}](/${entry.path}) — ${entry.reason}${entry.since ? ` (${entry.since})` : ""}`,
    );
  }
  lines.push("");

  return { title: "Stale canon", markdown: lines.join("\n"), data: { entries } };
}

export interface DivergenceEntry extends TimelineEntry {
  divergesAt?: Ref;
}

export function divergences(
  bundle: Bundle,
  options: { status?: string } = {},
): QueryResult<{
  counts: Record<string, number>;
  groups: Array<{ status: string; entries: DivergenceEntry[] }>;
}> {
  const byId = new Map(bundle.concepts.map((concept) => [concept.id, concept]));
  const all = timelineEntries(bundle).sort(
    (a, b) =>
      a.sequence - b.sequence ||
      (a.when ?? "").localeCompare(b.when ?? "") ||
      a.path.localeCompare(b.path),
  );

  const counts: Record<string, number> = {
    altered: 0,
    averted: 0,
    added: 0,
    unmarked: 0,
    intact: 0,
  };
  for (const entry of all) {
    const status = entry.divergence ?? "unmarked";
    counts[status] = (counts[status] ?? 0) + 1;
  }

  const wanted = options.status;
  const groupsMap = new Map<string, DivergenceEntry[]>();
  for (const entry of all) {
    const status = entry.divergence ?? "unmarked";
    if (wanted && status !== wanted) continue;
    const concept = byId.get(entry.id);
    const link = singleLink(concept?.frontmatter.diverges_at);
    const target = link ? byId.get(linkTargetId(link)) : undefined;
    const item: DivergenceEntry = { ...entry, ...(target ? { divergesAt: ref(target) } : {}) };
    const list = groupsMap.get(status) ?? [];
    list.push(item);
    groupsMap.set(status, list);
  }

  const order = ["altered", "averted", "added", "unmarked", "intact"];
  const groups = order
    .filter((status) => groupsMap.has(status))
    .map((status) => ({ status, entries: groupsMap.get(status) ?? [] }));

  const lines = [
    "# Divergence ledger",
    "",
    `intact: ${counts.intact} · altered: ${counts.altered} · averted: ${counts.averted} · ` +
      `added: ${counts.added} · unmarked: ${counts.unmarked}`,
    "",
  ];
  if (groups.length === 0) lines.push("No timeline events match.", "");
  for (const group of groups) {
    lines.push(`## ${group.status} (${group.entries.length})`, "");
    for (const entry of group.entries) {
      const when = entry.when ? `${entry.when} — ` : "";
      const at = entry.divergesAt
        ? ` → [${entry.divergesAt.title}](/${entry.divergesAt.path})`
        : "";
      lines.push(`* ${when}[${entry.title}](/${entry.path})${at}`);
    }
    lines.push("");
  }

  return {
    title: "Divergence ledger",
    markdown: lines.join("\n"),
    data: { counts, groups },
  };
}

export interface BundleStats {
  manuscript: {
    chapters: number;
    scenes: number;
    written: number;
    empty: number;
    words: number;
    averageSceneWords: number;
    chapterDetails: {
      id: string;
      title: string;
      scenes: number;
      words: number;
      wordsMin?: number;
      wordsMax?: number;
      wordState?: WordState;
    }[];
    targets: { under: number; over: number };
  };
  concepts: { type: string; count: number }[];
  characters: { total: number; alive: number; dead: number; unknown: number; other: number };
  tags: { used: number; missing: number };
  sources: { url: number; bundle: number; nonFollowable: number };
  divergence: Record<string, number>;
  stale: number;
}

const STATS_TAGS_RECOMMENDED = TAGS_RECOMMENDED;

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function stats(bundle: Bundle, options: { summary?: boolean } = {}): QueryResult<BundleStats> {
  const manuscript = collectManuscript(bundle);

  let scenes = 0;
  let written = 0;
  let words = 0;
  let under = 0;
  let over = 0;
  const chapterDetails: BundleStats["manuscript"]["chapterDetails"] = [];
  const chapterLines: string[] = [];

  for (const chapter of manuscript.chapters) {
    let chapterWords = 0;
    for (const scene of chapter.scenes) {
      const sceneWords = countWords(scene.body);
      scenes += 1;
      if (sceneWords > 0) written += 1;
      words += sceneWords;
      chapterWords += sceneWords;
    }

    const id = chapter.concept?.id ?? "";
    const title = chapter.concept ? getTitle(chapter.concept) : "Unassigned";
    const rawBounds = chapter.concept?.frontmatter.words;
    const parsed = rawBounds === undefined ? undefined : parseWordBounds(rawBounds);
    const bounds = parsed?.ok === true ? parsed.bounds : undefined;
    const state =
      bounds !== undefined && chapterWords > 0
        ? chapterWordState(bounds, chapterWords)
        : "unbounded";
    if (state === "under") under += 1;
    else if (state === "over") over += 1;
    chapterDetails.push({
      id,
      title,
      scenes: chapter.scenes.length,
      words: chapterWords,
      ...(bounds?.min !== undefined ? { wordsMin: bounds.min } : {}),
      ...(bounds?.max !== undefined ? { wordsMax: bounds.max } : {}),
      ...(state !== "unbounded" ? { wordState: state } : {}),
    });

    const sequence = chapter.concept?.frontmatter.sequence;
    const label =
      id === ""
        ? title
        : typeof sequence === "number" && Number.isFinite(sequence)
          ? `Chapter ${sequence} — ${title}`
          : title;
    const target = bounds !== undefined ? ` · target ${formatWordBounds(bounds)}` : "";
    const mark =
      state === "under" && bounds?.min !== undefined
        ? ` — under ${formatCount(bounds.min)}-word minimum`
        : state === "over" && bounds?.max !== undefined
          ? ` — over ${formatCount(bounds.max)}-word maximum`
          : "";
    chapterLines.push(
      `* ${label}: ${formatCount(chapterWords)} words (${chapter.scenes.length} scenes${target})${mark}`,
    );
  }

  const empty = scenes - written;
  const averageSceneWords = scenes === 0 ? 0 : Math.floor(words / scenes);

  const typeCounts = new Map<string, number>();
  for (const concept of bundle.concepts) {
    const type = getType(concept) ?? "Unknown";
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }
  const conceptCounts = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const characters = { total: 0, alive: 0, dead: 0, unknown: 0, other: 0 };
  for (const concept of bundle.concepts) {
    if (getType(concept) !== "Character") continue;
    characters.total += 1;
    const fate = concept.frontmatter.fate;
    const value = typeof fate === "string" ? fate.trim().toLowerCase() : "";
    if (value === "alive") characters.alive += 1;
    else if (value === "dead") characters.dead += 1;
    else if (value === "unknown") characters.unknown += 1;
    else characters.other += 1;
  }

  const uniqueTags = new Set<string>();
  let missingTags = 0;
  for (const concept of bundle.concepts) {
    const tags = stringList(concept.frontmatter.tags);
    for (const tag of tags) uniqueTags.add(tag.toLowerCase());
    const type = getType(concept);
    if (type !== undefined && STATS_TAGS_RECOMMENDED.has(type) && tags.length === 0) {
      missingTags += 1;
    }
  }

  const sources = { url: 0, bundle: 0, nonFollowable: 0 };
  for (const concept of bundle.concepts) {
    for (const entry of sourceEntries(concept)) {
      const resource = entry.resource;
      if (/^https?:\/\//i.test(resource)) sources.url += 1;
      else if (resource.startsWith("/") && resource.endsWith(".md")) sources.bundle += 1;
      else sources.nonFollowable += 1;
    }
  }

  const divergence = divergences(bundle).data.counts;
  const staleCount = stale(bundle).data.entries.length;

  const lines: string[] = ["# Stats", ""];
  lines.push("## Manuscript", "");
  lines.push(
    `* Chapters: ${manuscript.chapters.length} · Scenes: ${scenes} (written ${written}, empty ${empty})`,
  );
  lines.push(`* Words: ${formatCount(words)} (avg ${formatCount(averageSceneWords)}/scene)`);
  if (under > 0 || over > 0) {
    lines.push(`* Out of target: ${under} under · ${over} over`);
  }
  if (options.summary !== true) lines.push(...chapterLines);
  lines.push("");
  lines.push("## Concepts", "");
  for (const entry of conceptCounts) lines.push(`* ${entry.type}: ${entry.count}`);
  lines.push("");
  lines.push("## Characters by fate", "");
  lines.push(`* alive ${characters.alive} · dead ${characters.dead} · unknown ${characters.unknown}`);
  lines.push("");
  lines.push("## Tags", "");
  lines.push(`* Unique tags: ${uniqueTags.size} · missing tags: ${missingTags}`);
  lines.push("");
  lines.push("## Sources", "");
  lines.push(
    `* URLs ${sources.url} · bundle ${sources.bundle} · non-followable ${sources.nonFollowable}`,
  );
  lines.push("");
  lines.push("## Divergence", "");
  lines.push(
    `* intact ${divergence.intact ?? 0} · altered ${divergence.altered ?? 0} · ` +
      `averted ${divergence.averted ?? 0} · added ${divergence.added ?? 0} · ` +
      `unmarked ${divergence.unmarked ?? 0}`,
  );
  lines.push("");
  lines.push("## Stale canon", "");
  lines.push(`* ${staleCount} concept(s) due for a refresh`);
  lines.push("");

  return {
    title: "Stats",
    markdown: lines.join("\n"),
    data: {
      manuscript: {
        chapters: manuscript.chapters.length,
        scenes,
        written,
        empty,
        words,
        averageSceneWords,
        chapterDetails,
        targets: { under, over },
      },
      concepts: conceptCounts,
      characters,
      tags: { used: uniqueTags.size, missing: missingTags },
      sources,
      divergence,
      stale: staleCount,
    },
  };
}

export function threads(
  bundle: Bundle,
  options: { dangling?: boolean } = {},
): QueryResult<{ threads: ThreadEntry[] }> {
  const sceneConcepts = orderedScenes(bundle);
  const threadConcepts = bundle.concepts.filter((concept) => getType(concept) === "Plot Thread");

  const entries: ThreadEntry[] = threadConcepts.map((thread) => {
    const kind = typeof thread.frontmatter.kind === "string" ? thread.frontmatter.kind : undefined;
    const status =
      typeof thread.frontmatter.status === "string" ? thread.frontmatter.status : undefined;
    const scenes = sceneConcepts
      .filter((scene) => {
        const links = [...conceptLinks(scene), ...extractBundleLinks(scene.body, scene.path)];
        return links.some((link) => linkTargetId(link) === thread.id);
      })
      .map((scene) => ({ ...ref(scene), chapter: parentDir(scene.path) }));

    return { ...ref(thread), kind, status, scenes };
  });

  const shown = options.dangling ? entries.filter((entry) => entry.scenes.length === 0) : entries;

  const lines = ["# Plot threads", ""];
  if (shown.length === 0) {
    lines.push("No plot threads.", "");
  }
  for (const entry of shown) {
    const meta = [entry.kind && `kind: ${entry.kind}`, entry.status && `status: ${entry.status}`]
      .filter(Boolean)
      .join(" · ");
    lines.push(`## [${entry.title}](/${entry.path})`);
    if (meta) lines.push(`- ${meta}`);
    lines.push(
      entry.scenes.length === 0
        ? "- Advancing scenes: none"
        : `- Advancing scenes (${entry.scenes.length}): ${entry.scenes
            .map((scene) => `[${scene.title}](/${scene.path})`)
            .join(", ")}`,
    );
    lines.push("");
  }
  if (options.dangling && entries.length > 0 && shown.length === 0) {
    lines.push("No dangling threads.", "");
  }

  return { title: "Plot threads", markdown: lines.join("\n"), data: { threads: shown } };
}
