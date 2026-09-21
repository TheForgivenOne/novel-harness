import { getTitle, getType } from "../bundle/concept.ts";
import { parseDocument } from "../bundle/frontmatter.ts";
import { LINK_FIELDS, LINK_LIST_FIELDS } from "../bundle/links.ts";
import { writeConcept } from "../bundle/write.ts";
import { resolveConcept } from "../bundle/resolve.ts";
import { regenerateIndexes } from "../index/generate.ts";
import { appendLog, today } from "../log/writer.ts";
import { getTypeDef } from "../schema/catalog.ts";
import { splitList } from "../text/guards.ts";
import type { Bundle } from "../bundle/bundle.ts";
import type { OpsProject } from "./link-rewrite.ts";

export interface SetResult {
  path: string;
  changed: string[];
  resolved: Record<string, string>;
}

const SINGLE_LINK_TYPES: Partial<Record<string, string[]>> = {
  pov: ["Character"],
  location: ["Location"],
  dies_in: ["Scene"],
  diverges_at: ["Scene", "Timeline Event"],
  arc: ["Arc"],
  episode: ["Episode"],
};

const LIST_LINK_TYPES: Partial<Record<string, string[]>> = {
  cast: ["Character"],
  characters: ["Character"],
  participants: ["Character"],
  themes: ["Theme"],
  affiliations: ["Faction"],
  relationships: ["Relationship"],
  source_works: ["Reference"],
};

function resolveLink(
  bundle: Bundle,
  value: string,
  types: string[] | undefined,
  field: string,
): { link: string; id: string } {
  const target = resolveConcept(bundle, value);
  if (!target) throw new Error(`${field}: target not found: ${value}`);
  const type = getType(target);
  if (types !== undefined && (type === undefined || !types.includes(type))) {
    throw new Error(`${field}: expected ${types.join(" or ")}, found ${type ?? "unknown"}: ${value}`);
  }
  return { link: `/${target.id}.md`, id: target.id };
}

export async function setConceptFields(
  project: OpsProject,
  conceptName: string,
  assignments: { field: string; value: string }[],
  options: { unset?: string[]; at?: string; dryRun?: boolean } = {},
): Promise<SetResult> {
  const concept = resolveConcept(project.bundle, conceptName);
  if (!concept) throw new Error(`concept not found: ${conceptName}`);

  const doc = parseDocument(concept.raw);
  const data = { ...doc.data };
  const changed: string[] = [];
  const resolved: Record<string, string> = {};

  for (const { field, value } of assignments) {
    if (field === "") throw new Error("field name is required");

    const singleTypes = SINGLE_LINK_TYPES[field];
    if (singleTypes !== undefined) {
      const link = resolveLink(project.bundle, value, singleTypes, field);
      data[field] = link.link;
      resolved[field] = link.id;
      changed.push(field);
      continue;
    }

    const listTypes = LIST_LINK_TYPES[field];
    if (listTypes !== undefined) {
      const values = splitList(value);
      if (values.length === 0) throw new Error(`${field}: at least one value is required`);
      const links = values.map((entry) => resolveLink(project.bundle, entry, listTypes, field));
      data[field] = links.map((entry) => entry.link);
      resolved[field] = links.map((entry) => entry.id).join(",");
      changed.push(field);
      continue;
    }

    if (field === "sequence") {
      const sequence = Number(value);
      if (!Number.isFinite(sequence)) throw new Error(`sequence must be a number: ${value}`);
      data[field] = sequence;
      changed.push(field);
      continue;
    }

    if (field === "tags") {
      data[field] = splitList(value);
      changed.push(field);
      continue;
    }

    const type = getType(concept);
    const allowed = type === undefined ? undefined : getTypeDef(type)?.enumFields?.[field];
    if (allowed !== undefined && !allowed.includes(value)) {
      throw new Error(`${field} must be one of ${allowed.join(" | ")}: ${value}`);
    }
    data[field] = value;
    changed.push(field);
  }

  if (options.at !== undefined) {
    const link = resolveLink(project.bundle, options.at, ["Scene", "Timeline Event"], "--at");
    data.diverges_at = link.link;
    resolved.diverges_at = link.id;
    changed.push("diverges_at");
  }

  for (const field of options.unset ?? []) {
    const key = field.trim();
    if (key === "") continue;
    delete data[key];
    changed.push(key);
  }

  if (!options.dryRun) {
    await writeConcept(project.bundle, concept, data, doc.body);
    await regenerateIndexes(project.bundle);
    await appendLog(project.bundle, "", {
      date: today(),
      action: "Update",
      message: `Updated ${getTitle(concept)} (/${concept.path}): ${changed.join(", ")}.`,
    });
  }

  return { path: concept.path, changed, resolved };
}
