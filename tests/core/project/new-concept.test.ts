import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { newConceptDraft } from "../../../src/core/project/new-concept.ts";
import { getTypeDefBySlug } from "../../../src/core/schema/catalog.ts";
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
| Act 1 | Full Moon | 2 | Scott McCall | Jan 16, 2011 | 1500 |

# Scenes

| Chapter | Scene | Sequence | POV | When | Status |
| ------- | ----- | -------- | --- | ---- | ------ |
| First Day | The Bite | 1 | Scott McCall | Jan 9, 2011 | stub |
| First Day | The Hunt | 2 | Scott McCall | Jan 10, 2011 | drafted |

# Next

Draft The Bite in First Day.
`;

const HERO = `---
type: Character
title: Scott McCall
role: protagonist
fate: alive
status: stable
${GEN}
---\n`;
const CHAPTER_ONE = `---
type: Chapter
title: First Day
sequence: 1
pov: /characters/scott.md
status: stable
${GEN}
---\n`;

async function sceneBundle(extra: Record<string, string>) {
  return loadBundle(
    await makeBundle({
      "characters/scott.md": HERO,
      "chapters/first-day.md": CHAPTER_ONE,
      ...extra,
    }),
  );
}

async function sceneProject(extra: Record<string, string>) {
  const root = await makeBundle({
    "characters/scott.md": HERO,
    "chapters/first-day.md": CHAPTER_ONE,
    ...extra,
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

describe("scene creation guardrails", () => {
  test("writes scenes under chapters/<slug>/scenes/", async () => {
    const bundle = await sceneBundle({});
    const def = getTypeDefBySlug("scene");
    const draft = newConceptDraft(bundle, def!, {
      name: "Opening",
      author: "human:a",
    });
    expect(draft.path).toBe("chapters/first-day/scenes/opening.md");
  });

  test("hard-errors when outline exists but no Scenes row", async () => {
    const bundle = await sceneBundle({ "outline.md": OUTLINE });
    const def = getTypeDefBySlug("scene");
    expect(() =>
      newConceptDraft(bundle, def!, { name: "Unplanned", author: "human:a" }),
    ).toThrow("scene has no row in story/outline.md; add it to # Scenes first: Unplanned");
  });

  test("hard-errors when outline exists but no Structure row for the chapter", async () => {
    const bundle = await sceneBundle({
      "outline.md": OUTLINE,
      "chapters/extra.md": `---
