# novel-harness

[![CI](https://github.com/TheForgivenOne/novel-harness/actions/workflows/test.yml/badge.svg)](https://github.com/TheForgivenOne/novel-harness/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Bun >= 1.1](https://img.shields.io/badge/Bun-%3E%3D1.1-black?logo=bun)](https://bun.sh)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A harness for novel creation. It stores a novel as an
[OKF v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format)
knowledge bundle — plain markdown with YAML frontmatter — and renders adapters
so coding agents (opencode, Claude Code, Codex, Gemini CLI) can write it
natively.

- **No MCP.** No service, no runtime between you and the files.
- **The CLI never calls an LLM.** It scaffolds, validates, packs context, and
  builds. Your agent does the writing through rendered `/outline`, `/draft`,
  `/continue`, `/revise`, `/continuity`, and `/ask` commands.
- **Portable.** The `story/` directory is a conformant OKF bundle. It is
  readable with `cat`, diffable in git, and consumable by any OKF tool.

Full design: [docs/SPEC.md](docs/SPEC.md).

## Requirements

[Bun](https://bun.sh) >= 1.1. The CLI is Bun-native; it runs no Node and needs
no other runtime.

## Install

Pick one. Every path exposes the same `novel` command.

**No install (run once, from npm or JSR):**

```bash
bunx novel-harness init my-novel        # npm registry
bunx jsr:@theforgivenone/novel-harness init my-novel   # JSR
bunx github:TheForgivenOne/novel-harness init my-novel  # straight from git
```

**From a clone (developing or self-hosting):**

```bash
git clone https://github.com/TheForgivenOne/novel-harness.git
cd novel-harness
bash scripts/install.sh      # bun install + bun link + verify
```

To undo the global link: `bun unlink` in the repo root.

**Global from npm** (once published):

```bash
bun add -g novel-harness
novel --version
```

**Homebrew** (macOS/Linux, tap maintained in this org):

```bash
brew install TheForgivenOne/novel-harness/novel-harness
```

**Nix** (flake, no install step; `nix develop` gives a dev shell):

```bash
nix run github:TheForgivenOne/novel-harness
```

## Quickstart

```bash
bunx novel-harness init my-novel --name "The Hollow Crown" --author human:you
cd my-novel

novel new character "Elena Voss" --role protagonist
novel new location "The Grand Archive"
novel new chapter "The Archive"
novel new scene "A Map That Shouldn't Exist" --location the-grand-archive

novel validate
```

`init` writes the `story/` bundle and renders agent adapters (`AGENTS.md`,
`CLAUDE.md`, `.opencode/`, `.claude/`, `.gemini/`). Open your agent of choice
and run `/outline`, then `/draft chapters/the-archive/a-map-that-shouldnt-exist`.

## Commands

| Command | Does |
|---|---|
| `novel init [dir]` | Scaffold a project and render adapters |
| `novel new <type> [name]` | Create a concept with correct path and frontmatter (`--from-template`) |
| `novel import <file>` | Bulk-create concepts from CSV or YAML in one pass |
| `novel set <concept> f=v...` | Update frontmatter fields (`--unset`, `--at`, `--dry-run`) |
| `novel rm <concept>` | Remove a concept; refuses if linked (`--force`) |
| `novel mv <scene> --to <chapter>` | Move a scene and rewrite its links |
| `novel renumber [--type <list>] [--sort sequence\|when]` | Compact sequence numbers; `--sort when` orders Timeline Events by date |
| `novel rename <concept> <name>` | Rename a concept and rewrite links to it |
| `novel convert <from> <to>` | Convert between types and relocate (`--file`) |
| `novel merge <primary> <other>` | Merge a duplicate concept (`--yes` to apply) |
| `novel tag --batch <rules.yaml>` | Apply YAML tagging rules |
| `novel validate [--fix] [--only <id\|glob>] [--severity error\|warning] [--quiet] [--summary] [--json]` | OKF v0.2 conformance + strict profile checks, with output filters |
| `novel audit [--fix] [--receipts] [--online] [--only <id\|glob>]` | One report: project, content, sources, receipts, links (`--quiet`, `--summary`, `--json`) |
| `novel fetch <url>` | Fetch a page and log a research receipt |
| `novel doctor [--fix]` | Report or fix outdated config, structure, and adapters |
| `novel index` | Regenerate all `index.md` files |
| `novel context <concept>` | Print an agent context slice to stdout |
| `novel query <subcommand>` | Structured reads: `search`, `timeline`, `when`, `divergences`, `stale`, `character`, `at`, `tag`, `refs`, `stats` (`--summary` skips per-chapter lines) |
| `novel outline [--check]` | Print the story outline; `--check` reports drift between outline rows and bundle files |
| `novel status` | Per-chapter progress: drafted vs stubs, words, budget, next scene |
| `novel canon <export\|import>` | Move canon between projects as a reusable pack |
| `novel build [--out <dir>]` | Assemble the manuscript into `dist/` |
| `novel export [--format md\|html]` | Export the manuscript (epub/pdf not yet) |
| `novel diff [ref1] [ref2]` | Git diff of the bundle (working tree by default) |
| `novel graph [--html]` | Emit the link graph |
| `novel sync` | Re-render adapters; never clobbers hand edits |

Concept types: `novel`, `plan`, `knowledge`, `outline`, `character`, `location`,
`faction`, `worldbuilding`, `item`, `plot-thread`, `arc`, `episode`, `chapter`,
`chapter-outline`, `scene`, `timeline-event`, `theme`, `relationship`,
`reference`, `research-note`.

## Project layout

```
my-novel/
  story/                  # the OKF bundle
    novel.md              # premise, POV, tense, fandom
    plan.md               # agreed premise, cast, rules, divergence goals
    knowledge.md          # who knows what, when, per season
    outline.md            # story-level outline: structure and scene tables
    characters/ locations/ factions/ world/ plot/ themes/
    relationships/ timeline/ chapters/ references/ research/
    chapters/
      index.md
      <slug>.md        # chapter concept
      <slug>/outline.md
      <slug>/scenes/   # scene concepts, one file per scene
    index.md  log.md
  .novel/
    config.json           # bundle path, adapter targets, author actor
    workflows/            # optional per-project workflow overrides
    manifest.json         # tracks generated adapter files
  dist/                   # manuscript and graph output
```

## Workflows

`story/` holds facts; scenes hold prose. `/draft` calls `novel context` to load
a scene's chapter, cast, location, and neighbors, writes the prose into the
scene body, and leaves `status: draft` until you promote it to `stable` (canon).

A chapter can declare a drafting range; `/draft` and `/continue` budget the
remaining scenes against it, and `novel validate` warns when a written chapter
falls outside (chapters marked `status: draft` are exempt):

```yaml
words: { min: 2500, max: 4000 }   # in story/chapters/<chapter>.md
```

Override or add workflows by placing a markdown file in `.novel/workflows/`:

```markdown
---
description: My custom pass
argument-hint: <concept id>
---

Do the thing to {{args}}.
```

Then run `novel sync`.

## Agent artifacts

`novel sync` renders more than commands. On opencode you also get:

| Artifact | Where | What |
|---|---|---|
| Subagents | `.opencode/agent/` | `researcher`, `skeptic`, `continuity-checker` — audit helpers |
| Skills | `.opencode/skill/` | `novel-harness`, `novel-recon`, `novel-drafting`, `novel-fanfic`, `novel-migration` |
| Tools | `.opencode/tools/` | `novel_query`, `novel_context`, `novel_validate`, `novel_fetch` |
| Plugin | `.opencode/plugin/novel-guard.ts` | runs `novel validate` after story writes and reports the tail |

Claude Code gets the three subagents and the five skills; Gemini keeps
instructions and commands, and Codex gets instructions via `AGENTS.md`.
`novel_fetch` writes a `{url, fetched_at, sha256, bytes}` receipt to
`.novel/fetch-log.jsonl`, so recon research can be audited later, and the
`/skeptic` workflow checks `origin: source` claims against the fetched
pages before they are marked `verified`.

## Queries

Ask the bundle structured questions without an agent:

```bash
novel query search "kanima"                # titles, aliases, ids, tags, bodies
novel query timeline --tag season-3a       # events in sequence order
novel query timeline --on "November 2011"  # events at a date
novel query timeline --from 2011 --to 2012
novel query when "January 9, 2011"         # canon snapshot: event, cast, location, neighbours
novel query character stiles-stilinski     # scenes, events, relationships
novel query at eichen-house                # scenes set there, in order
novel query tag season-3a                  # everything tagged, grouped by type
novel query divergences                    # what changed vs canon: altered/averted/added
novel query divergences --status averted   # canon beats your MC prevented
novel query stale                          # canon due for a refresh
novel query refs "Scott Gets Bitten"       # transcript/recap/wiki links to fetch
novel query search "kanima" --type Worldbuilding --limit 5
novel query character stiles-stilinski --json
novel query timeline --bundle canon/teenwolf   # query a canon pack directly
```

Agents get the same power through the `/query` workflow, which translates a
question into queries and reasons over the structured results.

## Cleanup and stats

```bash
novel query stats                     # words, chapter targets, fate, tags, sources
novel convert chapter arc --file story/chapters/season-1-wolf-moon.md
novel rename characters/boyd vernon-boyd
novel merge characters/vernon-boyd characters/boyd --yes
novel tag --batch tag-rules.yaml
novel audit --fix
novel fetch https://example.com/canon-page  # downloads + logs a sha256 receipt
novel audit --receipts                      # fails if a cited URL was never fetched
novel audit --online                        # opt-in liveness; 403/5xx are not "broken"
novel audit --quiet                         # errors only; --only <path>, --summary, --json
novel diff                            # what changed this session
novel export --format html
```

## Bulk authoring

For a 500-chapter project, build rows in a spreadsheet and import them in
one pass (validated before anything is written, one index regeneration):

```bash
novel import chapters.csv             # header: type,title,chapter,pov,tags,...
novel import plan.yaml --dry-run      # YAML list works too
novel set characters/elena-voss tags=cast,alpha fate=dead
novel set timeline/scott-gets-bitten divergence=altered --at chapters/ch-01/scenes/sc-05
novel mv chapters/ch-01/scenes/sc-02 --to ch-04 --sequence 1
novel rm locations/old-archive --force   # --force leaves inbound links for validate to flag
```

Every command has its own help: `novel import --help`, `novel set --help`,
`novel new scene --help`.

## Canon packs

One crawl can serve many fics:

```bash
novel canon export               # -> canon/<fandom>/ (origin: source + references)
novel canon import ../other/canon/teenwolf
```

Import preserves paths so links keep working. Identical concepts are skipped,
your `fanon`/`divergent` edits are kept, source-vs-source differences are
reported as conflicts (`--force` to overwrite).

Recon is incremental once canon exists: `novel query stale` lists facts due
for a refresh, and `/recon` updates only those through their `refs`.

## Fanfiction

Fanfiction is first-class. A source work is a `Reference` concept, and the
Novel records the fandom:

```bash
novel init my-fic --name "The Boy Who Lived Again" --fandom "Harry Potter" \
  --canon-type canon-divergent

novel new reference "Harry Potter novels" --resource https://example.com/hp
# then set source_works: [/references/harry-potter-novels.md] in story/novel.md

novel new character "Harry Potter" --origin source
novel new character "Draco Malfoy" --origin divergent \
  --diverges-at chapters/ch-01/sc-01
```

- `origin: source` — imported from the original work; cite it in `sources`.
- `origin: fanon` — invented for your story.
- `origin: divergent` — changed from canon; `diverges_at` names the scene or
  timeline event where the change happens.
- `canon_type` is one of `canon-compliant`, `canon-divergent`,
  `alternate-universe`, `fusion`, `crossover`.

`novel validate` enforces the canon rules, `novel context` pulls source and
divergence links into an agent's context, and `novel graph` shows them as
edges. The `/continuity` workflow audits contradictions against
`origin: source` facts.

The fanfiction loop is three-phase:

```
/recon     learn the source canon broadly, record it as origin: source
   │       concepts with citations, and note what you skipped
   ▼
/outline   plan against that baseline; set canon_type and diverges_at
   │       set each scene's in-world `when` so it lines up with canon
   ▼
/draft → /weave → /continue → /revise → /continuity
```

`/weave <canon event>` is the fanfic special: it loads the canon snapshot at
that date (`novel query when`) and writes a scene where your MC is present —
same time, place, participants, and outcome, with the source's dialogue left
intact. Canon stays canon; the MC is woven through it.

Recon maps rather than extracts. The bundle holds the state — characters,
plot, timeline, arcs, episodes, and a compact recap per episode — plus `refs`
linking each concept to its authoritative pages. When a scene needs exact
staging, voice, or dialogue, `/draft` and `/weave` fetch those pages on
demand: the web holds the full detail, the bundle holds the map.

Canon divergence is tracked explicitly. Every Timeline Event carries a
`divergence` status — `intact` (happened as canon), `altered` (happened,
changed), `averted` (never happened), `added` (fanon) — with `altered` and
`averted` pointing at the scene that changes them. `novel query divergences`
is the ledger of what your MC changed:

```
$ novel query divergences
intact: 12 · altered: 3 · averted: 2 · added: 5 · unmarked: 0

## averted (2)
* January 9, 2011 — [Scott Gets Bitten] → [The Intervention](...)
* March 2011 — [Allison's Death] → [The Warning](...)
```

Recon is deliberately web-first: the agent must read and cite sources, and
must stop rather than fill canon from model memory. That's what keeps the
result a true fanfic instead of a half-remembered one.

## Migrating

`novel doctor` checks an existing project for outdated config, missing
concept directories, stale adapters, index drift, and content warnings —
without writing anything. `novel doctor --fix` applies the mechanical fixes
(config version, directories, indexes, adapters).

The entry point for an old project is `novel migrate`: it applies those
mechanical fixes, renders the `/migrate` command into your agent, and prints
what content still needs migrating. Restart your agent afterwards.

Content migrations stay agent-driven. `/migrate` converts old modeling —
seasons recorded as Chapters into `Arc`s, untagged concepts, author material
cited as an unfollowable string, duplicate concepts — using `novel validate`
as the checklist.

For repeatable migrations, script the deterministic parts:

```yaml
# migration.yaml
- action: convert
  from: chapter
  to: arc
- action: merge
  primary: characters/vernon-boyd
  remove: characters/boyd
- action: tag
  match: { type: Character, species: werewolf }
  add: [werewolf]
```

```bash
novel migrate --spec migration.yaml   # validates the whole spec first
novel validate --fix                  # unquotes sources, normalizes added events
```

## Development

```bash
bun install
bun run test        # bun test ./tests
bun run typecheck   # alias: bun run lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions, [ROADMAP.md](ROADMAP.md)
for what's planned, and [CHANGELOG.md](CHANGELOG.md) for release notes. Questions
and ideas go in [Discussions](https://github.com/TheForgivenOne/novel-harness/discussions).

Try it end to end with an agent using a sandbox preset. Each preset gets its
own folder, so they coexist:

```bash
bash scripts/sandbox.sh teenwolf   # also: sherlock, harrypotter, naruto,
cd sandbox/teenwolf && opencode    #       supernatural, twilight, blank
```

## License

MIT — see [LICENSE](LICENSE).

## Trademarks

"novel-harness" and the `novel` command name are project trademarks of the
maintainer. The MIT license grants rights to the **code**; it does not grant
rights to use the project's name or branding. Forks are welcome, but a
redistributed or hosted derivative must not present itself as "novel-harness"
or imply endorsement by the project. See [TRADEMARK.md](TRADEMARK.md).
