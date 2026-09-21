import { relative } from "node:path";
import { writeManuscript } from "../../core/build/manuscript.ts";
import { flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdBuild(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const project = await openProject(cwd);
    const out = flagString(args, "out") ?? project.config.build.out;
    const outDir = out.startsWith("/") ? out : `${project.root}/${out}`;
    const path = await writeManuscript(project.bundle, outDir);
    process.stdout.write(`Wrote ${relative(project.root, path)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
