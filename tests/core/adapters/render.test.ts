import { describe, expect, test } from "bun:test";
import { markdownAgent } from "../../../src/core/adapters/render.ts";
import type { AgentDefinition } from "../../../src/core/adapters/types.ts";

const agent: AgentDefinition = {
  name: "scoped",
  description: "Scoped editor",
  permission: { edit: { "story/**": "allow", "*": "ask" }, bash: "allow" },
  prompt: "Prompt.",
};

describe("markdownAgent nested permissions", () => {
  test("renders nested glob rules under the key", () => {
    const out = markdownAgent(agent);
    expect(out).toContain("permission:");
    expect(out).toContain("  edit:");
    expect(out).toContain('    "story/**": allow');
    expect(out).toContain('    "*": ask');
    expect(out).toContain("  bash: allow");
  });
});