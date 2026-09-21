import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { buildContext, buildStoryContext } from "../../../src/core/context/build.ts";
import { refs, when } from "../../../src/core/query/query.ts";
import { makeBundle, validStoryDir } from "../../helpers.ts";

const weaveFiles = {
  "novel.md":
    "---\ntype: Novel\ntitle: T\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "characters/scott.md":
    "---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\nfate: alive\ntags: [protagonist]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "chapters/ch-01.md":
    "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/scott.md\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "chapters/ch-01/sc-01.md":
    "---\ntype: Scene\ntitle: The Bite\nsequence: 1\npov: /characters/scott.md\ncast: [/characters/scott.md]\nwhen: January 9, 2011\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/the-bite.md":
    '---\ntype: Timeline Event\ntitle: Scott Gets Bitten\nsequence: 1\nwhen: January 9, 2011\ntags: [season-1]\nparticipants: [/characters/scott.md]\nrefs:\n  - title: "1x01 transcript"\n    url: https://example.com/transcript\n    kind: transcript\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nThe werewolf bites Scott in the preserve.\n',
};

describe("scene-aware context", () => {
  test("includes timeline events at the scene's when", async () => {
    const bundle = await loadBundle(await makeBundle(weaveFiles));
    const context = buildContext(bundle, "chapters/ch-01/sc-01");
    expect(context.included.map((concept) => concept.id)).toContain("timeline/the-bite");
    expect(context.markdown).toContain("The werewolf bites Scott in the preserve.");
    expect(context.markdown).toContain("Web references");
  });

  test("lists web references to fetch", async () => {
    const bundle = await loadBundle(await makeBundle(weaveFiles));
    const report = refs(bundle, "the-bite").data;
    expect(report.refs).toHaveLength(1);
    expect(report.refs[0]?.url).toBe("https://example.com/transcript");
    expect(report.refs[0]?.kind).toBe("transcript");
  });

  test("when resolves participants and body", async () => {
    const bundle = await loadBundle(await makeBundle(weaveFiles));
    const entry = when(bundle, "January 9, 2011").data.entries[0]!;
    expect(entry.participants.map((participant) => participant.id)).toEqual(["characters/scott"]);
    expect(entry.body).toContain("werewolf bites Scott");
  });
});

describe("context packing", () => {
  test("includes the chapter, adjacent scenes, cast, and location", async () => {
    const bundle = await loadBundle(validStoryDir);
    const context = buildContext(bundle, "chapters/ch-01/sc-01");
    expect(context.missing).toEqual([]);
    expect(context.markdown).toContain("Context: A Map That Shouldn't Exist");
    expect(context.markdown).toContain("chapters/ch-01.md");
    expect(context.markdown).toContain("chapters/ch-01/sc-02.md");
    expect(context.markdown).toContain("characters/marcus-reyes.md");
    expect(context.markdown).toContain("locations/grand-archive.md");
  });

  test("includes scenes as backlinks for a character", async () => {
    const bundle = await loadBundle(validStoryDir);
    const context = buildContext(bundle, "characters/elena-voss");
    expect(context.included.map((concept) => concept.id)).toContain("chapters/ch-01/sc-01");
    expect(context.included.map((concept) => concept.id)).toContain("factions/ink-guild");
  });

  test("throws for unknown concepts", async () => {
    const bundle = await loadBundle(validStoryDir);
    expect(() => buildContext(bundle, "characters/nobody")).toThrow("concept not found");
  });

  test("reports missing link targets", async () => {
    const bundle = await loadBundle(validStoryDir);
    const context = buildContext(bundle, "chapters/ch-01/sc-01");
    expect(context.markdown).toContain("Type: Scene");
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
  test("context includes the cited source work", async () => {
    const bundle = await loadBundle(await makeBundle(fanficFiles()));
    const context = buildContext(bundle, "characters/harry");
    expect(context.included.map((concept) => concept.id)).toContain("references/hp-books");
  });
});

const withFutureEvents = {
  ...weaveFiles,
  "timeline/the-prelude.md":
    "---\ntype: Timeline Event\ntitle: The Prelude\nsequence: 0\nwhen: January 1, 2011\nstatus: draft\n---\nThe month before the bite.\n",
  "timeline/the-full-moon.md":
    "---\ntype: Timeline Event\ntitle: The Full Moon\nsequence: 2\nwhen: January 30, 2011\nstatus: draft\n---\nA later event the scene must not know about.\n",
};

const soFarFiles = {
  ...weaveFiles,
  "knowledge.md":
    "---\ntype: Knowledge\ntitle: Knowledge Matrix\nstatus: draft\n---\n# Who Knows What, When\n\n## Season 1\n\n| Character | Knows about | Since | How they learned |\n| --------- | ----------- | ----- | ---------------- |\n| Scott McCall | the bite | January 5, 2011 | He was bitten |\n| Scott McCall | the pack | February 1, 2011 | He was told |\n| Elena Voss | the archive | before season 1 | She built it |\n",
};

describe("scope-wall context", () => {
  test("scene context filters out timeline events dated after the scene's when", async () => {
    const bundle = await loadBundle(await makeBundle(withFutureEvents));
    const context = buildContext(bundle, "chapters/ch-01/sc-01");
    const ids = context.included.map((concept) => concept.id);
    expect(ids).toContain("timeline/the-bite");
    expect(ids).toContain("timeline/the-prelude");
    expect(ids).not.toContain("timeline/the-full-moon");
  });

  test("--so-far appends reader state filtered by the scene's when", async () => {
    const bundle = await loadBundle(await makeBundle(soFarFiles));
    const plain = buildContext(bundle, "chapters/ch-01/sc-01");
    expect(plain.markdown).not.toContain("Reader state");
    const stateful = buildContext(bundle, "chapters/ch-01/sc-01", { soFar: true });
    expect(stateful.markdown).toContain("# Reader state (so far)");
    expect(stateful.markdown).toContain("| Scott McCall | the bite | January 5, 2011 |");
    expect(stateful.markdown).toContain("| Elena Voss | the archive | before season 1 |");
    expect(stateful.markdown).not.toContain("the pack");
  });
});

function storyFiles(): Record<string, string> {
  return {
    ...weaveFiles,
    "plan.md": "---\ntype: Plan\ntitle: Plan\nstatus: draft\n---\nAgreed premise.\n",
    "outline.md":
      "---\ntype: Outline\ntitle: Outline\nstatus: draft\n---\n# Structure\n\n# Scenes\n\n# Next\n",
    "plot/main-thread.md":
      "---\ntype: Plot Thread\ntitle: The Pack\nkind: main\nstatus: draft\n---\nThe pack grows.\n",
    "arcs/act-one.md": "---\ntype: Arc\ntitle: Act One\nstatus: draft\n---\n",
  };
}

describe("whole-story context", () => {
  test("story context assembles the outline slice", async () => {
    const bundle = await loadBundle(await makeBundle(storyFiles()));
    const story = buildStoryContext(bundle);
    expect(story.markdown).toContain("# Story context");
    expect(story.markdown).toContain("Agreed premise.");
    expect(story.markdown).toContain("# Structure");
    expect(story.markdown).toContain("[The Pack](/plot/main-thread.md)");
    expect(story.markdown).toContain("kind: main");
    expect(story.markdown).toContain("[Act One](/arcs/act-one.md)");
    expect(story.markdown).toContain("[Scott Gets Bitten](/timeline/the-bite.md)");
  });
});