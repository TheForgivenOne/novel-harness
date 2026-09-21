import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import {
  character,
  divergences,
  location,
  search,
  stale,
  stats,
  tag,
  timeline,
  when,
} from "../../../src/core/query/query.ts";
import { makeBundle, validStoryDir } from "../../helpers.ts";

const timelineFiles = {
  "novel.md":
    "---\ntype: Novel\ntitle: T\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/alpha-arrival.md":
    "---\ntype: Timeline Event\ntitle: Alpha Pack Arrival\nsequence: 2\nwhen: August 2011\ntags: [season-3a]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/hale-fire.md":
    "---\ntype: Timeline Event\ntitle: Hale House Fire\nsequence: 1\nwhen: 2005\ntags: [pre-series]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/winter-formal.md":
    "---\ntype: Timeline Event\ntitle: Winter Formal\nsequence: 3\nwhen: November 2011\ntags: [season-3a]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
};

describe("search", () => {
  test("finds concepts by title, description, tag, and id", async () => {
    const bundle = await loadBundle(validStoryDir);

    expect(search(bundle, "elena").data.hits[0]?.id).toBe("characters/elena-voss");
    expect(search(bundle, "forbidden").data.hits.map((hit) => hit.id)).toContain(
      "characters/elena-voss",
    );
    expect(search(bundle, "fantasy").data.hits.map((hit) => hit.id)).toContain("novel");
    expect(search(bundle, "grand-archive").data.hits.map((hit) => hit.id)).toContain(
      "locations/grand-archive",
    );
  });

  test("returns no hits for gibberish", async () => {
    const bundle = await loadBundle(validStoryDir);
    expect(search(bundle, "zzzzzz").data.hits).toHaveLength(0);
  });

  test("supports type, tag, and limit filters", async () => {
    const bundle = await loadBundle(validStoryDir);

    const limited = search(bundle, "elena", { limit: 1 });
    expect(limited.data.hits).toHaveLength(1);
    expect(limited.data.total).toBeGreaterThanOrEqual(1);

    const typed = search(bundle, "forbidden", { type: "Character" });
    expect(typed.data.hits.map((hit) => hit.id)).toContain("characters/elena-voss");

    const wrongType = search(bundle, "forbidden", { type: "Location" });
    expect(wrongType.data.hits).toHaveLength(0);

    const tagged = search(bundle, "the", { tag: "fantasy" });
    expect(tagged.data.hits.map((hit) => hit.id)).toContain("novel");
  });

  test("includes a snippet for body matches", async () => {
    const bundle = await loadBundle(validStoryDir);
    const hits = search(bundle, "loyal").data.hits;
    expect(hits.some((hit) => hit.snippet?.includes("loyal"))).toBe(true);
  });
});

const staleFiles = {
  "novel.md":
    "---\ntype: Novel\ntitle: T\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/old-fact.md":
    "---\ntype: Timeline Event\ntitle: Old Fact\nsequence: 1\nwhen: 2005\ntags: [old]\norigin: source\nstale_after: 2020-01-01T00:00:00Z\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/fresh-fact.md":
    "---\ntype: Timeline Event\ntitle: Fresh Fact\nsequence: 2\nwhen: 2011\ntags: [fresh]\norigin: source\nstale_after: 2999-01-01T00:00:00Z\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
};

describe("stale canon", () => {
  test("lists canon facts past stale_after only", async () => {
    const bundle = await loadBundle(await makeBundle(staleFiles));
    const titles = stale(bundle).data.entries.map((entry) => entry.title);
    expect(titles).toContain("Old Fact");
    expect(titles).not.toContain("Fresh Fact");
  });
});

const divergenceFiles = {
  "novel.md":
    "---\ntype: Novel\ntitle: T\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "characters/scott.md":
    "---\ntype: Character\ntitle: Scott\nrole: protagonist\nfate: alive\ntags: [protagonist]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "chapters/ch-01.md":
    "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/scott.md\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "chapters/ch-01/sc-01.md":
    "---\ntype: Scene\ntitle: The Save\nsequence: 1\npov: /characters/scott.md\ncast: [/characters/scott.md]\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/canon-intact.md":
    "---\ntype: Timeline Event\ntitle: Canon Intact\nsequence: 1\nwhen: 2011\ntags: [s1]\norigin: source\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/canon-altered.md":
    "---\ntype: Timeline Event\ntitle: Canon Altered\nsequence: 2\nwhen: 2011\ntags: [s1]\norigin: source\ndivergence: altered\ndiverges_at: /chapters/ch-01/sc-01.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/canon-averted.md":
    "---\ntype: Timeline Event\ntitle: Canon Averted\nsequence: 3\nwhen: 2011\ntags: [s1]\norigin: source\ndivergence: averted\ndiverges_at: /chapters/ch-01/sc-01.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/fanon-added.md":
    "---\ntype: Timeline Event\ntitle: Fanon Added\nsequence: 4\nwhen: 2011\ntags: [fan]\norigin: fanon\ndivergence: added\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "timeline/unmarked.md":
    "---\ntype: Timeline Event\ntitle: Unmarked\nsequence: 5\nwhen: 2011\ntags: [misc]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
};

