import { removeConcept } from "../../core/ops/remove.ts";
import { flagBool, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdRm(args: ParsedArgs, cwd: string): Promise<number> {
  const [conceptName] = args.positional;
  if (conceptName === undefined) {
    process.stderr.write("error: usage: novel rm <concept> [--force] [--dry-run]\n");
    return 1;
  }

  const dryRun = flagBool(args, "dry-run");
  try {
    const project = await openProject(cwd);
    const result = await removeConcept(project, conceptName, {
      force: flagBool(args, "force"),
      dryRun,
    });
    for (const link of result.inbound) {
      process.stderr.write(`warning: ${link.path} links to the removed concept (${link.source})\n`);
    }
    process.stdout.write(`${dryRun ? "would remove" : "removed"} ${result.path}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
