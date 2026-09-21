import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import {
  parseRenumberGroups,
  parseRenumberSort,
  renumberSequences,
} from "../../../src/core/ops/renumber.ts";
import { makeBundle } from "../../helpers.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";
const novel = `---\ntype: Novel\ntitle: Test\nstatus: stable\n${GEN}\n---\n`;
const hero = `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\n${GEN}\n---\n`;
const chapter = (title: string, sequence: number) =>
  `---\ntype: Chapter\ntitle: ${title}\nsequence: ${sequence}\npov: /characters/hero.md\nstatus: stable\n${GEN}\n---\n`;
const scene = (title: string, sequence: number) =>
  `---\ntype: Scene\ntitle: ${title}\nsequence: ${sequence}\npov: /characters/hero.md\nstatus: stable\n${GEN}\n---\n`;
const event = (title: string, sequence: number | undefined, when: string) =>
  `---\ntype: Timeline Event\ntitle: ${title}\n` +
  (sequence === undefined ? "" : `sequence: ${sequence}\n`) +
  `when: ${when}\nstatus: stable\n${GEN}\n---\n`;
const eventNoSequence = (title: string, when: string) =>
  `---\ntype: Timeline Event\ntitle: ${title}\nwhen: ${when}\nstatus: stable\n${GEN}\n---\n`;

async function setup() {
  const root = await makeBundle({
    "novel.md": novel,
    "characters/hero.md": hero,
    "chapters/ch-01.md": chapter("One", 1),
    "chapters/ch-02.md": chapter("Two", 3),
    "chapters/ch-03.md": chapter("Three", 7),
    "chapters/ch-01/sc-a.md": scene("A", 2),
    "chapters/ch-01/sc-b.md": scene("B", 5),
    "chapters/ch-02/sc-c.md": scene("C", 4),
    "timeline/ev-a.md": event("A", 2, "2010"),
    "timeline/ev-b.md": event("B", 2, "2011"),
    "timeline/ev-c.md": eventNoSequence("C", "2012"),
  });
  const bundle = await loadBundle(root);
  return { root, project: { bundle, bundlePath: root } };
}

