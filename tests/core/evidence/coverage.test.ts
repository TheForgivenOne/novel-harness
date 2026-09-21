import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { auditReceipts } from "../../../src/core/evidence/coverage.ts";
import { receiptFor } from "../../../src/core/evidence/receipts.ts";
import { makeBundle } from "../../helpers.ts";

const GENERATED = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";

describe("receipt coverage", () => {
  test("reports cited URLs without receipts", async () => {
    const root = await makeBundle({
      "characters/hero.md":
        `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\n` +
        `refs:\n  - title: A\n    url: https://example.com/a\n    kind: wiki\n` +
        `  - title: B\n    url: https://example.com/b\n    kind: wiki\n` +
        `sources:\n  - id: c\n    resource: https://example.com/c\nstatus: stable\n${GENERATED}\n---\n`,
    });
    const bundle = await loadBundle(root);
    const coverage = auditReceipts(bundle, [receiptFor("https://example.com/a", "a")]);
    expect(coverage.cited).toBe(3);
    expect(coverage.fetched).toBe(1);
    expect(coverage.missing).toBe(2);
    expect(coverage.entries.find((entry) => entry.url === "https://example.com/a")?.fetched).toBe(true);
    expect(coverage.entries.find((entry) => entry.url === "https://example.com/b")?.fetched).toBe(false);
  });
});