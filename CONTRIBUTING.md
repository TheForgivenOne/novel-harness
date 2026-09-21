# Contributing

Thanks for helping improve `novel-harness`. This is the source repo for the
CLI — not a novel bundle. See `AGENTS.md` for the full architecture brief and
`docs/SPEC.md` for the authoritative spec (including the decisions log).

## Requirements

- [Bun](https://bun.sh) >= 1.1. There is no Node/npm workflow; `bun install`
  uses `bun.lock`.

## Setup

```bash
bun install
bun run test        # bun test ./tests
bun run typecheck   # tsc --noEmit (alias: bun run lint)
```

Run a single file with `bun test tests/query.test.ts`.

Always run **both** `test` and `typecheck` before opening a pull request.
`tsconfig.json` includes `tests/`, so test files are typechecked too.

## Design constraints

These are load-bearing; changes that violate them will be declined:

- **The CLI never calls an LLM.** It scaffolds, validates, packs context, and
  builds; the agent does the writing.
- **No MCP, no runtime service.** The bundle on disk is the single source of
  truth.
- **OKF v0.2 conformance is a hard requirement.**
- **Fanfiction is first-class** (`origin`, `diverges_at`, `canon_type`).

## Code style

- Follow the layout in `AGENTS.md`: `bin/novel.ts` → `src/cli/main.ts`, one
  thin file per subcommand in `src/cli/commands/`, all logic in `src/core/**`.
- Relative imports use explicit `.ts` extensions.
- `verbatimModuleSyntax` is on — type-only imports must use `import type`.
- `noUncheckedIndexedAccess` is on — array/record indexing yields
  `T | undefined`; guard before use.

## Tests

- Unit tests build throwaway bundles in a temp dir via `makeBundle` in
  `tests/helpers.ts`; fixtures live in `tests/fixtures/valid-story/`.
- `tests/golden/` holds exact-match snapshots of adapter output and validator
  messages. When you change what adapters or the validator render, update those
  files with `bun run test:update`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): description` (`feat`, `fix`, `docs`, `refactor`, `test`,
`chore`). Keep each commit focused on a single change.

## Reporting issues

Open an issue at
<https://github.com/TheForgivenOne/novel-harnes/issues>. Include the command
you ran, the output, and your Bun version.
