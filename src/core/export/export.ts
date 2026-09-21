import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getTitle, type Concept } from "../bundle/concept.ts";
import type { Bundle } from "../bundle/bundle.ts";
import { collectManuscript, writeManuscript } from "../build/manuscript.ts";
import { sequenceOf } from "../bundle/sort.ts";
import { escapeHtml } from "../text/html.ts";

export const UNSUPPORTED_EXPORT_FORMAT =
  "export --format epub|pdf is not supported yet; use md or html";

export type ExportFormat = "md" | "html" | (string & {});

function renderParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((part) =>
      part
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .join(" "),
    )
    .filter((part) => part !== "");
}

export function renderManuscriptHtml(bundle: Bundle): string {
  const manuscript = collectManuscript(bundle);
  const title = manuscript.novel ? getTitle(manuscript.novel) : "Manuscript";
  const rawDescription = manuscript.novel?.frontmatter.description;
  const description =
    typeof rawDescription === "string" && rawDescription.trim() !== ""
      ? rawDescription.trim()
      : undefined;

  const sections: string[] = ["    <header class=\"title-page\">"];
  sections.push(`      <h1>${escapeHtml(title)}</h1>`);
  if (description !== undefined) {
    sections.push(`      <p class="description">${escapeHtml(description)}</p>`);
  }
  sections.push("    </header>");

  for (const chapter of manuscript.chapters) {
    const chapterTitle = chapter.concept ? getTitle(chapter.concept) : "Unassigned";
    const number = chapter.concept ? sequenceOf(chapter.concept) : Number.MAX_SAFE_INTEGER;
    const heading =
      number === Number.MAX_SAFE_INTEGER
        ? chapterTitle
        : `Chapter ${number} — ${chapterTitle}`;
    sections.push(`    <h1>${escapeHtml(heading)}</h1>`);

    chapter.scenes.forEach((scene, index) => {
      if (index > 0) sections.push('    <p class="scene-break">* * *</p>');
      for (const paragraph of renderParagraphs(scene.body)) {
        sections.push(`    <p>${escapeHtml(paragraph)}</p>`);
      }
    });
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #14141a; color: #dcdce4; font: 17px/1.7 Georgia, "Times New Roman", serif; }
  main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
  .title-page { text-align: center; margin-bottom: 3.5rem; }
  .title-page h1 { font-size: 2.4rem; margin: 0 0 1rem; }
  p.description { font-style: italic; color: #a9a9b8; margin: 0; }
  h1 { font-size: 1.5rem; margin: 3rem 0 1.5rem; }
  p { margin: 0 0 1.2rem; }
  p.scene-break { text-align: center; color: #8a8a98; letter-spacing: 0.4em; margin: 2rem 0; }
</style>
</head>
<body>
<main>
${sections.join("\n")}
</main>
</body>
</html>
`;
}

export async function exportBundle(
  bundle: Bundle,
  outDir: string,
  format: ExportFormat,
): Promise<string> {
  if (format === "md") {
    return writeManuscript(bundle, outDir);
  }
  if (format === "html") {
    const outPath = join(outDir, "manuscript.html");
    await mkdir(outDir, { recursive: true });
    await writeFile(outPath, renderManuscriptHtml(bundle), "utf8");
    return outPath;
  }
  throw new Error(UNSUPPORTED_EXPORT_FORMAT);
}
