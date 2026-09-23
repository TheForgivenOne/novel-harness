import { findProjectRoot, loadConfig } from "../../core/project/config.ts";
import { fixProject } from "../../core/project/doctor.ts";
import type { ParsedArgs } from "../args.ts";

export async function cmdUpdate(_args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const root = findProjectRoot(cwd);
    if (!root) {
      throw new Error("no novel project found here (run `novel init` first)");
    }

    const config = await loadConfig(root);
    const applied = await fixProject(root, config);
    if (applied.length === 0) {
      process.stdout.write("project is up to date\n");
      return 0;
    }

    for (const line of applied) {
      process.stdout.write(`updated: ${line}\n`);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
