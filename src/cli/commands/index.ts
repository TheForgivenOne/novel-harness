import { regenerateIndexes } from "../../core/index/generate.ts";
import type { ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdIndex(_args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const project = await openProject(cwd);
    const changes = await regenerateIndexes(project.bundle);
    const changed = changes.filter((change) => change.changed);
    for (const change of changed) {
      process.stdout.write(`updated ${change.path}\n`);
    }
    process.stdout.write(
      `${changed.length} index file(s) updated, ${changes.length - changed.length} unchanged\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
