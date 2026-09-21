import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../../../src/core/project/config.ts";
import { checkProject, fixProject } from "../../../src/core/project/doctor.ts";
import { initProject } from "../../../src/core/project/init.ts";
import { makeBundle, tmpProject } from "../../helpers.ts";

describe("doctor chapter outline checks", () => {
  test("warns and fixes a chapter without outline.md", async () => {
    const root = await tmpProject("doctor-outline");
    const project = await initProject(root, { name: "Test Story", author: "human:tester" });
    const bundlePath = join(project.projectRoot, "story");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(bundlePath, "chapters"), { recursive: true });
    await writeFile(
      join(bundlePath, "chapters", "ch-01.md"),
      `---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/missing.md\nstatus: draft\nby: human:tester\nat: 2026-09-12T00:00:00Z\n---\n`,
      "utf8",
    );
    const { checkProject, fixProject } = await import("../../../src/core/project/doctor.ts");
    const { loadConfig } = await import("../../../src/core/project/config.ts");
    const cfg = await loadConfig(project.projectRoot);
    const report = await checkProject(project.projectRoot, cfg);
    expect(report.issues.some((issue) => issue.code === "structure/missing-outline")).toBe(true);
    await fixProject(project.projectRoot, cfg);
    const fixed = await checkProject(project.projectRoot, cfg);
    expect(fixed.issues.some((issue) => issue.code === "structure/missing-outline")).toBe(false);
    expect(existsSync(join(bundlePath, "chapters/ch-01/outline.md"))).toBe(true);
  });
});

const legacyProject = {
  ".novel/config.json": '{\n  "bundle": "story",\n  "author": "human:author"\n}\n',
  "story/novel.md":
    "---\ntype: Novel\ntitle: Legacy\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
};

describe("doctor", () => {
  test("reports legacy config, missing dirs, stale adapters, and index drift", async () => {
    const root = await makeBundle(legacyProject);
    const report = await checkProject(root);
    const codes = report.issues.map((issue) => issue.code);
    expect(codes).toContain("config/version");
    expect(codes).toContain("structure/missing-dir");
    expect(codes).toContain("adapters/stale");
    expect(codes).toContain("index/drift");
  });

  test("fixProject applies the mechanical fixes and the report goes clean", async () => {
    const root = await makeBundle(legacyProject);
    const applied = await fixProject(root, await loadConfig(root));
    expect(applied.length).toBeGreaterThan(0);

    expect(existsSync(join(root, "story/arcs/index.md"))).toBe(true);
    expect(existsSync(join(root, "story/episodes/index.md"))).toBe(true);
    expect(existsSync(join(root, "story/items/index.md"))).toBe(true);

    const after = await checkProject(root);
    const codes = after.issues.map((issue) => issue.code);
    expect(codes).not.toContain("config/version");
    expect(codes).not.toContain("structure/missing-dir");
    expect(codes).not.toContain("adapters/stale");
    expect(codes).not.toContain("index/drift");
  });

  test("suggests /migrate when content needs semantic fixes", async () => {
    const root = await makeBundle({
      ...legacyProject,
      "story/chapters/season-1.md":
        "---\ntype: Chapter\ntitle: Season 1\nsequence: 1\npov: /characters/nobody.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    });
    const report = await checkProject(root);
    expect(report.suggestions.join(" ")).toContain("/migrate");
    expect(report.suggestions.join(" ")).toContain("novel migrate");
    expect(report.content["profile/orphan-chapter"]).toBeGreaterThan(0);
  });
});