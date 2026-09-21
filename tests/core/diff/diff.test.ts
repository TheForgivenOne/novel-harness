import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitBundleDiff, renderDiffMarkdown } from "../../../src/core/diff/diff.ts";

function runGit(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function commit(cwd: string, message: string): void {
  runGit(cwd, ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-m", message]);
}

describe("diff", () => {
  test("gitBundleDiff annotates added concepts and renders markdown", async () => {
    const repo = await mkdtemp(join(tmpdir(), "novel-diff-"));
    const bundlePath = join(repo, "story");
    await mkdir(bundlePath, { recursive: true });
    await writeFile(
      join(bundlePath, "novel.md"),
      "---\ntype: Novel\ntitle: Test Novel\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      "utf8",
    );

    runGit(repo, ["init"]);
    runGit(repo, ["add", "-A"]);
    commit(repo, "init");

    await mkdir(join(bundlePath, "characters"), { recursive: true });
    await writeFile(
      join(bundlePath, "characters", "boyd.md"),
      "---\ntype: Character\ntitle: Boyd\nrole: supporting\nfate: alive\norigin: source\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      "utf8",
    );
    runGit(repo, ["add", "-A"]);
    commit(repo, "add boyd");

    const changes = gitBundleDiff(repo, bundlePath, "HEAD~1", "HEAD");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      status: "A",
      path: "characters/boyd.md",
      type: "Character",
      title: "Boyd",
      origin: "source",
    });

    const markdown = renderDiffMarkdown("HEAD~1", "HEAD", changes);
    expect(markdown).toContain("# Diff HEAD~1..HEAD");
    expect(markdown).toContain("* 1 added");
    expect(markdown).toContain("## Added");
    expect(markdown).toContain("* characters/boyd.md — Character — origin source");
  });
});