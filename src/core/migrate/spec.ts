import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Bundle } from "../bundle/bundle.ts";
import { loadBundle } from "../bundle/bundle.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import { convertConcepts } from "../ops/convert.ts";
import { resolveConcept } from "../bundle/resolve.ts";
import type { OpsProject } from "../ops/link-rewrite.ts";
import { isRecord } from "../text/guards.ts";
import { mergeConcepts } from "../ops/merge.ts";
import { applyTagRules } from "../ops/tag-batch.ts";

export interface MigrationAction {
  action: string;
  from?: string;
  to?: string;
  file?: string;
  primary?: string;
  remove?: string;
  match?: Record<string, unknown>;
  add?: string[];
}

export interface MigrationStepResult {
  action: string;
  summary: string;
}

export interface MigrationReport {
  steps: MigrationStepResult[];
}

const KNOWN_ACTIONS = new Set(["convert", "merge", "tag"]);

function requiredString(
  record: Record<string, unknown>,
  key: string,
  index: number,
  action: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`migration action ${index + 1} (${action}) requires a non-empty \`${key}\``);
  }
  return value;
}

export async function loadMigrationSpec(specPath: string): Promise<MigrationAction[]> {
  let raw: string;
  try {
    raw = await readFile(specPath, "utf8");
  } catch (error) {
    throw new Error(`cannot read migration spec ${specPath}: ${(error as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new Error(`invalid migration spec YAML: ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("migration spec must be a YAML list of actions");
  }

  const actions: MigrationAction[] = [];
  for (let index = 0; index < parsed.length; index++) {
    const entry = parsed[index];
    if (!isRecord(entry)) {
      throw new Error(`migration action ${index + 1} must be a mapping`);
    }

    const action = entry.action;
    if (typeof action !== "string" || action.trim() === "") {
      throw new Error(`migration action ${index + 1} is missing an \`action\` field`);
    }
    if (!KNOWN_ACTIONS.has(action)) {
      throw new Error(`migration action ${index + 1} has unknown action ${JSON.stringify(action)}`);
    }

    if (action === "convert") {
      const from = requiredString(entry, "from", index, action);
      const to = requiredString(entry, "to", index, action);
      const file = entry.file;
      if (file !== undefined && (typeof file !== "string" || file.trim() === "")) {
        throw new Error(`migration action ${index + 1} (convert) has an invalid \`file\``);
      }
      actions.push({ action, from, to, file });
      continue;
    }

    if (action === "merge") {
      const primary = requiredString(entry, "primary", index, action);
      const remove = requiredString(entry, "remove", index, action);
      actions.push({ action, primary, remove });
      continue;
    }

    const match = entry.match;
    if (!isRecord(match)) {
      throw new Error(`migration action ${index + 1} (tag) requires a \`match\` mapping`);
    }
    const add = entry.add;
    if (!Array.isArray(add) || !add.every((tag): tag is string => typeof tag === "string")) {
      throw new Error(`migration action ${index + 1} (tag) requires an \`add\` list of strings`);
    }
    actions.push({ action, match, add });
  }

  return actions;
}

function resolveMigrationFile(bundle: Bundle, bundlePath: string, file: string): string {
  const direct = resolveConcept(bundle, file);
  if (direct) return direct.id;

  const cleaned = file.trim().replace(/^\/+/, "").replace(/\.md$/i, "");
  const segments = cleaned.split("/").filter((segment) => segment !== "");
  if (segments[0] === basename(bundlePath)) segments.shift();

  for (let index = 0; index < segments.length; index++) {
    const candidate = resolveConcept(bundle, segments.slice(index).join("/"));
    if (candidate) return candidate.id;
  }
  return file;
}

async function runAction(
  project: OpsProject,
  action: MigrationAction,
): Promise<MigrationStepResult> {
  if (action.action === "convert") {
    const file =
      action.file === undefined
        ? undefined
        : resolveMigrationFile(project.bundle, project.bundlePath, action.file);
    const result = await convertConcepts(project, action.from ?? "", action.to ?? "", { file });
    return {
      action: action.action,
      summary: `converted ${result.converted.length}, skipped ${result.skipped.length}`,
    };
  }

  if (action.action === "merge") {
    const primary = action.primary ?? "";
    const remove = action.remove ?? "";
    await mergeConcepts(project, primary, remove, true);
    return { action: action.action, summary: `merged ${remove} into ${primary}` };
  }

  const dir = await mkdtemp(join(tmpdir(), "novel-migrate-"));
  const tempPath = join(dir, "rules.yaml");
  try {
    const rules = [{ match: action.match ?? {}, add: action.add ?? [] }];
    await writeFile(tempPath, stringifyYaml(rules), "utf8");
    const result = await applyTagRules(project.bundle, tempPath);
    return { action: action.action, summary: `tagged ${result.changed.length} concept(s)` };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runMigrationSpec(
  bundlePath: string,
  author: string | undefined,
  specPath: string,
): Promise<MigrationReport> {
  const actions = await loadMigrationSpec(specPath);
  const steps: MigrationStepResult[] = [];

  for (let index = 0; index < actions.length; index++) {
    const action = actions[index];
    if (!action) continue;
    try {
      const bundle = await loadBundle(bundlePath);
      const project: OpsProject = { bundle, bundlePath, config: { author } };
      steps.push(await runAction(project, action));
    } catch (error) {
      throw new Error(
        `migration action ${index + 1} (${action.action}) failed: ${(error as Error).message}`,
      );
    }
  }

  const bundle = await loadBundle(bundlePath);
  await regenerateIndexes(bundle);
  await appendLog(bundle, "", {
    date: today(),
    action: "Migrate",
    message: `Applied migration spec with ${actions.length} action(s).`,
  });

  return { steps };
}
