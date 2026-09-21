import { convertConcepts } from "../../core/ops/convert.ts";
import { formatTypeCatalog, getTypeDefBySlug } from "../../core/schema/catalog.ts";
import { flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdConvert(args: ParsedArgs, cwd: string): Promise<number> {
  const [fromArg, toArg] = args.positional;
  if (!fromArg || !toArg) {
    process.stderr.write("usage: novel convert <from-type> <to-type> [--file <path>]\n");
    return 1;
  }

  const fromDef = getTypeDefBySlug(fromArg);
  const toDef = getTypeDefBySlug(toArg);
  if (!fromDef || !toDef) {
    const unknown = !fromDef ? fromArg : toArg;
    process.stderr.write(`error: unknown concept type "${unknown}"\n\n${formatTypeCatalog()}\n`);
    return 1;
  }

  try {
    const project = await openProject(cwd);
    const result = await convertConcepts(project, fromDef.slug, toDef.slug, {
      file: flagString(args, "file"),
    });

    process.stdout.write(
      `Converted ${result.converted.length} concept(s) from ${fromDef.type} to ${toDef.type}\n`,
    );
    for (const item of result.converted) {
      process.stdout.write(`  ${item.from} -> ${item.to}\n`);
    }
    for (const skip of result.skipped) {
      process.stderr.write(`skipped ${skip.path}: ${skip.reason}\n`);
    }

    return result.converted.length === 0 && result.skipped.length > 0 ? 1 : 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
