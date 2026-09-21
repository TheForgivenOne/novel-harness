import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { basename } from "../bundle/paths.ts";

export interface OutlineRow {
  [column: string]: string | undefined;
}

export function outlineConcept(bundle: Bundle): Concept | undefined {
  return bundle.concepts.find((concept) => getType(concept) === "Outline");
}

function tableRows(body: string, heading: string): OutlineRow[] {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === `# ${heading}`);
  if (start === -1) return [];
  const rows: OutlineRow[] = [];
  let headers: string[] | undefined;
  for (let i = start + 1; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (line.startsWith("#")) break;
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    if (headers === undefined) {
      headers = cells;
      continue;
    }
    const row: OutlineRow = {};
    headers.forEach((header, index) => {
      const value = cells[index]?.trim() ?? "";
      if (value !== "") row[header] = value;
    });
    rows.push(row);
  }
  return rows;
}

export function structureRows(bundle: Bundle): OutlineRow[] {
  const outline = outlineConcept(bundle);
  return outline ? tableRows(outline.body, "Structure") : [];
}

export function sceneRows(bundle: Bundle): OutlineRow[] {
  const outline = outlineConcept(bundle);
  return outline ? tableRows(outline.body, "Scenes") : [];
}

function cellMatches(value: string | undefined, needle: string): boolean {
  if (value === undefined) return false;
  const norm = (text: string) =>
    text.trim().toLowerCase().replace(/^\/+/, "").replace(/\.md$/, "");
  return norm(value) === norm(needle);
}

export function rowMatchesChapter(row: OutlineRow, chapter: Concept): boolean {
  return (
    cellMatches(row.Chapter, chapter.id) ||
    cellMatches(row.Chapter, basename(chapter.id)) ||
    cellMatches(row.Chapter, getTitle(chapter))
  );
}

export function structureRowFor(
  bundle: Bundle,
  chapter: Concept,
): OutlineRow | undefined {
  return structureRows(bundle).find((row) => rowMatchesChapter(row, chapter));
}

export function sceneRowFor(
  bundle: Bundle,
  chapter: Concept,
  sceneName: string,
): OutlineRow | undefined {
  return sceneRows(bundle).find(
    (row) => rowMatchesChapter(row, chapter) && cellMatches(row.Scene, sceneName),
  );
}

export function nextLine(bundle: Bundle): string | undefined {
  const outline = outlineConcept(bundle);
  if (!outline) return undefined;
  const lines = outline.body.split("\n");
  const index = lines.findIndex((line) => line.trim() === "# Next");
  if (index === -1) return undefined;
  for (let i = index + 1; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (line === "") continue;
    if (line.startsWith("#")) return undefined;
    return line;
  }
  return undefined;
}

export function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}