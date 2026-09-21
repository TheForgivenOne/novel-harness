import { describe, expect, spyOn, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "../../../src/cli/args.ts";
import { cmdStatus } from "../../../src/cli/commands/status.ts";
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

async function run(
  cmd: (args: ReturnType<typeof parseArgs>, cwd: string) => Promise<number>,
  root: string,
  argv: string[],
) {
  const out: string[] = [];
  const err: string[] = [];
  const outSpy = spyOn(process.stdout, "write").mockImplementation(
    ((chunk: string) => {
      out.push(String(chunk));
      return true;
    }) as typeof process.stdout.write,
  );
  const errSpy = spyOn(process.stderr, "write").mockImplementation(
    ((chunk: string) => {
      err.push(String(chunk));
      return true;
    }) as typeof process.stderr.write,
  );
  const code = await cmd(parseArgs(argv), root);
  outSpy.mockRestore();
  errSpy.mockRestore();
  return { code, out: out.join(""), err: err.join("") };
}

describe("novel status", () => {
  test("reports drafted vs stubs, words, budget, and next", async () => {
    const root = await setup({
      "chapters/first-day/scenes/the-bite.md": SCENE_DRAFTED,
    });
    const { code, out } = await run(cmdStatus, root, []);
    expect(code).toBe(0);
    expect(out).toContain("First Day (budget 1800)");
    expect(out).toContain("1 drafted, 0 stubs");
    expect(out).toContain("Next: Draft The Bite in First Day.");
  });

  test("stub scene counts as a stub and becomes next", async () => {
    const root = await setup({});
    const { out } = await run(cmdStatus, root, []);
    expect(out).toContain("0 drafted, 1 stubs");
    expect(out).toContain("next: The Bite");
  });
});