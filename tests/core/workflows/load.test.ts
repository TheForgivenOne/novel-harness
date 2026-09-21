import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWorkflows } from "../../../src/workflows/load.ts";

async function workflowsRoot() {
  const root = await mkdtemp(join(tmpdir(), "novel-harness-load-"));
  await mkdir(join(root, ".novel", "workflows"), { recursive: true });
  return root;
}

describe("loadWorkflows", () => {
  test("returns the defaults when no workflow overrides exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "novel-harness-load-empty-"));
    const workflows = await loadWorkflows(root);
    expect(workflows.length).toBeGreaterThan(0);
    expect(workflows.some((w) => w.name === "draft")).toBe(true);
  });

  test("overrides a built-in workflow description, hint, and body", async () => {
    const root = await workflowsRoot();
    await writeFile(
      join(root, ".novel", "workflows", "draft.md"),
      `---\ndescription: Overridden description\nargument-hint: <scene id>\n---\n\nNew body.\n`,
      "utf8",
    );
    const workflows = await loadWorkflows(root);
    const draft = workflows.find((w) => w.name === "draft");
    expect(draft?.description).toBe("Overridden description");
    expect(draft?.argumentHint).toBe("<scene id>");
    expect(draft?.body).toBe("New body.");
  });

  test("keeps the built-in body when the override body is empty", async () => {
    const root = await workflowsRoot();
    await writeFile(
      join(root, ".novel", "workflows", "draft.md"),
      `---\ndescription: Overridden\n---\n\n   \n`,
      "utf8",
    );
    const workflows = await loadWorkflows(root);
    const draft = workflows.find((w) => w.name === "draft");
    expect(draft?.description).toBe("Overridden");
    expect(draft?.body.length).toBeGreaterThan(0);
  });

  test("adds a new workflow with a description", async () => {
    const root = await workflowsRoot();
    await writeFile(
      join(root, ".novel", "workflows", "beat-sheet.md"),
      `---\ndescription: Lay out the beats\n---\n\nBeat sheet body.\n`,
      "utf8",
    );
    const workflows = await loadWorkflows(root);
    const beat = workflows.find((w) => w.name === "beat-sheet");
    expect(beat?.description).toBe("Lay out the beats");
    expect(beat?.body).toBe("Beat sheet body.");
  });

  test("rejects a new workflow without a description", async () => {
    const root = await workflowsRoot();
    await writeFile(
      join(root, ".novel", "workflows", "beat-sheet.md"),
      `---\ntitle: something\n---\n\nBody.\n`,
      "utf8",
    );
    await expect(loadWorkflows(root)).rejects.toThrow("must set a description");
  });

  test("ignores non-markdown files in the workflow directory", async () => {
    const root = await workflowsRoot();
    await writeFile(join(root, ".novel", "workflows", "notes.txt"), "not a workflow", "utf8");
    const workflows = await loadWorkflows(root);
    expect(workflows.some((w) => w.name === "notes")).toBe(false);
  });

  test("skips malformed frontmatter files as errors", async () => {
    const root = await workflowsRoot();
    await writeFile(
      join(root, ".novel", "workflows", "broken.md"),
      `---\ndescription: [unterminated\n---\nBody.\n`,
      "utf8",
    );
    await expect(loadWorkflows(root)).rejects.toThrow();
  });
});