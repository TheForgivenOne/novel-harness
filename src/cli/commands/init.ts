import { syncAdapters } from "../../core/adapters/sync.ts";
import { loadConfig } from "../../core/project/config.ts";
import { initProject } from "../../core/project/init.ts";
import { splitList } from "../../core/text/guards.ts";
import { INSTRUCTIONS } from "../../workflows/index.ts";
import { loadWorkflows } from "../../workflows/load.ts";
import { flagString, type ParsedArgs } from "../args.ts";

export async function cmdInit(args: ParsedArgs, cwd: string): Promise<number> {
  const target = args.positional[0] ?? cwd;
  const rawTargets = flagString(args, "targets");
  const targets = rawTargets === undefined ? undefined : splitList(rawTargets);

  try {
    const result = await initProject(target, {
      name: flagString(args, "name"),
      author: flagString(args, "author"),
      targets,
      fandom: flagString(args, "fandom"),
      canonType: flagString(args, "canon-type"),
    });

    process.stdout.write(`Initialized novel project at ${result.projectRoot}\n`);
    for (const file of result.created) {
      process.stdout.write(`  ${file}\n`);
    }

    const config = await loadConfig(result.projectRoot);
    if (config.targets.length > 0) {
      const workflows = await loadWorkflows(result.projectRoot);
      const sync = await syncAdapters(result.projectRoot, config, {
        workflows,
        instructions: INSTRUCTIONS,
      });
      process.stdout.write(`Rendered ${sync.written.length} adapter file(s).\n`);
    }

    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
