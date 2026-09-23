import { describe, expect, spyOn, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "../../src/cli/args.ts";
import { cmdUpdate } from "../../src/cli/commands/update.ts";
import { GENERATED_HEADER } from "../../src/core/adapters/render.ts";
import { initProject } from "../../src/core/project/init.ts";
import { tmpProject } from "../helpers.ts";

async function captureUpdate(cwd: string): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const outSpy = spyOn(process.stdout, "write").mockImplementation(((chunk: string) => {
    out.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);
  const errSpy = spyOn(process.stderr, "write").mockImplementation(((chunk: string) => {
    err.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
  const code = await cmdUpdate(parseArgs([]), cwd);
  outSpy.mockRestore();
  errSpy.mockRestore();
  return { code, out: out.join(""), err: err.join("") };
}

describe("novel update", () => {
  test("refreshes an initialized project", async () => {
    const root = await tmpProject("update-clean");
    await initProject(root, { name: "Test Story", author: "human:tester" });

    const { code, out } = await captureUpdate(root);
    expect(code).toBe(0);
    expect(out.length).toBeGreaterThan(0);
  });

  test("migrates a legacy .opencode/skill/ directory", async () => {
    const root = await tmpProject("update-legacy");
    await initProject(root, { name: "Test Story", author: "human:tester" });

    const legacyDir = join(root, ".opencode/skill/novel-harness");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      join(legacyDir, "SKILL.md"),
      `---\nname: novel-harness\ndescription: test\n---\n\n${GENERATED_HEADER}\n\nbody\n`,
      "utf8",
    );

    const { code, out } = await captureUpdate(root);
    expect(code).toBe(0);
    expect(out).toContain("legacy");
    expect(existsSync(join(root, ".opencode/skill"))).toBe(false);
    expect(existsSync(join(root, ".opencode/skills/novel-harness/SKILL.md"))).toBe(true);
  });

  test("errors outside a project", async () => {
    const root = await tmpProject("update-empty");
    const { code, err } = await captureUpdate(root);
    expect(code).toBe(1);
    expect(err).toContain("no novel project");
  });
});
