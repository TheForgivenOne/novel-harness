import { describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../../../src/cli/args.ts";
import { cmdAudit } from "../../../src/cli/commands/audit.ts";
import { cmdFetch } from "../../../src/cli/commands/fetch.ts";
import { readFetchReceipts } from "../../../src/core/evidence/receipts.ts";
import { initProject } from "../../../src/core/project/init.ts";

const GEN = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";
const GENERATED = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";

async function projectWithIssues(): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), "novel-audit-"));
  const project = await initProject(join(base, "proj"), { name: "Audit Test" });
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

async function run(root: string, argv: string[]): Promise<{ code: number; out: string }> {
  const chunks: string[] = [];
  const spy = spyOn(process.stdout, "write").mockImplementation(((chunk: string) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);
  const code = await cmdAudit(parseArgs(argv), root);
  spy.mockRestore();
  return { code, out: chunks.join("") };
}

describe("novel audit", () => {
  test("reports project, content, and sources sections", async () => {
    const root = await projectWithIssues();
    const { out } = await run(root, []);
    expect(out).toContain("## Project");
    expect(out).toContain("## Content");
    expect(out).toContain("## Sources");
    expect(out).toContain("chapters/orphan.md");
  });

  test("--only limits entries to matching paths", async () => {
    const root = await projectWithIssues();
    const { out } = await run(root, ["--only", "chapters/orphan"]);
    expect(out).toContain("chapters/orphan.md");
    expect(out).not.toContain("characters/broken.md");
  });

  test("--quiet hides warnings but keeps errors", async () => {
    const root = await projectWithIssues();
    const { code, out } = await run(root, ["--quiet"]);
    expect(out).not.toContain("warning chapters/orphan.md");
    expect(out).toContain("characters/broken.md");
    expect(code).toBe(1);
  });

  test("--severity warning hides errors", async () => {
    const root = await projectWithIssues();
    const { out } = await run(root, ["--severity", "warning"]);
    expect(out).toContain("warning chapters/orphan.md");
    expect(out).not.toContain("error characters/broken.md");
  });

  test("--summary prints per-code counts only", async () => {
    const root = await projectWithIssues();
    const { out } = await run(root, ["--summary"]);
    expect(out).toContain("profile/orphan-chapter: 1");
    expect(out).not.toContain("warning chapters/orphan.md");
  });

  test("--json emits a structured report", async () => {
    const root = await projectWithIssues();
    const { out } = await run(root, ["--json"]);
    const parsed = JSON.parse(out) as {
      project: unknown[];
      content: unknown[];
      sources: { entries: unknown[] };
    };
    expect(Array.isArray(parsed.project)).toBe(true);
    expect(Array.isArray(parsed.content)).toBe(true);
    expect(Array.isArray(parsed.sources.entries)).toBe(true);
  });
});

describe("fetch and audit commands", () => {
  test("novel fetch records a receipt and audit --receipts gates on coverage", async () => {
    const base = await mkdtemp(join(tmpdir(), "novel-fetch-"));
    const project = await initProject(join(base, "proj"), { name: "Fetch Test" });
    const server = Bun.serve({ port: 0, fetch: () => new Response("page body") });
    const url = `http://localhost:${server.port}/page`;

    const reference =
      `---\ntype: Reference\ntitle: Work\nresource: https://example.com/work\n` +
      `refs:\n  - title: Page\n    url: ${url}\n    kind: wiki\nstatus: stable\n${GENERATED}\n---\n`;
    await writeFile(join(project.projectRoot, "story", "references", "work.md"), reference, "utf8");

    const spy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const errSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    const missing = await cmdAudit(parseArgs(["--receipts"]), project.projectRoot);
    expect(missing).toBe(1);

    const fetched = await cmdFetch(parseArgs([url]), project.projectRoot);
    server.stop(true);
    expect(fetched).toBe(0);

    const covered = await cmdAudit(parseArgs(["--receipts"]), project.projectRoot);
    spy.mockRestore();
    errSpy.mockRestore();
    expect(covered).toBe(0);

    const receipts = await readFetchReceipts(project.projectRoot);
    expect(receipts.map((entry) => entry.url)).toEqual([url]);
  });
});
