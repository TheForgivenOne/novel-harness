import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { setConceptFields } from "../../../src/core/ops/set.ts";
import { makeBundle } from "../../helpers.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";

async function setup() {
  const root = await makeBundle({
    "novel.md": `---\ntype: Novel\ntitle: Test\nstatus: stable\n${GEN}\n---\n`,
    "characters/hero.md": `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\n${GEN}\n---\n`,
    "locations/archive.md": `---\ntype: Location\ntitle: Archive\nstatus: stable\n${GEN}\n---\n`,
    "chapters/ch-01.md": `---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/hero.md\nstatus: stable\n${GEN}\n---\n`,
    "chapters/ch-01/sc-01.md": `---\ntype: Scene\ntitle: Open\nsequence: 1\npov: /characters/hero.md\ncast: [/characters/hero.md]\nstatus: stable\n${GEN}\n---\n`,
    "timeline/event.md": `---\ntype: Timeline Event\ntitle: Event\nsequence: 1\nwhen: 2011\nstatus: stable\n${GEN}\n---\n`,
  });
  const bundle = await loadBundle(root);
  return { root, bundle, project: { bundle, bundlePath: root } };
}

async function raw(root: string, path: string): Promise<string> {
  return readFile(join(root, path), "utf8");
}

describe("novel set", () => {
  test("updates title and tags and writes a log entry", async () => {
    const { root, project } = await setup();
    const result = await setConceptFields(project, "hero", [
      { field: "title", value: "Hero Prime" },
      { field: "tags", value: "cast, alpha" },
    ]);
    expect(result.changed).toEqual(["title", "tags"]);
    const file = await raw(root, "characters/hero.md");
    expect(file).toContain("title: Hero Prime");
    expect(file).toContain("- cast");
    expect(file).toContain("- alpha");
    expect(await raw(root, "log.md")).toContain("**Update**");
  });

  test("resolves links from slugs", async () => {
    const { root, project } = await setup();
    await setConceptFields(project, "chapters/ch-01/sc-01", [{ field: "location", value: "archive" }]);
    expect(await raw(root, "chapters/ch-01/sc-01.md")).toContain("location: /locations/archive.md");
  });

  test("sets divergence and diverges_at with --at", async () => {
    const { root, project } = await setup();
    await setConceptFields(
      project,
      "timeline/event",
      [{ field: "divergence", value: "altered" }],
      { at: "chapters/ch-01/sc-01" },
    );
    const file = await raw(root, "timeline/event.md");
    expect(file).toContain("divergence: altered");
    expect(file).toContain("diverges_at: /chapters/ch-01/sc-01.md");
  });

  test("rejects invalid enum values", async () => {
    const { project } = await setup();
    await expect(
      setConceptFields(project, "hero", [{ field: "fate", value: "undead" }]),
    ).rejects.toThrow("fate must be one of");
  });

  test("--unset removes a field", async () => {
    const { root, project } = await setup();
    await setConceptFields(project, "hero", [{ field: "tags", value: "cast" }]);
    const result = await setConceptFields(project, "hero", [], { unset: ["tags"] });
    expect(result.changed).toEqual(["tags"]);
    expect(await raw(root, "characters/hero.md")).not.toContain("tags:");
  });

  test("--dry-run leaves the file unchanged", async () => {
    const { root, project } = await setup();
    await setConceptFields(project, "hero", [{ field: "title", value: "Nope" }], { dryRun: true });
    expect(await raw(root, "characters/hero.md")).toContain("title: Hero");
  });

  test("stores unknown fields as plain strings", async () => {
    const { root, project } = await setup();
    await setConceptFields(project, "hero", [{ field: "moon", value: "full" }]);
    expect(await raw(root, "characters/hero.md")).toContain("moon: full");
  });
});
