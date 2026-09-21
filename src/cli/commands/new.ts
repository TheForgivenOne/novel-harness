import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadBundle } from "../../core/bundle/bundle.ts";
import { getType } from "../../core/bundle/concept.ts";
import { detectDocument } from "../../core/bundle/frontmatter.ts";
import { regenerateIndexes, renderEmptyIndex } from "../../core/index/generate.ts";
import { appendLog, today } from "../../core/log/writer.ts";
import {
  newConceptDraft,
  type NewConceptOptions,
} from "../../core/project/new-concept.ts";
import { applySourceWork } from "../../core/project/source-work.ts";
import { renderChapterOutlineDoc } from "../../core/project/scaffold.ts";
import { formatTypeCatalog, getTypeDefBySlug } from "../../core/schema/catalog.ts";
import { flagBool, flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

async function loadTemplate(
  projectRoot: string,
  name: string | undefined,
  type: string,
): Promise<NewConceptOptions["template"]> {
  if (name === undefined) return undefined;

  const templatesDir = join(projectRoot, ".novel", "templates");
  const raw = await readFile(join(templatesDir, `${name}.md`), "utf8").catch(() => undefined);
  if (raw === undefined) {
    const entries = await readdir(templatesDir).catch(() => [] as string[]);
    const available = entries
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => entry.slice(0, -3))
      .sort();
    throw new Error(
      available.length === 0
        ? `template "${name}" not found; no templates found`
        : `template "${name}" not found; available templates: ${available.join(", ")}`,
    );
  }

  const detected = detectDocument(raw);
  const templateType = detected.data.type;
  if (
    typeof templateType === "string" &&
    templateType.trim() !== "" &&
    templateType !== type
  ) {
    throw new Error(`template "${name}" is for type ${templateType}, not ${type}`);
  }
  return { data: detected.data, body: detected.body };
}

export async function cmdNew(args: ParsedArgs, cwd: string): Promise<number> {
  const [typeArg, name] = args.positional;
  if (!typeArg) {
    process.stderr.write(`error: missing concept type\n\n${formatTypeCatalog()}\n`);
    return 1;
  }

  const def = getTypeDefBySlug(typeArg);
  if (!def) {
    process.stderr.write(`error: unknown concept type "${typeArg}"\n\n${formatTypeCatalog()}\n`);
    return 1;
  }

  try {
    const project = await openProject(cwd);
    const template = await loadTemplate(project.root, flagString(args, "from-template"), def.type);
    const draft = newConceptDraft(project.bundle, def, {
      name,
      author: project.config.author,
      pov: flagString(args, "pov"),
      chapter: flagString(args, "chapter"),
      category: flagString(args, "category"),
      when: flagString(args, "when"),
      resource: flagString(args, "resource"),
      role: flagString(args, "role"),
      kind: flagString(args, "kind"),
      characters: flagString(args, "characters"),
      cast: flagString(args, "cast"),
      location: flagString(args, "location"),
      origin: flagString(args, "origin"),
      divergesAt: flagString(args, "diverges-at"),
      fandom: flagString(args, "fandom"),
      canonType: flagString(args, "canon-type"),
      sourceWorks: flagString(args, "source-works"),
      tags: flagString(args, "tags"),
      divergence: flagString(args, "divergence"),
      template,
    });

    const abs = join(project.bundlePath, draft.path);
    if (existsSync(abs)) {
      process.stderr.write(`error: concept already exists: ${draft.path}\n`);
      return 1;
    }

    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, draft.content, "utf8");

    if (def.type === "Chapter") {
      const chapterDir = draft.path.replace(/\.md$/, "");
      const chapterTitle =
        typeof draft.data.title === "string" ? draft.data.title : (name ?? chapterDir);
      await mkdir(join(project.bundlePath, chapterDir, "scenes"), { recursive: true });
      await writeFile(
        join(project.bundlePath, chapterDir, "outline.md"),
        renderChapterOutlineDoc(project.config.author, new Date().toISOString(), chapterTitle),
        "utf8",
      );
      await writeFile(
        join(project.bundlePath, chapterDir, "scenes", "index.md"),
        renderEmptyIndex("scenes"),
        "utf8",
      );
    }

    if (flagBool(args, "source-work")) {
      if (def.type !== "Reference") {
        throw new Error("--source-work only applies to `novel new reference`");
      }
      const novel = project.bundle.concepts.find((concept) => getType(concept) === "Novel");
      if (!novel) throw new Error("no novel.md found; cannot attach the source work");
      await writeFile(novel.absPath, applySourceWork(novel, `/${draft.path}`), "utf8");
    }

    const fresh = await loadBundle(project.bundlePath);
    const title = typeof draft.data.title === "string" ? draft.data.title : draft.path;
    await appendLog(fresh, "", {
      date: today(),
      action: "Creation",
      message: `Added [${title}](/${draft.path}).`,
    });
    await regenerateIndexes(fresh);

    process.stdout.write(`Created ${draft.path}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
