import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { removeConcept } from "../../../src/core/ops/remove.ts";
import { makeBundle } from "../../helpers.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";
const novel = `---\ntype: Novel\ntitle: Test\nstatus: stable\n${GEN}\n---\n`;
const hero = `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\n${GEN}\n---\n`;
const archive = `---\ntype: Location\ntitle: Archive\nstatus: stable\n${GEN}\n---\n`;
const chapter = (title: string, sequence: number) =>
  `---\ntype: Chapter\ntitle: ${title}\nsequence: ${sequence}\npov: /characters/hero.md\nstatus: stable\n${GEN}\n---\n`;
const scene =
  `---\ntype: Scene\ntitle: Open\nsequence: 1\npov: /characters/hero.md\n` +
  `cast: [/characters/hero.md]\nlocation: /locations/archive.md\nstatus: stable\n${GEN}\n---\n`;
const event =
  `---\ntype: Timeline Event\ntitle: Event\nsequence: 1\nwhen: 2011\n` +
  `diverges_at: /chapters/ch-01/sc-01.md\nstatus: stable\n${GEN}\n---\n`;

async function setup(extra: Record<string, string> = {}) {
  const root = await makeBundle({
    "novel.md": novel,
    "characters/hero.md": hero,
    "locations/archive.md": archive,
    "chapters/ch-01.md": chapter("One", 1),
    "chapters/ch-02.md": chapter("Two", 2),
    "chapters/ch-01/sc-01.md": scene,
    "timeline/event.md": event,
    ...extra,
  });
  const bundle = await loadBundle(root);
  return { root, project: { bundle, bundlePath: root } };
}

describe("novel rm", () => {
  test("refuses when other concepts link to the target", async () => {
    const { project } = await setup();
    await expect(removeConcept(project, "archive")).rejects.toThrow(
      "1 concept(s) link to locations/archive",
    );
  });

  test("--force removes the concept and reports inbound links", async () => {
    const { root, project } = await setup();
    const result = await removeConcept(project, "archive", { force: true });
    expect(result.inbound.map((link) => link.path)).toEqual(["chapters/ch-01/sc-01.md"]);
    expect(existsSync(join(root, "locations/archive.md"))).toBe(false);
  });

  test("--dry-run keeps the file", async () => {
    const { root, project } = await setup();
    await removeConcept(project, "archive", { force: true, dryRun: true });
    expect(existsSync(join(root, "locations/archive.md"))).toBe(true);
  });

  test("removing the last scene prunes its directory", async () => {
    const { root, project } = await setup();
    await removeConcept(project, "chapters/ch-01/sc-01", { force: true });
    expect(existsSync(join(root, "chapters/ch-01"))).toBe(false);
  });
});