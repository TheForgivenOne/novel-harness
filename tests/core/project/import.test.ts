import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { importConcepts, parseImport } from "../../../src/core/project/import.ts";
import { makeBundle } from "../../helpers.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";

async function setup() {
  const root = await makeBundle({
    "novel.md": `---\ntype: Novel\ntitle: Test\nstatus: stable\n${GEN}\n---\n`,
    "characters/hero.md": `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\n${GEN}\n---\n`,
  });
  const bundle = await loadBundle(root);
  return { root, project: { bundle, bundlePath: root, author: "human:a" } };
}

async function raw(root: string, path: string): Promise<string> {
  return readFile(join(root, path), "utf8");
}

describe("parseImport", () => {
  test("parses CSV with quoted values", () => {
    const rows = parseImport('type,title\ncharacter,"Voss, Elena"\n', "cast.csv");
    expect(rows).toEqual([{ type: "character", title: "Voss, Elena" }]);
  });

  test("parses YAML lists", () => {
    const rows = parseImport("- type: character\n  title: Guest\n  tags: [a, b]\n", "cast.yaml");
    expect(rows).toEqual([{ type: "character", title: "Guest", tags: "a,b" }]);
  });

  test("normalizes dashed keys", () => {
    const rows = parseImport("type,title,diverges-at\nscene,Open,chapters/ch-01/sc-01\n", "s.csv");
    expect(rows[0]?.diverges_at).toBe("chapters/ch-01/sc-01");
  });

  test("rejects rows without a type", () => {
    expect(() => parseImport("type,title\n,Missing\n", "s.csv")).toThrow("row 1: type is required");
  });
});

describe("importConcepts", () => {
  test("creates chapters and a scene with continuous sequences", async () => {
    const { root, project } = await setup();
    const rows = parseImport(
      "type,title,chapter\nchapter,One,\nchapter,Two,\nscene,Opening,One\n",
      "plan.csv",
    );
    const result = await importConcepts(project, rows, { source: "plan.csv" });
    expect(result.created).toEqual([
      "chapters/one.md",
      "chapters/two.md",
      "chapters/one/scenes/opening.md",
    ]);
    expect(await raw(root, "chapters/one.md")).toContain("sequence: 1");
    expect(await raw(root, "chapters/two.md")).toContain("sequence: 2");
    expect(existsSync(join(root, "chapters/one/scenes/opening.md"))).toBe(true);
    expect(await raw(root, "log.md")).toContain("Imported 3 concept(s) from plan.csv");
  });

  test("applies row fields including fate, tags, and sequence", async () => {
    const { root, project } = await setup();
    const rows = parseImport(
      "type,title,sequence,fate,tags\ncharacter,Guest,,dead,ghost\nchapter,Seven,7,,\n",
      "rows.csv",
    );
    await importConcepts(project, rows);
    const guest = await raw(root, "characters/guest.md");
    expect(guest).toContain("fate: dead");
    expect(guest).toContain("- ghost");
    expect(await raw(root, "chapters/seven.md")).toContain("sequence: 7");
  });

  test("aborts atomically on an invalid row", async () => {
    const { root, project } = await setup();
    const rows = parseImport("type,title\nchapter,Valid\nnonsense,Bad\n", "bad.csv");
    await expect(importConcepts(project, rows)).rejects.toThrow("row 2: unknown concept type");
    expect(existsSync(join(root, "chapters/valid.md"))).toBe(false);
  });

  test("skips duplicate paths", async () => {
    const { project } = await setup();
    const rows = parseImport("type,title\nchapter,One\nchapter,One\n", "dupes.csv");
    const result = await importConcepts(project, rows);
    expect(result.created).toEqual(["chapters/one.md"]);
    expect(result.skipped).toEqual([{ row: 2, path: "chapters/one.md", reason: "already exists" }]);
  });

  test("stores unknown scalar columns as frontmatter", async () => {
    const { root, project } = await setup();
    const rows = parseImport("type,title,mood\ncharacter,Grim,moody\n", "extra.csv");
    await importConcepts(project, rows);
    expect(await raw(root, "characters/grim.md")).toContain("mood: moody");
  });

  test("--dry-run writes nothing", async () => {
    const { root, project } = await setup();
    const rows = parseImport("type,title\nchapter,One\n", "dry.csv");
    const result = await importConcepts(project, rows, { dryRun: true });
    expect(result.created).toEqual(["chapters/one.md"]);
    expect(existsSync(join(root, "chapters/one.md"))).toBe(false);
  });
});
