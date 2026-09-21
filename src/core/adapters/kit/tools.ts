import type { ToolDefinition } from "../types.ts";
import { GENERATED_HEADER_LINE as MARKER } from "../render.ts";

const NOVEL_QUERY = `${MARKER}
import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Run a deterministic novel-harness query and return its JSON output",
  args: {
    subcommand: tool.schema
      .string()
      .describe("search | timeline | when | character | at | tag | refs | stats | divergences | stale"),
    term: tool.schema.string().optional().describe("Search term, concept id, tag, or date"),
    flags: tool.schema.string().optional().describe("Extra flags, for example --type Character --limit 5"),
  },
  async execute(args, context) {
    const command = ["novel", "query", args.subcommand];
    if (args.term) command.push(args.term);
    command.push("--json");
    if (args.flags) command.push(...args.flags.split(/\\s+/).filter(Boolean));
    const proc = Bun.spawn(command, { cwd: context.worktree, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) return \`novel query failed (\${exitCode}): \${stderr.trim() || stdout.trim()}\`;
    return stdout.trim();
  },
});
`;

const NOVEL_CONTEXT = `${MARKER}
import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Load the novel-harness context slice: pass --story for the whole-story outline slice, or a concept with --so-far for who-knows-what reader state",
  args: {
    concept: tool.schema
      .string()
      .optional()
      .describe("Concept id or path, for example chapters/ch-01/sc-01"),
    story: tool.schema
      .boolean()
      .optional()
      .describe("Whole-story slice (no concept needed)"),
    soFar: tool.schema
      .boolean()
      .optional()
      .describe("Append reader state from story/knowledge.md"),
  },
  async execute(args, context) {
    const command = ["novel", "context"];
    if (args.story) command.push("--story");
    if (args.concept) command.push(args.concept);
    if (args.soFar) command.push("--so-far");
    const proc = Bun.spawn(command, {
      cwd: context.worktree,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) return \`novel context failed (\${exitCode}): \${stderr.trim() || stdout.trim()}\`;
    return stdout.trim();
  },
});
`;

const NOVEL_VALIDATE = `${MARKER}
import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Run novel validate and return diagnostics for the current bundle",
  args: {},
  async execute(_args, context) {
    const proc = Bun.spawn(["novel", "validate"], {
      cwd: context.worktree,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (stdout.trim() === "" && stderr.trim() !== "") return stderr.trim();
    return \`exit \${exitCode}\\n\${stdout.trim()}\`;
  },
});
`;

const NOVEL_FETCH = `${MARKER}
import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Fetch a page for canon research. Logs a sha256 receipt to .novel/fetch-log.jsonl and returns the page text",
  args: {
    url: tool.schema.string().describe("Exact page URL to fetch"),
    max_bytes: tool.schema.number().optional().describe("Maximum characters to return (default 20000)"),
  },
  async execute(args, context) {
    const command = ["novel", "fetch", args.url];
    if (args.max_bytes !== undefined) command.push("--max-bytes", String(args.max_bytes));
    const proc = Bun.spawn(command, { cwd: context.worktree, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) return \`novel fetch failed (\${exitCode}): \${stderr.trim() || stdout.trim()}\`;
    return stdout.trim();
  },
});
`;

export const TOOLS: ToolDefinition[] = [
  {
    name: "novel_query",
    description: "Deterministic bundle queries via novel query --json",
    source: NOVEL_QUERY,
  },
  {
    name: "novel_context",
    description: "Prepared context slice for a concept",
    source: NOVEL_CONTEXT,
  },
  {
    name: "novel_validate",
    description: "Bundle validation diagnostics",
    source: NOVEL_VALIDATE,
  },
  {
    name: "novel_fetch",
    description: "Receipt-logging page fetch for canon research",
    source: NOVEL_FETCH,
  },
];
