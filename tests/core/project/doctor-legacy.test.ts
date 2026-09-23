import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GENERATED_HEADER } from "../../../src/core/adapters/render.ts";
import { loadConfig } from "../../../src/core/project/config.ts";
import { checkProject, fixProject } from "../../../src/core/project/doctor.ts";
import { makeBundle } from "../../helpers.ts";

const baseConfig = `${JSON.stringify(
  {
    version: 1,
    bundle: "story",
    targets: ["opencode"],
    author: "human:a",
    build: { out: "dist", format: "markdown" },
  },
  null,
  2,
)}\n`;

const generatedSkill = `---\nname: novel-harness\ndescription: test\n---\n\n${GENERATED_HEADER}\n\nbody\n`;

const legacyProject = {
  ".novel/config.json": baseConfig,
  ".opencode/skill/novel-harness/SKILL.md": generatedSkill,
  "story/novel.md":
    "---\ntype: Novel\ntitle: Legacy\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
};

describe("doctor legacy opencode skills path", () => {
  test("flags .opencode/skill/ and migrates it to .opencode/skills/", async () => {
    const root = await makeBundle(legacyProject);

    const before = await checkProject(root);
    expect(before.issues.some((issue) => issue.code === "adapters/legacy-path")).toBe(true);

    const applied = await fixProject(root, await loadConfig(root));
    expect(applied.some((line) => line.includes("legacy"))).toBe(true);

    expect(existsSync(join(root, ".opencode/skill"))).toBe(false);
    expect(existsSync(join(root, ".opencode/skills/novel-harness/SKILL.md"))).toBe(true);

    const after = await checkProject(root);
    expect(after.issues.some((issue) => issue.code === "adapters/legacy-path")).toBe(false);
  });

  test("leaves a non-novel legacy directory alone", async () => {
    const root = await makeBundle({
      ".novel/config.json": baseConfig,
      ".opencode/skill/custom/SKILL.md": "---\nname: custom\n---\n\nuser content\n",
      "story/novel.md":
        "---\ntype: Novel\ntitle: Legacy\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    });

    const before = await checkProject(root);
    expect(before.issues.some((issue) => issue.code === "adapters/legacy-path")).toBe(false);

    await fixProject(root, await loadConfig(root));
    expect(existsSync(join(root, ".opencode/skill/custom/SKILL.md"))).toBe(true);
  });
});
