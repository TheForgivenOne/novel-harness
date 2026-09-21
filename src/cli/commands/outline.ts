import { checkOutline } from "../../core/outline/check.ts";
import { outlineConcept } from "../../core/outline/parse.ts";
import { flagBool, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

export async function cmdOutline(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    const project = await openProject(cwd);
    const outline = outlineConcept(project.bundle);
    if (!outline) {
      process.stderr.write("error: no story/outline.md; run `novel doctor --fix` or `novel init`\n");
      return 1;
    }
    if (!flagBool(args, "check")) {
      process.stdout.write(outline.body);
      return 0;
    }
    const drift = checkOutline(project.bundle);
    const lines: string[] = [];
    if (drift.plannedOnly.length > 0) {
      lines.push("Planned chapters with no chapter file:");
      for (const id of drift.plannedOnly) lines.push(`  - ${id}`);
    }
    if (drift.fileOnly.length > 0) {
      lines.push("Chapter files with no row in # Structure:");
      for (const id of drift.fileOnly) lines.push(`  - ${id}`);
    }
    if (drift.scenePlannedOnly.length > 0) {
      lines.push("Planned scenes with no scene file:");
      for (const id of drift.scenePlannedOnly) lines.push(`  - ${id}`);
    }
    if (drift.sceneFileOnly.length > 0) {
      lines.push("Scene files with no row in # Scenes:");
      for (const id of drift.sceneFileOnly) lines.push(`  - ${id}`);
    }
    if (drift.misplaced.length > 0) {
      lines.push("Scene files not under a scenes/ directory (warning):");
      for (const id of drift.misplaced) lines.push(`  - ${id}`);
    }
    if (lines.length === 0) {
      process.stdout.write("Outline is in sync with the bundle.\n");
      return 0;
    }
    const hardCount =
      drift.plannedOnly.length + drift.fileOnly.length +
      drift.scenePlannedOnly.length + drift.sceneFileOnly.length;
    process.stdout.write(`${lines.join("\n")}\n`);
    return hardCount > 0 ? 1 : 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}