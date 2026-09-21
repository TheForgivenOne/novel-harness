import type { Bundle } from "../bundle/bundle.ts";
import { getType, type Concept } from "../bundle/concept.ts";
import { sourceEntries } from "../bundle/entries.ts";
import { LINK_FIELDS, LINK_LIST_FIELDS } from "../bundle/links.ts";
import { isBundleLink, isFollowableResource, linkTargetId, normalizeBundlePath, parentDir } from "../bundle/paths.ts";
import {
  ORIGIN_VALUES,
  REF_KINDS,
  STATUS_VALUES,
  getTypeDef,
  type TypeDef,
} from "../schema/catalog.ts";
import { normalizeName } from "../text/slug.ts";
import { isStale } from "../query/dates.ts";
import type { Diagnostic } from "./diagnostics.ts";

const STATUS_SET = new Set<string>(STATUS_VALUES);
const ORIGIN_SET = new Set<string>(ORIGIN_VALUES);

export const TAGS_RECOMMENDED = new Set([
  "Timeline Event",
  "Arc",
  "Episode",
  "Chapter",
  "Scene",
  "Character",
  "Location",
  "Faction",
  "Worldbuilding",
  "Item",
]);

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}

function describe(value: unknown): string {
  if (Array.isArray(value)) return "a list";
  if (value === null) return "null";
  return `a ${typeof value}`;
}

function segmentsUnderHome(path: string, home: string): number | undefined {
  const prefix = `${home}/`;
  if (!path.startsWith(prefix)) return undefined;
  return path.slice(prefix.length).split("/").length;
}

function validateRequired(concept: Concept, def: TypeDef, diagnostics: Diagnostic[]): void {
  const required = new Set(def.required);
  if (def.narrative) {
    required.add("status");
    required.add("generated");
  }
  for (const key of required) {
    if (isEmpty(concept.frontmatter[key])) {
      diagnostics.push({
        severity: "error",
        code: "profile/missing-field",
        path: concept.path,
        message: `type ${def.type} requires \`${key}\``,
      });
    }
  }
}

function sceneChapterId(path: string): string {
  const parent = parentDir(path);
  return parent.endsWith("/scenes") ? parentDir(parent) : parent;
}

function validatePlacement(concept: Concept, def: TypeDef, diagnostics: Diagnostic[]): void {
  if (def.singleton) {
    if (concept.path !== def.home) {
      diagnostics.push({
        severity: "error",
        code: "profile/home",
        path: concept.path,
        message: `type ${def.type} must live at ${def.home}`,
      });
    }
    return;
  }

  const depth = segmentsUnderHome(concept.path, def.home);
  if (depth === undefined) {
    diagnostics.push({
      severity: "error",
      code: "profile/home",
      path: concept.path,
      message: `type ${def.type} must live under ${def.home}/`,
    });
    return;
  }

  if (def.type === "Chapter" && depth !== 1) {
    diagnostics.push({
      severity: "error",
      code: "profile/home",
      path: concept.path,
      message: "type Chapter must live at chapters/<chapter>.md",
    });
  }
  if (def.type === "Scene" && depth !== 2 && depth !== 3) {
    diagnostics.push({
      severity: "error",
      code: "profile/home",
      path: concept.path,
      message: "type Scene must live at chapters/<chapter>/<scene>.md or chapters/<chapter>/scenes/<scene>.md",
    });
  }
}

function validateEnums(concept: Concept, def: TypeDef, diagnostics: Diagnostic[]): void {
  const frontmatter = concept.frontmatter;

  const status = frontmatter.status;
  if (status !== undefined && !(typeof status === "string" && STATUS_SET.has(status))) {
    diagnostics.push({
      severity: "error",
      code: "profile/enum",
      path: concept.path,
      message: `status must be one of ${STATUS_VALUES.join(", ")}`,
    });
  }

  const origin = frontmatter.origin;
  if (origin !== undefined && !(typeof origin === "string" && ORIGIN_SET.has(origin))) {
    diagnostics.push({
      severity: "error",
      code: "profile/enum",
      path: concept.path,
      message: `origin must be one of ${ORIGIN_VALUES.join(", ")}`,
    });
  }

  for (const [field, values] of Object.entries(def.enumFields ?? {})) {
    const value = frontmatter[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || !values.includes(value)) {
      diagnostics.push({
        severity: "error",
        code: "profile/enum",
        path: concept.path,
        message: `${field} must be one of ${values.join(", ")}`,
      });
    }
  }
}