type: Chapter
title: Extra
sequence: 9
pov: /characters/scott.md
status: stable
${GEN}
---\n`,
    });
    const def = getTypeDefBySlug("scene");
    expect(() =>
      newConceptDraft(bundle, def!, { name: "The Bite", chapter: "extra", author: "human:a" }),
    ).toThrow("chapter has no row in story/outline.md; add it to # Structure first: chapters/extra");
  });

  test("auto-fills sequence, pov, and when from the Scenes row", async () => {
    const bundle = await sceneBundle({ "outline.md": OUTLINE });
    const def = getTypeDefBySlug("scene");
    const draft = newConceptDraft(bundle, def!, {
      name: "The Bite",
      author: "human:a",
    });
    expect(draft.path).toBe("chapters/first-day/scenes/the-bite.md");
    expect(draft.data.sequence).toBe(1);
    expect(draft.data.pov).toBe("/characters/scott.md");
    expect(draft.data.when).toBe("Jan 9, 2011");
  });

  test("explicit flags beat the row", async () => {
    const bundle = await sceneBundle({ "outline.md": OUTLINE });
    const def = getTypeDefBySlug("scene");
    const draft = newConceptDraft(bundle, def!, {
      name: "The Bite",
      author: "human:a",
      when: "Jan 12, 2011",
    });
    expect(draft.data.when).toBe("Jan 12, 2011");
  });

  test("no outline means no guardrails and no auto-fill", async () => {
    const bundle = await sceneBundle({});
    const def = getTypeDefBySlug("scene");
    const draft = newConceptDraft(bundle, def!, { name: "Open", author: "human:a" });
    expect(draft.path).toBe("chapters/first-day/scenes/open.md");
    expect(draft.data.pov).toBe("/characters/scott.md");
  });
});

describe("chapter outline draft path", () => {
  test("novel new chapter-outline targets chapters/<slug>/outline.md", async () => {
    const bundle = await sceneBundle({});
    const def = getTypeDefBySlug("chapter-outline");
    const draft = newConceptDraft(bundle, def!, {
      name: "First Day",
      author: "human:a",
    });
    expect(draft.path).toBe("chapters/first-day/outline.md");
    expect(draft.data.type).toBe("Chapter Outline");
  });
});

const chapter = (title: string, seq: number) =>
  `---\ntype: Chapter\ntitle: ${title}\nsequence: ${seq}\npov: /characters/hero.md\nstatus: stable\n${GEN}\n---\n`;
const hero =
  `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\n${GEN}\n---\n`;

async function draftWith(files: Record<string, string>, chapterArg?: string) {
  const bundle = await loadBundle(await makeBundle({ "characters/hero.md": hero, ...files }));
  const def = getTypeDefBySlug("scene");
  if (!def) throw new Error("scene type missing");
  const input = { name: "Opening", author: "human:a", ...(chapterArg ? { chapter: chapterArg } : {}) };
  return { bundle, def, input };
}

describe("scene chapter resolution", () => {
  test("uses the only chapter when --chapter is omitted", async () => {
    const { bundle, def, input } = await draftWith({ "chapters/ch-01.md": chapter("One", 1) });
    const draft = newConceptDraft(bundle, def, input);
    expect(draft.path.startsWith("chapters/ch-01/")).toBe(true);
  });

  test("requires --chapter when several chapters exist", async () => {
    const { bundle, def, input } = await draftWith({
      "chapters/ch-01.md": chapter("One", 1),
      "chapters/ch-02.md": chapter("Two", 2),
    });
    expect(() => newConceptDraft(bundle, def, input)).toThrow(
      "scene requires --chapter <id|title|slug>; chapters: chapters/ch-01 (One), chapters/ch-02 (Two)",
    );
  });

  test("resolves --chapter by bare slug", async () => {
    const { bundle, def, input } = await draftWith(
      {
        "chapters/ch-01.md": chapter("One", 1),
        "chapters/ch-02.md": chapter("Two", 2),
      },
      "ch-02",
    );
    const draft = newConceptDraft(bundle, def, input);
    expect(draft.path.startsWith("chapters/ch-02/")).toBe(true);
  });

  test("resolves --chapter by title", async () => {
    const { bundle, def, input } = await draftWith(
      {
        "chapters/ch-01.md": chapter("One", 1),
        "chapters/ch-02.md": chapter("Two", 2),
      },
      "Two",
    );
    const draft = newConceptDraft(bundle, def, input);
    expect(draft.path.startsWith("chapters/ch-02/")).toBe(true);
  });

  test("fails when --chapter does not match a chapter", async () => {
    const { bundle, def, input } = await draftWith(
      { "chapters/ch-01.md": chapter("One", 1) },
      "nope",
    );
    expect(() => newConceptDraft(bundle, def, input)).toThrow("chapter not found: nope");
  });

  test("fails when no chapter exists", async () => {
    const { bundle, def, input } = await draftWith({});
    expect(() => newConceptDraft(bundle, def, input)).toThrow("no chapter exists");
  });
});

const storyFiles = {
  "novel.md":
    "---\ntype: Novel\ntitle: The Hollow Crown\ndescription: A map that should not exist.\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "characters/scott.md":
    "---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\nfate: alive\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "chapters/ch-01.md":
    "---\ntype: Chapter\ntitle: The Archive\nsequence: 1\npov: /characters/scott.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n# Summary\n",
  "chapters/ch-01/sc-01.md":
    '---\ntype: Scene\ntitle: The Map\nsequence: 1\npov: /characters/scott.md\ncast: [/characters/scott.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nThe archivist set <script>alert("intruder")</script> on the table.\n\nA second paragraph follows.\n',
};

describe("concept templates", () => {
  test("merges template frontmatter and body into a new draft", async () => {
    const bundle = await loadBundle(await makeBundle(storyFiles));
    const def = getTypeDefBySlug("character");
    if (!def) throw new Error("character type def missing");

    const draft = newConceptDraft(bundle, def, {
      name: "Boyd",
      author: "human:a",
      now: "2026-09-12T00:00:00Z",
      tags: "alpha,beta",
      template: {
        data: {
          species: "werewolf",
          role: "beta",
          tags: ["beta", "hale-pack"],
          aliases: ["Beta"],
        },
        body: "# Boyd\n\nA werewolf.\n",
      },
    });

    expect(draft.path).toBe("characters/boyd.md");
    expect(draft.data.species).toBe("werewolf");
    expect(draft.data.role).toBe("beta");
    expect(draft.data.type).toBe("Character");
    expect(draft.data.title).toBe("Boyd");
    expect(draft.data.status).toBe("draft");
    expect(draft.data.generated).toEqual({ by: "human:a", at: "2026-09-12T00:00:00Z" });
    expect(draft.data.tags).toEqual(["alpha", "beta", "hale-pack"]);
    expect(draft.data.aliases).toEqual(["Beta"]);
    expect(draft.content).toContain("A werewolf.");
    expect(draft.content).not.toContain("# Overview");
  });

  test("keeps structural keys from the generated draft", async () => {
    const bundle = await loadBundle(await makeBundle(storyFiles));
    const def = getTypeDefBySlug("character");
    if (!def) throw new Error("character type def missing");

    const draft = newConceptDraft(bundle, def, {
      name: "Erica",
      author: "human:a",
      now: "2026-09-12T00:00:00Z",
      template: {
        data: {
          type: "Location",
          title: "Wrong Title",
          generated: { by: "template", at: "1999-01-01T00:00:00Z" },
        },
        body: "",
      },
    });

    expect(draft.data.type).toBe("Character");
    expect(draft.data.title).toBe("Erica");
    expect(draft.data.generated).toEqual({ by: "human:a", at: "2026-09-12T00:00:00Z" });
    expect(draft.data.status).toBe("draft");
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

describe("new concept fanfic flags", () => {
  test("sets origin on a new character", async () => {
    const bundle = await loadBundle(await makeBundle(fanficFiles()));
    const def = getTypeDefBySlug("character");
    expect(def).toBeDefined();
    const draft = newConceptDraft(bundle, def!, {
      name: "Severus Snape",
      author: "human:a",
      origin: "fanon",
    });
    expect(draft.data.origin).toBe("fanon");
  });

  test("requires --diverges-at for origin: divergent", async () => {
    const bundle = await loadBundle(await makeBundle(fanficFiles()));
    const def = getTypeDefBySlug("character");
    expect(() =>
      newConceptDraft(bundle, def!, { name: "Ron Weasley", author: "human:a", origin: "divergent" }),
    ).toThrow("diverges-at");
  });

  test("resolves a diverges_at scene link", async () => {
    const bundle = await loadBundle(await makeBundle(fanficFiles()));
    const def = getTypeDefBySlug("character");
    const draft = newConceptDraft(bundle, def!, {
      name: "Ron Weasley",
      author: "human:a",
      origin: "divergent",
      divergesAt: "chapters/ch-01/sc-01",
    });
    expect(draft.data.diverges_at).toBe("/chapters/ch-01/sc-01.md");
  });
});