# Roadmap

Directional, not a promise. Priorities shift as the project gets users. Items
are labeled by area; good first issues are linked from the tracker.

## v0.1.0 — foundation (shipped)

- OKF v0.2 bundle scaffold, validation, and repair (`init`, `new`, `validate`,
  `doctor`, `index`, `sync`)
- Concept types with fanfiction as first-class (`origin`, `diverges_at`,
  `canon_type`, `fate`, sources)
- Agent adapters: `AGENTS.md`, `CLAUDE.md`, `.opencode/`, `.claude/`, `.gemini/`
- Context packing, structured queries, continuity audit, canon packs, receipts
- Build (`dist/manuscript.md`) and graph export

## v0.2.0 — reach

- **Publish to npm** so `bunx novel-harness` works without a clone
- Docs site generated from `docs/SPEC.md`
- More adapters (Cursor, Windsurf, Aider) behind the existing `src/core/adapters`
  seam
- More sandbox presets and a fixture that exercises every concept type
- EPUB / DOCX manuscript export alongside markdown

## Later — depth

- Incremental validation for large bundles (cache keyed by file mtime)
- Timeline visualization beyond the static graph export
- Optional bilingual / translation workflows for bundles
- A `novel lint` that reports style consistency (tense, POV, naming) without
  touching content

## Non-goals

- Calling an LLM from the CLI
- An MCP server or any runtime service
- Storing prose anywhere but the on-disk OKF bundle
