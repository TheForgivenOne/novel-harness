import { AGENTS } from "./agents.ts";
import { HOOKS } from "./hooks.ts";
import { SKILLS } from "./skills.ts";
import { TOOLS } from "./tools.ts";
import type { AgentDefinition, HookDefinition, SkillDefinition, ToolDefinition } from "../types.ts";

export { AGENTS } from "./agents.ts";
export { HOOKS } from "./hooks.ts";
export { SKILLS } from "./skills.ts";
export { TOOLS } from "./tools.ts";

export interface ArtifactKit {
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  tools: ToolDefinition[];
  hooks: HookDefinition[];
}

export function artifactKit(): ArtifactKit {
  return { agents: AGENTS, skills: SKILLS, tools: TOOLS, hooks: HOOKS };
}
