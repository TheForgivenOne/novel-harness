import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { collectManuscript, renderManuscript } from "../../../src/core/build/manuscript.ts";
import { validStoryDir } from "../../helpers.ts";

describe("manuscript build", () => {
  test("collects chapters and scenes in order", async () => {
    const bundle = await loadBundle(validStoryDir);
    const manuscript = collectManuscript(bundle);
    expect(manuscript.novel?.id).toBe("novel");
    expect(manuscript.chapters).toHaveLength(1);
    expect(manuscript.chapters[0]?.scenes.map((scene) => scene.id)).toEqual([
      "chapters/ch-01/sc-01",
      "chapters/ch-01/sc-02",
    ]);
  });

  test("renders title, chapter heading, and scene separators", async () => {
    const bundle = await loadBundle(validStoryDir);
    const text = renderManuscript(bundle);
    expect(text.startsWith("# The Hollow Crown")).toBe(true);
    expect(text).toContain("# Chapter 1 — The Archive");
    expect(text).toContain("The archivist set the map on the table");
    expect(text).toContain("* * *");
  });
});