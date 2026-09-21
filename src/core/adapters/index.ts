import { agentsMdAdapter } from "./agents-md.ts";
import { claudeAdapter } from "./claude.ts";
import { geminiAdapter } from "./gemini.ts";
import { opencodeAdapter } from "./opencode.ts";
import type { Adapter } from "./types.ts";

export const ADAPTERS: Adapter[] = [
  agentsMdAdapter,
  opencodeAdapter,
  claudeAdapter,
  geminiAdapter,
];

export function getAdapter(id: string): Adapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === id);
}

export function adapterIds(): string[] {
  return ADAPTERS.map((adapter) => adapter.id);
}

export type { Adapter, AdapterInput, ArtifactKind, AgentDefinition, SkillDefinition, ToolDefinition, HookDefinition, GeneratedFile, Workflow } from "./types.ts";
