import type { Bundle } from "../bundle/bundle.ts";
import { getTitle, getType, type Concept } from "../bundle/concept.ts";
import { serializeDocument } from "../bundle/frontmatter.ts";
import { parentDir } from "../bundle/paths.ts";
import { resolveConcept } from "../bundle/resolve.ts";
import { nextSequence } from "../bundle/sort.ts";
import { outlineConcept, sceneRowFor, structureRowFor, toNumber } from "../outline/parse.ts";
import type { TypeDef } from "../schema/catalog.ts";
import { slugify } from "../text/slug.ts";
import { mergeUnique } from "../text/guards.ts";
import { titleFromName } from "../text/title.ts";

export interface NewConceptOptions {
  name?: string;
  author: string;
  now?: string;
  pov?: string;
  chapter?: string;
  category?: string;
  when?: string;
  resource?: string;
  role?: string;
  fate?: string;
  kind?: string;
  characters?: string;
  cast?: string;
  location?: string;
  origin?: string;
  divergesAt?: string;
  fandom?: string;
  canonType?: string;
  sourceWorks?: string;
  tags?: string;
  aliases?: string;
  sequence?: number;
  divergence?: string;
  template?: { data: Record<string, unknown>; body: string };
}

export interface NewConceptDraft {
  /** Bundle-relative path of the new concept. */
  path: string;
  /** Serialized file contents. */
  content: string;
  /** Frontmatter that was written. */
  data: Record<string, unknown>;
}

function nextSiblingSequence(bundle: Bundle, type: string, parent?: string): number {
  return nextSequence(
    bundle.concepts.filter(
      (concept) =>
        getType(concept) === type &&
        (parent === undefined || parentDir(concept.path) === parent),
    ),
  );
}

function findCharacter(bundle: Bundle, value: string): Concept | undefined {
  const needle = value.trim().toLowerCase().replace(/^\/+/, "").replace(/\.md$/, "");
  return bundle.concepts.find((concept) => {
    if (getType(concept) !== "Character") return false;
    const basename = concept.id.split("/").pop() ?? concept.id;
    return (
      concept.id.toLowerCase() === needle ||
      basename.toLowerCase() === needle ||
      getTitle(concept).toLowerCase() === needle
    );
  });
}

function characterLink(bundle: Bundle, value: string, field: string): string {
  const concept = findCharacter(bundle, value);
  if (!concept) throw new Error(`${field} character not found: ${value}`);
  return `/${concept.path}`;
}

function locationLink(bundle: Bundle, value: string): string {
  const needle = value.trim().toLowerCase().replace(/^\/+/, "").replace(/\.md$/, "");
  const concept = bundle.concepts.find((candidate) => {
    if (getType(candidate) !== "Location") return false;
    const basename = candidate.id.split("/").pop() ?? candidate.id;
    return (
      candidate.id.toLowerCase() === needle ||
      basename.toLowerCase() === needle ||
      getTitle(candidate).toLowerCase() === needle
    );
  });
  if (!concept) throw new Error(`location not found: ${value}`);
  return `/${concept.path}`;
}

function conceptLinkByTypes(
  bundle: Bundle,
  value: string,
  types: string[],
  field: string,
): string {
  const needle = value.trim().toLowerCase().replace(/^\/+/, "").replace(/\.md$/, "");
  const concept = bundle.concepts.find((candidate) => {
    const type = getType(candidate);
    if (!type || !types.includes(type)) return false;
    const basename = candidate.id.split("/").pop() ?? candidate.id;
    return (
      candidate.id.toLowerCase() === needle ||
      basename.toLowerCase() === needle ||
      getTitle(candidate).toLowerCase() === needle
    );
  });
  if (!concept) throw new Error(`${field} target not found: ${value} (${types.join(" or ")})`);
  return `/${concept.path}`;
}

function defaultPovLink(bundle: Bundle): string {
  const characters = bundle.concepts.filter((concept) => getType(concept) === "Character");
  const pov =
    characters.find((concept) => concept.frontmatter.role === "protagonist") ?? characters[0];
  if (!pov) throw new Error("no characters exist; create one first or pass --pov");
  return `/${pov.path}`;
}

