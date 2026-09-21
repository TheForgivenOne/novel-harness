import { describe, expect, test } from "bun:test";
import { normalizeName, slugify } from "../../../src/core/text/slug.ts";

describe("slugify", () => {
  test("strips quotes and punctuation, collapses separators", () => {
    expect(slugify("Harry's Twin")).toBe("harrys-twin");
    expect(slugify("  The  Grand-Archive  ")).toBe("the-grand-archive");
  });

  test("returns the fallback for empty slugs", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("!!!", "untitled")).toBe("untitled");
  });
});

describe("normalizeName", () => {
  test("matches names across separators", () => {
    expect(normalizeName("Elena-Voss")).toBe("elenavoss");
    expect(normalizeName("Elena Voss")).toBe("elenavoss");
  });
});