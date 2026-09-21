import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { buildGraph, graphToHtml, graphToJson } from "../../../src/core/graph/build.ts";
import { validateBundle } from "../../../src/core/validate/index.ts";
import { makeBundle, validStoryDir } from "../../helpers.ts";

describe("graph build", () => {
  test("includes nodes and typed edges", async () => {
    const bundle = await loadBundle(validStoryDir);
    const graph = buildGraph(bundle);
    expect(graph.nodes).toHaveLength(8);
    expect(graph.edges).toContainEqual({
      from: "chapters/ch-01/sc-01",
      to: "characters/elena-voss",
      kind: "pov",
    });
    expect(graph.edges).toContainEqual({
      from: "chapters/ch-01/sc-01",
      to: "characters/marcus-reyes",
      kind: "cast",
    });
    expect(graph.edges).toContainEqual({
      from: "chapters/ch-01/sc-01",
      to: "locations/grand-archive",
      kind: "location",
    });
  });

  test("serializes json and self-contained html", async () => {
    const bundle = await loadBundle(validStoryDir);
    const graph = buildGraph(bundle);
    const json = JSON.parse(graphToJson(graph));
    expect(json.nodes).toHaveLength(8);

    const html = graphToHtml(graph, "The Hollow Crown");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("The Hollow Crown");
    expect(html).toContain('id="graph-data"');
    expect(html).not.toContain('src="http');
    expect(html).not.toContain('href="http');
    expect(html).not.toContain("cdn.");
  });
});

function fanficFiles(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "novel.md":
      "---\ntype: Novel\ntitle: The Boy Who Lived Again\nfandom: Harry Potter\ncanon_type: canon-divergent\nsource_works: [/references/hp-books.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "references/hp-books.md":
      "---\ntype: Reference\ntitle: Harry Potter novels\nresource: https://example.com/hp\n---\n",
    "characters/harry.md":
      "---\ntype: Character\ntitle: Harry Potter\nrole: protagonist\nfate: alive\ntags: [gryffindor]\norigin: source\nsources:\n  - id: hp-books\n    resource: /references/hp-books.md\n    title: Harry Potter novels\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n\nHarry is a wizard.[^hp-books]\n\n[^hp-books]: Harry Potter novels\n",
    "characters/draco.md":
      "---\ntype: Character\ntitle: Draco Malfoy\nrole: deuteragonist\nfate: alive\ntags: [slytherin]\norigin: divergent\ndiverges_at: /chapters/ch-01/sc-01.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01.md":
      "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/harry.md\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01/sc-01.md":
      "---\ntype: Scene\ntitle: S\nsequence: 1\npov: /characters/harry.md\ncast:\n  - /characters/harry.md\n  - /characters/draco.md\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nProse.\n",
    ...extra,
  };
}

describe("fanfiction graph links", () => {
  test("traces source_works, sources, and diverges_at edges", async () => {
    const bundle = await loadBundle(await makeBundle(fanficFiles()));
    const graph = buildGraph(bundle);
    expect(graph.edges).toContainEqual({
      from: "novel",
      to: "references/hp-books",
      kind: "source_works",
    });
    expect(graph.edges).toContainEqual({
      from: "characters/draco",
      to: "chapters/ch-01/sc-01",
      kind: "diverges_at",
    });
    expect(graph.edges).toContainEqual({
      from: "characters/harry",
      to: "references/hp-books",
      kind: "sources",
    });
  });
});

const GENERATED = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";

function novelFile(): string {
  return `---\ntype: Novel\ntitle: Test\nstatus: stable\n${GENERATED}\n---\n`;
}

function heroFile(sources: string[]): string {
  const lines = sources.map((resource) => `  - id: s\n    resource: ${resource}`).join("\n");
  return `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\norigin: source\nsources:\n${lines}\nstatus: stable\n${GENERATED}\n---\n`;
}

function sceneFile(body: string): string {
  return `---\ntype: Scene\ntitle: Open\nsequence: 1\npov: /characters/hero.md\ncast: [/characters/hero.md]\nstatus: stable\n${GENERATED}\n---\n${body}\n`;
}

async function build(files: Record<string, string>) {
  return loadBundle(await makeBundle({ "novel.md": novelFile(), ...files }));
}

describe("relative links", () => {
  test("relative body links resolve and produce graph edges", async () => {
    const bundle = await build({
      "characters/hero.md": heroFile(["https://example.com/canon"]),
      "chapters/ch-01.md": `---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/hero.md\nstatus: stable\n${GENERATED}\n---\n`,
      "chapters/ch-01/sc-01.md": sceneFile("See [Hero](../../characters/hero.md)."),
    });
    const diagnostics = validateBundle(bundle).diagnostics;
    expect(diagnostics.filter((entry) => entry.code === "continuity/broken-link")).toEqual([]);
    const graph = buildGraph(bundle);
    expect(
      graph.edges.some(
        (edge) => edge.from === "chapters/ch-01/sc-01" && edge.to === "characters/hero",
      ),
    ).toBe(true);
  });

  test("broken relative links still warn with the resolved path", async () => {
    const bundle = await build({
      "characters/hero.md": heroFile(["https://example.com/canon"]),
      "chapters/ch-01.md": `---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/hero.md\nstatus: stable\n${GENERATED}\n---\n`,
      "chapters/ch-01/sc-01.md": sceneFile("See [Ghost](../../characters/ghost.md)."),
    });
    const messages = validateBundle(bundle)
      .diagnostics.filter((entry) => entry.code === "continuity/broken-link")
      .map((entry) => entry.message);
    expect(messages).toEqual(["body link target /characters/ghost.md does not exist"]);
  });
});