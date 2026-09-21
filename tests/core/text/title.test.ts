import { describe, expect, test } from "bun:test";
import { titleCase, titleFromDir, titleFromName } from "../../../src/core/text/title.ts";

describe("titleFromDir", () => {
  test("splits slugs into capitalized words", () => {
    expect(titleFromDir("the-first-day")).toBe("The First Day");
    expect(titleFromDir("season_1")).toBe("Season 1");
    expect(titleFromDir("alpha")).toBe("Alpha");
  });

  test("handles empty and separator-only inputs", () => {
    expect(titleFromDir("")).toBe("");
    expect(titleFromDir("---")).toBe("");
  });
});

describe("titleFromName", () => {
  test("keeps names that already contain capitals or spaces", () => {
    expect(titleFromName("Scott McCall")).toBe("Scott McCall");
    expect(titleFromName("JSON")).toBe("JSON");
  });

  test("title-cases slug-like names", () => {
    expect(titleFromName("the-bite")).toBe("The Bite");
    expect(titleFromName("alpha")).toBe("Alpha");
  });

  test("trims surrounding whitespace", () => {
    expect(titleFromName("  The Bite  ")).toBe("The Bite");
  });
});

describe("titleCase", () => {
  test("capitalizes each word of a slug", () => {
    expect(titleCase("full-moon-night")).toBe("Full Moon Night");
    expect(titleCase("one")).toBe("One");
  });

  test("handles empty input", () => {
    expect(titleCase("")).toBe("");
  });
});