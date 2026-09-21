import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../../../src/cli/args.ts";
import { cmdQuery } from "../../../src/cli/commands/query.ts";
import { initProject } from "../../../src/core/project/init.ts";

async function queryProject() {
  const root = await mkdtemp(join(tmpdir(), "novel-harness-query-cmd-"));
  await initProject(root, { name: "Query Test", author: "human:tester" });
  return root;
}

async function writeBundleFiles(dir: string, files: Record<string, string>): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
}

describe("novel query command", () => {
  test("search returns matches and --json emits structured output", async () => {
    const root = await queryProject();
    await writeBundleFiles(join(root, "story"), {
      "characters/scott.md": `---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\n---\n\nA werewolf.\n`,
    });
    let out = "";
    const original = process.stdout.write.bind(process.stdout);
    try {
      const chunks: string[] = [];
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      const code = await cmdQuery(parseArgs(["search", "werewolf"]), root);
      expect(code).toBe(0);
      out = chunks.join("");
    } finally {
      process.stdout.write = original;
    }
    expect(out).toContain("Scott McCall");
  });

  test("--json prints the structured result", async () => {
    const root = await queryProject();
    await writeBundleFiles(join(root, "story"), {
      "characters/scott.md": `---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\n---\n\nA werewolf.\n`,
    });
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    try {
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      const code = await cmdQuery(parseArgs(["search", "werewolf", "--json"]), root);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = original;
    }
    const parsed = JSON.parse(chunks.join(""));
    expect(parsed.hits.length).toBeGreaterThan(0);
  });

  test("timeline accepts --tag and --on filters", async () => {
    const root = await queryProject();
    await writeBundleFiles(join(root, "story"), {
      "timeline/full-moon.md": `---\ntype: Timeline Event\ntitle: Full Moon\nsequence: 1\nwhen: 2011-01-09\ntags: [canon]\n---\n`,
    });
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    try {
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      const code = await cmdQuery(parseArgs(["timeline", "--tag", "canon"]), root);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = original;
    }
    expect(chunks.join("")).toContain("Full Moon");
  });

  test("when resolves an event by name", async () => {
    const root = await queryProject();
    await writeBundleFiles(join(root, "story"), {
      "timeline/full-moon.md": `---\ntype: Timeline Event\ntitle: Full Moon\nsequence: 1\nwhen: 2011-01-09\n---\n`,
    });
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    try {
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      const code = await cmdQuery(parseArgs(["when", "Full Moon"]), root);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = original;
    }
    expect(chunks.join("")).toContain("Full Moon");
  });

  test("divergences lists non-intact events", async () => {
    const root = await queryProject();
    await writeBundleFiles(join(root, "story"), {
      "timeline/full-moon.md": `---\ntype: Timeline Event\ntitle: Full Moon\nsequence: 1\nwhen: 2011-01-09\ndivergence: altered\ndiverges_at: /chapters/the-first-day/scenes/the-bite.md\n---\n`,
      "chapters/the-first-day.md": `---\ntype: Chapter\ntitle: The First Day\nsequence: 1\n---\n`,
      "chapters/the-first-day/scenes/the-bite.md": `---\ntype: Scene\ntitle: The Bite\nsequence: 1\npov: /characters/scott.md\nwhen: 2011-01-09\n---\n`,
      "characters/scott.md": `---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\n---\n`,
    });
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    try {
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      const code = await cmdQuery(parseArgs(["divergences"]), root);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = original;
    }
    expect(chunks.join("")).toContain("Full Moon");
  });

  test("stats reports chapter word counts", async () => {
    const root = await queryProject();
    await writeBundleFiles(join(root, "story"), {
      "chapters/the-first-day.md": `---\ntype: Chapter\ntitle: The First Day\nsequence: 1\n---\n`,
      "chapters/the-first-day/scenes/the-bite.md": `---\ntype: Scene\ntitle: The Bite\nsequence: 1\npov: /characters/scott.md\n---\n\nIt was a quiet night.\n`,
      "characters/scott.md": `---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\n---\n`,
    });
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    try {
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      const code = await cmdQuery(parseArgs(["stats"]), root);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = original;
    }
    expect(chunks.join("")).toContain("The First Day");
  });

  test("unknown query prints usage and exits 1", async () => {
    const root = await queryProject();
    const chunks: string[] = [];
    const errs: string[] = [];
    const out = process.stdout.write.bind(process.stdout);
    const err = process.stderr.write.bind(process.stderr);
    try {
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      process.stderr.write = ((chunk: unknown) => {
        errs.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;
      const code = await cmdQuery(parseArgs(["frobnicate"]), root);
      expect(code).toBe(1);
    } finally {
      process.stdout.write = out;
      process.stderr.write = err;
    }
    expect(errs.join("")).toContain("Unknown query");
  });

  test("query without a subcommand prints usage and exits 1", async () => {
    const root = await queryProject();
    const errs: string[] = [];
    const err = process.stderr.write.bind(process.stderr);
    try {
      process.stderr.write = ((chunk: unknown) => {
        errs.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;
      const code = await cmdQuery(parseArgs([]), root);
      expect(code).toBe(1);
    } finally {
      process.stderr.write = err;
    }
    expect(errs.join("")).toContain("Usage: novel query");
  });

  test("--bundle queries an external bundle without a project", async () => {
    const root = await queryProject();
    const external = await mkdtemp(join(tmpdir(), "novel-harness-query-ext-"));
    await writeBundleFiles(external, {
      "characters/watson.md": `---\ntype: Character\ntitle: John Watson\nrole: ally\n---\n\nA doctor.\n`,
    });
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    try {
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      const code = await cmdQuery(parseArgs(["search", "doctor", "--bundle", external]), root);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = original;
    }
    expect(chunks.join("")).toContain("John Watson");
  });

  test("query errors exit 1 (missing argument)", async () => {
    const root = await queryProject();
    const errs: string[] = [];
    const err = process.stderr.write.bind(process.stderr);
    try {
      process.stderr.write = ((chunk: unknown) => {
        errs.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;
      const code = await cmdQuery(parseArgs(["search"]), root);
      expect(code).toBe(1);
    } finally {
      process.stderr.write = err;
    }
    expect(errs.join("")).toContain("usage: novel query search");
  });
});

describe("query subcommands", () => {
  async function runQuery(argv: string[], root: string): Promise<string> {
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    try {
      process.stdout.write = ((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
      }) as typeof process.stdout.write;
      const code = await cmdQuery(parseArgs(argv), root);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = original;
    }
    return chunks.join("");
  }

  test("stale lists canon facts past their stale_after date", async () => {
    const root = await queryProject();
    await writeBundleFiles(join(root, "story"), {
      "canon/wolf-alpha.md": `---\ntype: Faction\ntitle: Wolf Alpha Pack\norigin: source\nstale_after: 2000-01-01\n---\n`,
      "canon/fresh-pack.md": `---\ntype: Faction\ntitle: Fresh Pack\norigin: source\nstale_after: 2999-01-01\n---\n`,
      "canon/generated-pack.md": `---\ntype: Faction\ntitle: Generated Pack\norigin: source\ngenerated: { at: 2000-01-01T00:00:00Z }\n---\n`,
    });
    const out = await runQuery(["stale"], root);
    expect(out).toContain("Wolf Alpha Pack");
    expect(out).toContain("stale_after passed (2000-01-01)");
    expect(out).toContain("Generated Pack");
    expect(out).toContain("not refreshed in 30 days");
    expect(out).not.toContain("Fresh Pack");
  });

  test("character at tag and refs report their sections", async () => {
    const root = await queryProject();
    await writeBundleFiles(join(root, "story"), {
      "characters/scott.md": `---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\naffiliations: [/factions/alpha-pack.md]\n---\n`,
      "factions/alpha-pack.md": `---\ntype: Faction\ntitle: Alpha Pack\nrefs:\n  - title: Alpha Pack Recap\n    url: https://example.com/alpha-pack\n    kind: recap\n---\n`,
      "locations/beacon-hills.md": `---\ntype: Location\ntitle: Beacon Hills Preserve\n---\n`,
      "chapters/the-first-day.md": `---\ntype: Chapter\ntitle: The First Day\nsequence: 1\n---\n`,
      "chapters/the-first-day/scenes/the-bite.md": `---\ntype: Scene\ntitle: The Bite\nsequence: 1\npov: /characters/scott.md\nlocation: /locations/beacon-hills.md\n---\n\nIt was a quiet night.\n`,
      "timeline/full-moon.md": `---\ntype: Timeline Event\ntitle: Full Moon\nsequence: 1\nwhen: 2011-01-09\nparticipants: [/characters/scott.md]\ntags: [canon]\n---\n`,
    });

    const characterOut = await runQuery(["character", "Scott McCall"], root);
    expect(characterOut).toContain("## Scenes (1)");
    expect(characterOut).toContain("The Bite");
    expect(characterOut).toContain("## Timeline events (1)");
    expect(characterOut).toContain("Full Moon");
    expect(characterOut).toContain("## Affiliations");
    expect(characterOut).toContain("/factions/alpha-pack.md");
    expect(characterOut).toContain("## Locations");

    const atOut = await runQuery(["at", "Beacon Hills"], root);
    expect(atOut).toContain("## Scenes (1)");
    expect(atOut).toContain("The Bite");

    const tagOut = await runQuery(["tag", "canon"], root);
    expect(tagOut).toContain("# Tag: canon");
    expect(tagOut).toContain("## Timeline Event");
    expect(tagOut).toContain("Full Moon");

    const refsOut = await runQuery(["refs", "Alpha Pack"], root);
    expect(refsOut).toContain("# References: Alpha Pack");
    expect(refsOut).toContain("Alpha Pack Recap");
    expect(refsOut).toContain("https://example.com/alpha-pack");
  });

  test("character with no name prints usage and exits 1", async () => {
    const root = await queryProject();
    const errs: string[] = [];
    const err = process.stderr.write.bind(process.stderr);
    try {
      process.stderr.write = ((chunk: unknown) => {
        errs.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;
      const code = await cmdQuery(parseArgs(["character"]), root);
      expect(code).toBe(1);
    } finally {
      process.stderr.write = err;
    }
    expect(errs.join("")).toContain("usage: novel query character");
  });
});