function validateFieldShapes(concept: Concept, def: TypeDef, diagnostics: Diagnostic[]): void {
  const fm = concept.frontmatter;

  if (fm.title !== undefined && typeof fm.title !== "string") {
    diagnostics.push({
      severity: "error",
      code: "profile/field-type",
      path: concept.path,
      message: `title must be a string, found ${describe(fm.title)}`,
    });
  }

  if (fm.description !== undefined && typeof fm.description !== "string") {
    diagnostics.push({
      severity: "error",
      code: "profile/field-type",
      path: concept.path,
      message: `description must be a string, found ${describe(fm.description)}`,
    });
  }

  const sequence = fm.sequence;
  if (sequence !== undefined && (!Number.isInteger(sequence) || (sequence as number) < 1)) {
    diagnostics.push({
      severity: "error",
      code: "profile/field-type",
      path: concept.path,
      message: `sequence must be a positive integer, found ${describe(sequence)}`,
    });
  }

  if (fm.when !== undefined && typeof fm.when !== "string" && typeof fm.when !== "number") {
    diagnostics.push({
      severity: "error",
      code: "profile/field-type",
      path: concept.path,
      message: `when must be a date string (quote bare years like "2005"), found ${describe(fm.when)}`,
    });
  }

  if (fm.fandom !== undefined && typeof fm.fandom !== "string") {
    diagnostics.push({
      severity: "error",
      code: "profile/field-type",
      path: concept.path,
      message: `fandom must be a string, found ${describe(fm.fandom)}`,
    });
  }

  if (fm.sources !== undefined) {
    const sources = fm.sources;
    const valid =
      Array.isArray(sources) &&
      sources.every(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          !Array.isArray(entry) &&
          typeof (entry as Record<string, unknown>).resource === "string" &&
          ((entry as Record<string, unknown>).resource as string).trim() !== "",
      );
    if (!valid) {
      diagnostics.push({
        severity: "error",
        code: "profile/sources",
        path: concept.path,
        message: "sources must be a list of mappings each with a `resource` (OKF §5.1)",
      });
    }
  }

  if (fm.refs !== undefined) {
    const refs = fm.refs;
    const valid =
      Array.isArray(refs) &&
      refs.every((entry) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
        const record = entry as Record<string, unknown>;
        if (typeof record.url !== "string" || !/^https?:\/\//.test(record.url)) return false;
        if (record.title !== undefined && typeof record.title !== "string") return false;
        if (
          record.kind !== undefined &&
          !(typeof record.kind === "string" && (REF_KINDS as readonly string[]).includes(record.kind))
        ) {
          return false;
        }
        return true;
      });
    if (!valid) {
      diagnostics.push({
        severity: "error",
        code: "profile/refs",
        path: concept.path,
        message: `refs must be a list of { title, url, kind } with an http(s) url; kind is one of ${REF_KINDS.join(", ")}`,
      });
    }
  }

  if (fm.tags !== undefined) {
    const tags = fm.tags;
    const valid = Array.isArray(tags) && tags.every((tag) => typeof tag === "string");
    if (!valid) {
      diagnostics.push({
        severity: "error",
        code: "profile/field-type",
        path: concept.path,
        message: "tags must be a list of strings",
      });
    }
  }

  for (const field of LINK_FIELDS) {
    if (field === "pov" && def.type !== "Chapter" && def.type !== "Scene") continue;
    const value = fm[field];
    if (value !== undefined && !isBundleLink(value)) {
      diagnostics.push({
        severity: "error",
        code: "profile/link-format",
        path: concept.path,
        message: `${field} must be a bundle-relative link like /characters/name.md`,
      });
    }
  }

  for (const field of LINK_LIST_FIELDS) {
    const value = fm[field];
    if (value === undefined) continue;
    const valid = Array.isArray(value) && value.every((entry) => isBundleLink(entry));
    if (!valid) {
      diagnostics.push({
        severity: "error",
        code: "profile/link-format",
        path: concept.path,
        message: `${field} must be a list of bundle-relative links like /characters/name.md`,
      });
    }
  }

  if (def.type === "Relationship" && Array.isArray(fm.characters)) {
    const links = fm.characters.filter((entry): entry is string => typeof entry === "string");
    if (links.length !== 2) {
      diagnostics.push({
        severity: "error",
        code: "profile/relationship",
        path: concept.path,
        message: "Relationship requires exactly 2 character links",
      });
    } else if (links[0] === links[1]) {
      diagnostics.push({
        severity: "error",
        code: "profile/relationship",
        path: concept.path,
        message: "Relationship requires 2 distinct character links",
      });
    }
  }

  if (def.type === "Reference" && fm.resource !== undefined && typeof fm.resource !== "string") {
    diagnostics.push({
      severity: "error",
      code: "profile/field-type",
      path: concept.path,
      message: `resource must be a string, found ${describe(fm.resource)}`,
    });
  }

  const generated = fm.generated;
  if (generated !== undefined) {
    if (typeof generated !== "object" || generated === null || Array.isArray(generated)) {
      diagnostics.push({
        severity: "error",
        code: "profile/generated",
        path: concept.path,
        message: "generated must be a mapping with `by` and optional `at`",
      });
    } else {
      const record = generated as Record<string, unknown>;
      if (typeof record.by !== "string" || record.by.trim() === "") {
        diagnostics.push({
          severity: "error",
          code: "profile/generated",
          path: concept.path,
          message: "generated.by must be an actor string (OKF §7)",
        });
      }
      if (record.at !== undefined && !isIsoDate(record.at)) {
        diagnostics.push({
          severity: "error",
          code: "profile/generated",
          path: concept.path,
          message: "generated.at must be an ISO 8601 datetime with a UTC offset",
        });
      }
    }
  }

  if (fm.stale_after !== undefined && !isIsoDate(fm.stale_after)) {
    diagnostics.push({
      severity: "error",
      code: "profile/field-type",
      path: concept.path,
      message: "stale_after must be an ISO 8601 datetime with a UTC offset",
    });
  }

  const verified = fm.verified;
  if (verified !== undefined) {
    const entries = Array.isArray(verified) ? verified : [verified];
    const valid =
      entries.length > 0 &&
      entries.every(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          !Array.isArray(entry) &&
          typeof (entry as Record<string, unknown>).by === "string" &&
          ((entry as Record<string, unknown>).at === undefined ||
            isIsoDate((entry as Record<string, unknown>).at)),
      );
    if (!valid) {
      diagnostics.push({
        severity: "error",
        code: "profile/verified",
        path: concept.path,
        message: "verified must be a mapping or list of { by, at } entries",
      });
    }
  }
}

