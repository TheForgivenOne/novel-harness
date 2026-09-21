export interface TypeDef {
  /** Frontmatter `type` value. */
  type: string;
  /** CLI name for `novel new <slug>`. */
  slug: string;
  /** Directory (relative to bundle root) or exact file path for singleton types. */
  home: string;
  /** Profile-required frontmatter keys; missing means a validation error. */
  required: string[];
  /** Whether `status` and `generated` are additionally required. */
  narrative: boolean;
  /** Singleton types live at one exact path. */
  singleton?: boolean;
  /** Optional constrained values per field. */
  enumFields?: Record<string, readonly string[]>;
}

export const STATUS_VALUES = ["draft", "stable", "deprecated"] as const;
export const FATE_VALUES = ["alive", "dead", "unknown"] as const;
export const CATEGORY_VALUES = ["magic", "tech", "culture", "geography"] as const;
export const ORIGIN_VALUES = ["source", "fanon", "divergent"] as const;
export const REF_KINDS = ["transcript", "recap", "wiki", "interview", "other"] as const;
export const DIVERGENCE_VALUES = ["intact", "altered", "averted", "added"] as const;
export const CANON_TYPE_VALUES = [
  "canon-compliant",
  "canon-divergent",
  "alternate-universe",
  "fusion",
  "crossover",
] as const;

export const TYPE_CATALOG: readonly TypeDef[] = [
  {
    type: "Novel",
    slug: "novel",
    home: "novel.md",
    required: ["title"],
    narrative: true,
    singleton: true,
    enumFields: { canon_type: CANON_TYPE_VALUES },
  },
  {
    type: "Plan",
    slug: "plan",
    home: "plan.md",
    required: ["title"],
    narrative: true,
    singleton: true,
  },
  {
    type: "Knowledge",
    slug: "knowledge",
    home: "knowledge.md",
    required: ["title"],
    narrative: true,
    singleton: true,
  },
  {
    type: "Character",
    slug: "character",
    home: "characters",
    required: ["title", "role", "fate"],
    narrative: true,
    enumFields: { fate: FATE_VALUES },
  },
  {
    type: "Location",
    slug: "location",
    home: "locations",
    required: ["title"],
    narrative: false,
  },
  {
    type: "Faction",
    slug: "faction",
    home: "factions",
    required: ["title"],
    narrative: false,
  },
  {
    type: "Worldbuilding",
    slug: "worldbuilding",
    home: "world",
    required: ["title", "category"],
    narrative: false,
    enumFields: { category: CATEGORY_VALUES },
  },
  {
    type: "Item",
    slug: "item",
    home: "items",
    required: ["title"],
    narrative: false,
  },
  {
    type: "Plot Thread",
    slug: "plot-thread",
    home: "plot",
    required: ["title", "status"],
    narrative: true,
  },
  {
    type: "Arc",
    slug: "arc",
    home: "arcs",
    required: ["title"],
    narrative: true,
  },
  {
    type: "Episode",
    slug: "episode",
    home: "episodes",
    required: ["title", "sequence"],
    narrative: true,
  },
  {
    type: "Chapter",
    slug: "chapter",
    home: "chapters",
    required: ["title", "sequence", "pov"],
    narrative: true,
  },
  {
    type: "Scene",
    slug: "scene",
    home: "chapters",
    required: ["title", "sequence", "pov"],
    narrative: true,
  },
  {
    type: "Timeline Event",
    slug: "timeline-event",
    home: "timeline",
    required: ["title", "sequence", "when"],
    narrative: true,
    enumFields: { divergence: DIVERGENCE_VALUES },
  },
  {
    type: "Theme",
    slug: "theme",
    home: "themes",
    required: ["title"],
    narrative: false,
  },
  {
    type: "Relationship",
    slug: "relationship",
    home: "relationships",
    required: ["characters", "kind"],
    narrative: false,
  },
  {
    type: "Reference",
    slug: "reference",
    home: "references",
    required: ["title", "resource"],
    narrative: false,
  },
  {
    type: "Research Note",
    slug: "research-note",
    home: "research",
    required: ["title"],
    narrative: false,
  },
  {
    type: "Outline",
    slug: "outline",
    home: "outline.md",
    required: ["title"],
    narrative: true,
    singleton: true,
  },
  {
    type: "Chapter Outline",
    slug: "chapter-outline",
    home: "chapters",
    required: ["title"],
    narrative: true,
  },
];

export const TYPE_RANK: ReadonlyMap<string, number> = new Map(
  TYPE_CATALOG.map((def, index) => [def.type, index]),
);

export function typeRank(type: string | undefined): number {
  if (!type) return TYPE_CATALOG.length + 1;
  return TYPE_RANK.get(type) ?? TYPE_CATALOG.length;
}

export function getTypeDef(type: string): TypeDef | undefined {
  return TYPE_CATALOG.find((def) => def.type === type);
}

export function normalizeTypeName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function getTypeDefBySlug(slug: string): TypeDef | undefined {
  const normalized = normalizeTypeName(slug);
  return TYPE_CATALOG.find(
    (def) => def.slug === normalized || normalizeTypeName(def.type) === normalized,
  );
}

export function formatTypeCatalog(): string {
  const width = Math.max(...TYPE_CATALOG.map((def) => def.type.length));
  return TYPE_CATALOG.map((def) => `  ${def.type.padEnd(width)}  (novel new ${def.slug})`).join(
    "\n",
  );
}