describe("divergence ledger", () => {
  test("counts and groups canon divergence states", async () => {
    const bundle = await loadBundle(await makeBundle(divergenceFiles));
    const report = divergences(bundle).data;

    expect(report.counts).toEqual({
      intact: 1,
      altered: 1,
      averted: 1,
      added: 1,
      unmarked: 1,
    });

    const altered = divergences(bundle, { status: "altered" }).data.groups;
    expect(altered).toHaveLength(1);
    expect(altered[0]?.status).toBe("altered");
    expect(altered[0]?.entries[0]?.divergesAt?.id).toBe("chapters/ch-01/sc-01");
  });

  test("timeline marks non-intact events", async () => {
    const bundle = await loadBundle(await makeBundle(divergenceFiles));
    const text = timeline(bundle).markdown;
    expect(text).toContain("**averted**");
    expect(text).not.toContain("Canon Intact**");
  });

  test("when reports divergence and where it changed", async () => {
    const bundle = await loadBundle(await makeBundle(divergenceFiles));
    const text = when(bundle, "Canon Altered").markdown;
    expect(text).toContain("Divergence: altered");
    expect(text).toContain("changed at [The Save]");
  });
});

describe("timeline", () => {
  test("orders events and filters by tag and year", async () => {
    const bundle = await loadBundle(await makeBundle(timelineFiles));

    const all = timeline(bundle).data.entries;
    expect(all.map((entry) => entry.title)).toEqual([
      "Hale House Fire",
      "Alpha Pack Arrival",
      "Winter Formal",
    ]);

    const tagged = timeline(bundle, { tag: "season-3a" }).data.entries;
    expect(tagged).toHaveLength(2);

    const range = timeline(bundle, { from: "2011", to: "2011" }).data.entries;
    expect(range.map((entry) => entry.title)).toEqual(["Alpha Pack Arrival", "Winter Formal"]);
  });

  test("filters by an in-world date with --on", async () => {
    const bundle = await loadBundle(await makeBundle(timelineFiles));
    expect(timeline(bundle, { on: "2005" }).data.entries.map((entry) => entry.title)).toEqual([
      "Hale House Fire",
    ]);
    expect(
      timeline(bundle, { on: "November 2011" }).data.entries.map((entry) => entry.title),
    ).toEqual(["Winter Formal"]);
  });
});

describe("when", () => {
  test("resolves a canon snapshot by date with neighbours", async () => {
    const bundle = await loadBundle(await makeBundle(timelineFiles));
    const result = when(bundle, "August 2011").data;
    expect(result.entries).toHaveLength(1);
    const entry = result.entries[0]!;
    expect(entry.event.title).toBe("Alpha Pack Arrival");
    expect(entry.previous?.title).toBe("Hale House Fire");
    expect(entry.next?.title).toBe("Winter Formal");
  });

  test("resolves directly by event name", async () => {
    const bundle = await loadBundle(await makeBundle(timelineFiles));
    const result = when(bundle, "Winter Formal").data;
    expect(result.entries[0]?.event.title).toBe("Winter Formal");
  });
});

describe("character", () => {
  test("reports scenes, locations, and affiliations in order", async () => {
    const bundle = await loadBundle(validStoryDir);
    const report = character(bundle, "elena-voss").data;

    expect(report.character.id).toBe("characters/elena-voss");
    expect(report.scenes.map((scene) => scene.id)).toEqual([
      "chapters/ch-01/sc-01",
      "chapters/ch-01/sc-02",
    ]);
    expect(report.locations).toEqual(["/locations/grand-archive.md"]);
    expect(report.affiliations).toEqual(["/factions/ink-guild.md"]);
  });

  test("resolves by title", async () => {
    const bundle = await loadBundle(validStoryDir);
    expect(character(bundle, "Elena Voss").data.character.id).toBe("characters/elena-voss");
  });

  test("throws for an unknown character", async () => {
    const bundle = await loadBundle(validStoryDir);
    expect(() => character(bundle, "nobody")).toThrow("character not found");
  });
});

describe("location", () => {
  test("reports scenes in manuscript order", async () => {
    const bundle = await loadBundle(validStoryDir);
    const report = location(bundle, "grand-archive").data;
    expect(report.location.id).toBe("locations/grand-archive");
    expect(report.scenes.map((scene) => scene.id)).toEqual([
      "chapters/ch-01/sc-01",
      "chapters/ch-01/sc-02",
    ]);
  });
});

