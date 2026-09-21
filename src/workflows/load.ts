import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Workflow } from "../core/adapters/types.ts";
import { detectDocument } from "../core/bundle/frontmatter.ts";
import { defaultWorkflows } from "./index.ts";

export const WORKFLOW_DIR = ".novel/workflows";

export async function loadWorkflows(projectRoot: string): Promise<Workflow[]> {
  const workflows = defaultWorkflows();
  const dir = join(projectRoot, WORKFLOW_DIR);

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return workflows;
  }

  for (const entry of entries.sort()) {
    if (!entry.endsWith(".md")) continue;
    const name = entry.slice(0, -3);
    const raw = await readFile(join(dir, entry), "utf8");
    const doc = detectDocument(raw);
    const body = doc.body.trim();
    const description = doc.data.description;
    const hint = doc.data["argument-hint"];

    const existing = workflows.find((workflow) => workflow.name === name);
    if (existing) {
      if (typeof description === "string" && description.trim() !== "") {
        existing.description = description;
      }
      if (typeof hint === "string") existing.argumentHint = hint;
      if (body !== "") existing.body = body;
      continue;
    }

    if (typeof description !== "string" || description.trim() === "") {
      throw new Error(`${WORKFLOW_DIR}/${entry} must set a description in frontmatter`);
    }
    workflows.push({
      name,
      description,
      ...(typeof hint === "string" ? { argumentHint: hint } : {}),
      body,
    });
  }

  return workflows;
}
