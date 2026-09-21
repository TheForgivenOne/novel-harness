import { setConceptFields } from "../../core/ops/set.ts";
import { flagBool, flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdSet(args: ParsedArgs, cwd: string): Promise<number> {
  const [conceptName, ...pairs] = args.positional;
  if (conceptName === undefined || pairs.length === 0) {
    process.stderr.write(
      "error: usage: novel set <concept> field=value [field=value...] [--unset a,b] [--at <scene>] [--dry-run]\n",
    );
    return 1;
  }

  const assignments: { field: string; value: string }[] = [];
  for (const pair of pairs) {
    const index = pair.indexOf("=");
    if (index <= 0) {
      process.stderr.write(`error: assignment must be field=value: ${pair}\n`);
      return 1;
    }
    assignments.push({ field: pair.slice(0, index).trim(), value: pair.slice(index + 1) });
  }

  const unset = flagString(args, "unset")
    ?.split(",")
    .map((field) => field.trim())
    .filter((field) => field !== "");

  try {
    const project = await openProject(cwd);
    const result = await setConceptFields(project, conceptName, assignments, {
      unset,
      at: flagString(args, "at"),
      dryRun: flagBool(args, "dry-run"),
    });
    const prefix = flagBool(args, "dry-run") ? "would update" : "updated";
    process.stdout.write(`${prefix} ${result.path}: ${result.changed.join(", ")}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
