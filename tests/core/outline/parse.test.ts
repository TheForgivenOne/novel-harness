import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import {
  nextLine,
  outlineConcept,
  sceneRowFor,
  sceneRows,
  structureRowFor,
  structureRows,
  toNumber,
} from "../../../src/core/outline/parse.ts";
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

describe("outline parsing", () => {
  test("finds the Outline concept and parses both tables", async () => {
    const bundle = await loadBundle(
      await makeBundle({
        "outline.md": OUTLINE,
        "chapters/first-day.md": `---
type: Chapter
title: First Day
sequence: 1
pov: /characters/scott.md
status: stable
${GEN}
---\n`,
        "chapters/first-day/scenes/the-bite.md": `---
type: Scene
title: The Bite
sequence: 1
pov: /characters/scott.md
status: draft
${GEN}
---\n`,
        "characters/scott.md": `---
type: Character
title: Scott McCall
role: protagonist
fate: alive
status: stable
${GEN}
---\n`,
      }),
    );

    expect(outlineConcept(bundle)).toBeDefined();
    const structure = structureRows(bundle);
    expect(structure).toHaveLength(2);
    expect(structure[0]?.Chapter).toBe("First Day");
    expect(structure[0]?.Sequence).toBe("1");
    expect(toNumber(structure[0]?.Sequence)).toBe(1);
    expect(toNumber(undefined)).toBeUndefined();
    const scenes = sceneRows(bundle);
    expect(scenes).toHaveLength(2);
    expect(scenes[0]?.Status).toBe("stub");
  });

  test("rowMatchesChapter matches by id, basename, or title", async () => {
    const bundle = await loadBundle(
      await makeBundle({
        "outline.md": OUTLINE,
        "chapters/first-day.md": `---
type: Chapter
title: First Day
sequence: 1
pov: /characters/scott.md
status: stable
${GEN}
---\n`,
      }),
    );
    const chapter = bundle.concepts.find((c) => c.id === "chapters/first-day");
    expect(chapter).toBeDefined();
    expect(structureRowFor(bundle, chapter!)).toBeDefined();
    expect(structureRowFor(bundle, chapter!)?.Words).toBe("1800");
  });

  test("sceneRowFor matches the scene name within the chapter", async () => {
    const bundle = await loadBundle(
      await makeBundle({
        "outline.md": OUTLINE,
        "chapters/first-day.md": `---
type: Chapter
title: First Day
sequence: 1
pov: /characters/scott.md
status: stable
${GEN}
---\n`,
      }),
    );
    const chapter = bundle.concepts.find((c) => c.id === "chapters/first-day");
    const row = sceneRowFor(bundle, chapter!, "The Bite");
    expect(row?.Sequence).toBe("1");
    expect(row?.POV).toBe("Scott McCall");
    expect(sceneRowFor(bundle, chapter!, "Missing Scene")).toBeUndefined();
  });

  test("nextLine returns the first non-empty line after # Next", async () => {
    const bundle = await loadBundle(
      await makeBundle({ "outline.md": OUTLINE }),
    );
    expect(nextLine(bundle)).toBe("Draft The Bite in First Day.");
  });

  test("missing outline yields empty rows", async () => {
    const bundle = await loadBundle(await makeBundle({}));
    expect(outlineConcept(bundle)).toBeUndefined();
    expect(structureRows(bundle)).toEqual([]);
    expect(sceneRows(bundle)).toEqual([]);
  });
});