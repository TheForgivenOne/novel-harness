import { renameConcept } from "../../core/ops/rename.ts";
import type { ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdRename(args: ParsedArgs, cwd: string): Promise<number> {
  const [concept, ...rest] = args.positional;
  const newName = rest.join(" ").trim();
  if (!concept || newName === "") {
    process.stderr.write("usage: novel rename <concept> <new-name>\n");
    return 1;
  }

  try {
    const project = await openProject(cwd);
    const result = await renameConcept(project, concept, newName);
    process.stdout.write(
      `Renamed ${result.from} -> ${result.to} (${result.rewritten.length} link(s) rewritten)\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
