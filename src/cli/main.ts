import { VERSION } from "../version.ts";
import { parseArgs, type ParsedArgs } from "./args.ts";
import { cmdAudit } from "./commands/audit.ts";
import { cmdBuild } from "./commands/build.ts";
import { cmdCanon } from "./commands/canon.ts";
import { cmdContext } from "./commands/context.ts";
import { cmdConvert } from "./commands/convert.ts";
import { cmdDiff } from "./commands/diff.ts";
import { cmdDoctor } from "./commands/doctor.ts";
import { cmdExport } from "./commands/export.ts";
import { cmdFetch } from "./commands/fetch.ts";
import { cmdGraph } from "./commands/graph.ts";
import { cmdImport } from "./commands/import.ts";
import { cmdIndex } from "./commands/index.ts";
import { cmdInit } from "./commands/init.ts";
import { cmdMerge } from "./commands/merge.ts";
import { cmdMv } from "./commands/mv.ts";
import { cmdMigrate } from "./commands/migrate.ts";
import { cmdNew } from "./commands/new.ts";
import { cmdOutline } from "./commands/outline.ts";
import { cmdQuery } from "./commands/query.ts";
import { cmdRename } from "./commands/rename.ts";
import { cmdRenumber } from "./commands/renumber.ts";
import { cmdRm } from "./commands/rm.ts";
import { cmdSet } from "./commands/set.ts";
import { cmdStatus } from "./commands/status.ts";
import { cmdSync } from "./commands/sync.ts";
import { cmdTag } from "./commands/tag.ts";
import { cmdValidate } from "./commands/validate.ts";

const HELP = `novel — a harness for novel creation on an OKF v0.2 bundle

Usage: novel <command> [options]

Commands:
  init [dir]              Scaffold a new novel project and render adapters
  new <type> [name]       Create a concept in the bundle (--from-template <name>)
  import <file>           Bulk-create concepts from a CSV or YAML file
  rename <concept> <name> Rename a concept and rewrite links to it
  renumber                Compact sequence numbers (--sort when orders by date)
  rm <concept>            Remove a concept (refuses if linked; --force)
  mv <scene> --to <ch>    Move a scene to another chapter and rewrite links
  convert <from> <to>     Convert concepts between types [--file <path>]
  merge <primary> <other> Merge a duplicate concept into a primary [--yes]
  set <concept> f=v ...   Update frontmatter fields on a concept
  tag --batch <rules>     Apply YAML tagging rules to concepts
  validate [--fix]        Validate the bundle; --only/--severity/--quiet/--summary filter output
  audit [options]         Project, content, and source report (--fix, --receipts, --online)
  doctor [--fix]          Check config, structure, adapters, and content
  migrate                 Update an old project and render the /migrate command
  index                   Regenerate all index.md files
  context [<concept> | --story]
                          Print the context slice; --story is the whole-story slice
  query <subcommand>      Search, timeline, divergence, and stats queries
  outline [--check]       Print the story outline; --check reports drift vs files
  status                  Per-chapter drafting progress, word budgets, and next scene
  canon <export|import>   Move canon between projects as a reusable pack
  build [--out <dir>]     Assemble the manuscript
  export [--format md|html] [--out <dir>]  Export the manuscript
  diff [ref1] [ref2]      Git diff of bundle concepts (default: working tree)
  fetch <url>             Fetch a page and log a receipt (--max-bytes <n>)
  graph [--html]          Emit the relationship graph
  sync                    Re-render agent adapters (AGENTS.md, CLAUDE.md, ...)

Options:
  -h, --help              Show this help
  -v, --version           Show the version

Run \`novel init\` to start a project, then \`novel new character "Elena Voss"\`.
`;

type Handler = (args: ParsedArgs, cwd: string) => Promise<number>;

interface CommandHelp {
  usage: string;
  summary: string;
  flags?: string[];
  examples?: string[];
}

