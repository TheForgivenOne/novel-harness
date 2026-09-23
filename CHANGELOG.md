# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1](https://github.com/TheForgivenOne/novel-harness/compare/v0.2.0...v0.2.1) (2026-09-23)


### Bug Fixes

* **cli:** read VERSION from package.json so release-please bumps it ([#14](https://github.com/TheForgivenOne/novel-harness/issues/14)) ([8a31cb4](https://github.com/TheForgivenOne/novel-harness/commit/8a31cb4ad1172b4a0f4e4db3f0847e1515734cb5))

## [0.2.0](https://github.com/TheForgivenOne/novel-harness/compare/v0.1.0...v0.2.0) (2026-09-23)


### Features

* **cli:** self-update, in-place project update, and opencode skills path fix ([#11](https://github.com/TheForgivenOne/novel-harness/issues/11)) ([79bbc99](https://github.com/TheForgivenOne/novel-harness/commit/79bbc99b4b7a536bc23933bf2b64eb57a9fd2029))
* **package:** add repository, homepage, bugs, author, and keywords metadata ([#5](https://github.com/TheForgivenOne/novel-harness/issues/5)) ([#7](https://github.com/TheForgivenOne/novel-harness/issues/7)) ([cf5279b](https://github.com/TheForgivenOne/novel-harness/commit/cf5279bbd4fe52f2ee52b26ae742b4eca76b1a22))
* prebuilt binary releases, build script, and standalone curl installer ([41ea5d1](https://github.com/TheForgivenOne/novel-harness/commit/41ea5d1fd797e654d2e923a807b8b739514646e3))

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
