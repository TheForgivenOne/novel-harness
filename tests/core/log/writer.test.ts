import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { appendLog, renderLogUpdate } from "../../../src/core/log/writer.ts";
import { makeBundle } from "../../helpers.ts";

const files = {
  "novel.md":
    "---\ntype: Novel\ntitle: T\ndescription: A test novel.\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "characters/elena.md":
    "---\ntype: Character\ntitle: Elena\nrole: protagonist\nfate: alive\nstatus: stable\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "characters/marcus.md":
    "---\ntype: Character\ntitle: Marcus\nrole: ally\nfate: alive\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
};

describe("log writing", () => {
  test("creates a log with the entry under today", () => {
    const updated = renderLogUpdate(undefined, {
      date: "2026-09-12",
      action: "Creation",
      message: "Added the bundle.",
    });
    expect(updated).toContain("# Directory Update Log");
    expect(updated).toContain("## 2026-09-12");
    expect(updated).toContain("* **Creation**: Added the bundle.");
  });

  test("puts newest dates first", () => {
    const first = renderLogUpdate(undefined, {
      date: "2026-09-12",
      action: "Creation",
      message: "First.",
    });
    const second = renderLogUpdate(first, {
      date: "2026-09-13",
      action: "Update",
      message: "Second.",
    });
    expect(second.indexOf("## 2026-09-13")).toBeLessThan(second.indexOf("## 2026-09-12"));
  });

  test("prepends entries within the same date", () => {
    const first = renderLogUpdate(undefined, {
      date: "2026-09-12",
      action: "Creation",
      message: "First.",
    });
    const second = renderLogUpdate(first, {
      date: "2026-09-12",
      action: "Update",
      message: "Second.",
    });
    expect(second.indexOf("* **Update**: Second.")).toBeLessThan(
      second.indexOf("* **Creation**: First."),
    );
  });

  test("appendLog writes the file", async () => {
    const root = await makeBundle(files);
    const bundle = await loadBundle(root);
    const rel = await appendLog(bundle, "characters", {
      date: "2026-09-12",
      action: "Creation",
      message: "Added Elena.",
    });
    expect(rel).toBe("characters/log.md");
    const reloaded = await loadBundle(root);
    expect(reloaded.logFiles.map((file) => file.path)).toContain("characters/log.md");
  });
});