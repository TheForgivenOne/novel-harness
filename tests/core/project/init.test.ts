import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { renderIndex } from "../../../src/core/index/generate.ts";
import { newConceptDraft } from "../../../src/core/project/new-concept.ts";
import { getTypeDefBySlug } from "../../../src/core/schema/catalog.ts";
import { initProject } from "../../../src/core/project/init.ts";
import { tmpProject } from "../../helpers.ts";

describe("init scaffolding", () => {
  test("scaffolds plan.md with Plan frontmatter and planning sections", async () => {
    const root = await tmpProject("plan");
    await initProject(root, { name: "Test Story", author: "human:tester" });
    const raw = await readFile(join(root, "story", "plan.md"), "utf8");

    expect(raw).toContain("type: Plan");
    expect(raw).toContain("title: Story Plan");
    expect(raw).toContain("status: draft");
    expect(raw).toContain("generated:");
    expect(raw).toContain("by: human:tester");
    expect(raw).toContain("# Premise");
    expect(raw).toContain("# Cast");
    expect(raw).toContain("# Rules");
    expect(raw).toContain("# Divergence Goals");
    expect(raw).toContain("# Decisions");
  });

  test("scaffolds knowledge.md with Knowledge frontmatter and a season matrix", async () => {
    const root = await tmpProject("knowledge");
    await initProject(root, { name: "Test Story", author: "human:tester" });
    const raw = await readFile(join(root, "story", "knowledge.md"), "utf8");

    expect(raw).toContain("type: Knowledge");
    expect(raw).toContain("title: Knowledge Matrix");
    expect(raw).toContain("status: draft");
    expect(raw).toContain("# Who Knows What, When");
    expect(raw).toContain("## Season 1");
    expect(raw).toContain("| Character | Knows about | Since | How they learned |");
  });

  test("scaffolds outline.md with Outline frontmatter and outline tables", async () => {
    const root = await tmpProject("outline");
    await initProject(root, { name: "Test Story", author: "human:tester" });
    const raw = await readFile(join(root, "story", "outline.md"), "utf8");

    expect(raw).toContain("type: Outline");
    expect(raw).toContain("title: Story Outline");
    expect(raw).toContain("# Structure");
    expect(raw).toContain("| Arc | Chapter | Sequence | POV | When | Words |");
    expect(raw).toContain("# Scenes");
    expect(raw).toContain("| Chapter | Scene | Sequence | POV | When | Status |");
    expect(raw).toContain("# Next");
  });

  test("plan.md has the expanded 8-section template", async () => {
    const root = await tmpProject("plan8");
    await initProject(root, { name: "Test Story", author: "human:tester" });
    const raw = await readFile(join(root, "story", "plan.md"), "utf8");

    expect(raw).toContain("# Premise");
    expect(raw).toContain("# Logline");
    expect(raw).toContain("# Cast");
    expect(raw).toContain("| Character | Role | Fate | Notes |");
    expect(raw).toContain("# Divergence Goals");
    expect(raw).toContain("| Divergence | Type | Why |");
    expect(raw).toContain("# Rules");
    expect(raw).toContain("# POV & Tense");
    expect(raw).toContain("# Open Questions");
    expect(raw).toContain("# Decisions");
    expect(raw).not.toContain("# Arcs");
  });

  test("plan.md and knowledge.md validate and appear in the root index", async () => {
    const root = await tmpProject("index");
    await initProject(root, { name: "Test Story", author: "human:tester" });
    const bundle = await loadBundle(join(root, "story"));
    const index = renderIndex(bundle, "");

    expect(index).toContain("# Plan");
    expect(index).toContain("* [Story Plan](plan.md)");
    expect(index).toContain("# Knowledge");
    expect(index).toContain("* [Knowledge Matrix](knowledge.md)");
    expect(index).toContain("# Outline");
    expect(index).toContain("* [Story Outline](outline.md)");
  });
});

describe("plan and knowledge singleton creation", () => {
  test("novel new plan targets plan.md and requires narrative fields", () => {
    const def = getTypeDefBySlug("plan");
    expect(def).toBeDefined();
    const draft = newConceptDraft(
      {
        root: "/tmp",
        concepts: [],
        malformed: [],
        indexFiles: [],
        logFiles: [],
      },
      def!,
      { name: "Story Plan", author: "human:tester" },
    );
    expect(draft.path).toBe("plan.md");
    expect(draft.data.status).toBe("draft");
    expect(draft.data.type).toBe("Plan");
  });

  test("novel new knowledge targets knowledge.md", () => {
    const def = getTypeDefBySlug("knowledge");
    expect(def).toBeDefined();
    const draft = newConceptDraft(
      {
        root: "/tmp",
        concepts: [],
        malformed: [],
        indexFiles: [],
        logFiles: [],
      },
      def!,
      { name: "Knowledge Matrix", author: "human:tester" },
    );
    expect(draft.path).toBe("knowledge.md");
    expect(draft.data.type).toBe("Knowledge");
  });
});