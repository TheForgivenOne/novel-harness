import { relative, resolve } from "node:path";
import { exportBundle, UNSUPPORTED_EXPORT_FORMAT } from "../../core/export/export.ts";
import { flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdExport(args: ParsedArgs, cwd: string): Promise<number> {
  const format = flagString(args, "format") ?? "md";
  if (format !== "md" && format !== "html") {
    process.stderr.write(`error: ${UNSUPPORTED_EXPORT_FORMAT}\n`);
    return 1;
  }

  try {
    const project = await openProject(cwd);
    const out = flagString(args, "out") ?? project.config.build.out;
    const outDir = resolve(project.root, out);
    const path = await exportBundle(project.bundle, outDir, format);
    process.stdout.write(`Wrote ${relative(project.root, path)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
