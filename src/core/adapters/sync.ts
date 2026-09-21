import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProjectConfig } from "../project/config.ts";
import { getAdapter } from "./index.ts";
import { artifactKit } from "./kit/index.ts";
import { pruneEmptyDirsMany } from "../ops/prune.ts";
import { isRecord } from "../text/guards.ts";
import type { Adapter, AdapterInput, Workflow } from "./types.ts";

export interface ManifestEntry {
  hash: string;
  adapter: string;
}

export interface Manifest {
  generated: Record<string, ManifestEntry>;
}

export const MANIFEST_PATH = ".novel/manifest.json";

export interface SyncInput {
  workflows: Workflow[];
  instructions: string;
}

export interface SyncOptions {
  /** Compute the result without writing files or the manifest. */
  dryRun?: boolean;
}

export interface SyncResult {
  written: string[];
  updated: string[];
  unchanged: string[];
  removed: string[];
  conflicts: string[];
  unknownTargets: string[];
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function readManifest(path: string): Promise<Record<string, unknown>> {
  const raw = await readFile(path, "utf8").catch(() => undefined);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function syncAdapters(
  projectRoot: string,
  config: ProjectConfig,
  input: SyncInput,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const dryRun = options.dryRun === true;
  const result: SyncResult = {
    written: [],
    updated: [],
    unchanged: [],
    removed: [],
    conflicts: [],
    unknownTargets: [],
  };

  const rawManifest = await readManifest(join(projectRoot, MANIFEST_PATH));
  const manifest: Manifest = {
    generated: isRecord(rawManifest.generated)
      ? (rawManifest.generated as Record<string, ManifestEntry>)
      : {},
  };
  const adapters: Adapter[] = [];
  for (const target of config.targets) {
    const adapter = getAdapter(target);
    if (adapter) adapters.push(adapter);
    else result.unknownTargets.push(target);
  }

  const rendered = new Map<string, { content: string; adapter: string }>();
  const fullInput: AdapterInput = { ...input, ...artifactKit() };
  for (const adapter of adapters) {
    for (const file of adapter.render(fullInput)) {
      const existing = rendered.get(file.path);
      if (existing && existing.content !== file.content) {
        throw new Error(
          `adapter conflict for ${file.path}: ${existing.adapter} and ${adapter.id} disagree`,
        );
      }
      rendered.set(file.path, { content: file.content, adapter: adapter.id });
    }
  }

  for (const [path, file] of rendered) {
    const abs = join(projectRoot, path);
    const exists = existsSync(abs);
    const disk = exists ? await readFile(abs, "utf8") : undefined;
    const tracked = manifest.generated[path];

    if (disk === file.content) {
      result.unchanged.push(path);
      manifest.generated[path] = { hash: hash(file.content), adapter: file.adapter };
      continue;
    }

    if (disk !== undefined && (!tracked || tracked.hash !== hash(disk))) {
      result.conflicts.push(path);
      continue;
    }

    if (!dryRun) {
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, file.content, "utf8");
    }
    if (exists) result.updated.push(path);
    else result.written.push(path);
    manifest.generated[path] = { hash: hash(file.content), adapter: file.adapter };
  }

  for (const path of Object.keys(manifest.generated)) {
    if (rendered.has(path)) continue;
    const abs = join(projectRoot, path);
    const disk = await readFile(abs, "utf8").catch(() => undefined);
    const tracked = manifest.generated[path];
    if (disk === undefined) {
      delete manifest.generated[path];
      continue;
    }
    if (!tracked || hash(disk) !== tracked.hash) {
      result.conflicts.push(path);
      continue;
    }
    if (!dryRun) await rm(abs);
    result.removed.push(path);
    delete manifest.generated[path];
  }

  if (!dryRun) {
    const manifestPath = join(projectRoot, MANIFEST_PATH);
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await pruneEmptyDirsMany(projectRoot, result.removed);
  }

  result.written.sort();
  result.updated.sort();
  result.unchanged.sort();
  result.removed.sort();
  result.conflicts.sort();
  return result;
}
