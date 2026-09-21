import {
  parseRenumberGroups,
  parseRenumberSort,
  renumberSequences,
} from "../../core/ops/renumber.ts";
import { flagBool, flagNumber, flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdRenumber(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const groups = parseRenumberGroups(flagString(args, "type"));
    const sort = parseRenumberSort(flagString(args, "sort"));
    const dryRun = flagBool(args, "dry-run");
    const project = await openProject(cwd);
    const result = await renumberSequences(project, {
      groups,
      start: flagNumber(args, "start"),
      step: flagNumber(args, "step"),
      sort,
      dryRun,
    });

    const prefix = dryRun ? "would renumber" : "renumbered";
    for (const change of result.changes) {
      const from = change.from === undefined ? "—" : String(change.from);
      process.stdout.write(`${prefix} ${change.path}: ${from} → ${change.to}\n`);
    }
    process.stdout.write(
      `${prefix} ${result.changes.length} concept(s) ` +
        `(chapters ${result.groups.chapter}, scenes ${result.groups.scene}, timeline ${result.groups.timeline})\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
