import { getType } from "../bundle/concept.ts";
import { compareSequence, sequenceOf } from "../bundle/sort.ts";
import { compareWhen } from "../bundle/timeline.ts";
import type { Bundle } from "../bundle/bundle.ts";
import type { Diagnostic } from "./diagnostics.ts";

export function validateTimelineOrder(bundle: Bundle): Diagnostic[] {
  const events = bundle.concepts
    .filter((concept) => {
      if (getType(concept) !== "Timeline Event") return false;
      const sequence = concept.frontmatter.sequence;
      return typeof sequence === "number" && Number.isFinite(sequence);
    })
    .sort(compareSequence);

  const diagnostics: Diagnostic[] = [];
  for (let index = 1; index < events.length; index++) {
    const previous = events[index - 1];
    const current = events[index];
    if (previous === undefined || current === undefined) continue;
    const previousWhen = previous.frontmatter.when;
    const currentWhen = current.frontmatter.when;
    if (previousWhen === undefined || currentWhen === undefined) continue;
    const previousText = String(previousWhen);
    const currentText = String(currentWhen);
    if (previousText.trim() === "" || currentText.trim() === "") continue;
    const order = compareWhen(currentText, previousText);
    if (order >= 0) continue;
    diagnostics.push({
      severity: "warning",
      code: "profile/sequence-when",
      path: current.path,
      message:
        `sequence ${sequenceOf(current)} comes after sequence ${sequenceOf(previous)} ` +
        `but when "${currentWhen}" is earlier than "${previousWhen}"`,
    });
  }
  return diagnostics;
}
