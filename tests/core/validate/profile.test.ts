import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { validateBundle } from "../../../src/core/validate/index.ts";
import { makeBundle } from "../../helpers.ts";

function baseFiles(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "novel.md":
      "---\ntype: Novel\ntitle: T\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "characters/elena.md":
      "---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: alive\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01.md":
      "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/elena.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01/sc-01.md":
      "---\ntype: Scene\ntitle: S\nsequence: 1\npov: /characters/elena.md\ncast: [/characters/elena.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nProse.\n",
    ...extra,
  };
}

async function validateFiles(files: Record<string, string>) {
  const root = await makeBundle(files);
  return validateBundle(await loadBundle(root));
}

async function codesFor(files: Record<string, string>): Promise<string[]> {
  const result = await validateFiles(files);
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("profile validation", () => {
  test("flags a missing required field", async () => {
    const codes = await codesFor(
      baseFiles({
        "characters/elena.md":
          "---\ntype: Character\ntitle: Elena\nrole: protagonist\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/missing-field");
  });

  test("requires generated on narrative types", async () => {
    const codes = await codesFor(
      baseFiles({
        "chapters/ch-01.md":
          "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/elena.md\nstatus: draft\n---\n",
      }),
    );
    expect(codes).toContain("profile/missing-field");
  });

  test("flags a scene outside chapters/<chapter>/", async () => {
    const files = baseFiles({ "chapters/sc-orphan.md": "---\ntype: Scene\ntitle: X\nsequence: 9\npov: /characters/elena.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n" });
    const codes = await codesFor(files);
    expect(codes).toContain("profile/home");
  });

  test("warns when canon is past stale_after", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/old.md":
          "---\ntype: Timeline Event\ntitle: Old\nsequence: 1\nwhen: 2005\ntags: [old]\norigin: source\nstale_after: 2020-01-01T00:00:00Z\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/stale");
  });

  test("flags altered divergence without a scene", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/bite.md":
          "---\ntype: Timeline Event\ntitle: Bite\nsequence: 1\nwhen: 2011\ntags: [s1]\norigin: source\ndivergence: altered\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/divergence-without-scene");
  });

  test("accepts altered divergence with a diverges_at scene", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/bite.md":
          "---\ntype: Timeline Event\ntitle: Bite\nsequence: 1\nwhen: 2011\ntags: [s1]\norigin: source\ndivergence: altered\ndiverges_at: /chapters/ch-01/sc-01.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).not.toContain("fanfic/divergence-without-scene");
  });

  test("warns when intact keeps a diverges_at", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/bite.md":
          "---\ntype: Timeline Event\ntitle: Bite\nsequence: 1\nwhen: 2011\ntags: [s1]\norigin: source\ndivergence: intact\ndiverges_at: /chapters/ch-01/sc-01.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/intact-with-divergence");
  });

  test("warns when an added event is marked origin: source", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/new.md":
          "---\ntype: Timeline Event\ntitle: New\nsequence: 1\nwhen: 2011\ntags: [fan]\norigin: source\ndivergence: added\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/added-but-source");
  });

  test("flags an invalid divergence status", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/bite.md":
          "---\ntype: Timeline Event\ntitle: Bite\nsequence: 1\nwhen: 2011\ntags: [s1]\norigin: source\ndivergence: maybe\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/enum");
  });

  test("flags malformed web references", async () => {
    const codes = await codesFor(
      baseFiles({
        "characters/elena.md":
          '---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: alive\ntags: [protagonist]\nrefs:\n  - title: Missing the url\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n',
      }),
    );
    expect(codes).toContain("profile/refs");
  });

  test("accepts well-formed web references", async () => {
    const codes = await codesFor(
      baseFiles({
        "characters/elena.md":
          '---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: alive\ntags: [protagonist]\nrefs:\n  - title: Elena wiki\n    url: https://example.com/elena\n    kind: wiki\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n',
      }),
    );
    expect(codes).not.toContain("profile/refs");
  });

  test("warns when query-critical concepts have no tags", async () => {
    const codes = await codesFor(baseFiles());
    expect(codes).toContain("profile/missing-tags");
  });

  test("warns on a chapter with no scenes", async () => {
    const codes = await codesFor(
      baseFiles({
        "chapters/ch-02.md":
          "---\ntype: Chapter\ntitle: Two\nsequence: 2\npov: /characters/elena.md\ntags: [ch-02]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/orphan-chapter");
  });

  test("accepts Arc, Episode, and Item types", async () => {
    const codes = await codesFor(
      baseFiles({
        "arcs/season-1.md":
          "---\ntype: Arc\ntitle: Season 1\ntags: [season-1]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
        "episodes/e-01.md":
          "---\ntype: Episode\ntitle: Pilot\nsequence: 1\ntags: [season-1]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
        "items/ash-key.md":
          "---\ntype: Item\ntitle: Ash Key\ntags: [artifact]\n---\n",
      }),
    );
    expect(codes).not.toContain("profile/unknown-type");
    expect(codes).not.toContain("profile/home");
  });

  test("warns on unknown types", async () => {
    const codes = await codesFor(
      baseFiles({ "characters/robot.md": "---\ntype: Robot\ntitle: Unit 7\n---\n" }),
    );
    expect(codes).toContain("profile/unknown-type");
  });

  test("flags invalid enum values", async () => {
    const codes = await codesFor(
      baseFiles({
        "characters/elena.md":
          "---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: undead\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/enum");
  });

  test("flags malformed link fields", async () => {
    const codes = await codesFor(
      baseFiles({
        "chapters/ch-01.md":
          "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: elena\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/link-format");
  });

  test("flags a Relationship without exactly two characters", async () => {
    const codes = await codesFor(
      baseFiles({
        "relationships/elena-marcus.md":
          "---\ntype: Relationship\ncharacters: [/characters/elena.md]\nkind: allies\n---\n",
      }),
    );
    expect(codes).toContain("profile/relationship");
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

describe("fanfiction validation", () => {
  test("a well-formed fanfic bundle is clean", async () => {
    const result = validateBundle(await loadBundle(await makeBundle(fanficFiles())));
    if (result.errors > 0 || result.warnings > 0) {
      throw new Error(
        result.diagnostics
          .map((d) => `${d.severity} ${d.code} ${d.path}: ${d.message}`)
          .join("\n"),
      );
    }
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });

  test("flags an invalid origin", async () => {
    const codes = await codesFor(
      fanficFiles({
        "characters/harry.md":
          "---\ntype: Character\ntitle: Harry Potter\nrole: protagonist\nfate: alive\norigin: borrowed\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/enum");
  });

  test("flags origin: divergent without diverges_at", async () => {
    const codes = await codesFor(
      fanficFiles({
        "characters/draco.md":
          "---\ntype: Character\ntitle: Draco Malfoy\nrole: deuteragonist\nfate: alive\norigin: divergent\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/divergent-without-divergence");
  });

  test("warns when origin: source has no sources", async () => {
    const codes = await codesFor(
      fanficFiles({
        "characters/harry.md":
          "---\ntype: Character\ntitle: Harry Potter\nrole: protagonist\nfate: alive\norigin: source\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/source-without-sources");
  });

  test("flags canon-compliant without source_works", async () => {
    const codes = await codesFor(
      fanficFiles({
        "novel.md":
          "---\ntype: Novel\ntitle: The Boy Who Lived Again\nfandom: Harry Potter\ncanon_type: canon-compliant\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/missing-source-works");
  });

  test("flags an invalid canon_type", async () => {
    const codes = await codesFor(
      fanficFiles({
        "novel.md":
          "---\ntype: Novel\ntitle: The Boy Who Lived Again\ncanon_type: loose\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/enum");
  });

  test("warns when source_works points to a non-Reference", async () => {
    const codes = await codesFor(
      fanficFiles({
        "novel.md":
          "---\ntype: Novel\ntitle: The Boy Who Lived Again\ncanon_type: canon-divergent\nsource_works: [/characters/harry.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/source-work-not-reference");
  });

  test("warns on an unresolved sources resource", async () => {
    const codes = await codesFor(
      fanficFiles({
        "characters/harry.md":
          "---\ntype: Character\ntitle: Harry Potter\nrole: protagonist\nfate: alive\norigin: source\nsources:\n  - id: missing\n    resource: /references/nope.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/unresolved-source");
  });

  test("warns when origin: source cites an unfollowable resource", async () => {
    const codes = await codesFor(
      fanficFiles({
        "characters/harry.md":
          "---\ntype: Character\ntitle: Harry Potter\nrole: protagonist\nfate: alive\norigin: source\nsources:\n  - id: memory\n    resource: author-provided data\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("fanfic/unverifiable-source");
  });

  test("warns when two concepts share a name or alias", async () => {
    const codes = await codesFor(
      fanficFiles({
        "characters/deaton-a.md":
          "---\ntype: Character\ntitle: Alan Deaton\nrole: supporting\nfate: alive\norigin: fanon\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
        "characters/deaton-b.md":
          "---\ntype: Character\ntitle: Dr. Alan Deaton\naliases: [Alan Deaton]\nrole: supporting\nfate: alive\norigin: fanon\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("profile/duplicate-concept");
  });
});