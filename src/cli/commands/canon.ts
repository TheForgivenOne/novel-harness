import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { readManifest } from "../../core/adapters/sync.ts";
import { loadBundle } from "../../core/bundle/bundle.ts";
import { getType } from "../../core/bundle/concept.ts";
import { exportPack, importPack, readPackMeta } from "../../core/canon/pack.ts";
import { regenerateIndexes } from "../../core/index/generate.ts";
import { applyNovelMeta } from "../../core/project/source-work.ts";
import { slugify } from "../../core/text/slug.ts";
import { isRecord } from "../../core/text/guards.ts";
import { flagBool, flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

const USAGE = `Usage: novel canon <subcommand> [args]

Subcommands:
  export [--out <dir>]    Export origin: source concepts + references as a pack
  import <dir> [--force]  Import a canon pack into story/

Options:
  --force                 Overwrite local source concepts that conflict
`;

const CANON_MANIFEST = ".novel/canon.json";

interface CanonManifest {
  packs: Record<
    string,
    { path: string; name: string; importedAt: string; concepts: number }
  >;
}

async function readCanonManifest(projectRoot: string): Promise<CanonManifest> {
  const raw = await readManifest(join(projectRoot, CANON_MANIFEST));
  return {
    packs: isRecord(raw.packs) ? (raw.packs as CanonManifest["packs"]) : {},
  };
}

export async function cmdCanon(args: ParsedArgs, cwd: string): Promise<number> {
  const [sub, ...rest] = args.positional;
  if (!sub) {
    process.stderr.write(USAGE);
    return 1;
  }

  try {
    const project = await openProject(cwd);

    if (sub === "export") {
      const novel = project.bundle.concepts.find((concept) => getType(concept) === "Novel");
      const fandom = novel?.frontmatter.fandom;
      const fallback = typeof fandom === "string" ? slugify(fandom, "canon") : "canon";
      const out = flagString(args, "out") ?? join(project.root, "canon", fallback);

      const { meta, files } = await exportPack(project.bundle, out);
      process.stdout.write(`Exported ${files.length} concept(s) to ${out}\n`);
      process.stdout.write(
        `  pack: ${meta.name}${meta.fandom ? ` (fandom: ${meta.fandom})` : ""}\n`,
      );
      return 0;
    }

    if (sub === "import") {
      const dir = rest[0];
      if (!dir) throw new Error("usage: novel canon import <dir> [--force]");
      const packDir = resolve(cwd, dir);
      const meta = await readPackMeta(packDir);

      const result = await importPack(project.bundlePath, packDir, {
        force: flagBool(args, "force"),
      });

      const fresh = await loadBundle(project.bundlePath);
      const novel = fresh.concepts.find((concept) => getType(concept) === "Novel");
      let attached: string[] = [];
      if (novel) {
        const available = new Set(fresh.concepts.map((concept) => `/${concept.path}`));
        const works = meta.source_works.filter((link) => available.has(link));
        attached = works;
        await writeFile(
          novel.absPath,
          applyNovelMeta(novel, { sourceWorks: works, fandom: meta.fandom }),
          "utf8",
        );
      }
      await regenerateIndexes(await loadBundle(project.bundlePath));

      const manifest = await readCanonManifest(project.root);
      manifest.packs[meta.name] = {
        path: packDir,
        name: meta.name,
        importedAt: new Date().toISOString(),
        concepts: meta.concepts,
      };
      const manifestPath = join(project.root, CANON_MANIFEST);
      await mkdir(dirname(manifestPath), { recursive: true });
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

      process.stdout.write(
        `Imported "${meta.name}": ${result.added.length} added, ${result.updated.length} updated, ` +
          `${result.unchanged.length} unchanged, ${result.keptLocal.length} kept local, ` +
          `${result.conflicts.length} conflict(s)\n`,
      );
      if (attached.length > 0) {
        process.stdout.write(`attached source works: ${attached.join(", ")}\n`);
      }
      for (const kept of result.keptLocal) process.stdout.write(`kept local: ${kept}\n`);
      for (const conflict of result.conflicts) {
        process.stderr.write(`conflict: ${conflict} (use --force to overwrite)\n`);
      }
      return result.conflicts.length > 0 ? 1 : 0;
    }

    process.stderr.write(`Unknown canon subcommand: ${sub}\n\n${USAGE}`);
    return 1;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