function validateDuplicateNames(bundle: Bundle, diagnostics: Diagnostic[]): void {
  const seen = new Map<string, Concept>();
  for (const concept of bundle.concepts) {
    const type = getType(concept);
    if (!type) continue;

    const names: string[] = [];
    const title = concept.frontmatter.title;
    if (typeof title === "string") names.push(title);
    const aliases = concept.frontmatter.aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        if (typeof alias === "string") names.push(alias);
      }
    }

    for (const name of names) {
      const normalized = normalizeName(name);
      if (normalized === "") continue;
      const key = `${type}\u0000${normalized}`;
      const prior = seen.get(key);
      if (prior) {
        diagnostics.push({
          severity: "warning",
          code: "profile/duplicate-concept",
          path: concept.path,
          message: `${concept.id} and ${prior.id} share the ${type} name ${JSON.stringify(name)}; merge them or add one to the other's aliases`,
        });
      } else {
        seen.set(key, concept);
      }
    }
  }
}

export function validateProfile(bundle: Bundle): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const novels = bundle.concepts.filter((concept) => getType(concept) === "Novel");
  if (novels.length > 1) {
    diagnostics.push({
      severity: "error",
      code: "profile/singleton",
      message: `expected a single Novel, found ${novels.length} (${novels.map((c) => c.path).join(", ")})`,
    });
  }

  const chaptersWithScenes = new Set(
    bundle.concepts
      .filter((concept) => getType(concept) === "Scene")
      .map((concept) => sceneChapterId(concept.path)),
  );

  for (const concept of bundle.concepts) {
    const type = getType(concept);
    if (!type) continue;
    const def = getTypeDef(type);
    if (!def) {
      diagnostics.push({
        severity: "warning",
        code: "profile/unknown-type",
        path: concept.path,
        message: `unknown concept type ${JSON.stringify(type)}; tolerated as a generic concept (OKF §4.1)`,
      });
      continue;
    }
    validateRequired(concept, def, diagnostics);
    validatePlacement(concept, def, diagnostics);
    validateEnums(concept, def, diagnostics);
    validateFieldShapes(concept, def, diagnostics);

    if (TAGS_RECOMMENDED.has(def.type) && isEmpty(concept.frontmatter.tags)) {
      diagnostics.push({
        severity: "warning",
        code: "profile/missing-tags",
        path: concept.path,
        message: `type ${def.type} should carry tags so \`novel query\` can filter it`,
      });
    }
    if (def.type === "Chapter" && !chaptersWithScenes.has(concept.id)) {
      diagnostics.push({
        severity: "warning",
        code: "profile/orphan-chapter",
        path: concept.path,
        message:
          "Chapter has no scenes; if this is canon season or arc data, use type Arc under arcs/ instead",
      });
    }
  }

  validateDuplicateNames(bundle, diagnostics);

  return diagnostics;
}

