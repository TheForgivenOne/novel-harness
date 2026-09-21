# Roadmap

Directional, not a promise. Priorities shift as the project gets users. The
ordering below is deliberate: **the CLI is the product**, and everything else is
a rendering of it onto some agent's surface.

## North star

`novel` makes a coding agent a competent novelist. The CLI is the product: it
scaffolds, validates, and packs context against an OKF v0.2 bundle on disk. An
*adapter* is how that same CLI shows up inside a given agent — as instructions,
commands, agents, skills, tools, or (later) an MCP config.

The rule that follows from this: **nothing is built for the CLI's sake alone,
and no adapter work lands while the CLI has known conformance gaps.**

## Tier 0 — Core CLI (primary)

Always first. Work here never pauses for an adapter.

- OKF v0.2 conformance as a hard requirement; strict-profile validation
- The full command surface: scaffold, edit, move, merge, validate, audit, pack
  context, query, build
- Reliability: incremental validation for large bundles, faster `context` on
  deep concept graphs
- Publish to npm so `bunx novel-harness` works without a clone or build

## Tier 1 — Terminal coding agents

Terminal-first agents, because that is where the CLI model fits best: a shell,
a filesystem, and no UI assumptions.

Shipped: **opencode**, **Claude Code**, **Codex** (instructions via `AGENTS.md`),
**Gemini CLI**.

Next, in order:

- **GitHub Copilot CLI** — instructions + commands
- **Zed** — via its agent panel and `AGENTS.md`
- **Aider** — instructions + conventions file

Each new adapter is gated on the same rule as decision 2026-09-12: its file
formats are **verified against current upstream docs**, never guessed from
filenames. A one-off adapter is one file plus one line in
`src/core/adapters/index.ts`.

## Tier 2 — Capability depth

Today capabilities differ a lot per agent: opencode gets agents, skills, tools,
and a plugin; Claude gets agents and skills; Gemini and Codex get instructions
and commands. Close that gap deliberately.

- A published **capability matrix** (agent × artifact kind): what is rendered,
  what is missing, why
- `novel doctor` reports capability gaps for the adapter you actually have
  rendered
- Bring hooks/plugins to more agents as their surfaces allow

## Tier 3 — Editor-integrated agents

Later, and only where it earns its keep. Editor agents want different seams
(panels, inline actions, language-server-style hooks) and more UI surface.

- **Cursor**
- **Windsurf**
- **VS Code + Copilot** (editor, not the CLI)

## Tier 4 — MCP adapter (additive, optional)

MCP is a **planned adapter, never a dependency**. It renders a local MCP server
config that exposes the four operations the CLI already has —
`novel_query`, `novel_context`, `novel_validate`, `novel_fetch` — as MCP tools,
matching decision 2026-09-13.

Hard constraints:

- MCP is **never required**. Every workflow keeps working by reading the bundle
  and calling the CLI directly.
- No hosted service. Any MCP server is local and reads the same files.
- The CLI still never calls an LLM.

## Tier 5 — Distribution

- Standalone binaries via GitHub Releases (done); curl installer (done)
- Homebrew tap
- Nix flake

## Later — depth and reach

- EPUB / DOCX manuscript export alongside markdown
- A docs site generated from `docs/SPEC.md`
- Timeline visualization beyond the static graph export
- Optional bilingual / translation workflows
- `novel lint` reporting style consistency (tense, POV, naming) without touching
  content

## Non-goals

- Calling an LLM from the CLI
- A hosted or required runtime service (MCP included)
- Storing prose anywhere but the on-disk OKF bundle

## How this roadmap changes

Ordering changes stop being a discussion once they are a logged decision in
`docs/SPEC.md` (see the decisions log). Proposals go through an issue or a
Discussion first.
