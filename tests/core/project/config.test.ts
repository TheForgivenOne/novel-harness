import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_VERSION, DEFAULT_CONFIG, loadConfig } from "../../../src/core/project/config.ts";
import { fixProject } from "../../../src/core/project/doctor.ts";
import { makeBundle } from "../../helpers.ts";

const legacyProject = {
  ".novel/config.json": '{\n  "bundle": "story",\n  "author": "human:author"\n}\n',
  "story/novel.md":
    "---\ntype: Novel\ntitle: Legacy\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
};

describe("config versioning", () => {
  test("a config without a version loads as legacy", async () => {
    const root = await makeBundle(legacyProject);
    const config = await loadConfig(root);
    expect(config.version).toBe(0);
    expect(config.targets).toEqual(DEFAULT_CONFIG.targets);
  });

  test("init writes the current version", async () => {
    const root = await makeBundle(legacyProject);
    await fixProject(root, await loadConfig(root));
    const config = await loadConfig(root);
    expect(config.version).toBe(CONFIG_VERSION);
    expect(JSON.parse(await readFile(join(root, ".novel/config.json"), "utf8")).version).toBe(
      CONFIG_VERSION,
    );
  });
});