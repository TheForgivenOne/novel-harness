import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { regenerateIndexes, renderIndex } from "../../../src/core/index/generate.ts";
import { makeBundle } from "../../helpers.ts";

const files = {
  "novel.md":
    "---\ntype: Novel\ntitle: T\ndescription: A test novel.\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "characters/elena.md":
    "---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: alive\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "characters/marcus.md":
    "---\ntype: Character\ntitle: Marcus\nrole: ally\nfate: alive\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
};

describe("index generation", () => {
  test("renders a root index with okf_version and subdirectories", async () => {
    const bundle = await loadBundle(await makeBundle(files));
    const root = renderIndex(bundle, "");
    expect(root).toContain('okf_version: "0.2"');
    expect(root).toContain("* [T](novel.md) - A test novel.");
    expect(root).toContain("# Subdirectories");
    expect(root).toContain("* [characters](characters/)");
  });

  test("renders a directory index without frontmatter, sorted by title", async () => {
    const bundle = await loadBundle(await makeBundle(files));
    const characters = renderIndex(bundle, "characters");
    expect(characters).not.toContain("okf_version");
    expect(characters).toContain("# Characters");
    expect(characters.indexOf("* [Elena](elena.md)")).toBeLessThan(
      characters.indexOf("* [Marcus](marcus.md)"),
    );
  });

  test("regenerateIndexes is idempotent", async () => {
    const root = await makeBundle(files);
    const first = await regenerateIndexes(await loadBundle(root));
    expect(first.some((change) => change.changed)).toBe(true);
    expect(first.map((change) => change.path).sort()).toEqual([
      "characters/index.md",
      "index.md",
    ]);

    const second = await regenerateIndexes(await loadBundle(root));
    expect(second.every((change) => !change.changed)).toBe(true);
  });
});