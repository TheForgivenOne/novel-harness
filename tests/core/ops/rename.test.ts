import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { renameConcept } from "../../../src/core/ops/rename.ts";
import type { OpsProject } from "../../../src/core/ops/link-rewrite.ts";
import { makeBundle } from "../../helpers.ts";

describe("rename slug guard", () => {
  test("refuses a name that produces an empty slug", async () => {
    const root = await makeBundle({
      "characters/hero.md":
        "---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    });
    const bundle = await loadBundle(root);
    await expect(renameConcept({ bundle, bundlePath: root }, "characters/hero", "!!!")).rejects.toThrow(
      "cannot derive a slug",
    );
  });
});

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

describe("novel rename chapter", () => {
  test("renaming a chapter moves its folder and rewrites scene links", async () => {
    const { root, project } = await setup({
      "chapters/ch-01/outline.md": `---\ntype: Chapter Outline\ntitle: One — Outline\nstatus: draft\n${GEN}\n---\n`,
      "chapters/ch-01/scenes/sc-01.md": scene,
      "timeline/event.md": event.replace("/chapters/ch-01/sc-01.md", "/chapters/ch-01/scenes/sc-01.md"),
    });
    const { renameConcept } = await import("../../../src/core/ops/rename.ts");
    const result = await renameConcept(project, "chapters/ch-01", "Three");
    expect(result.to).toBe("chapters/three");
    expect(existsSync(join(root, "chapters/three/outline.md"))).toBe(true);
    expect(existsSync(join(root, "chapters/three/scenes/sc-01.md"))).toBe(true);
    expect(existsSync(join(root, "chapters/ch-01"))).toBe(false);
    expect(await readFile(join(root, "timeline/event.md"), "utf8")).toContain(
      "diverges_at: /chapters/three/scenes/sc-01.md",
    );
  });
});

async function openProject(root: string): Promise<OpsProject> {
  return {
    bundle: await loadBundle(root),
    bundlePath: root,
    config: { author: "human:tester" },
  };
}

function novelFile(): string {
  return "---\ntype: Novel\ntitle: Test\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n";
}

function characterFile(title: string, body = ""): string {
  return `---\ntype: Character\ntitle: ${title}\nrole: supporting\nfate: alive\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n${body}`;
}

function chapterFile(title: string, body = ""): string {
  return `---\ntype: Chapter\ntitle: ${title}\nsequence: 1\npov: /characters/elena.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n${body}`;
}

function sceneFile(title: string): string {
  return `---\ntype: Scene\ntitle: ${title}\nsequence: 1\npov: /characters/elena.md\ncast: [/characters/elena.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n`;
}

describe("renameConcept", () => {
  test("renames the file, updates the title, and rewrites backlinks", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "characters/boyd.md": characterFile("Boyd"),
      "characters/elena.md": characterFile("Elena", "See [Boyd](/characters/boyd.md).\n"),
    });
    const project = await openProject(root);

    const result = await renameConcept(project, "boyd", "Vernon Boyd");

    expect(result.from).toBe("characters/boyd");
    expect(result.to).toBe("characters/vernon-boyd");
    expect(result.rewritten).toContain("characters/elena.md");
    expect(existsSync(join(root, "characters/boyd.md"))).toBe(false);

    const renamed = await readFile(join(root, "characters/vernon-boyd.md"), "utf8");
    expect(renamed).toContain("title: Vernon Boyd");
    const elena = await readFile(join(root, "characters/elena.md"), "utf8");
    expect(elena).toContain("/characters/vernon-boyd.md");
    expect(elena).not.toContain("/characters/boyd.md");

    const bundle = await loadBundle(root);
    expect(bundle.concepts.some((concept) => concept.id === "characters/vernon-boyd")).toBe(true);
    expect(bundle.concepts.some((concept) => concept.id === "characters/boyd")).toBe(false);
  });

  test("keeps the parent directory for scenes", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "characters/elena.md": characterFile("Elena"),
      "chapters/ch-01.md": chapterFile("One"),
      "chapters/ch-01/sc-01.md": sceneFile("Opening"),
    });
    const project = await openProject(root);

    const result = await renameConcept(project, "chapters/ch-01/sc-01", "The Meeting");

    expect(result.to).toBe("chapters/ch-01/the-meeting");
    expect(existsSync(join(root, "chapters/ch-01/the-meeting.md"))).toBe(true);
    expect(existsSync(join(root, "chapters/ch-01/sc-01.md"))).toBe(false);
  });

  test("errors when the target file already exists", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "characters/boyd.md": characterFile("Boyd"),
      "characters/vernon-boyd.md": characterFile("Vernon"),
    });
    const project = await openProject(root);

    await expect(renameConcept(project, "boyd", "Vernon Boyd")).rejects.toThrow(
      "target already exists",
    );
  });
});