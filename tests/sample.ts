import type { AdapterInput, Workflow } from "../src/core/adapters/types.ts";

export const SAMPLE_WORKFLOW: Workflow = {
  name: "draft",
  description: "Draft a scene",
  argumentHint: "<scene id>",
  body: "Draft `{{args}}` now.\n",
};

export const SAMPLE_INPUT: AdapterInput = {
  workflows: [SAMPLE_WORKFLOW],
  instructions: "# Instructions\n\nDo good work.\n",
};
