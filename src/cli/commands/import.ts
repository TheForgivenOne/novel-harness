import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { importConcepts, parseImport } from "../../core/project/import.ts";
import { flagBool, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdImport(args: ParsedArgs, cwd: string): Promise<number> {
  const [file] = args.positional;
  if (file === undefined) {
    process.stderr.write("error: usage: novel import <file.csv|file.yaml> [--dry-run]\n");
    return 1;
  }

  try {
    const project = await openProject(cwd);
    const path = resolve(cwd, file);
    const source = await readFile(path, "utf8");
    const rows = parseImport(source, path);
    const dryRun = flagBool(args, "dry-run");
    const result = await importConcepts(
      { bundle: project.bundle, bundlePath: project.bundlePath, author: project.config.author },
      rows,
      { dryRun, source: file },
    );
    for (const skipped of result.skipped) {
      process.stderr.write(`skip row ${skipped.row}: ${skipped.path} (${skipped.reason})\n`);
    }
    process.stdout.write(`${dryRun ? "would create" : "created"} ${result.created.length} concept(s)\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
