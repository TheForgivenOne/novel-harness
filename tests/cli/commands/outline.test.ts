import { describe, expect, spyOn, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "../../../src/cli/args.ts";
import { cmdOutline } from "../../../src/cli/commands/outline.ts";
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

describe("novel outline --check", () => {
  test("clean bundle passes with exit 0", async () => {
    const root = await setup({
      "chapters/first-day/scenes/the-bite.md": SCENE_DRAFTED,
    });
    const { code, out } = await run(cmdOutline, root, ["--check"]);
    expect(code).toBe(0);
    expect(out).toContain("Outline is in sync");
  });

  test("planned scene without a file fails", async () => {
    const root = await setup({
      "outline.md": OUTLINE.replace(
        "| First Day | The Bite | 1 | Scott McCall | Jan 9, 2011 | stub |",
        "| First Day | The Bite | 1 | Scott McCall | Jan 9, 2011 | stub |\n| First Day | The Hunt | 2 | Scott McCall | Jan 10, 2011 | stub |",
      ),
    });
    const { code, out } = await run(cmdOutline, root, ["--check"]);
    expect(code).toBe(1);
    expect(out).toContain("Planned scenes with no scene file");
  });

  test("scene file outside scenes/ is a warning that does not fail the gate", async () => {
    const root = await setup({
      "chapters/first-day/scenes/the-bite.md": SCENE_DRAFTED,
      "chapters/first-day/legacy.md": SCENE_DRAFTED,
    });
    const { code, out } = await run(cmdOutline, root, ["--check"]);
    expect(code).toBe(0);
    expect(out).toContain("not under a scenes/ directory");
  });

  test("prints the outline body without --check", async () => {
    const root = await setup({});
    const { code, out } = await run(cmdOutline, root, []);
    expect(code).toBe(0);
    expect(out).toContain("# Structure");
    expect(out).toContain("| Arc | Chapter | Sequence | POV | When | Words |");
  });
});