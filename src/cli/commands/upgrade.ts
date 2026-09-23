import { runUpgrade, defaultUpgradeDeps, type UpgradeReport } from "../../core/upgrade/run.ts";
import { flagBool, flagString, type ParsedArgs } from "../args.ts";

function printReport(report: UpgradeReport): void {
  const { install } = report;
  const source = install.sourceRoot ?? install.location;
  process.stdout.write(`novel ${report.currentVersion} — ${install.method} install at ${source}\n`);

  if (report.latest !== undefined) {
    const state = report.updateAvailable ? "update available" : "up to date";
    process.stdout.write(`latest release: ${report.latest.tag} (${state})\n`);
  }

  for (const action of report.actions) {
    process.stdout.write(`  ${action}\n`);
  }

  if (report.message !== undefined) {
    process.stdout.write(`${report.message}\n`);
  }
}

export async function cmdUpgrade(args: ParsedArgs, cwd: string): Promise<number> {
  const json = flagBool(args, "json");
  const options = {
    check: flagBool(args, "check"),
    yes: flagBool(args, "yes"),
    version: flagString(args, "version"),
  };

  try {
    const report = await runUpgrade(options, defaultUpgradeDeps());
    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printReport(report);
    }
    return report.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
