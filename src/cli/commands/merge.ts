import { mergeConcepts } from "../../core/ops/merge.ts";
import { flagBool, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdMerge(args: ParsedArgs, cwd: string): Promise<number> {
  const [primary, secondary] = args.positional;
  if (!primary || !secondary) {
    process.stderr.write("usage: novel merge <primary> <secondary> [--yes]\n");
    return 1;
  }

  const apply = flagBool(args, "yes");
  try {
    const project = await openProject(cwd);
    const plan = await mergeConcepts(project, primary, secondary, apply);

    if (!apply) {
      process.stdout.write(`Would merge /${plan.secondary} into /${plan.primary}\n`);
      process.stdout.write(`  aliases (${plan.aliases.length}): ${plan.aliases.join(", ") || "-"}\n`);
      process.stdout.write(`  tags (${plan.tags.length}): ${plan.tags.join(", ") || "-"}\n`);
      process.stdout.write(`  sources: ${plan.sources.length}\n`);
      process.stdout.write("Run again with --yes to apply.\n");
      return 0;
    }

    process.stdout.write(`Merged /${plan.secondary} into /${plan.primary}\n`);
    process.stdout.write(
      `aliases: ${plan.aliases.length}, tags: ${plan.tags.length}, sources: ${plan.sources.length}\n`,
    );
    process.stdout.write(`Primary: /${plan.primary}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
