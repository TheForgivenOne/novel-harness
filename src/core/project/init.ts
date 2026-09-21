import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { loadBundle } from "../bundle/bundle.ts";
import { ensureGenerated, serializeDocument } from "../bundle/frontmatter.ts";
import { renderEmptyIndex, regenerateIndexes } from "../index/generate.ts";
import { renderLogUpdate, today } from "../log/writer.ts";
import { TYPE_CATALOG } from "../schema/catalog.ts";
import { titleFromDir } from "../text/title.ts";
import { CONFIG_VERSION, DEFAULT_CONFIG, saveConfig, type ProjectConfig } from "./config.ts";
import { renderKnowledgeDoc, renderOutlineDoc, renderPlanDoc } from "./scaffold.ts";

export const CONCEPT_DIRS = [
  ...new Set(TYPE_CATALOG.filter((def) => !def.singleton).map((def) => def.home)),
];

export interface InitOptions {
  name?: string;
  author?: string;
  targets?: string[];
  fandom?: string;
  canonType?: string;
}

export interface InitResult {
  projectRoot: string;
  created: string[];
}

export async function initProject(target: string, options: InitOptions = {}): Promise<InitResult> {
  const projectRoot = resolve(target);
  if (existsSync(join(projectRoot, ".novel", "config.json")) || existsSync(join(projectRoot, "story"))) {
    throw new Error(`project already initialized: ${projectRoot}`);
  }

  const name = options.name?.trim() || titleFromDir(basename(projectRoot)) || "Untitled Novel";
  const author = options.author?.trim() || DEFAULT_CONFIG.author;
  const config: ProjectConfig = {
    version: CONFIG_VERSION,
    bundle: "story",
    targets: options.targets && options.targets.length > 0 ? options.targets : [...DEFAULT_CONFIG.targets],
    author,
    build: { ...DEFAULT_CONFIG.build },
  };

  const created: string[] = [];
  const bundlePath = join(projectRoot, config.bundle);

  await saveConfig(projectRoot, config);
  created.push(".novel/config.json");

  const gitignore = join(projectRoot, ".gitignore");
  if (!existsSync(gitignore)) {
    await writeFile(gitignore, "dist/\n", "utf8");
    created.push(".gitignore");
  }

  await mkdir(bundlePath, { recursive: true });

  const novelData: Record<string, unknown> = {
    type: "Novel",
    title: name,
    description: "One-line logline.",
    status: "draft",
    ...(options.fandom ? { fandom: options.fandom } : {}),
    ...(options.canonType ? { canon_type: options.canonType } : {}),
  };
  ensureGenerated(novelData, author);
  const novel = serializeDocument({
    data: novelData,
    body: "# Premise\n\nWho wants what, and what stands in the way.\n",
  });
  await writeFile(join(bundlePath, "novel.md"), novel, "utf8");
  created.push(`${config.bundle}/novel.md`);

  const now = new Date().toISOString();
  await writeFile(join(bundlePath, "plan.md"), renderPlanDoc(author, now), "utf8");
  created.push(`${config.bundle}/plan.md`);

  await writeFile(join(bundlePath, "knowledge.md"), renderKnowledgeDoc(author, now), "utf8");
  created.push(`${config.bundle}/knowledge.md`);

  await writeFile(join(bundlePath, "outline.md"), renderOutlineDoc(author, now), "utf8");
  created.push(`${config.bundle}/outline.md`);

  await writeFile(
    join(bundlePath, "log.md"),
    renderLogUpdate(undefined, {
      date: today(),
      action: "Initialization",
      message: `Created the bundle for **${name}**.`,
    }),
    "utf8",
  );
  created.push(`${config.bundle}/log.md`);

  for (const dir of CONCEPT_DIRS) {
    await mkdir(join(bundlePath, dir), { recursive: true });
    await writeFile(join(bundlePath, dir, "index.md"), renderEmptyIndex(dir), "utf8");
    created.push(`${config.bundle}/${dir}/index.md`);
  }

  const bundle = await loadBundle(bundlePath);
  await regenerateIndexes(bundle);
  created.push(`${config.bundle}/index.md`);

  return { projectRoot, created };
}
