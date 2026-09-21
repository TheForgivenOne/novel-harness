import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { INSTRUCTIONS } from "../../workflows/index.ts";
import { loadWorkflows } from "../../workflows/load.ts";
import { syncAdapters } from "../adapters/sync.ts";
import { loadBundle } from "../bundle/bundle.ts";
import { getTitle, getType } from "../bundle/concept.ts";
import {
  regenerateIndexes,
  renderEmptyIndex,
  staleIndexPaths,
} from "../index/generate.ts";
import { TYPE_CATALOG } from "../schema/catalog.ts";
import { validateBundle } from "../validate/index.ts";
import {
  CONFIG_VERSION,
  bundleRoot,
  loadConfig,
  saveConfig,
  type ProjectConfig,
} from "./config.ts";
import { renderChapterOutlineDoc } from "./scaffold.ts";

export interface DoctorIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  fixable: boolean;
}

export interface DoctorReport {
  issues: DoctorIssue[];
  /** Content diagnostics grouped by code. */
  content: Record<string, number>;
  suggestions: string[];
}

const MIGRATION_CODES = new Set([
  "profile/orphan-chapter",
  "profile/missing-tags",
  "profile/duplicate-concept",
  "profile/unknown-type",
  "fanfic/unverifiable-source",
  "fanfic/unresolved-source",
  "fanfic/source-work-not-reference",
]);

export async function checkProject(
  projectRoot: string,
  config?: ProjectConfig,
): Promise<DoctorReport> {
  const cfg = config ?? (await loadConfig(projectRoot));
  const issues: DoctorIssue[] = [];
  const suggestions: string[] = [];

  if (cfg.version !== CONFIG_VERSION) {
    issues.push({
      code: "config/version",
      severity: "warning",
      message: `config version ${cfg.version} is not current (${CONFIG_VERSION})`,
      fixable: true,
    });
  }

  const bundlePath = bundleRoot(projectRoot, cfg);
  for (const def of TYPE_CATALOG) {
    if (def.singleton) continue;
    if (!existsSync(join(bundlePath, def.home))) {
      issues.push({
        code: "structure/missing-dir",
        severity: "warning",
        message: `missing bundle directory ${cfg.bundle}/${def.home}/`,
        fixable: true,
      });
    }
  }

  let workflows;
  try {
    workflows = await loadWorkflows(projectRoot);
  } catch (error) {
    issues.push({
      code: "config/workflows",
      severity: "error",
      message: `workflow override problem: ${(error as Error).message}`,
      fixable: false,
    });
  }

  if (workflows && cfg.targets.length > 0) {
    const sync = await syncAdapters(
      projectRoot,
      cfg,
      { workflows, instructions: INSTRUCTIONS },
      { dryRun: true },
    );
    const stale = sync.written.length + sync.updated.length;
    if (stale > 0) {
      issues.push({
        code: "adapters/stale",
        severity: "warning",
        message: `${stale} adapter file(s) missing or outdated`,
        fixable: true,
      });
    }
    for (const path of sync.conflicts) {
      issues.push({
        code: "adapters/conflict",
        severity: "warning",
        message: `${path} was edited by hand; sync will not clobber it`,
        fixable: false,
      });
    }
    for (const target of sync.unknownTargets) {
      issues.push({
        code: "config/target",
        severity: "warning",
        message: `unknown adapter target ${JSON.stringify(target)}`,
        fixable: false,
      });
    }
  }

  const bundle = await loadBundle(bundlePath);
  for (const rel of staleIndexPaths(bundle)) {
    issues.push({
      code: "index/drift",
      severity: "warning",
      message: `${rel} is missing or out of date`,
      fixable: true,
    });
  }

  for (const chapter of bundle.concepts.filter((concept) => getType(concept) === "Chapter")) {
    if (!existsSync(join(bundlePath, `${chapter.id}/outline.md`))) {
      issues.push({
        code: "structure/missing-outline",
        severity: "warning",
        message: `${chapter.id} has no chapters/<slug>/outline.md`,
        fixable: true,
      });
    }
  }

  const result = validateBundle(bundle);
  const content: Record<string, number> = {};
  for (const diagnostic of result.diagnostics) {
    content[diagnostic.code] = (content[diagnostic.code] ?? 0) + 1;
  }
  if (Object.keys(content).some((code) => MIGRATION_CODES.has(code))) {
    const stale = issues.some((issue) => issue.code === "adapters/stale");
    suggestions.push(
      stale
        ? "Run `novel migrate` (or `novel doctor --fix`) to update the project and render /migrate, then run /migrate in your agent."
        : "Run /migrate in your agent to fix the content issues.",
    );
  }

  return { issues, content, suggestions };
}

export async function fixProject(projectRoot: string, config: ProjectConfig): Promise<string[]> {
  const applied: string[] = [];

  const cfg = { ...config, build: { ...config.build } };
  if (cfg.version !== CONFIG_VERSION) {
    cfg.version = CONFIG_VERSION;
    await saveConfig(projectRoot, cfg);
    applied.push(`config version → ${CONFIG_VERSION}`);
  }

  const bundlePath = bundleRoot(projectRoot, cfg);
  for (const def of TYPE_CATALOG) {
    if (def.singleton) continue;
    const dir = join(bundlePath, def.home);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "index.md"), renderEmptyIndex(def.home), "utf8");
      applied.push(`created ${cfg.bundle}/${def.home}/`);
    }
  }

  const bundle = await loadBundle(bundlePath);

  const author = cfg.author ?? "human:author";
  const now = new Date().toISOString();
  for (const chapter of bundle.concepts.filter((concept) => getType(concept) === "Chapter")) {
    const outlinePath = join(bundlePath, `${chapter.id}/outline.md`);
    if (!existsSync(outlinePath)) {
      await mkdir(join(bundlePath, chapter.id), { recursive: true });
      await writeFile(
        outlinePath,
        renderChapterOutlineDoc(author, now, getTitle(chapter)),
        "utf8",
      );
      applied.push(`created ${cfg.bundle}/${chapter.id}/outline.md`);
    }
  }

  const changes = await regenerateIndexes(bundle);
  const changed = changes.filter((change) => change.changed).length;
  if (changed > 0) applied.push(`regenerated ${changed} index file(s)`);

  if (cfg.targets.length > 0) {
    const workflows = await loadWorkflows(projectRoot);
    const sync = await syncAdapters(projectRoot, cfg, {
      workflows,
      instructions: INSTRUCTIONS,
    });
    const touched = sync.written.length + sync.updated.length + sync.removed.length;
    if (touched > 0) {
      applied.push(
        `synced adapters (${sync.written.length} written, ${sync.updated.length} updated, ${sync.removed.length} removed)`,
      );
    }
  }

  return applied;
}
