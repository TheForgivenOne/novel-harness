# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-21

Initial public release.

### Added

- OKF v0.2 novel-bundle scaffold and full CLI: `init`, `new`, `import`, `set`,
  `rm`, `mv`, `renumber`, `rename`, `convert`, `merge`, `tag`
- Validation and repair: `validate --fix`, `doctor --fix`, `audit --receipts`,
  continuity checks, and strict-profile rules
- Agent adapters rendering `AGENTS.md`, `CLAUDE.md`, `.opencode/`, `.claude/`,
  and `.gemini/`, with thin-artifact sync
- Context packing (`context`), structured queries (`query`), canon packs
  (`canon`), and research receipts (`fetch`)
- Build to `dist/manuscript.md` and graph export (`graph --html`)
- Fanfiction as a first-class concept: `origin`, `diverges_at`, `canon_type`,
  `fate`, and source citations
- Sandbox presets for end-to-end testing: teenwolf, sherlock, harrypotter,
  naruto, supernatural, twilight, blank

[Unreleased]: https://github.com/TheForgivenOne/novel-harness/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/TheForgivenOne/novel-harness/releases/tag/v0.1.0
