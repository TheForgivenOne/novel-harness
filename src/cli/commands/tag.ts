import { resolve } from "node:path";
import { applyTagRules } from "../../core/ops/tag-batch.ts";
import { flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

const USAGE = `Usage: novel tag --batch <rules.yaml>

Options:
  --batch <file>    Apply YAML tagging rules ({ match, add }) to the story bundle
`;

export async function cmdTag(args: ParsedArgs, cwd: string): Promise<number> {
  const batch = flagString(args, "batch");
  if (!batch) {
    process.stderr.write(USAGE);
    return 1;
  }

  try {
    const project = await openProject(cwd);
    const result = await applyTagRules(project.bundle, resolve(cwd, batch));

    for (const change of result.changed) {
      const added = change.added.map((tag) => `+${tag}`).join(", ");
      process.stdout.write(`${change.path}: ${added}\n`);
    }
    process.stdout.write(
      `Tagged ${result.changed.length} concept(s) via ${result.rules} rule(s); ` +
        `${result.unchanged.length} unchanged.\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
