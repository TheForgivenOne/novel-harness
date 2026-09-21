import { join } from "node:path";
import type { Bundle } from "../core/bundle/bundle.ts";
import { loadBundle } from "../core/bundle/bundle.ts";
import {
  bundleRoot,
  findProjectRoot,
  loadConfig,
  type ProjectConfig,
} from "../core/project/config.ts";

export interface ProjectContext {
  root: string;
  config: ProjectConfig;
  bundle: Bundle;
  bundlePath: string;
}

export async function openProject(cwd: string): Promise<ProjectContext> {
  const root = findProjectRoot(cwd);
  if (!root) {
    throw new Error("no novel project found here (run `novel init` first)");
  }
  const config = await loadConfig(root);
  const bundlePath = bundleRoot(root, config);
  const bundle = await loadBundle(bundlePath);
  return { root, config, bundle, bundlePath };
}
