import { AGENTS_MD_NOTES } from "./notes.ts";
import { instructionsFile, markdownAgent, markdownCommand, markdownSkill } from "./render.ts";
import type { Adapter, AdapterInput, GeneratedFile } from "./types.ts";

export const opencodeAdapter: Adapter = {
  id: "opencode",
  description: "opencode instructions, commands, agents, skills, tools, and guard plugin",
  capabilities: ["instructions", "commands", "agents", "skills", "tools", "hooks"],
  render({ workflows, instructions, agents = [], skills = [], tools = [], hooks = [] }: AdapterInput): GeneratedFile[] {
    const files: GeneratedFile[] = [
      {
        path: "AGENTS.md",
        content: instructionsFile("AGENTS.md", instructions, AGENTS_MD_NOTES),
        kind: "instructions",
      },
    ];
    for (const workflow of workflows) {
      files.push({
        path: `.opencode/command/${workflow.name}.md`,
        content: markdownCommand(workflow),
        kind: "commands",
      });
    }
    for (const agent of agents) {
      files.push({
        path: `.opencode/agent/${agent.name}.md`,
        content: markdownAgent(agent),
        kind: "agents",
      });
    }
    for (const skill of skills) {
      files.push({
        path: `.opencode/skills/${skill.name}/SKILL.md`,
        content: markdownSkill(skill),
        kind: "skills",
      });
    }
    for (const tool of tools) {
      files.push({
        path: `.opencode/tools/${tool.name}.ts`,
        content: tool.source,
        kind: "tools",
      });
    }
    for (const hook of hooks) {
      files.push({
        path: `.opencode/plugin/${hook.name}.ts`,
        content: hook.source,
        kind: "hooks",
      });
    }
    return files;
  },
};