const COMMAND_HELP: Record<string, CommandHelp> = {
  init: {
    usage: "init [dir]",
    summary: "Scaffold a novel project and render agent adapters.",
    flags: [
      "--name <title>        Novel title",
      "--author <actor>      Author actor (human:you)",
      "--fandom <name>       Fanfiction fandom",
      "--canon-type <type>   canon-compliant | canon-divergent | alternate-universe | fusion | crossover",
      "--targets <list>      Comma-separated adapter targets",
    ],
    examples: ["novel init my-novel --name \"The Hollow Crown\" --author human:you"],
  },
  new: {
    usage: "new <type> [name]",
    summary: "Create one concept at the correct path with frontmatter.",
    flags: [
      "--pov <character>       Point-of-view character for chapters and scenes",
      "--chapter <id|title|slug>  Target chapter for a scene (required when several chapters exist)",
      "--cast <a,b>            Scene cast, comma-separated characters",
      "--location <place>      Scene location",
      "--when <date>           In-world date for scenes and timeline events",
      "--tags <a,b>            Tags, comma-separated",
      "--sequence/other fields per type; see `novel new <type> --help` examples",
      "--from-template <name>  Prefill from .novel/templates/<name>.md",
      "--source-work           Attach a reference to the novel's source_works",
    ],
    examples: [
      "novel new chapter \"The Archive\"",
      "novel new scene \"A Map\" --chapter ch-01 --cast elena-voss --location the-archive --when \"January 9, 2011\"",
    ],
  },
  import: {
    usage: "import <file.csv|file.yaml> [--dry-run]",
    summary:
      "Bulk-create concepts. Rows are validated before anything is written; sequences stay continuous, duplicates are skipped, and the batch is one index pass.",
    flags: ["--dry-run   Validate and report without writing"],
    examples: [
      "novel import chapters.csv",
      "novel import plan.yaml --dry-run",
    ],
  },
  rename: {
    usage: "rename <concept> <new-name>",
    summary: "Rename a concept's file and title and rewrite every link to it.",
    examples: ["novel rename characters/sophia-chen \"Sophia Morgan\""],
  },
  convert: {
    usage: "convert <from-type> <to-type> [--file <path>]",
    summary: "Convert concepts between types and relocate them.",
    flags: ["--file <path>   Convert only this concept"],
    examples: ["novel convert chapter arc --file story/chapters/season-1-wolf-moon.md"],
  },
  merge: {
    usage: "merge <primary> <other> [--yes]",
    summary: "Merge a duplicate concept into the primary (preview unless --yes).",
    flags: ["--yes   Apply the merge"],
    examples: ["novel merge characters/vernon-boyd characters/boyd --yes"],
  },
  rm: {
    usage: "rm <concept> [--force] [--dry-run]",
    summary:
      "Remove a concept. Refuses when other concepts link to it unless --force; --force leaves those links broken for the validator to report.",
    flags: ["--force     Remove even when inbound links exist", "--dry-run   Report without deleting"],
    examples: ["novel rm chapters/ch-01/scenes/sc-99", "novel rm locations/old-archive --force"],
  },
  mv: {
    usage: "mv <scene> --to <chapter> [--sequence N] [--dry-run] | mv <chapter> --to <new-slug>",
    summary:
      "Move a scene to another chapter (into its scenes/ folder), or move a chapter to a new slug with its whole folder. Ids change, so links are rewritten. Use `novel rename` for same-directory renames.",
    flags: ["--to <target>   Target chapter for a scene, or the new slug for a chapter", "--sequence N   Override the appended sequence", "--dry-run"],
    examples: [
      "novel mv chapters/ch-01/sc-01 --to ch-02 --sequence 1",
      "novel mv chapters/ch-01 --to ch-03",
    ],
  },
  tag: {
    usage: "tag --batch <rules.yaml>",
    summary: "Apply YAML match/add tagging rules to many concepts at once.",
    flags: ["--batch <file>   Rules file with match and add entries"],
    examples: ["novel tag --batch tag-rules.yaml"],
  },
  set: {
    usage: "set <concept> field=value [field=value...]",
    summary:
      "Update frontmatter fields on one concept. Links resolve by id, slug, or title; tags and link lists are comma-separated. `title` changes the display title only (file renames are `novel rename`).",
    flags: [
      "--unset a,b     Remove fields",
      "--at <scene>    Set diverges_at to a Scene or Timeline Event",
      "--dry-run       Report without writing",
    ],
    examples: [
      "novel set characters/elena-voss tags=cast,werewolf",
      "novel set timeline/x divergence=altered --at chapters/ch-01/sc-01",
    ],
  },
  validate: {
    usage: "validate [--fix] [--only <id|glob>] [--severity error|warning] [--quiet] [--summary] [--json]",
    summary:
      "Check OKF v0.2 conformance and the novel profile; errors exit 1. Filters limit which diagnostics are printed; the exit code still reflects the whole bundle.",
    flags: [
      "--fix               Regenerate indexes, unquote sources, normalize added events",
      "--only <id|glob>    Show only diagnostics under matching paths",
      "--severity <level>  Show only error or warning diagnostics",
      "--quiet             Errors only",
      "--summary           Counts per code, no per-item lines",
      "--json              Machine-readable diagnostics",
    ],
    examples: [
      "novel validate",
      "novel validate --fix",
      "novel validate --only chapters/ch-01 --quiet",
    ],
  },
  renumber: {
    usage: "renumber [--type <chapter|scene|timeline>] [--start <n>] [--step <n>] [--sort sequence|when] [--dry-run]",
    summary:
      "Compact sequence numbers: one contiguous run for chapters and timeline events, one per chapter for scenes. `--sort when` orders Timeline Events by their `when` date instead of their current sequence.",
    flags: [
      "--type <list>       chapter, scene, timeline (default: all)",
      "--start <n>         First number to assign (default 1)",
      "--step <n>          Gap between numbers (default 1)",
      "--sort <field>      Timeline Event order: sequence or when (default: sequence)",
      "--dry-run           Report without writing",
    ],
    examples: [
      "novel renumber --dry-run",
      "novel renumber --type scene --start 10",
      "novel renumber --type timeline --sort when",
    ],
  },
  audit: {
    usage: "audit [--fix] [--receipts] [--online] [--only <id|glob>] [--severity error|warning] [--quiet] [--summary] [--json]",
    summary:
      "One read-only report: project drift, content diagnostics, and source classification. --fix applies the safe fixes (indexes, quoted sources, added events).",
    flags: [
      "--fix               Regenerate indexes and apply safe content fixes",
      "--receipts          Cross-check cited URLs against .novel/fetch-log.jsonl",
      "--online            Check live HTTP status (401/403/429 and 5xx are not broken)",
      "--only <id|glob>    Limit content/source entries to matching paths",
      "--severity <level>  Show only error or warning diagnostics",
      "--quiet             Errors only",
      "--summary           Counts per code, no per-item lines",
      "--json              Machine-readable report",
    ],
    examples: [
      "novel audit --quiet",
      "novel audit --only chapters/ch-01 --summary",
      "novel audit --receipts --online",
    ],
  },
  doctor: {
    usage: "doctor [--fix]",
    summary: "Report or fix config, structure, adapters, indexes, and content state.",
    flags: ["--fix   Apply mechanical fixes only"],
  },
  migrate: {
    usage: "migrate [--spec <rules.yaml>]",
    summary: "Update an old project; with --spec, run convert/merge/tag migrations.",
    flags: ["--spec <file>   Validated YAML migration actions"],
  },
  index: {
    usage: "index",
    summary: "Regenerate every index.md in the bundle.",
  },
  context: {
    usage: "context [<concept> | --story] [--so-far] [--max-body <n>]",
    summary: "Print the prepared context slice for an agent.",
    flags: [
      "--story       Whole-story slice: novel, plan, outline, threads, arcs, timeline",
      "--so-far      Scene context: append who-knows-what reader state from story/knowledge.md",
      "--max-body <n>   Truncate non-target bodies (0 disables)",
    ],
  },
  query: {
    usage: "query <subcommand> [term] [flags]",
    summary: "Deterministic, LLM-free reads over the bundle.",
    flags: [
      "subcommands: search, timeline, when, divergences, stale, character, at, tag, refs, stats, threads",
      "--summary            Compact `query stats` output (no per-chapter lines)",
      "--json              Machine-readable output",
      "--bundle <dir>      Query a bundle without a project",
      "--type/--tag/--limit/--on/--from/--to/--status/--days/--dangling  Subcommand filters",
    ],
    examples: [
      "novel query timeline --on \"November 2011\"",
      "novel query character stiles-stilinski --json",
    ],
  },
  outline: {
    usage: "outline [--check]",
    summary:
      "Print story/outline.md; --check reports drift between outline rows and chapter/scene files (exit 1 on drift; misplaced scenes are warnings).",
    flags: ["--check   Drift report: rows without files and files without rows"],
    examples: ["novel outline --check"],
  },
  status: {
    usage: "status",
    summary: "Per-chapter progress: drafted vs stub scenes, words vs budget, and the next scene to draft.",
  },
  canon: {
    usage: "canon <export|import> [dir]",
    summary: "Move canon between projects as a reusable pack.",
    flags: ["--out <dir>   Export destination", "--force   Overwrite source-vs-source conflicts on import"],
    examples: ["novel canon export", "novel canon import ../other/canon/teenwolf"],
  },
  build: {
    usage: "build [--out <dir>]",
    summary: "Assemble the manuscript in sequence order.",
    flags: ["--out <dir>   Output directory"],
  },
  export: {
    usage: "export [--format md|html] [--out <dir>]",
    summary: "Export the manuscript (epub/pdf not supported yet).",
    flags: ["--format md|html   Output format", "--out <dir>   Output directory"],
  },
  diff: {
    usage: "diff [ref1] [ref2] [--json]",
    summary: "Git diff of bundle concepts; defaults to working tree vs HEAD.",
    flags: ["--json   Machine-readable output"],
  },
  fetch: {
    usage: "fetch <url> [--max-bytes <n>]",
    summary: "Fetch a page for canon research and log a sha256 receipt.",
    flags: ["--max-bytes <n>   Maximum characters to print (default 20000)"],
    examples: ["novel fetch https://example.com/episode --max-bytes 4000"],
  },
  graph: {
    usage: "graph [--html] [--out <path>]",
    summary: "Emit the relationship graph as JSON or a self-contained HTML file.",
    flags: ["--html   Render HTML", "--out <path>   Output path"],
  },
  sync: {
    usage: "sync",
    summary: "Re-render agent adapters and the artifact kit; never clobbers hand edits.",
  },
};

