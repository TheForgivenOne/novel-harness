# Pull Request

## What does this change?

<!-- A sentence or two. Link the issue: "Closes #123". -->

## Type

- [ ] `feat` — new behavior
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — no behavior change
- [ ] `test` — tests only
- [ ] `chore` — tooling, deps, CI

## Checklist

- [ ] I read `CONTRIBUTING.md` and the design constraints hold (no LLM calls, no
      MCP/runtime service, OKF v0.2 conformance, fanfiction stays first-class).
- [ ] `bun run typecheck` passes.
- [ ] `bun run test` passes.
- [ ] If adapter or validator output changed, I updated `tests/golden/` with
      `bun run test:update` and reviewed the diff.
- [ ] I updated docs (`README.md` / `docs/SPEC.md`) if user-facing behavior
      changed.
