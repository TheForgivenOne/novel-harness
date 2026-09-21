import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { validateBundle } from "../../../src/core/validate/index.ts";
import { makeBundle, validStoryDir } from "../../helpers.ts";

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

describe("valid fixture bundle", () => {
  test("passes with no errors or warnings", async () => {
    const result = validateBundle(await loadBundle(validStoryDir));
    if (result.errors > 0 || result.warnings > 0) {
      throw new Error(result.diagnostics.map((d) => `${d.severity} ${d.code} ${d.path}: ${d.message}`).join("\n"));
    }
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
  });
});

describe("continuity validation", () => {
  test("flags a POV character missing from cast", async () => {
    const codes = await codesFor(
      baseFiles({
        "chapters/ch-01/sc-01.md":
          "---\ntype: Scene\ntitle: S\nsequence: 1\npov: /characters/elena.md\ncast: []\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("continuity/pov-not-in-cast");
  });

  test("flags duplicate sequence values", async () => {
    const codes = await codesFor(
      baseFiles({
        "chapters/ch-01/sc-02.md":
          "---\ntype: Scene\ntitle: S2\nsequence: 1\npov: /characters/elena.md\ncast: [/characters/elena.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("continuity/duplicate-sequence");
  });

  test("warns when a dead character has no dies_in scene", async () => {
    const codes = await codesFor(
      baseFiles({
        "characters/elena.md":
          "---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: dead\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("continuity/unverifiable-death");
  });

  test("flags a dead character appearing after dies_in", async () => {
    const codes = await codesFor(
      baseFiles({
        "characters/elena.md":
          "---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: dead\ndies_in: /chapters/ch-01/sc-01.md\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
        "chapters/ch-01/sc-02.md":
          "---\ntype: Scene\ntitle: S2\nsequence: 2\npov: /characters/elena.md\ncast: [/characters/elena.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("continuity/dead-character");
  });

  test("warns on broken body links", async () => {
    const codes = await codesFor(
      baseFiles({
        "chapters/ch-01/sc-01.md":
          "---\ntype: Scene\ntitle: S\nsequence: 1\npov: /characters/elena.md\ncast: [/characters/elena.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nSee [nobody](/characters/nobody.md).\n",
      }),
    );
    expect(codes).toContain("continuity/broken-link");
  });

  test("warns when a canon scene references draft concepts", async () => {
    const codes = await codesFor(
      baseFiles({
        "characters/elena.md":
          "---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: alive\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
        "chapters/ch-01/sc-01.md":
          "---\ntype: Scene\ntitle: S\nsequence: 1\npov: /characters/elena.md\ncast: [/characters/elena.md]\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
      }),
    );
    expect(codes).toContain("continuity/stable-references-draft");
  });
});

describe("timeline order", () => {
  const event = (title: string, sequence: number, when: string) =>
    `---\ntype: Timeline Event\ntitle: ${title}\nsequence: ${sequence}\nwhen: ${when}\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n`;

  test("warns when sequence order disagrees with when", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/first.md": event("First", 1, "January 2011"),
        "timeline/second.md": event("Second", 2, "March 2010"),
      }),
    );
    expect(codes).toContain("profile/sequence-when");
  });

  test("accepts sequence order that matches when", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/first.md": event("First", 1, "March 2010"),
        "timeline/second.md": event("Second", 2, "January 2011"),
      }),
    );
    expect(codes).not.toContain("profile/sequence-when");
  });

  test("does not compare partial dates missing a shared component", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/first.md": event("First", 1, "2011"),
        "timeline/second.md": event("Second", 2, "March 2011"),
      }),
    );
    expect(codes).not.toContain("profile/sequence-when");
  });

  test("skips events without a sequence", async () => {
    const codes = await codesFor(
      baseFiles({
        "timeline/first.md":
          "---\ntype: Timeline Event\ntitle: First\nwhen: January 2011\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
        "timeline/second.md": event("Second", 2, "March 2010"),
      }),
    );
    expect(codes).not.toContain("profile/sequence-when");
  });

  test("attributes the warning to the later event", async () => {
    const result = await validateFiles(
      baseFiles({
        "timeline/first.md": event("First", 1, "January 2011"),
        "timeline/second.md": event("Second", 2, "March 2010"),
      }),
    );
    const warning = result.diagnostics.find((d) => d.code === "profile/sequence-when");
    expect(warning?.severity).toBe("warning");
    expect(warning?.path).toBe("timeline/second.md");
  });
});