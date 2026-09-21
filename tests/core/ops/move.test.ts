import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { moveConcept } from "../../../src/core/ops/move.ts";
import { makeBundle } from "../../helpers.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";
const novel = `---\ntype: Novel\ntitle: Test\nstatus: stable\n${GEN}\n---\n`;
const hero = `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\n${GEN}\n---\n`;
const archive = `---\ntype: Location\ntitle: Archive\nstatus: stable\n${GEN}\n---\n`;
const chapter = (title: string, sequence: number) =>
  `---\ntype: Chapter\ntitle: ${title}\nsequence: ${sequence}\npov: /characters/hero.md\nstatus: stable\n${GEN}\n---\n`;
const scene =
  `---\ntype: Scene\ntitle: Open\nsequence: 1\npov: /characters/hero.md\n` +
  `cast: [/characters/hero.md]\nlocation: /locations/archive.md\nstatus: stable\n${GEN}\n---\n`;
const event =
  `---\ntype: Timeline Event\ntitle: Event\nsequence: 1\nwhen: 2011\n` +
  `diverges_at: /chapters/ch-01/sc-01.md\nstatus: stable\n${GEN}\n---\n`;

async function setup(extra: Record<string, string> = {}) {
  const root = await makeBundle({
    "novel.md": novel,
    "characters/hero.md": hero,
    "locations/archive.md": archive,
    "chapters/ch-01.md": chapter("One", 1),
    "chapters/ch-02.md": chapter("Two", 2),
    "chapters/ch-01/sc-01.md": scene,
    "timeline/event.md": event,
    ...extra,
  });
  const bundle = await loadBundle(root);
  return { root, project: { bundle, bundlePath: root } };
}

describe("novel mv", () => {
  test("moves a scene, appends a sequence, and rewrites links", async () => {
    const { root, project } = await setup();
    const result = await moveConcept(project, "chapters/ch-01/sc-01", { to: "ch-02" });
    expect(result.to).toBe("chapters/ch-02/scenes/sc-01");
    expect(result.rewritten).toContain("timeline/event.md");
    expect(existsSync(join(root, "chapters/ch-01/sc-01.md"))).toBe(false);
    const moved = await readFile(join(root, "chapters/ch-02/scenes/sc-01.md"), "utf8");
    expect(moved).toContain("sequence: 1");
    expect(await readFile(join(root, "timeline/event.md"), "utf8")).toContain(
      "diverges_at: /chapters/ch-02/scenes/sc-01.md",
    );
    expect(await readFile(join(root, "chapters/ch-01.md"), "utf8")).toBeDefined();
    expect(existsSync(join(root, "chapters/ch-01"))).toBe(false);
  });

  test("rejects non-scene concepts", async () => {
    const { project } = await setup();
    await expect(moveConcept(project, "hero", { to: "ch-02" })).rejects.toThrow("only scenes");
  });

  test("--sequence overrides the appended value", async () => {
    const { root, project } = await setup();
    await moveConcept(project, "chapters/ch-01/sc-01", { to: "ch-02", sequence: 5 });
    expect(await readFile(join(root, "chapters/ch-02/scenes/sc-01.md"), "utf8")).toContain(
      "sequence: 5",
    );
  });

  test("rejects a colliding target path", async () => {
    const { project } = await setup({
      "chapters/ch-02/scenes/sc-01.md": scene.replace("title: Open", "title: Taken"),
    });
    await expect(moveConcept(project, "chapters/ch-01/sc-01", { to: "ch-02" })).rejects.toThrow(
      "target exists",
    );
  });
});

describe("novel mv chapter", () => {
  test("moves the chapter concept, outline, and scenes folder", async () => {
    const { root, project } = await setup({
      "chapters/ch-01/outline.md": `---\ntype: Chapter Outline\ntitle: One — Outline\nstatus: draft\n${GEN}\n---\n`,
      "chapters/ch-01/scenes/sc-01.md": scene,
      "timeline/event.md": event.replace("/chapters/ch-01/sc-01.md", "/chapters/ch-01/scenes/sc-01.md"),
    });
    const result = await moveConcept(project, "chapters/ch-01", { to: "ch-03" });
    expect(result.to).toBe("chapters/ch-03");
    expect(existsSync(join(root, "chapters/ch-01.md"))).toBe(false);
    expect(existsSync(join(root, "chapters/ch-03.md"))).toBe(true);
    expect(existsSync(join(root, "chapters/ch-03/outline.md"))).toBe(true);
    expect(existsSync(join(root, "chapters/ch-03/scenes/sc-01.md"))).toBe(true);
    expect(await readFile(join(root, "timeline/event.md"), "utf8")).toContain(
      "diverges_at: /chapters/ch-03/scenes/sc-01.md",
    );
  });
});