async function sequenceAt(root: string, path: string): Promise<number | undefined> {
  const raw = await readFile(`${root}/${path}`, "utf8");
  const match = /^sequence:\s*(\d+)/m.exec(raw);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

describe("novel renumber", () => {
  test("compacts chapters, per-chapter scenes, and timeline events", async () => {
    const { root, project } = await setup();
    const result = await renumberSequences(project);

    expect(result.changes.map((change) => change.path)).toEqual([
      "chapters/ch-02.md",
      "chapters/ch-03.md",
      "chapters/ch-01/sc-a.md",
      "chapters/ch-01/sc-b.md",
      "chapters/ch-02/sc-c.md",
      "timeline/ev-a.md",
      "timeline/ev-c.md",
    ]);
    expect(result.groups).toEqual({ chapter: 2, scene: 3, timeline: 2 });

    expect(await sequenceAt(root, "chapters/ch-01.md")).toBe(1);
    expect(await sequenceAt(root, "chapters/ch-02.md")).toBe(2);
    expect(await sequenceAt(root, "chapters/ch-03.md")).toBe(3);
    expect(await sequenceAt(root, "chapters/ch-01/sc-a.md")).toBe(1);
    expect(await sequenceAt(root, "chapters/ch-01/sc-b.md")).toBe(2);
    expect(await sequenceAt(root, "chapters/ch-02/sc-c.md")).toBe(1);
    expect(await sequenceAt(root, "timeline/ev-a.md")).toBe(1);
    expect(await sequenceAt(root, "timeline/ev-b.md")).toBe(2);
    expect(await sequenceAt(root, "timeline/ev-c.md")).toBe(3);
  });

  test("--dry-run reports changes without writing", async () => {
    const { root, project } = await setup();
    const result = await renumberSequences(project, { dryRun: true });
    expect(result.changes.length).toBeGreaterThan(0);
    expect(await sequenceAt(root, "chapters/ch-02.md")).toBe(3);
  });

  test("--type limits the groups touched", async () => {
    const { root, project } = await setup();
    const result = await renumberSequences(project, { groups: ["scene"] });
    expect(result.groups.chapter).toBe(0);
    expect(result.groups.timeline).toBe(0);
    expect(await sequenceAt(root, "chapters/ch-02.md")).toBe(3);
    expect(await sequenceAt(root, "chapters/ch-01/sc-b.md")).toBe(2);
  });

  test("--start and --step set the assigned numbers", async () => {
    const { root, project } = await setup();
    await renumberSequences(project, { groups: ["chapter"], start: 10, step: 5 });
    expect(await sequenceAt(root, "chapters/ch-01.md")).toBe(10);
    expect(await sequenceAt(root, "chapters/ch-02.md")).toBe(15);
    expect(await sequenceAt(root, "chapters/ch-03.md")).toBe(20);
  });

  test("rejects invalid start, step, and group names", async () => {
    const { project } = await setup();
    await expect(renumberSequences(project, { start: 0 })).rejects.toThrow(/start/);
    await expect(renumberSequences(project, { step: 1.5 })).rejects.toThrow(/step/);
    expect(() => parseRenumberGroups("chapters, prologue")).toThrow(/unknown renumber type/);
    expect(parseRenumberGroups("chapters,timeline-events")).toEqual(["chapter", "timeline"]);
  });
});

describe("novel renumber --sort when", () => {
  async function whenFixture() {
    const root = await makeBundle({
      "novel.md": novel,
      "characters/hero.md": hero,
      "chapters/ch-01.md": chapter("One", 1),
      "chapters/ch-01/sc-a.md": scene("A", 1),
      "timeline/z-late.md": event("Late", 1, "2013"),
      "timeline/a-early.md": event("Early", 2, "2011"),
      "timeline/m-mid.md": event("Mid", 3, "March 2012"),
      "timeline/b-undated.md": event("Undated", 4, "someday"),
    });
    const bundle = await loadBundle(root);
    return { root, project: { bundle, bundlePath: root } };
  }

  test("orders timeline events by when before assigning sequences", async () => {
    const { root, project } = await whenFixture();
    const result = await renumberSequences(project, { sort: "when" });
    expect(result.groups.timeline).toBe(2);
    expect(await sequenceAt(root, "timeline/b-undated.md")).toBe(1);
    expect(await sequenceAt(root, "timeline/a-early.md")).toBe(2);
    expect(await sequenceAt(root, "timeline/m-mid.md")).toBe(3);
    expect(await sequenceAt(root, "timeline/z-late.md")).toBe(4);
  });

  test("keeps existing sequence order for events sharing a date", async () => {
    const root = await makeBundle({
      "novel.md": novel,
      "characters/hero.md": hero,
      "timeline/second.md": event("Second", 5, "2011"),
      "timeline/first.md": event("First", 9, "2011"),
    });
    const bundle = await loadBundle(root);
    await renumberSequences({ bundle, bundlePath: root }, { sort: "when" });
    expect(await sequenceAt(root, "timeline/second.md")).toBe(1);
    expect(await sequenceAt(root, "timeline/first.md")).toBe(2);
  });

  test("sequence sort ignores when order", async () => {
    const { root, project } = await whenFixture();
    await renumberSequences(project);
    expect(await sequenceAt(root, "timeline/z-late.md")).toBe(1);
    expect(await sequenceAt(root, "timeline/a-early.md")).toBe(2);
    expect(await sequenceAt(root, "timeline/m-mid.md")).toBe(3);
    expect(await sequenceAt(root, "timeline/b-undated.md")).toBe(4);
  });

  test("parseRenumberSort accepts when and rejects other fields", () => {
    expect(parseRenumberSort(undefined)).toBe("sequence");
    expect(parseRenumberSort("when")).toBe("when");
    expect(parseRenumberSort("WHEN")).toBe("when");
    expect(() => parseRenumberSort("date")).toThrow(/unknown sort field/);
  });
});
