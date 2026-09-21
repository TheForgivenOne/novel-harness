import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { getTitle, getType } from "../../core/bundle/concept.ts";
import { buildGraph, graphToHtml, graphToJson } from "../../core/graph/build.ts";
import { flagBool, flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdGraph(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const project = await openProject(cwd);
    const graph = buildGraph(project.bundle);

    if (!flagBool(args, "html")) {
      process.stdout.write(graphToJson(graph));
      return 0;
    }

    const novel = project.bundle.concepts.find((concept) => getType(concept) === "Novel");
    const name = novel ? getTitle(novel) : basename(project.bundlePath);
    const out = flagString(args, "out") ?? join(project.config.build.out, "graph.html");
    const abs = out.startsWith("/") ? out : join(project.root, out);

    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, graphToHtml(graph, name), "utf8");
    process.stdout.write(`Wrote ${relative(project.root, abs)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
