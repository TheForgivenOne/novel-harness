import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { validateBundle } from "../../../src/core/validate/index.ts";
import { makeBundle } from "../../helpers.ts";

function baseFiles(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "novel.md":
      "---\ntype: Novel\ntitle: T\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "characters/elena.md":
      "---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: alive\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01.md":
      "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/elena.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01/sc-01.md":
      "---\ntype: Scene\ntitle: S\nsequence: 1\npov: /characters/elena.md\ncast: [/characters/elena.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nProse.\n",
    ...extra,
  };
}

async function validateFiles(files: Record<string, string>) {
  const root = await makeBundle(files);
  return validateBundle(await loadBundle(root));
}

async function codesFor(files: Record<string, string>): Promise<string[]> {
  const result = await validateFiles(files);
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("OKF validation", () => {
  test("flags a concept with no type", async () => {
    const codes = await codesFor(baseFiles({ "characters/broken.md": "---\ntitle: Nope\n---\n" }));
    expect(codes).toContain("okf/type");
  });

  test("flags frontmatter on a non-root index.md", async () => {
    const codes = await codesFor(
      baseFiles({ "characters/index.md": "---\ntype: Character\n---\n" }),
    );
    expect(codes).toContain("okf/index-frontmatter");
  });

  test("flags frontmatter on log.md", async () => {
    const codes = await codesFor(baseFiles({ "log.md": "---\ntype: Novel\n---\n" }));
    expect(codes).toContain("okf/log-frontmatter");
  });

  test("warns on a non-0.2 okf_version", async () => {
    const codes = await codesFor(baseFiles({ "index.md": '---\nokf_version: "0.1"\n---\n' }));
    expect(codes).toContain("okf/version");
  });
});

const GENERATED = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";

function novelFile(): string {
  return `---\ntype: Novel\ntitle: Test\nstatus: stable\n${GENERATED}\n---\n`;
}

function heroFile(sources: string[]): string {
  const lines = sources.map((resource) => `  - id: s\n    resource: ${resource}`).join("\n");
  return `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\norigin: source\nsources:\n${lines}\nstatus: stable\n${GENERATED}\n---\n`;
}

async function build(files: Record<string, string>) {
  return loadBundle(await makeBundle({ "novel.md": novelFile(), ...files }));
}

describe("log structure", () => {
  test("accepts ISO date headings", async () => {
    const bundle = await build({
      "log.md": "# Directory Update Log\n\n## 2026-09-13\n* **Update**: Added a concept.\n",
    });
    expect(
      validateBundle(bundle).diagnostics.filter((entry) => entry.code === "okf/log-date"),
    ).toEqual([]);
  });

  test("rejects non-ISO date headings", async () => {
    const bundle = await build({
      "log.md": "# Directory Update Log\n\n## 13/09/2026\n* **Update**: Added a concept.\n",
    });
    const codes = validateBundle(bundle)
      .diagnostics.filter((entry) => entry.code === "okf/log-date")
      .map((entry) => entry.path);
    expect(codes).toEqual(["log.md"]);
  });
});

describe("strict timestamps", () => {
  test("accepts ISO datetimes with an explicit offset", async () => {
    const bundle = await build({
      "characters/hero.md": heroFile(["https://example.com/canon"]),
    });
    expect(
      validateBundle(bundle).diagnostics.filter(
        (entry) => entry.code === "profile/generated" || entry.code === "profile/field-type",
      ),
    ).toEqual([]);
  });

  test("rejects date-only and offset-less generated.at", async () => {
    const dateOnly = await build({
      "characters/hero.md": `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12 }\n---\n`,
    });
    expect(validateBundle(dateOnly).errors).toBe(1);

    const offsetLess = await build({
      "characters/hero.md": `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00 }\n---\n`,
    });
    expect(validateBundle(offsetLess).errors).toBe(1);
  });

  test("rejects date-only stale_after", async () => {
    const bundle = await build({
      "characters/hero.md": `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\norigin: source\nstale_after: 2026-09-12\nstatus: stable\n${GENERATED}\n---\n`,
    });
    const fields = validateBundle(bundle)
      .diagnostics.filter((entry) => entry.code === "profile/field-type")
      .map((entry) => entry.message);
    expect(fields).toContain("stale_after must be an ISO 8601 datetime with a UTC offset");
  });
});