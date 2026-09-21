import { gitBundleDiff, renderDiffMarkdown } from "../../core/diff/diff.ts";
import { flagBool, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdDiff(args: ParsedArgs, cwd: string): Promise<number> {
  const [ref1, ref2Arg] = args.positional;
  if (ref1 === undefined && ref2Arg !== undefined) {
    process.stderr.write("error: usage: novel diff [ref1] [ref2] [--json]\n");
    return 1;
  }

  try {
    const project = await openProject(cwd);
    const changes = gitBundleDiff(project.root, project.bundlePath, ref1, ref2Arg);

    let from: string;
    let to: string;
    if (ref1 === undefined) {
      from = "working tree";
      to = "HEAD";
    } else if (ref2Arg === undefined) {
      from = ref1;
      to = "working tree";
    } else {
      from = ref1;
      to = ref2Arg;
    }

    if (flagBool(args, "json")) {
      process.stdout.write(`${JSON.stringify({ from, to, changes }, null, 2)}\n`);
    } else {
      process.stdout.write(renderDiffMarkdown(from, to, changes));
    }
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
