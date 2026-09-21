import { buildContext, buildStoryContext } from "../../core/context/build.ts";
import { flagBool, flagNumber, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdContext(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const project = await openProject(cwd);
    const maxBody = flagNumber(args, "max-body");

    if (flagBool(args, "story")) {
      process.stdout.write(buildStoryContext(project.bundle, { maxBodyChars: maxBody }).markdown);
      return 0;
    }

    const raw = args.positional[0];
    if (!raw) {
      process.stderr.write("error: usage: novel context <concept> [--so-far] | --story\n");
      return 1;
    }

    const id = raw.replace(/^\.?\//, "").replace(/\.md$/, "");
    const context = buildContext(project.bundle, id, {
      maxBodyChars: maxBody,
      soFar: flagBool(args, "so-far"),
    });
    process.stdout.write(context.markdown);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
