export interface WordBounds {
  min?: number;
  max?: number;
}

export type WordBoundsResult =
  | { ok: true; bounds: WordBounds }
  | { ok: false; message: string };

export type WordState = "unbounded" | "under" | "in-range" | "over";

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function parseWordBounds(value: unknown): WordBoundsResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, message: "words must be a mapping with min and/or max" };
  }

  const record = value as Record<string, unknown>;
  const rawMin = record.min;
  const rawMax = record.max;

  if (
    rawMin !== undefined &&
    (typeof rawMin !== "number" || !Number.isInteger(rawMin) || rawMin <= 0)
  ) {
    return { ok: false, message: "words.min must be a positive integer" };
  }
  if (
    rawMax !== undefined &&
    (typeof rawMax !== "number" || !Number.isInteger(rawMax) || rawMax <= 0)
  ) {
    return { ok: false, message: "words.max must be a positive integer" };
  }
  if (rawMin === undefined && rawMax === undefined) {
    return { ok: false, message: "words must define min and/or max" };
  }
  if (typeof rawMin === "number" && typeof rawMax === "number" && rawMin > rawMax) {
    return { ok: false, message: "words.min must not exceed words.max" };
  }

  const bounds: WordBounds = {};
  if (typeof rawMin === "number") bounds.min = rawMin;
  if (typeof rawMax === "number") bounds.max = rawMax;
  return { ok: true, bounds };
}

export function chapterWordState(bounds: WordBounds, written: number): WordState {
  if (bounds.min === undefined && bounds.max === undefined) return "unbounded";
  if (bounds.min !== undefined && written < bounds.min) return "under";
  if (bounds.max !== undefined && written > bounds.max) return "over";
  return "in-range";
}

export function formatWordBounds(bounds: WordBounds): string {
  if (bounds.min !== undefined && bounds.max !== undefined) {
    return `${bounds.min.toLocaleString("en-US")}–${bounds.max.toLocaleString("en-US")}`;
  }
  if (bounds.min !== undefined) return `min ${bounds.min.toLocaleString("en-US")}`;
  if (bounds.max !== undefined) return `max ${bounds.max.toLocaleString("en-US")}`;
  return "unbounded";
}
