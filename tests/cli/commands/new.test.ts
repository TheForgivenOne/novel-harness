import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "../../../src/cli/args.ts";
import { cmdNew } from "../../../src/cli/commands/new.ts";
import { makeBundle } from "../../helpers.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";
const HERO = `---
type: Character
title: Scott McCall
role: protagonist
fate: alive
status: stable
${GEN}
---\n`;
const CHAPTER_ONE = `---
type: Chapter
title: First Day
sequence: 1
pov: /characters/scott.md
status: stable
${GEN}
---\n`;

async function sceneProject(extra: Record<string, string>) {
  const root = await makeBundle({
    "characters/scott.md": HERO,
    "chapters/first-day.md": CHAPTER_ONE,
    ...extra,
  });
  await mkdir(join(root, ".novel"));
  await writeFile(
    join(root, ".novel", "config.json"),
    JSON.stringify({
      version: 1,
      bundle: "",
      targets: [],
      author: "human:a",
      build: { out: "dist", format: "md" },
    }),
    "utf8",
  );
  return root;
}

describe("novel new chapter scaffolding", () => {
  test("creates outline.md and scenes/ alongside the chapter", async () => {
    const root = await sceneProject({});
    const code = await cmdNew(parseArgs(["chapter", "Full Moon"]), root);
    expect(code).toBe(0);
    const outlinePath = join(root, "chapters/full-moon/outline.md");
    const scenesIndex = join(root, "chapters/full-moon/scenes/index.md");
    expect(existsSync(outlinePath)).toBe(true);
    expect(existsSync(scenesIndex)).toBe(true);
    const raw = await readFile(outlinePath, "utf8");
    expect(raw).toContain("type: Chapter Outline");
    expect(raw).toContain("title: Full Moon — Outline");
    expect(raw).toContain("# Intent");
    expect(raw).toContain("# Scenes");
    expect(raw).toContain("# Notes");
  });
});