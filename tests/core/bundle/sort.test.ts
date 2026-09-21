import { describe, expect, test } from "bun:test";
import { sequenceOf } from "../../../src/core/bundle/sort.ts";
import type { Concept } from "../../../src/core/bundle/concept.ts";

const conceptWith = (frontmatter: Record<string, unknown>): Concept =>
  ({ frontmatter, path: "characters/hero.md" }) as unknown as Concept;

describe("sequenceOf", () => {
  test("reads numbers and applies the fallback", () => {
    expect(sequenceOf(conceptWith({ sequence: 7 }))).toBe(7);
    expect(sequenceOf(conceptWith({ sequence: "7" }))).toBe(Number.MAX_SAFE_INTEGER);
    expect(sequenceOf(conceptWith({ sequence: "7" }), 0)).toBe(0);
  });
});