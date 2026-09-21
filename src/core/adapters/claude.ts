import { claudeAgent, instructionsFile, markdownCommand, markdownSkill } from "./render.ts";
import type { Adapter, AdapterInput, GeneratedFile } from "./types.ts";

const NOTES = [
  "Commands live in `.claude/commands/` and are invoked as `/name`.",
  "Run `novel context <concept>` to load a scene's chapter, cast, location, and neighbors.",
];

export const claudeAdapter: Adapter = {
  id: "claude",
  description: "Claude Code instructions, commands, agents, and skills",
  capabilities: ["instructions", "commands", "agents", "skills"],
  render({ workflows, instructions, agents = [], skills = [] }: AdapterInput): GeneratedFile[] {
    const files: GeneratedFile[] = [
      {
        path: "CLAUDE.md",
        content: instructionsFile("CLAUDE.md", instructions, NOTES),
        kind: "instructions",
      },
    ];
    for (const workflow of workflows) {
      files.push({
        path: `.claude/commands/${workflow.name}.md`,
        content: markdownCommand(workflow),
        kind: "commands",
      });
    }
    for (const agent of agents) {
      files.push({
        path: `.claude/agents/${agent.name}.md`,
        content: claudeAgent(agent),
        kind: "agents",
      });
    }
    for (const skill of skills) {
      files.push({
        path: `.claude/skills/${skill.name}/SKILL.md`,
        content: markdownSkill(skill),
        kind: "skills",
      });
    }
    return files;
  },
};
