import type { Concept } from "../bundle/concept.ts";

export interface DateParts {
  year?: number;
  month?: number;
  day?: number;
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Parse freeform in-world dates like "January 9, 2011", "9 January 2011", or "2011-01-09". */
export function parseDateParts(text: string): DateParts {
  const lower = text.toLowerCase();

  const iso = /\b(\d{4})-(\d{1,2})(?:-(\d{1,2}))?\b/.exec(lower);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: iso[3] ? Number(iso[3]) : undefined,
    };
  }

  const yearMatch = /\b(?:19|20)\d{2}\b/.exec(lower);
  let month: number | undefined;
  let day: number | undefined;

  for (let index = 0; index < MONTH_NAMES.length; index++) {
    const name = MONTH_NAMES[index];
    if (!name) continue;
    const at = lower.indexOf(name);
    if (at === -1) continue;
    month = index + 1;

    const after = lower.slice(at + name.length);
    const dayAfter = /^\s+(\d{1,2})\b/.exec(after);
    if (dayAfter?.[1]) day = Number(dayAfter[1]);

    if (day === undefined) {
      const before = lower.slice(0, at);
      const dayBefore = /(\d{1,2})\s*$/.exec(before);
      if (dayBefore?.[1]) day = Number(dayBefore[1]);
    }
    break;
  }

  return { year: yearMatch ? Number(yearMatch[0]) : undefined, month, day };
}

/**
 * True when `when` satisfies the query date on its most specific component.
 * "2011" matches any 2011 date; "January 2011" matches that month; a full date
 * matches that day.
 */
export function dateMatches(when: string | undefined, query: DateParts): boolean {
  if (!when) return false;
  if (query.year === undefined && query.month === undefined && query.day === undefined) {
    return false;
  }

  const parts = parseDateParts(when);

  if (query.day !== undefined) {
    if (parts.day !== query.day) return false;
    if (query.month !== undefined && parts.month !== query.month) return false;
    if (query.year !== undefined && parts.year !== query.year) return false;
    return true;
  }

  if (query.month !== undefined) {
    if (parts.month !== query.month) return false;
    if (query.year !== undefined && parts.year !== query.year) return false;
    return true;
  }

  return parts.year === query.year;
}

export function isStale(concept: Concept, now: Date = new Date()): boolean {
  const staleAfter = concept.frontmatter.stale_after;
  if (typeof staleAfter !== "string") return false;
  const at = new Date(staleAfter);
  return !Number.isNaN(at.getTime()) && at.getTime() <= now.getTime();
}