describe("tag", () => {
  test("groups tagged concepts by type", async () => {
    const bundle = await loadBundle(validStoryDir);
    const report = tag(bundle, "fantasy").data;
    expect(report.tag).toBe("fantasy");
    expect(report.groups.flatMap((group) => group.concepts.map((concept) => concept.id))).toContain(
      "novel",
    );
  });
});

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

describe("stats word targets", () => {
  test("reports bounds, per-chapter state, and summary counts", async () => {
    const bundle = await build({
      "chapters/ch-01.md": chapterFile("Short", "words: { min: 100, max: 200 }\n"),
      "chapters/ch-01/sc-01.md": sceneFile(1, words(60)),
      "chapters/ch-02.md": chapterFile("Long", "words: { min: 10, max: 50 }\n"),
      "chapters/ch-02/sc-01.md": sceneFile(1, words(80)),
      "chapters/ch-03.md": chapterFile("Fine", "words: { min: 10, max: 50 }\n"),
      "chapters/ch-03/sc-01.md": sceneFile(1, words(30)),
      "chapters/ch-04.md": chapterFile("Free"),
      "chapters/ch-04/sc-01.md": sceneFile(1, words(500)),
    });

    const result = stats(bundle);
    const short = result.data.manuscript.chapterDetails.find((entry) => entry.id === "chapters/ch-01");
    const fine = result.data.manuscript.chapterDetails.find((entry) => entry.id === "chapters/ch-03");
    const free = result.data.manuscript.chapterDetails.find((entry) => entry.id === "chapters/ch-04");

    expect(short?.wordsMin).toBe(100);
    expect(short?.wordsMax).toBe(200);
    expect(short?.wordState).toBe("under");
    expect(fine?.wordState).toBe("in-range");
    expect(free?.wordState).toBeUndefined();
    expect(result.data.manuscript.targets).toEqual({ under: 1, over: 1 });
    expect(result.markdown).toContain("Out of target: 1 under · 1 over");
    expect(result.markdown).toContain("under 100-word minimum");
    expect(result.markdown).toContain("target 10–50");
  });
});

const statsFiles = {
  "novel.md": "---\ntype: Novel\ntitle: The Test\n---\n",
  "chapters/ch-01.md":
    "---\ntype: Chapter\ntitle: Wolf Moon\nsequence: 1\npov: /characters/derek.md\n---\n",
  "chapters/ch-01/sc-01.md":
    "---\ntype: Scene\ntitle: First\nsequence: 1\npov: /characters/derek.md\n---\nThe wolf runs fast today\n",
  "chapters/ch-01/sc-02.md":
    "---\ntype: Scene\ntitle: Second\nsequence: 2\npov: /characters/derek.md\n---\n",
  "characters/derek.md":
    "---\ntype: Character\ntitle: Derek\nrole: deuteragonist\nfate: dead\n---\n",
};

describe("query stats", () => {
  test("reports manuscript, concepts, fate, tags, sources, divergence, and stale", async () => {
    const root = await makeBundle(statsFiles);
    const bundle = await loadBundle(root);
    const result = stats(bundle);
    const data = result.data;

    expect(data.manuscript.chapters).toBe(1);
    expect(data.manuscript.scenes).toBe(2);
    expect(data.manuscript.written).toBe(1);
    expect(data.manuscript.empty).toBe(1);
    expect(data.manuscript.words).toBe(5);
    expect(data.manuscript.averageSceneWords).toBe(2);
    expect(data.manuscript.chapterDetails).toEqual([
      { id: "chapters/ch-01", title: "Wolf Moon", scenes: 2, words: 5 },
    ]);

    expect(data.concepts[0]).toEqual({ type: "Scene", count: 2 });
    expect(data.concepts).toContainEqual({ type: "Character", count: 1 });

    expect(data.characters).toEqual({ total: 1, alive: 0, dead: 1, unknown: 0, other: 0 });

    expect(data.tags).toEqual({ used: 0, missing: 4 });

    expect(data.sources).toEqual({ url: 0, bundle: 0, nonFollowable: 0 });

    expect(data.divergence).toMatchObject({
      intact: 0,
      altered: 0,
      averted: 0,
      added: 0,
      unmarked: 0,
    });
    expect(data.stale).toBe(0);

    expect(result.markdown).toContain("* Chapters: 1 · Scenes: 2 (written 1, empty 1)");
    expect(result.markdown).toContain("* Words: 5 (avg 2/scene)");
    expect(result.markdown).toContain("* Chapter 1 — Wolf Moon: 5 words (2 scenes)");
    expect(result.markdown).toContain("* alive 0 · dead 1 · unknown 0");
  });

  test("--summary omits per-chapter lines", async () => {
    const root = await makeBundle(statsFiles);
    const bundle = await loadBundle(root);
    const result = stats(bundle, { summary: true });
    expect(result.markdown).toContain("* Chapters: 1 · Scenes: 2 (written 1, empty 1)");
    expect(result.markdown).not.toContain("Wolf Moon: 5 words");
    expect(result.markdown).toContain("## Concepts");
  });
});