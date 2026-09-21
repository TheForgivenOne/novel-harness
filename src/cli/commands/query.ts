import { resolve } from "node:path";
import { loadBundle } from "../../core/bundle/bundle.ts";
import type { QueryResult } from "../../core/query/query.ts";
import {
  character,
  divergences,
  location,
  refs,
  search,
  stale,
  stats,
  tag,
  threads,
  timeline,
  when,
} from "../../core/query/query.ts";
import { flagBool, flagNumber, flagString, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

const USAGE = `Usage: novel query <subcommand> [args] [--json] [--bundle <dir>]

Subcommands:
  search <text> [--type <Type>] [--tag <tag>] [--limit <n>]
                                    Full-text search across the bundle
  timeline [--tag <tag>] [--on <date>] [--from <when>] [--to <when>]
                                    Timeline events in order
  when <date|event>                 Canon snapshot: event details, participants,
                                    location, arc, episode, and neighbours
  divergences [--status <status>]   Canon divergence ledger: intact, altered,
                                    averted, added
  stale [--days <n>]                Canon facts due for a refresh
  character <name>                  Scenes, events, and relationships
  at <location>                     Scenes set at a location, in order
  tag <tag>                         Everything tagged, grouped by type
  refs <concept>                    Web references (transcripts, recaps) to fetch
  threads [--dangling]              Plot threads and the scenes that advance them;
                                    --dangling lists only threads no scene references
  stats [--summary]                 Bundle health: words, chapters, fate, tags, sources

Options:
  --json                            Print structured JSON instead of markdown
  --bundle <dir>                    Query any bundle (for example a canon pack)
                                    without an open project
`;

export async function cmdQuery(args: ParsedArgs, cwd: string): Promise<number> {
  const [sub, ...rest] = args.positional;
  if (!sub) {
    process.stderr.write(USAGE);
    return 1;
  }

  try {
    const bundleFlag = flagString(args, "bundle");
    const bundle = bundleFlag
      ? await loadBundle(resolve(cwd, bundleFlag))
      : (await openProject(cwd)).bundle;
    let result: QueryResult;

    switch (sub) {
      case "search": {
        const text = rest.join(" ").trim();
        if (text === "") throw new Error("usage: novel query search <text>");
        result = search(bundle, text, {
          type: flagString(args, "type"),
          tag: flagString(args, "tag"),
          limit: flagNumber(args, "limit"),
        });
        break;
      }
      case "timeline": {
        result = timeline(bundle, {
          tag: flagString(args, "tag"),
          on: flagString(args, "on"),
          from: flagString(args, "from"),
          to: flagString(args, "to"),
        });
        break;
      }
      case "when": {
        const value = rest.join(" ").trim();
        if (value === "") throw new Error("usage: novel query when <date|event>");
        result = when(bundle, value);
        break;
      }
      case "stale": {
        result = stale(bundle, { days: flagNumber(args, "days") });
        break;
      }
      case "divergences": {
        result = divergences(bundle, { status: flagString(args, "status") });
        break;
      }
      case "character": {
        const name = rest.join(" ").trim();
        if (name === "") throw new Error("usage: novel query character <name>");
        result = character(bundle, name);
        break;
      }
      case "at": {
        const name = rest.join(" ").trim();
        if (name === "") throw new Error("usage: novel query at <location>");
        result = location(bundle, name);
        break;
      }
      case "tag": {
        const value = rest.join(" ").trim();
        if (value === "") throw new Error("usage: novel query tag <tag>");
        result = tag(bundle, value);
        break;
      }
      case "refs": {
        const name = rest.join(" ").trim();
        if (name === "") throw new Error("usage: novel query refs <concept>");
        result = refs(bundle, name);
        break;
      }
      case "threads": {
        result = threads(bundle, { dangling: flagBool(args, "dangling") });
        break;
      }
      case "stats": {
        result = stats(bundle, { summary: flagBool(args, "summary") });
        break;
      }
      default:
        process.stderr.write(`Unknown query: ${sub}\n\n${USAGE}`);
        return 1;
    }

    if (flagBool(args, "json")) {
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    } else {
      process.stdout.write(result.markdown.endsWith("\n") ? result.markdown : `${result.markdown}\n`);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