function chapterList(chapters: Concept[]): string {
  const shown = chapters
    .slice(0, 8)
    .map((chapter) => `${chapter.id} (${getTitle(chapter)})`)
    .join(", ");
  return chapters.length > 8 ? `${shown}, …` : shown;
}

const TEMPLATE_STRUCTURAL_KEYS = ["type", "title", "generated", "sequence"] as const;
const TEMPLATE_UNION_KEYS = ["tags", "aliases"] as const;

function applyTemplate(
  generated: Record<string, unknown>,
  body: string,
  template: { data: Record<string, unknown>; body: string },
): { data: Record<string, unknown>; body: string } {
  const data: Record<string, unknown> = { ...generated, ...template.data };
  for (const key of TEMPLATE_STRUCTURAL_KEYS) {
    if (Object.hasOwn(generated, key)) data[key] = generated[key];
  }
  for (const key of TEMPLATE_UNION_KEYS) {
    if (Array.isArray(generated[key]) || Array.isArray(template.data[key])) {
      const generatedList = Array.isArray(generated[key]) ? (generated[key] as string[]) : [];
      const templateList = Array.isArray(template.data[key]) ? (template.data[key] as string[]) : [];
      data[key] = mergeUnique(generatedList, templateList);
    }
  }
  return { data, body: template.body.trim() !== "" ? template.body : body };
}

