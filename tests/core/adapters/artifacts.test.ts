import { describe, expect, test } from "bun:test";
import { ADAPTERS } from "../../../src/core/adapters/index.ts";
import { SAMPLE_INPUT } from "../../sample.ts";

describe("adapter capabilities", () => {
  test("declared capabilities match each target", () => {
    const matrix = Object.fromEntries(ADAPTERS.map((adapter) => [adapter.id, adapter.capabilities]));
    expect(matrix).toEqual({
      "agents-md": ["instructions"],
      opencode: ["instructions", "commands", "agents", "skills", "tools", "hooks"],
      claude: ["instructions", "commands", "agents", "skills"],
      gemini: ["instructions", "commands"],
    });
  });

  test("every generated file is tagged with a declared kind", () => {
    for (const adapter of ADAPTERS) {
      for (const file of adapter.render(SAMPLE_INPUT)) {
        expect(adapter.capabilities).toContain(file.kind);
      }
    }
  });
});
