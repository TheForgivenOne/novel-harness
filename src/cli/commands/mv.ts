import { moveConcept } from "../../core/ops/move.ts";
import { flagBool, flagNumber, flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdMv(args: ParsedArgs, cwd: string): Promise<number> {
  const [conceptName] = args.positional;
  const to = flagString(args, "to");
  if (conceptName === undefined || to === undefined) {
    process.stderr.write("error: usage: novel mv <scene> --to <chapter> [--sequence N] [--dry-run]\n");
    return 1;
  }

  const dryRun = flagBool(args, "dry-run");
  try {
    const project = await openProject(cwd);
    const result = await moveConcept(project, conceptName, {
      to,
      sequence: flagNumber(args, "sequence"),
      dryRun,
    });
    const rewrites = result.rewritten.length > 0 ? ` (${result.rewritten.length} link rewrite(s))` : "";
    process.stdout.write(`${dryRun ? "would move" : "moved"} ${result.from} -> ${result.to}${rewrites}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
