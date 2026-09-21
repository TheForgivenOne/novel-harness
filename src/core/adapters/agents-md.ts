import { AGENTS_MD_NOTES } from "./notes.ts";
import { instructionsFile } from "./render.ts";
import type { Adapter, AdapterInput, GeneratedFile } from "./types.ts";

export const agentsMdAdapter: Adapter = {
  id: "agents-md",
  description: "Generic AGENTS.md instructions for Codex and compatible agents",
  capabilities: ["instructions"],
  render({ instructions }: AdapterInput): GeneratedFile[] {
    return [
      {
        path: "AGENTS.md",
        content: instructionsFile("AGENTS.md", instructions, AGENTS_MD_NOTES),
        kind: "instructions",
      },
    ];
  },
};
