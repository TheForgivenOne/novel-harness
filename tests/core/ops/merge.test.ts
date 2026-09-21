import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { mergeConcepts } from "../../../src/core/ops/merge.ts";
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

describe("mergeConcepts", () => {
  function mergeFiles(): Record<string, string> {
    return {
      "novel.md": novelFile(),
      "characters/elena.md":
        "---\ntype: Character\ntitle: Elena\naliases: [E]\nrole: protagonist\ntags: [hero]\nfate: alive\nsources:\n  - id: s1\n    title: Shared\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nPrimary prose.\n",
      "characters/elena-alt.md":
        "---\ntype: Character\ntitle: Elena Voss\naliases: [Voss]\nrole: supporting\ntags: [veteran]\nfate: alive\nsources:\n  - id: s1\n    title: Shared\n  - id: s2\n    title: Other\nstatus: draft\ngenerated: { by: human:b, at: 2026-09-12T00:00:00Z }\n---\n\nSecondary prose.\n",
      "chapters/ch-01.md": chapterFile("One", "").replace(
        "/characters/elena.md",
        "/characters/elena-alt.md",
      ),
    };
  }

  test("preview returns a plan without writing anything", async () => {
    const root = await makeBundle(mergeFiles());
    const project = await openProject(root);
    const before = await readFile(join(root, "characters/elena.md"), "utf8");

    const plan = await mergeConcepts(project, "elena", "elena-alt", false);

    expect(plan.apply).toBe(false);
    expect(plan.primary).toBe("characters/elena.md");
    expect(plan.secondary).toBe("characters/elena-alt.md");
    expect(plan.aliases).toEqual(["E", "Elena Voss", "Voss"]);
    expect(plan.tags).toEqual(["hero", "veteran"]);
    expect(plan.sources).toHaveLength(2);
    expect(existsSync(join(root, "characters/elena-alt.md"))).toBe(true);
    expect(await readFile(join(root, "characters/elena.md"), "utf8")).toBe(before);
  });

  test("apply merges fields, appends the body, deletes the secondary, and rewrites links", async () => {
    const root = await makeBundle(mergeFiles());
    const project = await openProject(root);

    const plan = await mergeConcepts(project, "elena", "elena-alt", true);

    expect(plan.apply).toBe(true);
    expect(existsSync(join(root, "characters/elena-alt.md"))).toBe(false);

    const raw = await readFile(join(root, "characters/elena.md"), "utf8");
    expect(raw).toContain("## From Elena Voss");
    expect(raw).toContain("Secondary prose.");
    expect(raw).toContain("Primary prose.");

    const bundle = await loadBundle(root);
    const primary = bundle.concepts.find((concept) => concept.id === "characters/elena");
    expect(primary).toBeDefined();
    expect(primary?.frontmatter.aliases).toEqual(["E", "Elena Voss", "Voss"]);
    expect(primary?.frontmatter.tags).toEqual(["hero", "veteran"]);
    expect(primary?.frontmatter.sources).toHaveLength(2);

    const generated = primary?.frontmatter.generated as { by: string; at: string };
    expect(generated.by).toBe("human:a");
    expect(generated.at).not.toBe("2026-09-12T00:00:00Z");

    const chapter = await readFile(join(root, "chapters/ch-01.md"), "utf8");
    expect(chapter).toContain("/characters/elena.md");
    expect(chapter).not.toContain("/characters/elena-alt.md");
  });

  test("refuses to merge concepts of different types", async () => {
    const root = await makeBundle(mergeFiles());
    const project = await openProject(root);

    await expect(mergeConcepts(project, "elena", "ch-01", true)).rejects.toThrow("cannot merge");
  });
});