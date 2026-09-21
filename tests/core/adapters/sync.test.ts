import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { syncAdapters } from "../../../src/core/adapters/sync.ts";
import { DEFAULT_CONFIG } from "../../../src/core/project/config.ts";
import { INSTRUCTIONS, defaultWorkflows } from "../../../src/workflows/index.ts";
import { makeBundle } from "../../helpers.ts";

describe("sync dry run", () => {
  test("computes changes without writing files", async () => {
    const root = await makeBundle({});
    const result = await syncAdapters(
      root,
      DEFAULT_CONFIG,
      { workflows: defaultWorkflows(), instructions: INSTRUCTIONS },
      { dryRun: true },
    );
    expect(result.written).toHaveLength(71);
    expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(root, ".novel/manifest.json"))).toBe(false);
  });
});