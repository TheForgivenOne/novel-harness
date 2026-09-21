import { geminiCommand, instructionsFile } from "./render.ts";
import type { Adapter, AdapterInput, GeneratedFile } from "./types.ts";

const NOTES = [
  "Commands live in `.gemini/commands/` and are invoked as `/name`.",
  "Run `novel context <concept>` to load a scene's chapter, cast, location, and neighbors.",
];

export const geminiAdapter: Adapter = {
  id: "gemini",
  description: "Gemini CLI instructions and custom commands (TOML)",
  capabilities: ["instructions", "commands"],
  render({ workflows, instructions }: AdapterInput): GeneratedFile[] {
    const files: GeneratedFile[] = [
      {
        path: "GEMINI.md",
        content: instructionsFile("GEMINI.md", instructions, NOTES),
        kind: "instructions",
      },
    ];
    for (const workflow of workflows) {
      files.push({
        path: `.gemini/commands/${workflow.name}.toml`,
        content: geminiCommand(workflow),
        kind: "commands",
      });
    }
    return files;
  },
};
