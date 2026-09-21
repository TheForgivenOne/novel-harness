import type { Concept } from "./concept.ts";

export function sequenceOf(concept: Concept, fallback: number = Number.MAX_SAFE_INTEGER): number {
  const value = concept.frontmatter.sequence;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function compareSequence(a: Concept, b: Concept): number {
  return sequenceOf(a) - sequenceOf(b) || a.path.localeCompare(b.path);
}

export function nextSequence(concepts: Concept[]): number {
  return concepts.reduce((max, concept) => Math.max(max, sequenceOf(concept, 0)), 0) + 1;
}
