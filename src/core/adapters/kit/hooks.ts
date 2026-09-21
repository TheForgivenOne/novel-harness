import type { HookDefinition } from "../types.ts";
import { GENERATED_HEADER_LINE as MARKER } from "../render.ts";

const NOVEL_GUARD = `${MARKER}
import type { Plugin } from "@opencode-ai/plugin";

const STORY_FILE = /(^|\\/)story\\/.*\\.md$/;
const PATCH_FILE = /^\\*\\*\\* (?:Add|Update|Delete) File: (.+)$/gm;
const PATCH_MOVE = /^\\*\\*\\* Move to: (.+)$/gm;

export function touchedStoryPath(tool: string, args: Record<string, unknown>): string | undefined {
  if (tool === "write" || tool === "edit") {
    const filePath = typeof args.filePath === "string" ? args.filePath : "";
    return STORY_FILE.test(filePath) ? filePath : undefined;
  }
  if (tool === "apply_patch") {
    const patchText = typeof args.patchText === "string" ? args.patchText : "";
    for (const pattern of [PATCH_FILE, PATCH_MOVE]) {
      for (const match of patchText.matchAll(pattern)) {
        const path = (match[1] ?? "").trim();
        if (STORY_FILE.test(path)) return path;
      }
    }
  }
  return undefined;
}

export const NovelGuard: Plugin = async ({ $, worktree }) => {
  return {
    "tool.execute.after": async (input, output) => {
      const filePath = touchedStoryPath(input.tool, input.args);
      if (filePath === undefined) return;
      const result = await $\`novel validate\`.cwd(worktree).quiet().nothrow();
      const text = result.stdout.toString().trim();
      if (text === "") return;
      const tail = text.split("\\n").slice(-8).join("\\n");
      const existing = (output as { output?: string }).output ?? "";
      (output as { output?: string }).output = \`\${existing.trimEnd()}\\n\\n[novel-guard]\\n\${tail}\`;
      await Bun.write(
        \`\${worktree}/.novel/last-validate.json\`,
        JSON.stringify(
          { at: new Date().toISOString(), file: filePath, tool: input.tool, result: text },
          null,
          2,
        ),
      );
    },
  };
};
`;

export const HOOKS: HookDefinition[] = [
  {
    name: "novel-guard",
    description: "Validate the bundle after story writes and surface diagnostics in-session",
    source: NOVEL_GUARD,
  },
];
