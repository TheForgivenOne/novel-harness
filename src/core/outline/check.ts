import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { parentDir } from "../bundle/paths.ts";
import {
  rowMatchesChapter,
  sceneRows,
  structureRows,
  type OutlineRow,
} from "./parse.ts";

export interface OutlineDrift {
  plannedOnly: string[];
  fileOnly: string[];
  scenePlannedOnly: string[];
  sceneFileOnly: string[];
  misplaced: string[];
}

function chapterFor(bundle: Bundle, scene: Concept): Concept | undefined {
  const dir = parentDir(scene.path);
  return bundle.concepts.find(
    (candidate) =>
      getType(candidate) === "Chapter" &&
      (candidate.id === dir || candidate.id === parentDir(dir)),
  );
}

function sceneRowMatches(bundle: Bundle, scene: Concept, row: OutlineRow): boolean {
  const chapter = chapterFor(bundle, scene);
  if (!chapter) return false;
  const norm = (value: string | undefined, needle: string) =>
    value !== undefined &&
    value.trim().toLowerCase().replace(/^\/+/, "").replace(/\.md$/, "") ===
      needle.trim().toLowerCase().replace(/^\/+/, "").replace(/\.md$/, "");
  return rowMatchesChapter(row, chapter) && norm(row.Scene, getTitle(scene));
}

export function checkOutline(bundle: Bundle): OutlineDrift {
  const chapters = bundle.concepts.filter((candidate) => getType(candidate) === "Chapter");
  const scenes = bundle.concepts.filter((candidate) => getType(candidate) === "Scene");
  const rows = structureRows(bundle);
  const sceneRowList = sceneRows(bundle);

  const plannedOnly = rows
    .filter((row) => !chapters.some((chapter) => rowMatchesChapter(row, chapter)))
    .map((row) => row.Chapter ?? "(unnamed)");

  const fileOnly = chapters
    .filter((chapter) => !rows.some((row) => rowMatchesChapter(row, chapter)))
    .map((chapter) => chapter.id);

  const scenePlannedOnly = sceneRowList
    .filter((row) => !scenes.some((scene) => sceneRowMatches(bundle, scene, row)))
    .map((row) => `${row.Chapter ?? "?"} / ${row.Scene ?? "?"}`);

  const sceneFileOnly = scenes
    .filter((scene) => !sceneRowList.some((row) => sceneRowMatches(bundle, scene, row)))
    .map((scene) => scene.id);

  const misplaced = scenes
    .filter((scene) => !/\/scenes$/.test(parentDir(scene.path)))
    .map((scene) => scene.id);

  return { plannedOnly, fileOnly, scenePlannedOnly, sceneFileOnly, misplaced };
}