function commandHelpText(help: CommandHelp): string {
  const lines: string[] = [`novel ${help.usage}`, "", help.summary, ""];
  if (help.flags !== undefined && help.flags.length > 0) {
    lines.push("Flags:");
    for (const flag of help.flags) lines.push(`  ${flag}`);
    lines.push("");
  }
  if (help.examples !== undefined && help.examples.length > 0) {
    lines.push("Examples:");
    for (const example of help.examples) lines.push(`  ${example}`);
    lines.push("");
  }
  return lines.join("\n");
}

const COMMANDS: Record<string, Handler> = {
  init: cmdInit,
  new: cmdNew,
  import: cmdImport,
  rename: cmdRename,
  renumber: cmdRenumber,
  rm: cmdRm,
  mv: cmdMv,
  convert: cmdConvert,
  merge: cmdMerge,
  set: cmdSet,
  tag: cmdTag,
  validate: cmdValidate,
  audit: cmdAudit,
  doctor: cmdDoctor,
  migrate: cmdMigrate,
  index: cmdIndex,
  context: cmdContext,
  query: cmdQuery,
  outline: cmdOutline,
  status: cmdStatus,
  canon: cmdCanon,
  build: cmdBuild,
  export: cmdExport,
  diff: cmdDiff,
  fetch: cmdFetch,
  graph: cmdGraph,
  sync: cmdSync,
};

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return 0;
  }

  if (command === "--version" || command === "-v") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
    return 1;
  }

  const args = parseArgs(rest);
  if (args.flags.help === true || args.flags.h === true) {
    const help = COMMAND_HELP[command];
    process.stdout.write(help ? commandHelpText(help) : HELP);
    return 0;
  }

  return handler(args, process.cwd());
}
