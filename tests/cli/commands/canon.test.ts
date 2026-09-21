import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../../../src/cli/args.ts";
import { cmdCanon } from "../../../src/cli/commands/canon.ts";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { initProject } from "../../../src/core/project/init.ts";

async function canonProject(name: string) {
  const root = await mkdtemp(join(tmpdir(), `novel-harness-canon-${name}-`));
  await initProject(root, { name: "Canon Test", author: "human:tester" });
  return root;
}

async function writeFiles(dir: string, files: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    const { mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
}

const SOURCE_CONCEPT = `---
type: Character
title: Derek Hale
role: ally
origin: source
status: stable
---

Canon werewolf.
`;

const SOURCE_REFERENCE = `---
type: Reference
title: Teen Wolf Wiki
resource: https://teenwolf.fandom.com/
origin: source
---

Wiki.
`;

test("canon export writes a pack with source concepts", async () => {
  const root = await canonProject("export");
  const bundlePath = join(root, "story");
  await writeFiles(bundlePath, {
    "characters/derek.md": SOURCE_CONCEPT,
    "references/wiki.md": SOURCE_REFERENCE,
  });
  const out = join(root, "canon-out");
  const code = await cmdCanon(parseArgs(["export", "--out", out]), root);
  expect(code).toBe(0);
  expect(existsSync(join(out, "characters/derek.md"))).toBe(true);
  expect(existsSync(join(out, "pack.json"))).toBe(true);
  const meta = JSON.parse(await readFile(join(out, "pack.json"), "utf8"));
  expect(meta.concepts).toBe(2);
  expect(meta.source_works).toEqual([]);
});

test("canon export refuses to export inside the story bundle", async () => {
  const root = await canonProject("export-refuse");
  await writeFiles(join(root, "story"), {
    "characters/derek.md": SOURCE_CONCEPT,
    "references/wiki.md": SOURCE_REFERENCE,
  });
  const code = await cmdCanon(parseArgs(["export", "--out", join(root, "story")]), root);
  expect(code).toBe(1);
});

test("canon export defaults to canon/ when --out is omitted", async () => {
  const root = await canonProject("export-default");
  await writeFiles(join(root, "story"), {
    "characters/derek.md": SOURCE_CONCEPT,
    "references/wiki.md": SOURCE_REFERENCE,
  });
  const code = await cmdCanon(parseArgs(["export"]), root);
  expect(code).toBe(0);
  expect(existsSync(join(root, "canon", "canon", "pack.json"))).toBe(true);
});

test("canon import adds concepts and attaches source works", async () => {
  const root = await canonProject("import");
  const packDir = join(root, "pack");
  await writeFiles(packDir, {
    "pack.json": JSON.stringify({
      name: "Teen Wolf",
      fandom: "Teen Wolf",
      source_works: ["/references/wiki.md"],
      exportedAt: "2026-09-14T00:00:00.000Z",
      concepts: 2,
    }),
    "characters/derek.md": SOURCE_CONCEPT,
    "references/wiki.md": SOURCE_REFERENCE,
  });
  const code = await cmdCanon(parseArgs(["import", packDir]), root);
  expect(code).toBe(0);
  const bundle = await loadBundle(join(root, "story"));
  expect(bundle.concepts.some((c) => c.id === "characters/derek")).toBe(true);
  const novel = bundle.concepts.find((c) => c.frontmatter.type === "Novel");
  expect(novel?.frontmatter.source_works).toContain("/references/wiki.md");
  expect(novel?.frontmatter.fandom).toBe("Teen Wolf");
});

test("canon import reports conflicts and exits 1 without --force", async () => {
  const root = await canonProject("import-conflict");
  await writeFiles(join(root, "story"), { "characters/derek.md": SOURCE_CONCEPT });
  const packDir = join(root, "pack");
  await writeFiles(packDir, {
    "pack.json": JSON.stringify({
      name: "Teen Wolf",
      source_works: [],
      exportedAt: "2026-09-14T00:00:00.000Z",
      concepts: 1,
    }),
    "characters/derek.md": SOURCE_CONCEPT.replace("origin: source", "origin: fanon"),
  });
  const code = await cmdCanon(parseArgs(["import", packDir]), root);
  expect(code).toBe(1);
});

test("canon import with --force overwrites conflicting local concepts", async () => {
  const root = await canonProject("import-force");
  await writeFiles(join(root, "story"), { "characters/derek.md": SOURCE_CONCEPT });
  const packDir = join(root, "pack");
  await writeFiles(packDir, {
    "pack.json": JSON.stringify({
      name: "Teen Wolf",
      source_works: [],
      exportedAt: "2026-09-14T00:00:00.000Z",
      concepts: 1,
    }),
    "characters/derek.md": SOURCE_CONCEPT.replace("origin: source", "origin: fanon"),
  });
  const code = await cmdCanon(parseArgs(["import", packDir, "--force"]), root);
  expect(code).toBe(0);
  const bundle = await loadBundle(join(root, "story"));
  const derek = bundle.concepts.find((c) => c.id === "characters/derek");
  expect(derek?.frontmatter.origin).toBe("fanon");
});

test("canon without a subcommand prints usage and exits 1", async () => {
  const root = await canonProject("usage");
  const code = await cmdCanon(parseArgs([]), root);
  expect(code).toBe(1);
});

test("canon with an unknown subcommand prints usage and exits 1", async () => {
  const root = await canonProject("unknown");
  const code = await cmdCanon(parseArgs(["explode"]), root);
  expect(code).toBe(1);
});

test("canon import without a directory prints usage and exits 1", async () => {
  const root = await canonProject("import-usage");
  const code = await cmdCanon(parseArgs(["import"]), root);
  expect(code).toBe(1);
});

test("canon import of a non-pack directory exits 1", async () => {
  const root = await canonProject("not-a-pack");
  const packDir = join(root, "empty-pack");
  await writeFile(join(packDir, "unrelated.md"), "hi", "utf8").catch(() => {});
  const code = await cmdCanon(parseArgs(["import", packDir]), root);
  expect(code).toBe(1);
});

test("canon outside a project exits 1 with an error", async () => {
  const empty = await mkdtemp(join(tmpdir(), "novel-harness-canon-noproj-"));
  const code = await cmdCanon(parseArgs(["export"]), empty);
  expect(code).toBe(1);
});