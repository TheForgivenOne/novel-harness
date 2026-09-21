import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { compareSequence, sequenceOf } from "../bundle/sort.ts";

export interface ManuscriptChapter {
  concept?: Concept;
  scenes: Concept[];
}

export interface Manuscript {
  novel?: Concept;
  chapters: ManuscriptChapter[];
}

export function collectManuscript(bundle: Bundle): Manuscript {
  const novel = bundle.concepts.find((concept) => getType(concept) === "Novel");
  const chapters = bundle.concepts
    .filter((concept) => getType(concept) === "Chapter")
    .sort(compareSequence);
  const scenes = bundle.concepts.filter((concept) => getType(concept) === "Scene");

  const result: ManuscriptChapter[] = chapters.map((chapter) => ({
    concept: chapter,
    scenes: scenes
      .filter((scene) => scene.path.startsWith(`${chapter.id}/`))
      .sort(compareSequence),
  }));

  const assigned = new Set(result.flatMap((chapter) => chapter.scenes.map((scene) => scene.id)));
  const orphans = scenes.filter((scene) => !assigned.has(scene.id)).sort(compareSequence);
  if (orphans.length > 0) {
    result.push({ scenes: orphans });
  }

  return { novel, chapters: result };
}

export function renderManuscript(bundle: Bundle): string {
  const manuscript = collectManuscript(bundle);
  const lines: string[] = [];

  if (manuscript.novel) {
    lines.push(`# ${getTitle(manuscript.novel)}`, "");
    const description = manuscript.novel.frontmatter.description;
    if (typeof description === "string" && description.trim() !== "") {
      lines.push(description.trim(), "");
    }
  } else {
    lines.push("# Manuscript", "");
  }

  for (const chapter of manuscript.chapters) {
    const title = chapter.concept ? getTitle(chapter.concept) : "Unassigned";
    const number = chapter.concept ? sequenceOf(chapter.concept) : "";
    const heading = number === Number.MAX_SAFE_INTEGER || number === ""
      ? `# ${title}`
      : `# Chapter ${number} — ${title}`;
    lines.push(heading, "");

    chapter.scenes.forEach((scene, index) => {
      if (index > 0) lines.push("* * *", "");
      const prose = scene.body.trim();
      if (prose !== "") lines.push(prose, "");
    });
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export async function writeManuscript(bundle: Bundle, outDir: string): Promise<string> {
  const outPath = join(outDir, "manuscript.md");
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, renderManuscript(bundle), "utf8");
  return outPath;
}
