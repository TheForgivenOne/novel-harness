import { findProjectRoot, loadConfig } from "../../core/project/config.ts";
import { checkProject, fixProject } from "../../core/project/doctor.ts";
import { flagBool, type ParsedArgs } from "../args.ts";

export async function cmdDoctor(args: ParsedArgs, cwd: string): Promise<number> {
  const fix = flagBool(args, "fix");

  try {
    const root = findProjectRoot(cwd);
    if (!root) {
      throw new Error("no novel project found here (run `novel init` first)");
    }

    if (fix) {
      const config = await loadConfig(root);
      const applied = await fixProject(root, config);
      if (applied.length === 0) {
        process.stdout.write("nothing to fix\n");
      }
      for (const line of applied) {
        process.stdout.write(`fixed: ${line}\n`);
      }
    }

    const report = await checkProject(root);
    for (const issue of report.issues) {
      const hint = issue.fixable && !fix ? " (fixable with --fix)" : "";
      process.stdout.write(`warning: [${issue.code}] ${issue.message}${hint}\n`);
    }

    const content = Object.entries(report.content).sort((a, b) => b[1] - a[1]);
    if (content.length > 0) {
      process.stdout.write("content:\n");
      for (const [code, count] of content) {
        process.stdout.write(`  ${count} × ${code}\n`);
      }
    }

    if (report.issues.length === 0) {
      process.stdout.write("no project issues\n");
    }
    for (const suggestion of report.suggestions) {
      process.stdout.write(`${suggestion}\n`);
    }

    return report.issues.some((issue) => issue.severity === "error") ? 1 : 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
