import { resolve } from "node:path";
import { runMigrationSpec } from "../../core/migrate/spec.ts";
import { findProjectRoot, loadConfig } from "../../core/project/config.ts";
import { checkProject, fixProject } from "../../core/project/doctor.ts";
import { flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

const AGENT_COMMAND: Record<string, string> = {
  claude: ".claude/commands/migrate.md",
  opencode: ".opencode/command/migrate.md",
  gemini: ".gemini/commands/migrate.toml",
  "agents-md": "AGENTS.md",
};

export async function cmdMigrate(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const root = findProjectRoot(cwd);
    if (!root) {
      throw new Error("no novel project found here (run `novel init` first)");
    }

    const config = await loadConfig(root);
    const applied = await fixProject(root, config);
    if (applied.length === 0) {
      process.stdout.write("nothing to fix\n");
    }
    for (const line of applied) {
      process.stdout.write(`fixed: ${line}\n`);
    }

    const rendered = config.targets
      .map((target) => AGENT_COMMAND[target])
      .filter((path): path is string => path !== undefined);
    if (rendered.length > 0) {
      process.stdout.write(`rendered: ${rendered.join(", ")}\n`);
    }

    const specFlag = flagString(args, "spec");
    if (specFlag !== undefined) {
      const specPath = resolve(cwd, specFlag);
      const project = await openProject(cwd);
      process.stdout.write(`migration spec: ${specPath}\n`);
      const migration = await runMigrationSpec(project.bundlePath, project.config.author, specPath);
      for (const step of migration.steps) {
        process.stdout.write(`spec: ${step.summary}\n`);
      }
    }

    const report = await checkProject(root);
    const content = Object.entries(report.content).sort((a, b) => b[1] - a[1]);

    if (content.length === 0 && report.issues.length === 0) {
      process.stdout.write("Project is fully migrated.\n");
      return 0;
    }

    for (const issue of report.issues) {
      process.stdout.write(`warning: [${issue.code}] ${issue.message}\n`);
    }

    if (content.length > 0) {
      process.stdout.write("content still to migrate:\n");
      for (const [code, count] of content) {
        process.stdout.write(`  ${count} × ${code}\n`);
      }
      process.stdout.write(
        "\nNext: restart your agent, then run `/migrate` there to fix the content.\n",
      );
    }

    return report.issues.some((issue) => issue.severity === "error") ? 1 : 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
