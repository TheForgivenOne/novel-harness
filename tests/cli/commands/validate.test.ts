import { describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../../../src/cli/args.ts";
import { cmdValidate } from "../../../src/cli/commands/validate.ts";
import { initProject } from "../../../src/core/project/init.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";

async function projectWithIssues(): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), "novel-validate-"));
  const project = await initProject(join(base, "proj"), { name: "Validate Test" });
  await mkdir(join(project.projectRoot, "story", "chapters"), { recursive: true });
  await writeFile(
    join(project.projectRoot, "story", "chapters", "orphan.md"),
    `---\ntype: Chapter\ntitle: Orphan\nsequence: 1\npov: /characters/missing.md\nstatus: draft\n${GEN}\n---\n`,
    "utf8",
  );
  await writeFile(
    join(project.projectRoot, "story", "characters", "broken.md"),
    `---\ntype: Character\ntitle: Broken\nstatus: draft\n${GEN}\n---\n`,
    "utf8",
  );
  return project.projectRoot;
}

async function run(
  root: string,
  argv: string[],
): Promise<{ code: number; out: string; err: string }> {
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
  const code = await cmdValidate(parseArgs(argv), root);
  outSpy.mockRestore();
  errSpy.mockRestore();
  return { code, out: out.join(""), err: err.join("") };
}

describe("novel validate filters", () => {
  test("reports every diagnostic by default", async () => {
    const root = await projectWithIssues();
    const { code, out } = await run(root, []);
    expect(out).toContain("chapters/orphan.md");
    expect(out).toContain("characters/broken.md");
    expect(code).toBe(1);
  });

  test("--only limits diagnostics to matching paths and keeps the exit gate", async () => {
    const root = await projectWithIssues();
    const { code, out } = await run(root, ["--only", "chapters/orphan"]);
    expect(out).toContain("chapters/orphan.md");
    expect(out).not.toContain("characters/broken.md");
    expect(code).toBe(1);
  });

  test("--quiet hides warnings and keeps errors", async () => {
    const root = await projectWithIssues();
    const { code, out } = await run(root, ["--quiet"]);
    expect(out).not.toContain("chapters/orphan.md");
    expect(out).toContain("characters/broken.md");
    expect(code).toBe(1);
  });

  test("--severity warning hides errors", async () => {
    const root = await projectWithIssues();
    const { out } = await run(root, ["--severity", "warning"]);
    expect(out).toContain("chapters/orphan.md");
    expect(out).not.toContain("profile/missing-field");
    expect(out).toContain("profile/missing-tags");
  });

  test("--summary prints per-code counts instead of diagnostics", async () => {
    const root = await projectWithIssues();
    const { out } = await run(root, ["--summary"]);
    expect(out).toContain("profile/orphan-chapter: 1");
    expect(out).not.toContain("chapters/orphan.md");
  });

  test("--json emits filtered diagnostics with bundle counts", async () => {
    const root = await projectWithIssues();
    const { out } = await run(root, ["--json", "--only", "characters"]);
    const parsed = JSON.parse(out) as {
      counts: { errors: number; warnings: number; total: number };
      diagnostics: { path?: string }[];
    };
    expect(parsed.counts.errors).toBeGreaterThan(0);
    expect(parsed.counts.total).toBeGreaterThan(parsed.diagnostics.length);
    expect(parsed.diagnostics.some((entry) => entry.path?.startsWith("characters/"))).toBe(true);
    expect(parsed.diagnostics.some((entry) => entry.path?.includes("orphan"))).toBe(false);
  });

  test("rejects an unknown severity", async () => {
    const root = await projectWithIssues();
    const { code, out, err } = await run(root, ["--severity", "nope"]);
    expect(code).toBe(1);
    expect(out).toBe("");
    expect(err).toContain("severity");
  });
});
