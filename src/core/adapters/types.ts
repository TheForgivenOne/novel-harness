export interface Workflow {
  /** Command name without the slash, for example `draft`. */
  name: string;
  /** One-line description shown in the agent's command menu. */
  description: string;
  /** Hint shown during autocomplete, for example `<scene concept id>`. */
  argumentHint?: string;
  /** Prompt template. Use `{{args}}` where user arguments belong. */
  body: string;
}

export type ArtifactKind =
  | "instructions"
  | "commands"
  | "agents"
  | "skills"
  | "tools"
  | "hooks";

export type PermissionAction = "allow" | "ask" | "deny";
export type PermissionRule = PermissionAction | Record<string, PermissionAction>;

export interface AgentDefinition {
  name: string;
  description: string;
  /** Claude tool allow-list; omitted means all tools. */
  tools?: string[];
  /** opencode permission map; values are shorthand actions or nested glob rules. */
  permission?: Record<string, PermissionRule>;
  prompt: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  body: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** Full TypeScript source for `.opencode/tools/<name>.ts`. */
  source: string;
}

export interface HookDefinition {
  name: string;
  description: string;
  /** Full TypeScript source for `.opencode/plugin/<name>.ts`. */
  source: string;
}

export interface AdapterInput {
  workflows: Workflow[];
  /** Canonical instructions document (markdown, no frontmatter). */
  instructions: string;
  agents?: AgentDefinition[];
  skills?: SkillDefinition[];
  tools?: ToolDefinition[];
  hooks?: HookDefinition[];
}

export interface GeneratedFile {
  /** Path relative to the project root. */
  path: string;
  content: string;
  kind: ArtifactKind;
}

export interface Adapter {
  id: string;
  description: string;
  capabilities: ArtifactKind[];
  render(input: AdapterInput): GeneratedFile[];
}
