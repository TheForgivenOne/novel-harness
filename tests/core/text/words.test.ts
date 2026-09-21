import { describe, expect, test } from "bun:test";
import {
  chapterWordState,
  countWords,
  parseWordBounds,
} from "../../../src/core/text/words.ts";

describe("countWords", () => {
  test("counts whitespace-separated tokens", () => {
    expect(countWords("one  two\nthree\tfour")).toBe(4);
    expect(countWords("   ")).toBe(0);
    expect(countWords("")).toBe(0);
  });
});

describe("parseWordBounds", () => {
  test("accepts a mapping with either or both bounds", () => {
    expect(parseWordBounds({ min: 100, max: 200 })).toEqual({
      ok: true,
      bounds: { min: 100, max: 200 },
    });
    expect(parseWordBounds({ min: 100 })).toEqual({ ok: true, bounds: { min: 100 } });
    expect(parseWordBounds({ max: 200 })).toEqual({ ok: true, bounds: { max: 200 } });
  });

  test("rejects malformed bounds", () => {
    expect(parseWordBounds("many")).toEqual({
      ok: false,
      message: "words must be a mapping with min and/or max",
    });
    expect(parseWordBounds({})).toEqual({
      ok: false,
      message: "words must define min and/or max",
    });
    expect(parseWordBounds({ min: 0 })).toEqual({
      ok: false,
      message: "words.min must be a positive integer",
    });
    expect(parseWordBounds({ max: 10.5 })).toEqual({
      ok: false,
      message: "words.max must be a positive integer",
    });
    expect(parseWordBounds({ min: "100" })).toEqual({
      ok: false,
      message: "words.min must be a positive integer",
    });
    expect(parseWordBounds({ min: 300, max: 100 })).toEqual({
      ok: false,
      message: "words.min must not exceed words.max",
    });
  });
});

describe("chapterWordState", () => {
  test("classifies within, under, and over", () => {
    expect(chapterWordState({ min: 100, max: 200 }, 150)).toBe("in-range");
    expect(chapterWordState({ min: 100, max: 200 }, 100)).toBe("in-range");
    expect(chapterWordState({ min: 100, max: 200 }, 200)).toBe("in-range");
    expect(chapterWordState({ min: 100, max: 200 }, 60)).toBe("under");
    expect(chapterWordState({ min: 100, max: 200 }, 250)).toBe("over");
    expect(chapterWordState({ min: 100 }, 250)).toBe("in-range");
    expect(chapterWordState({ max: 200 }, 250)).toBe("over");
    expect(chapterWordState({}, 250)).toBe("unbounded");
  });
});