export function validateFanfic(bundle: Bundle): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const byId = new Map(bundle.concepts.map((concept) => [concept.id, concept]));

  for (const concept of bundle.concepts) {
    const frontmatter = concept.frontmatter;
    const origin = frontmatter.origin;

    if (origin === "divergent" && !isBundleLink(frontmatter.diverges_at)) {
      diagnostics.push({
        severity: "error",
        code: "fanfic/divergent-without-divergence",
        path: concept.path,
        message: "origin: divergent requires a `diverges_at` scene or timeline event link",
      });
    }

    if (origin === "source") {
      if (isStale(concept)) {
        const staleAfter = frontmatter.stale_after;
        diagnostics.push({
          severity: "warning",
          code: "profile/stale",
          path: concept.path,
          message: `canon fact is stale since ${String(staleAfter)}; re-check its refs and refresh it (\`/recon\` update mode)`,
        });
      }

      const sources = frontmatter.sources;
      if (!Array.isArray(sources) || sources.length === 0) {
        diagnostics.push({
          severity: "warning",
          code: "fanfic/source-without-sources",
          path: concept.path,
          message: "origin: source should cite the source work in `sources` (OKF §5.1)",
        });
      } else {
        const unfollowable = sources.filter((entry) => {
          if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
          const resource = (entry as Record<string, unknown>).resource;
          if (typeof resource !== "string") return true;
          return !isFollowableResource(resource);
        });
        if (unfollowable.length > 0) {
          const first = unfollowable[0] as Record<string, unknown>;
          diagnostics.push({
            severity: "warning",
            code: "fanfic/unverifiable-source",
            path: concept.path,
            message: `${unfollowable.length} of ${sources.length} sources are neither URLs nor followable paths (for example ${JSON.stringify(first.resource)}); save author-provided material into the bundle and cite that file`,
          });
        }
      }
    }

    const divergesAt = frontmatter.diverges_at;
    if (isBundleLink(divergesAt)) {
      const target = byId.get(linkTargetId(divergesAt));
      if (!target) {
        diagnostics.push({
          severity: "warning",
          code: "fanfic/unresolved-link",
          path: concept.path,
          message: `diverges_at target ${divergesAt} does not exist`,
        });
      } else {
        const type = getType(target);
        if (type !== "Scene" && type !== "Timeline Event") {
          diagnostics.push({
            severity: "warning",
            code: "fanfic/unresolved-link",
            path: concept.path,
            message: `diverges_at should point to a Scene or Timeline Event, found ${type ?? "unknown"}`,
          });
        }
      }
    }

    if (getType(concept) === "Timeline Event") {
      const divergence = frontmatter.divergence;
      if (
        (divergence === "altered" || divergence === "averted") &&
        !isBundleLink(frontmatter.diverges_at)
      ) {
        diagnostics.push({
          severity: "error",
          code: "fanfic/divergence-without-scene",
          path: concept.path,
          message: `divergence: ${divergence} requires \`diverges_at\` pointing at the scene that changes it`,
        });
      }
      if (divergence === "intact" && isBundleLink(frontmatter.diverges_at)) {
        diagnostics.push({
          severity: "warning",
          code: "fanfic/intact-with-divergence",
          path: concept.path,
          message: "divergence: intact but `diverges_at` is set; remove one of them",
        });
      }
      if (divergence === "added" && frontmatter.origin === "source") {
        diagnostics.push({
          severity: "warning",
          code: "fanfic/added-but-source",
          path: concept.path,
          message: "divergence: added describes a fanon event; set `origin: fanon`",
        });
      }
    }

    const sourceWorks = frontmatter.source_works;
    if (Array.isArray(sourceWorks)) {
      for (const link of sourceWorks) {
        if (!isBundleLink(link)) continue;
        const target = byId.get(linkTargetId(link));
        if (!target) {
          diagnostics.push({
            severity: "warning",
            code: "fanfic/unresolved-link",
            path: concept.path,
            message: `source_works target ${link} does not exist`,
          });
        } else if (getType(target) !== "Reference") {
          diagnostics.push({
            severity: "warning",
            code: "fanfic/source-work-not-reference",
            path: concept.path,
            message: `source_works should point to Reference concepts; ${link} is ${getType(target) ?? "unknown"}`,
          });
        }
      }
    }

    if (getType(concept) === "Novel") {
      const canonType = frontmatter.canon_type;
      if (canonType === "canon-compliant" || canonType === "canon-divergent") {
        const works = frontmatter.source_works;
        if (!Array.isArray(works) || works.length === 0) {
          diagnostics.push({
            severity: "error",
            code: "fanfic/missing-source-works",
            path: concept.path,
            message: `canon_type: ${canonType} requires at least one source_works link`,
          });
        }
      }
    }

    for (const entry of sourceEntries(concept)) {
      const resource = entry.resource;
      if (!resource.endsWith(".md")) continue;
      const resolved = resource.startsWith("/")
        ? resource
        : normalizeBundlePath(resource, concept.path);
      if (resolved !== undefined && !byId.has(linkTargetId(resolved))) {
        diagnostics.push({
          severity: "warning",
          code: "fanfic/unresolved-source",
          path: concept.path,
          message: `sources resource ${resource} does not exist in the bundle`,
        });
      }
    }
  }

  return diagnostics;
}
