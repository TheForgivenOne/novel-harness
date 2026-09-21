import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { convertConcepts } from "../../../src/core/ops/convert.ts";
import type { OpsProject } from "../../../src/core/ops/link-rewrite.ts";
import { makeBundle } from "../../helpers.ts";

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

describe("convertConcepts", () => {
  test("moves a chapter to arcs, changes the type, and rewrites links", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "characters/elena.md": characterFile("Elena", "See [One](/chapters/ch-01.md).\n"),
      "chapters/ch-01.md": chapterFile("One"),
    });
    const project = await openProject(root);

    const result = await convertConcepts(project, "chapter", "arc", {});

    expect(result.skipped).toEqual([]);
    expect(result.converted).toEqual([{ from: "chapters/ch-01.md", to: "arcs/ch-01.md" }]);
    expect(existsSync(join(root, "chapters/ch-01.md"))).toBe(false);

    const converted = await readFile(join(root, "arcs/ch-01.md"), "utf8");
    expect(converted).toContain("type: Arc");
    const elena = await readFile(join(root, "characters/elena.md"), "utf8");
    expect(elena).toContain("/arcs/ch-01.md");
    expect(elena).not.toContain("/chapters/ch-01.md");
  });

  test("converts a single file when --file is given", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "characters/elena.md": characterFile("Elena"),
      "chapters/ch-01.md": chapterFile("One"),
      "chapters/ch-02.md": chapterFile("Two"),
    });
    const project = await openProject(root);

    const result = await convertConcepts(project, "chapter", "arc", { file: "ch-02" });

    expect(result.converted).toEqual([{ from: "chapters/ch-02.md", to: "arcs/ch-02.md" }]);
    expect(existsSync(join(root, "chapters/ch-01.md"))).toBe(true);
    expect(existsSync(join(root, "arcs/ch-02.md"))).toBe(true);
  });

  test("refuses a chapter that owns a scene directory", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "characters/elena.md": characterFile("Elena"),
      "chapters/ch-01.md": chapterFile("One"),
      "chapters/ch-01/sc-01.md": sceneFile("Opening"),
    });
    const project = await openProject(root);

    const result = await convertConcepts(project, "chapter", "arc", {});

    expect(result.converted).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.path).toBe("chapters/ch-01.md");
    expect(result.skipped[0]?.reason).toContain("scene");
    expect(existsSync(join(root, "chapters/ch-01.md"))).toBe(true);
  });

  test("refuses scenes", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "characters/elena.md": characterFile("Elena"),
      "chapters/ch-01/sc-01.md": sceneFile("Opening"),
    });
    const project = await openProject(root);

    const result = await convertConcepts(project, "scene", "item", {});

    expect(result.converted).toEqual([]);
    expect(result.skipped[0]?.reason).toContain("manual");
  });
});