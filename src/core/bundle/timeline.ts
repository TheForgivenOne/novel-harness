import type { Bundle } from "./bundle.ts";
import { getTitle, getType } from "./concept.ts";
import { parseDateParts } from "../query/dates.ts";
import { stringList } from "../text/guards.ts";

export function compareWhen(a: string, b: string): number {
  const pa = parseDateParts(a);
  const pb = parseDateParts(b);
  const ya = pa.year ?? Number.NEGATIVE_INFINITY;
  const yb = pb.year ?? Number.NEGATIVE_INFINITY;
  if (ya !== yb) return ya < yb ? -1 : 1;
  const ma = pa.month ?? Number.NEGATIVE_INFINITY;
  const mb = pb.month ?? Number.NEGATIVE_INFINITY;
  if (ma !== mb) return ma < mb ? -1 : 1;
  const da = pa.day ?? Number.NEGATIVE_INFINITY;
  const db = pb.day ?? Number.NEGATIVE_INFINITY;
  if (da !== db) return da < db ? -1 : 1;
  return 0;
}

export interface TimelineEventConcept {
  id: string;
  path: string;
  title: string;
  when?: string;
  sequence: number;
  participants: string[];
  tags: string[];
  divergence?: string;
}

export function timelineEntries(bundle: Bundle): TimelineEventConcept[] {
  const events = bundle.concepts
    .filter((concept) => getType(concept) === "Timeline Event")
    .map((concept) => {
      const sequence = concept.frontmatter.sequence;
      const rawWhen = concept.frontmatter.when;
      const when =
        typeof rawWhen === "string"
          ? rawWhen
          : typeof rawWhen === "number" || typeof rawWhen === "boolean"
            ? String(rawWhen)
            : undefined;
      const rawDivergence = concept.frontmatter.divergence;
      const divergence =
        typeof rawDivergence === "string"
          ? rawDivergence
          : concept.frontmatter.origin === "source"
            ? "intact"
            : "unmarked";
      return {
        id: concept.id,
        path: concept.path,
        title: getTitle(concept),
        ...(when !== undefined ? { when } : {}),
        sequence: typeof sequence === "number" ? sequence : Number.MAX_SAFE_INTEGER,
        participants: stringList(concept.frontmatter.participants).filter((entry) =>
          entry.startsWith("/"),
        ),
        tags: stringList(concept.frontmatter.tags),
        divergence,
      };
    });
  events.sort(
    (a, b) =>
      a.sequence - b.sequence ||
      compareWhen(a.when ?? "", b.when ?? "") ||
      a.path.localeCompare(b.path),
  );
  return events;
}