import { getTitle } from "../../core/bundle/concept.ts";
import { chapterStatuses } from "../../core/outline/status.ts";
import { nextLine } from "../../core/outline/parse.ts";
import type { ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdStatus(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const project = await openProject(cwd);
    const statuses = chapterStatuses(project.bundle);
    const lines: string[] = [];
    for (const entry of statuses) {
      const label = entry.chapter ? getTitle(entry.chapter) : "Unassigned scenes";
      const budget = entry.budget !== undefined ? ` (budget ${entry.budget})` : "";
      const next = entry.next !== undefined ? `; next: ${entry.next}` : "";
      lines.push(
        `- ${label}${budget}: ${entry.drafted} drafted, ${entry.stubs} stubs, ${entry.words} words${next}`,
      );
    }
    const next = nextLine(project.bundle);
    if (next !== undefined) lines.push("", `Next: ${next}`);
    process.stdout.write(`${lines.join("\n")}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}