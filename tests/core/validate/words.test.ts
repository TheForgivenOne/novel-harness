import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { validateBundle } from "../../../src/core/validate/index.ts";
import { makeBundle } from "../../helpers.ts";

const NOVEL =
  "---\ntype: Novel\ntitle: Test\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n";
const HERO =
  "---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n";

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

function chapterFile(title: string, extra = "", status = "stable"): string {
  return (
    `---\ntype: Chapter\ntitle: ${title}\nsequence: 1\npov: /characters/hero.md\n` +
    `status: ${status}\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n${extra}---\n`
  );
}

function sceneFile(sequence: number, body: string): string {
  return (
    `---\ntype: Scene\ntitle: Scene ${sequence}\nsequence: ${sequence}\n` +
    `pov: /characters/hero.md\ncast: [/characters/hero.md]\nstatus: draft\n` +
    `generated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n${body}`
  );
}

async function build(files: Record<string, string>) {
  return loadBundle(await makeBundle({ "novel.md": NOVEL, "characters/hero.md": HERO, ...files }));
}

function codesOf(bundle: Awaited<ReturnType<typeof build>>, code: string): string[] {
  return validateBundle(bundle)
    .diagnostics.filter((diagnostic) => diagnostic.code === code)
    .map((diagnostic) => diagnostic.message);
}

describe("validateWordCounts", () => {
  test("errors on every malformed range", async () => {
    const bundle = await build({
      "chapters/ch-01.md": chapterFile("Bad", "words: many\n"),
    });
    expect(codesOf(bundle, "profile/words")).toEqual([
      "words must be a mapping with min and/or max",
    ]);
    expect(validateBundle(bundle).errors).toBe(1);
  });

  test("errors when min exceeds max", async () => {
    const bundle = await build({
      "chapters/ch-01.md": chapterFile("Bad", "words: { min: 300, max: 100 }\n"),
    });
    expect(codesOf(bundle, "profile/words")).toEqual(["words.min must not exceed words.max"]);
  });

  test("warns under the minimum with both numbers in the message", async () => {
    const bundle = await build({
      "chapters/ch-01.md": chapterFile("Short", "words: { min: 100, max: 200 }\n"),
      "chapters/ch-01/sc-01.md": sceneFile(1, words(60)),
    });
    expect(codesOf(bundle, "profile/word-count")).toEqual([
      "chapter is 40 words below its 100-word minimum (60 written)",
    ]);
    expect(validateBundle(bundle).errors).toBe(0);
  });

  test("warns over the maximum", async () => {
    const bundle = await build({
      "chapters/ch-01.md": chapterFile("Long", "words: { min: 50, max: 200 }\n"),
      "chapters/ch-01/sc-01.md": sceneFile(1, words(250)),
    });
    expect(codesOf(bundle, "profile/word-count")).toEqual([
      "chapter is 50 words above its 200-word maximum (250 written)",
    ]);
  });

  test("treats bounds as inclusive", async () => {
    const bundle = await build({
      "chapters/ch-01.md": chapterFile("Exact", "words: { min: 100, max: 100 }\n"),
      "chapters/ch-01/sc-01.md": sceneFile(1, words(100)),
    });
    expect(codesOf(bundle, "profile/word-count")).toEqual([]);
  });

  test("exempts draft and deprecated chapters", async () => {
    const draft = await build({
      "chapters/ch-01.md": chapterFile("Draft", "words: { min: 100 }\n", "draft"),
      "chapters/ch-01/sc-01.md": sceneFile(1, words(10)),
    });
    expect(codesOf(draft, "profile/word-count")).toEqual([]);

    const deprecated = await build({
      "chapters/ch-01.md": chapterFile("Cut", "words: { min: 100 }\n", "deprecated"),
      "chapters/ch-01/sc-01.md": sceneFile(1, words(10)),
    });
    expect(codesOf(deprecated, "profile/word-count")).toEqual([]);
  });

  test("skips chapters with no written prose", async () => {
    const bundle = await build({
      "chapters/ch-01.md": chapterFile("Empty", "words: { min: 100 }\n"),
      "chapters/ch-01/sc-01.md": sceneFile(1, "   \n"),
    });
    expect(codesOf(bundle, "profile/word-count")).toEqual([]);
  });
});