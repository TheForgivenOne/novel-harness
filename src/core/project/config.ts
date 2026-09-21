import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const CONFIG_VERSION = 1;

export interface ProjectConfig {
  /** Config schema version; a missing version means a legacy project. */
  version: number;
  /** Bundle directory, relative to the project root. */
  bundle: string;
  /** Enabled adapter targets. */
  targets: string[];
  /** Default actor for generated concepts, for example `human:dondre`. */
  author: string;
  build: {
    out: string;
    format: string;
  };
}

export const DEFAULT_CONFIG: ProjectConfig = {
  version: CONFIG_VERSION,
  bundle: "story",
  targets: ["agents-md", "claude", "opencode", "gemini"],
  author: "human:author",
  build: { out: "dist", format: "markdown" },
};

export const CONFIG_PATH = ".novel/config.json";

export function findProjectRoot(start: string): string | undefined {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, CONFIG_PATH)) || existsSync(join(dir, "story"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export async function loadConfig(projectRoot: string): Promise<ProjectConfig> {
  const raw = await readFile(join(projectRoot, CONFIG_PATH), "utf8").catch(() => undefined);
  if (!raw) return structuredClone(DEFAULT_CONFIG);

  let parsed: Partial<ProjectConfig>;
  try {
    parsed = JSON.parse(raw) as Partial<ProjectConfig>;
  } catch (error) {
    throw new Error(`invalid ${CONFIG_PATH}: ${(error as Error).message}`);
  }

  return {
    version: typeof parsed.version === "number" ? parsed.version : 0,
    bundle: typeof parsed.bundle === "string" ? parsed.bundle : DEFAULT_CONFIG.bundle,
    targets: Array.isArray(parsed.targets) ? parsed.targets : [...DEFAULT_CONFIG.targets],
    author: typeof parsed.author === "string" ? parsed.author : DEFAULT_CONFIG.author,
    build: {
      out: parsed.build?.out ?? DEFAULT_CONFIG.build.out,
      format: parsed.build?.format ?? DEFAULT_CONFIG.build.format,
    },
  };
}

export async function saveConfig(projectRoot: string, config: ProjectConfig): Promise<string> {
  const path = join(projectRoot, CONFIG_PATH);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return path;
}

export function bundleRoot(projectRoot: string, config: ProjectConfig): string {
  return join(projectRoot, config.bundle);
}