export function newConceptDraft(
  bundle: Bundle,
  def: TypeDef,
  options: NewConceptOptions,
): NewConceptDraft {
  const now = options.now ?? new Date().toISOString();
  const name = options.name?.trim();
  const data: Record<string, unknown> = { type: def.type, title: name ? titleFromName(name) : "Untitled Novel" };
  let path: string;
  let body = "# Overview\n";

  if (def.singleton) {
    path = def.home;
    if (options.fandom) data.fandom = options.fandom;
    if (options.canonType) data.canon_type = options.canonType;
    if (options.sourceWorks) {
      data.source_works = options.sourceWorks
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => conceptLinkByTypes(bundle, part, ["Reference"], "source_works"));
    }
  } else if (def.type === "Scene") {
    if (!name) throw new Error("scene requires a name");
    const chapters = bundle.concepts.filter((concept) => getType(concept) === "Chapter");
    let chapter: Concept | undefined;
    if (options.chapter !== undefined && options.chapter.trim() !== "") {
      const found = resolveConcept(bundle, options.chapter);
      if (!found || getType(found) !== "Chapter") {
        throw new Error(`chapter not found: ${options.chapter}; chapters: ${chapterList(chapters)}`);
      }
      chapter = found;
    } else if (chapters.length === 0) {
      throw new Error("no chapter exists; create one first with `novel new chapter <title>`");
    } else if (chapters.length === 1) {
      chapter = chapters[0];
    } else {
      throw new Error(
        `scene requires --chapter <id|title|slug>; chapters: ${chapterList(chapters)}`,
      );
    }
    if (chapter === undefined) {
      throw new Error("no chapter found; create one first or pass --chapter");
    }

    const row = sceneRowFor(bundle, chapter, name);
    if (outlineConcept(bundle) !== undefined) {
      if (!structureRowFor(bundle, chapter)) {
        throw new Error(
          `chapter has no row in story/outline.md; add it to # Structure first: ${chapter.id}`,
        );
      }
      if (!row) {
        throw new Error(
          `scene has no row in story/outline.md; add it to # Scenes first: ${name}`,
        );
      }
    }

    path = `${chapter.id}/scenes/${slugify(name, "untitled")}.md`;
    data.sequence =
      options.sequence ?? toNumber(row?.Sequence) ?? nextSiblingSequence(bundle, "Scene", chapter.id);
    const rowPov = row?.POV;
    data.pov = options.pov
      ? characterLink(bundle, options.pov, "pov")
      : rowPov
        ? characterLink(bundle, rowPov, "pov")
        : defaultPovLink(bundle);
    const cast = options.cast
      ? options.cast.split(",").map((part) => characterLink(bundle, part.trim(), "cast"))
      : [];
    if (!cast.includes(data.pov as string)) cast.unshift(data.pov as string);
    data.cast = cast;
    if (options.location) data.location = locationLink(bundle, options.location);
    const when = options.when ?? row?.When;
    if (when) data.when = when;
    body = "";
  } else if (def.type === "Chapter Outline") {
    if (!name) throw new Error("Chapter Outline requires a name");
    const chapters = bundle.concepts.filter((concept) => getType(concept) === "Chapter");
    let chapter: Concept | undefined;
    if (options.chapter !== undefined && options.chapter.trim() !== "") {
      const found = resolveConcept(bundle, options.chapter);
      if (!found || getType(found) !== "Chapter") {
        throw new Error(`chapter not found: ${options.chapter}; chapters: ${chapterList(chapters)}`);
      }
      chapter = found;
    } else if (chapters.length === 0) {
      throw new Error("no chapter exists; create one first with `novel new chapter <title>`");
    } else if (chapters.length === 1) {
      chapter = chapters[0];
    } else {
      throw new Error(`Chapter Outline requires --chapter; chapters: ${chapterList(chapters)}`);
    }
    if (chapter === undefined) {
      throw new Error("no chapter found; create one first or pass --chapter");
    }
    path = `${chapter.id}/outline.md`;
    body = "";
  } else {
    if (!name) throw new Error(`${def.type} requires a name`);
    path = `${def.home}/${slugify(name, "untitled")}.md`;

    switch (def.type) {
      case "Chapter": {
        data.sequence = nextSiblingSequence(bundle, "Chapter");
        data.pov = options.pov ? characterLink(bundle, options.pov, "pov") : defaultPovLink(bundle);
        body = "# Summary\n";
        break;
      }
      case "Timeline Event": {
        if (!options.when) throw new Error("timeline event requires --when");
        data.sequence = nextSiblingSequence(bundle, "Timeline Event");
        data.when = options.when;
        if (options.divergence) data.divergence = options.divergence;
        break;
      }
      case "Episode": {
        data.sequence = nextSiblingSequence(bundle, "Episode");
        break;
      }
      case "Worldbuilding": {
        if (!options.category) {
          throw new Error("worldbuilding requires --category (magic|tech|culture|geography)");
        }
        data.category = options.category;
        break;
      }
      case "Character": {
        data.role = options.role ?? "supporting";
        data.fate = options.fate ?? "alive";
        break;
      }
      case "Plot Thread": {
        data.status = "draft";
        break;
      }
      case "Relationship": {
        if (!options.characters) throw new Error("relationship requires --characters a,b");
        const parts = options.characters
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.length !== 2) {
          throw new Error("relationship requires exactly two characters: --characters a,b");
        }
        data.characters = parts.map((part) => characterLink(bundle, part, "characters"));
        if (!options.kind) throw new Error("relationship requires --kind");
        data.kind = options.kind;
        break;
      }
      case "Reference": {
        if (!options.resource) throw new Error("reference requires --resource");
        data.resource = options.resource;
        break;
      }
      default:
        break;
    }
  }

  if (options.origin === "divergent" && !options.divergesAt) {
    throw new Error("origin: divergent requires --diverges-at <scene or timeline event>");
  }
  if (options.origin) data.origin = options.origin;
  if (options.divergesAt) {
    data.diverges_at = conceptLinkByTypes(
      bundle,
      options.divergesAt,
      ["Scene", "Timeline Event"],
      "diverges_at",
    );
  }

  if (options.tags) {
    const tags = options.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length > 0) data.tags = tags;
  }

  if (options.aliases) {
    const aliases = options.aliases
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean);
    if (aliases.length > 0) data.aliases = aliases;
  }

  if (options.sequence !== undefined) data.sequence = options.sequence;

  if (def.narrative) {
    if (data.status === undefined) data.status = "draft";
    data.generated = { by: options.author, at: now };
  }

  const applied = options.template ? applyTemplate(data, body, options.template) : { data, body };

  return {
    path,
    content: serializeDocument({ data: applied.data, body: applied.body }),
    data: applied.data,
  };
}
