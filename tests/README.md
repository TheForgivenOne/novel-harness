# tests/

Test suite for novel-harness. Runner: `bun test` (Bun only; no Vitest).

## Layout

`tests/` mirrors `src/`:

- `tests/core/**` tests `src/core/**` (one file per module or module area).
- `tests/cli/**` tests `src/cli/**` (commands in `tests/cli/commands/`, the
  dispatcher in `tests/cli/main.test.ts`).
- Top-level files that do not mirror anything:
  - `helpers.ts` — `makeBundle`, `tmpProject`, `validStoryDir`.
  - `sample.ts` — `SAMPLE_INPUT`/`SAMPLE_WORKFLOW` used by golden tests.
  - `golden.test.ts` + `golden/` — exact-match snapshots of adapter output.
  - `fixtures/valid-story/` — a hand-maintained bundle for integration tests.

A test file lives where its subject lives. If you add a module under
`src/core/ops/`, its tests go in `tests/core/ops/`.

## Import depths

Files use the repo's `.ts`-extension relative imports:

- `tests/core/x.test.ts` → `../../src/core/...`
- `tests/core/sub/x.test.ts` → `../../../src/core/...`
- `tests/cli/commands/x.test.ts` → `../../../src/cli/...`
- `tests/cli/main.test.ts` → `../../src/cli/main.ts`
- Helpers: `tests/helpers.ts` from `tests/cli/commands/` is `../../helpers.ts`.

## Helpers — when to use what

- `makeBundle(files)` — throwaway bundle in a temp dir. Use for unit-style
  tests that only need concepts on disk. `loadBundle(root)` then behaves
  exactly like production.
- `tmpProject(name)` — empty temp project root (no bundle). Pair with
  `initProject(root, { name, author })` for scaffolding and CLI tests.
- `validStoryDir` — the committed fixture bundle. Use for integration tests
  that need a realistic, complete bundle; do not mutate it (read-only).

Never share mutable state between tests; always use temp dirs. Tests run in
parallel — `bun test` isolation depends on it.

## CLI tests

Commands are functions `(args: ParsedArgs, cwd: string) => Promise<number>`.
Spy on `process.stdout.write`/`process.stderr.write` to capture output:

```ts
const chunks: string[] = [];
const original = process.stdout.write.bind(process.stdout);
try {
  process.stdout.write = ((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  const code = await cmdQuery(parseArgs(["search", "werewolf"]), root);
  expect(code).toBe(0);
} finally {
  process.stdout.write = original;
}
```

Assert on the exit code (0 success, 1 failure) and on captured output.
CLI tests need a project: `tmpProject` + `initProject`, or a `.novel/config.json`.

## Golden files

`tests/golden/` holds exact-match snapshots of adapter output. There is no
updater script convention — run:

```bash
bun run test:update   # UPDATE_SNAPSHOTS=1 bun test tests/golden.test.ts
```

after intentionally changing adapter output, then review the diff. Any
unintended golden change fails the suite. `NOVEL_GOLDEN_DIR` overrides the
golden directory (used by tests and local experiments).

## Coverage

```bash
bun run test:coverage   # bun test --coverage
```

Bar: ≥85% line coverage overall, no module below 75%. Coverage is
documented, not enforced by the runner.

## Fixtures policy

- `tests/fixtures/valid-story/` — the one committed bundle; read-only.
- Everything else builds bundles in temp dirs via `makeBundle`.
- Never add generated adapter output to fixtures; that is what `golden/` is
  for.