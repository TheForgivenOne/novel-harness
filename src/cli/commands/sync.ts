import { syncAdapters } from "../../core/adapters/sync.ts";
import { INSTRUCTIONS } from "../../workflows/index.ts";
import { loadWorkflows } from "../../workflows/load.ts";
import type { ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdSync(_args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const project = await openProject(cwd);
    const workflows = await loadWorkflows(project.root);
    const result = await syncAdapters(project.root, project.config, {
      workflows,
      instructions: INSTRUCTIONS,
    });

    for (const path of result.written) process.stdout.write(`wrote ${path}\n`);
    for (const path of result.updated) process.stdout.write(`updated ${path}\n`);
    for (const path of result.removed) process.stdout.write(`removed ${path}\n`);
    for (const target of result.unknownTargets) {
      process.stderr.write(`warning: unknown adapter target "${target}"\n`);
    }
    for (const path of result.conflicts) {
      process.stderr.write(`conflict: ${path} was edited by hand; left untouched\n`);
    }

    process.stdout.write(
      `${result.written.length} written, ${result.updated.length} updated, ` +
        `${result.unchanged.length} unchanged, ${result.removed.length} removed\n`,
    );
    return result.conflicts.length > 0 ? 1 : 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
