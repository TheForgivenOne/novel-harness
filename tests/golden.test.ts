import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { claudeAdapter } from "../src/core/adapters/claude.ts";
import { geminiAdapter } from "../src/core/adapters/gemini.ts";
import { opencodeAdapter } from "../src/core/adapters/opencode.ts";
import { SAMPLE_INPUT } from "./sample.ts";

const GOLDEN_DIR = process.env.NOVEL_GOLDEN_DIR ?? join(import.meta.dir, "golden");

async function expectGolden(path: string, content: string): Promise<void> {
  const dir = process.env.NOVEL_GOLDEN_DIR ?? GOLDEN_DIR;
  if (process.env.UPDATE_SNAPSHOTS === "1") {
    await writeFile(join(dir, path), content, "utf8");
    return;
  }
  const expected = await readFile(join(dir, path), "utf8");
  expect(content).toBe(expected);
}

describe("golden files", () => {
  test("claude draft command", async () => {
    const files = claudeAdapter.render(SAMPLE_INPUT);
    const draft = files.find((file) => file.path === ".claude/commands/draft.md");
    expect(draft).toBeDefined();
    await expectGolden("claude-draft.md", draft!.content ?? "");
  });

  test("opencode draft command", async () => {
    const files = opencodeAdapter.render(SAMPLE_INPUT);
    const draft = files.find((file) => file.path === ".opencode/command/draft.md");
    expect(draft).toBeDefined();
    await expectGolden("opencode-draft.md", draft!.content ?? "");
  });

  test("gemini draft command", async () => {
    const files = geminiAdapter.render(SAMPLE_INPUT);
    const draft = files.find((file) => file.path === ".gemini/commands/draft.toml");
    expect(draft).toBeDefined();
    await expectGolden("gemini-draft.toml", draft!.content ?? "");
  });

  test("AGENTS.md instructions", async () => {
    const files = opencodeAdapter.render(SAMPLE_INPUT);
    const agents = files.find((file) => file.path === "AGENTS.md");
    expect(agents).toBeDefined();
    await expectGolden("AGENTS.md", agents!.content ?? "");
  });

  test("update mode writes the golden file instead of asserting", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "novel-harness-golden-"));
    const prev = { update: process.env.UPDATE_SNAPSHOTS, dir: process.env.NOVEL_GOLDEN_DIR };
    try {
      process.env.UPDATE_SNAPSHOTS = "1";
      process.env.NOVEL_GOLDEN_DIR = dir;
      const files = claudeAdapter.render(SAMPLE_INPUT);
      const draft = files.find((file) => file.path === ".claude/commands/draft.md");
      expect(draft).toBeDefined();
      await expectGolden("claude-draft.md", draft!.content ?? "");
      const written = await readFile(join(dir, "claude-draft.md"), "utf8");
      expect(written).toBe(draft!.content ?? "");
    } finally {
      if (prev.update === undefined) delete process.env.UPDATE_SNAPSHOTS;
      else process.env.UPDATE_SNAPSHOTS = prev.update;
      if (prev.dir === undefined) delete process.env.NOVEL_GOLDEN_DIR;
      else process.env.NOVEL_GOLDEN_DIR = prev.dir;
    }
  });
});