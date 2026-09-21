import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { checkOutline } from "../../../src/core/outline/check.ts";
import { makeBundle } from "../../helpers.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";
const OUTLINE = `---
type: Outline
title: Story Outline
status: draft
${GEN}
---
# Structure

| Arc | Chapter | Sequence | POV | When | Words |
| --- | ------- | -------- | --- | ---- | ----- |
| Act 1 | First Day | 1 | Scott McCall | Jan 9, 2011 | 1800 |

# Scenes

| Chapter | Scene | Sequence | POV | When | Status |
| ------- | ----- | -------- | --- | ---- | ------ |
| First Day | The Bite | 1 | Scott McCall | Jan 9, 2011 | stub |

# Next

Draft The Bite in First Day.
`;
const CHAPTER = `---\ntype: Chapter\ntitle: First Day\nsequence: 1\npov: /characters/scott.md\nstatus: stable\n${GEN}\n---\n`;
const SCENE_STUB = `---\ntype: Scene\ntitle: The Bite\nsequence: 1\npov: /characters/scott.md\ncast: [/characters/scott.md]\nstatus: draft\n${GEN}\n---\n# Overview\n`;
const SCENE_DRAFTED = SCENE_STUB + "\nIt was a quiet night in Beacon Hills. Scott walked home alone.\n";
const HERO = `---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\nfate: alive\nstatus: stable\n${GEN}\n---\n`;

async function setup(files: Record<string, string>) {
  const root = await makeBundle({
    "outline.md": OUTLINE,
    "characters/scott.md": HERO,
    "chapters/first-day.md": CHAPTER,
    "chapters/first-day/scenes/the-bite.md": SCENE_STUB,
    ...files,
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

describe("novel outline --check", () => {
  test("checkOutline flags planned-only and file-only rows", async () => {
    const root = await setup({
      "chapters/first-day/scenes/the-bite.md": SCENE_DRAFTED,
      "chapters/first-day/extra.md": SCENE_DRAFTED.replace("The Bite", "Extra"),
    });
    const bundle = await loadBundle(root);
    const drift = checkOutline(bundle);
    expect(drift.plannedOnly.length).toBe(0);
    expect(drift.sceneFileOnly).toContain("chapters/first-day/extra");
    expect(drift.misplaced).toContain("chapters/first-day/extra");
  });
});