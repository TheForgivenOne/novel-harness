import { describe, expect, test } from "bun:test";
import { getTypeDefBySlug, typeRank } from "../../../src/core/schema/catalog.ts";

describe("outline catalog types", () => {
  test("Outline is a singleton at outline.md", () => {
    const def = getTypeDefBySlug("outline");
    expect(def).toBeDefined();
    expect(def?.type).toBe("Outline");
    expect(def?.home).toBe("outline.md");
    expect(def?.singleton).toBe(true);
    expect(def?.required).toEqual(["title"]);
    expect(def?.narrative).toBe(true);
  });

  test("Chapter Outline is non-singleton under chapters", () => {
    const def = getTypeDefBySlug("chapter-outline");
    expect(def).toBeDefined();
    expect(def?.type).toBe("Chapter Outline");
    expect(def?.home).toBe("chapters");
    expect(def?.singleton).toBeUndefined();
    expect(def?.required).toEqual(["title"]);
  });

  test("Outline ranks after Research Note in TYPE_RANK", () => {
    expect(typeRank("Research Note")).toBeLessThan(typeRank("Outline"));
  });
});