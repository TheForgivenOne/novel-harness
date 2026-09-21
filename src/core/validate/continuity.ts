import type { Bundle } from "../bundle/bundle.ts";
import { getType, type Concept } from "../bundle/concept.ts";
import { extractBundleLinks } from "../bundle/links.ts";
import { linkTargetId, parentDir } from "../bundle/paths.ts";
import { compareSequence, sequenceOf } from "../bundle/sort.ts";
import { stringList } from "../text/guards.ts";
import type { Diagnostic } from "./diagnostics.ts";

function linkList(value: unknown): string[] {
  return stringList(value).filter((entry) => entry.startsWith("/"));
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function reportDuplicateSequences(
  items: Concept[],
  label: string,
  groupKey: (concept: Concept) => string,
  diagnostics: Diagnostic[],
): void {
  const groups = new Map<string, Concept[]>();
  for (const item of items) {
    const key = groupKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  for (const [key, list] of groups) {
    const bySequence = new Map<number, Concept[]>();
    for (const item of list) {
      const sequence = sequenceOf(item);
      if (sequence === Number.MAX_SAFE_INTEGER) continue;
      const bucket = bySequence.get(sequence) ?? [];
      bucket.push(item);
      bySequence.set(sequence, bucket);
    }
    for (const [sequence, bucket] of bySequence) {
      if (bucket.length < 2) continue;
      diagnostics.push({
        severity: "error",
        code: "continuity/duplicate-sequence",
        path: bucket[0]?.path,
        message: `duplicate ${label} sequence ${sequence} in ${key || "bundle root"}: ${bucket
          .map((concept) => concept.id)
          .join(", ")}`,
      });
    }
  }
}

export function validateContinuity(bundle: Bundle): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const byId = new Map(bundle.concepts.map((concept) => [concept.id, concept]));

  const chapters = bundle.concepts.filter((concept) => getType(concept) === "Chapter");
  const scenes = bundle.concepts.filter((concept) => getType(concept) === "Scene");

  const orderedScenes: Concept[] = [];
  const claimedScenes = new Set<string>();

  for (const chapter of [...chapters].sort(compareSequence)) {
    const children = scenes
      .filter(
        (scene) =>
          parentDir(scene.path) === chapter.id ||
          parentDir(parentDir(scene.path)) === chapter.id,
      )
      .sort(compareSequence);
    for (const scene of children) {
      claimedScenes.add(scene.id);
      orderedScenes.push(scene);
    }
  }

  for (const scene of scenes) {
    if (claimedScenes.has(scene.id)) continue;
    const parentDirName = parentDir(scene.path);
    const parent = parentDirName.endsWith("/scenes")
      ? parentDir(parentDirName)
      : parentDirName;
    if (!byId.has(parent)) {
      diagnostics.push({
        severity: "warning",
        code: "continuity/orphan-scene",
        path: scene.path,
        message: `parent chapter ${parent}.md does not exist`,
      });
    }
    orderedScenes.push(scene);
  }

  reportDuplicateSequences(chapters, "chapter", () => "", diagnostics);
  reportDuplicateSequences(
    scenes,
    "scene",
    (scene) => {
      const parent = parentDir(scene.path);
      return parent.endsWith("/scenes") ? parentDir(parent) : parent;
    },
    diagnostics,
  );

  const position = new Map<string, number>();
  orderedScenes.forEach((scene, index) => position.set(scene.id, index));

  const reportedUnverifiableDeath = new Set<string>();

  for (const scene of orderedScenes) {
    const cast = linkList(scene.frontmatter.cast);
    const pov = stringField(scene.frontmatter.pov);
    const location = stringField(scene.frontmatter.location);

    if (pov && !cast.includes(pov)) {
      diagnostics.push({
        severity: "error",
        code: "continuity/pov-not-in-cast",
        path: scene.path,
        message: `POV ${pov} is not listed in cast`,
      });
    }

    const referenced = [pov, location, ...cast].filter((value): value is string =>
      Boolean(value),
    );
    for (const link of referenced) {
      const target = byId.get(linkTargetId(link));
      if (!target) {
        diagnostics.push({
          severity: "warning",
          code: "continuity/broken-link",
          path: scene.path,
          message: `link target ${link} does not exist`,
        });
        continue;
      }

      if (getType(target) === "Character" && target.frontmatter.fate === "dead") {
        const diesIn = stringField(target.frontmatter.dies_in);
        if (!diesIn) {
          if (!reportedUnverifiableDeath.has(target.id)) {
            reportedUnverifiableDeath.add(target.id);
            diagnostics.push({
              severity: "warning",
              code: "continuity/unverifiable-death",
              path: target.path,
              message: "fate is dead but no dies_in scene is set; appearance order cannot be verified",
            });
          }
        } else {
          const deathPosition = position.get(linkTargetId(diesIn));
          const scenePosition = position.get(scene.id);
          if (
            deathPosition !== undefined &&
            scenePosition !== undefined &&
            scenePosition > deathPosition
          ) {
            diagnostics.push({
              severity: "error",
              code: "continuity/dead-character",
              path: scene.path,
              message: `${target.id} appears after dies_in ${diesIn}`,
            });
          }
        }
      }

      if (scene.frontmatter.status === "stable" && target.frontmatter.status === "draft") {
        diagnostics.push({
          severity: "warning",
          code: "continuity/stable-references-draft",
          path: scene.path,
          message: `canon scene references draft concept ${target.id}`,
        });
      }
    }

    for (const link of extractBundleLinks(scene.body, scene.path)) {
      if (!byId.has(linkTargetId(link))) {
        diagnostics.push({
          severity: "warning",
          code: "continuity/broken-link",
          path: scene.path,
          message: `body link target ${link} does not exist`,
        });
      }
    }
  }

  for (const concept of bundle.concepts) {
    if (getType(concept) === "Scene") continue;
    for (const link of extractBundleLinks(concept.body, concept.path)) {
      if (!byId.has(linkTargetId(link))) {
        diagnostics.push({
          severity: "warning",
          code: "continuity/broken-link",
          path: concept.path,
          message: `body link target ${link} does not exist`,
        });
      }
    }
  }

  return diagnostics;
}
