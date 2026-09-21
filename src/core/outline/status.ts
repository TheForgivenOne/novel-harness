import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, type Concept } from "../bundle/concept.ts";
import { compareSequence } from "../bundle/sort.ts";
import { collectManuscript } from "../build/manuscript.ts";
import { countWords } from "../text/words.ts";
import { nextLine, structureRowFor } from "./parse.ts";

export interface ChapterStatus {
  chapter?: Concept;
  drafted: number;
  stubs: number;
  words: number;
  budget?: string;
  next?: string;
}

function proseWords(body: string): number {
  return countWords(body.replace(/^#.*$/gm, "").trim());
}

export function chapterStatuses(bundle: Bundle): ChapterStatus[] {
  const manuscript = collectManuscript(bundle);
  return manuscript.chapters.map((entry) => {
    const drafted = entry.scenes.filter((scene) => proseWords(scene.body) > 0).length;
    const words = entry.scenes.reduce((total, scene) => total + proseWords(scene.body), 0);
    const next = entry.scenes
      .filter((scene) => proseWords(scene.body) === 0)
      .sort(compareSequence)
      .map((scene) => getTitle(scene))
      .at(0);
    const budget =
      entry.concept === undefined ? undefined : structureRowFor(bundle, entry.concept)?.Words;
    return {
      chapter: entry.concept,
      drafted,
      stubs: entry.scenes.length - drafted,
      words,
      budget,
      next,
    };
  });
}