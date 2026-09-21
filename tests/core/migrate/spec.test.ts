import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { loadMigrationSpec, runMigrationSpec } from "../../../src/core/migrate/spec.ts";
import { makeBundle } from "../../helpers.ts";

function novelFile(): string {
  return "---\ntype: Novel\ntitle: Test\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n";
}

function characterFile(title: string, extras: string[] = [], body = ""): string {
  return [
    "---",
    "type: Character",
    `title: ${title}`,
    "role: supporting",
    "fate: alive",
    "status: draft",
    ...extras,
    "generated: { by: human:a, at: 2026-09-12T00:00:00Z }",
    "---",
    body,
  ].join("\n");
}

function chapterFile(): string {
  return [
    "---",
    "type: Chapter",
    "title: Season 1",
    "sequence: 1",
    "pov: /characters/vernon-boyd.md",
    "status: draft",
    "generated: { by: human:a, at: 2026-09-12T00:00:00Z }",
    "---",
    "See [Boyd](/characters/boyd.md).",
    "",
  ].join("\n");
}

function migrationFiles(): Record<string, string> {
  return {
    "story/novel.md": novelFile(),
    "story/chapters/season-1.md": chapterFile(),
    "story/characters/vernon-boyd.md": characterFile("Vernon Boyd", [
      "species: werewolf",
      "tags: [pilot]",
    ]),
    "story/characters/boyd.md": characterFile("Boyd", ["species: werewolf"]),
    "story/characters/isaac-lahey.md": characterFile("Isaac Lahey", ["species: werewolf"]),
  };
}

const MIGRATION_SPEC = [
  "- action: convert",
  "  from: chapter",
  "  to: arc",
  "  file: story/chapters/season-1.md",
  "- action: merge",
  "  primary: characters/vernon-boyd",
  "  remove: characters/boyd",
  "- action: tag",
  "  match: { type: Character, species: werewolf }",
  "  add: [werewolf, hale-pack]",
].join("\n");

describe("runMigrationSpec", () => {
  test("applies convert, merge, and tag actions in order", async () => {
    const root = await makeBundle(migrationFiles());
    const bundlePath = join(root, "story");
    const specPath = join(root, "migrate.yaml");
    await writeFile(specPath, MIGRATION_SPEC, "utf8");

    const report = await runMigrationSpec(bundlePath, "human:tester", specPath);

    expect(report.steps).toEqual([
      { action: "convert", summary: "converted 1, skipped 0" },
      { action: "merge", summary: "merged characters/boyd into characters/vernon-boyd" },
      { action: "tag", summary: "tagged 2 concept(s)" },
    ]);

    expect(existsSync(join(root, "story/arcs/season-1.md"))).toBe(true);
    expect(existsSync(join(root, "story/chapters/season-1.md"))).toBe(false);
    expect(existsSync(join(root, "story/characters/boyd.md"))).toBe(false);

    const arc = await readFile(join(root, "story/arcs/season-1.md"), "utf8");
    expect(arc).toContain("type: Arc");
    expect(arc).toContain("/characters/vernon-boyd.md");
    expect(arc).not.toContain("/characters/boyd.md");

    const bundle = await loadBundle(bundlePath);
    const vernon = bundle.concepts.find((concept) => concept.id === "characters/vernon-boyd");
    expect(vernon?.frontmatter.tags).toEqual(["pilot", "werewolf", "hale-pack"]);
    const isaac = bundle.concepts.find((concept) => concept.id === "characters/isaac-lahey");
    expect(isaac?.frontmatter.tags).toEqual(["werewolf", "hale-pack"]);

    const log = await readFile(join(bundlePath, "log.md"), "utf8");
    expect(log).toContain("**Migrate**");
    expect(log).toContain("Applied migration spec with 3 action(s).");
  });

  test("rejects an unknown action before applying earlier valid ones", async () => {
    const root = await makeBundle(migrationFiles());
    const bundlePath = join(root, "story");
    const specPath = join(root, "bad.yaml");
    await writeFile(
      specPath,
      "- action: convert\n  from: chapter\n  to: arc\n- action: explode\n",
      "utf8",
    );

    await expect(runMigrationSpec(bundlePath, undefined, specPath)).rejects.toThrow("unknown action");
    expect(existsSync(join(root, "story/chapters/season-1.md"))).toBe(true);
    expect(existsSync(join(root, "story/arcs"))).toBe(false);
  });

  test("rejects an action missing required fields before changing files", async () => {
    const root = await makeBundle(migrationFiles());
    const bundlePath = join(root, "story");
    const specPath = join(root, "bad.yaml");
    await writeFile(specPath, "- action: merge\n  primary: characters/vernon-boyd\n", "utf8");

    await expect(runMigrationSpec(bundlePath, undefined, specPath)).rejects.toThrow(
      "requires a non-empty `remove`",
    );
    expect(existsSync(join(root, "story/characters/boyd.md"))).toBe(true);
    expect(existsSync(join(root, "story/characters/vernon-boyd.md"))).toBe(true);
  });

  test("rejects specs that are not a list", async () => {
    const root = await makeBundle(migrationFiles());
    const specPath = join(root, "bad.yaml");
    await writeFile(specPath, "action: convert\n", "utf8");

    await expect(loadMigrationSpec(specPath)).rejects.toThrow("must be a YAML list");
  });
});