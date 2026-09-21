import { regenerateIndexes } from "../../core/index/generate.ts";
import { applyValidateFixes } from "../../core/validate/fix.ts";
import { groupByCode } from "../../core/validate/diagnostics.ts";
import { keepDiagnostic } from "../../core/validate/filter.ts";
import { formatDiagnostic, validateBundle } from "../../core/validate/index.ts";
import { flagBool, flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

const SEVERITIES = ["error", "warning"];

export async function cmdValidate(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const severity = flagString(args, "severity");
    if (severity !== undefined && !SEVERITIES.includes(severity)) {
      throw new Error(`severity must be error or warning: ${severity}`);
    }

    let project = await openProject(cwd);

    if (flagBool(args, "fix")) {
      const changes = await regenerateIndexes(project.bundle);
      const changed = changes.filter((change) => change.changed).length;
      project = await openProject(cwd);
      process.stdout.write(`Regenerated ${changed} index file(s).\n`);

      const fixes = await applyValidateFixes(project.bundle);
      for (const fix of fixes) {
        process.stdout.write(`fixed: ${fix.path} — ${fix.message}\n`);
      }
      project = await openProject(cwd);
      process.stdout.write(`${fixes.length} quick fix(es) applied\n`);
    }

    const result = validateBundle(project.bundle);
    const only = flagString(args, "only");
    const quiet = flagBool(args, "quiet") || severity === "error";
    const summary = flagBool(args, "summary");
    const shown = result.diagnostics.filter((diagnostic) =>
      keepDiagnostic(diagnostic, only, severity, quiet),
    );

    if (flagBool(args, "json")) {
      const counts = {
        errors: result.errors,
        warnings: result.warnings,
        total: result.diagnostics.length,
      };
      process.stdout.write(`${JSON.stringify({ counts, diagnostics: shown }, null, 2)}\n`);
      return result.errors > 0 ? 1 : 0;
    }

    if (summary) {
      const byCode = groupByCode(shown);
      for (const [code, count] of [...byCode.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        process.stdout.write(`${code}: ${count}\n`);
      }
    } else {
      for (const diagnostic of shown) {
        process.stdout.write(`${formatDiagnostic(diagnostic)}\n`);
      }
    }

    const errors = shown.filter((diagnostic) => diagnostic.severity === "error").length;
    const warnings = shown.length - errors;
    process.stdout.write(`${errors} error(s), ${warnings} warning(s)\n`);
    return result.errors > 0 ? 1 : 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}