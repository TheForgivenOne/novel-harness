import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { applyValidateFixes } from "../../../src/core/validate/fix.ts";
import { makeBundle } from "../../helpers.ts";

function novelFile(): string {
  return "---\ntype: Novel\ntitle: Test\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n";
}

describe("applyValidateFixes", () => {
  test("strips quoted sources and sets origin on added timeline events", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "timeline/first-meeting.md": [
        "---",
        "type: Timeline Event",
        "title: First Meeting",
        "sequence: 1",
        "when: '2005'",
        "divergence: added",
        "status: draft",
        "generated: { by: human:a, at: 2026-09-12T00:00:00Z }",
        "---",
        "",
      ].join("\n"),
      "references/quoted.md":
        "---\ntype: Reference\ntitle: Quoted\nresource: https://example.com/q\nsources:\n  - resource: '\"https://quoted\"'\n---\n",
    });
    const bundle = await loadBundle(root);

    const fixes = await applyValidateFixes(bundle);

    expect(fixes.map((fix) => fix.code).sort()).toEqual([
      "profile/added-origin",
      "profile/sources-quoted",
    ]);
    expect(fixes.find((fix) => fix.code === "profile/added-origin")?.path).toBe(
      "timeline/first-meeting.md",
    );
    expect(fixes.find((fix) => fix.code === "profile/sources-quoted")?.path).toBe(
      "references/quoted.md",
    );

    const event = await readFile(join(root, "timeline/first-meeting.md"), "utf8");
    expect(event).toContain("origin: fanon");

    const reference = await readFile(join(root, "references/quoted.md"), "utf8");
    expect(reference).not.toContain('"https://quoted"');
    expect(reference).toContain("resource: https://quoted");
  });

  test("leaves an added event that already has an origin untouched", async () => {
    const root = await makeBundle({
      "novel.md": novelFile(),
      "timeline/first-meeting.md": [
        "---",
        "type: Timeline Event",
        "title: First Meeting",
        "sequence: 1",
        "when: '2005'",
        "divergence: added",
        "origin: source",
        "status: draft",
        "generated: { by: human:a, at: 2026-09-12T00:00:00Z }",
        "---",
        "",
      ].join("\n"),
    });
    const bundle = await loadBundle(root);

    const fixes = await applyValidateFixes(bundle);

    expect(fixes).toEqual([]);
    const event = await readFile(join(root, "timeline/first-meeting.md"), "utf8");
    expect(event).toContain("origin: source");
  });
});