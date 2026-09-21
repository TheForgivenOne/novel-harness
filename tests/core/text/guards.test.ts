import { describe, expect, test } from "bun:test";
import { isRecord, stringList } from "../../../src/core/text/guards.ts";

describe("guards", () => {
  test("isRecord rejects arrays and null", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  test("stringList keeps only strings", () => {
    expect(stringList(["a", 1, "b"])).toEqual(["a", "b"]);
    expect(stringList("a")).toEqual([]);
  });
});