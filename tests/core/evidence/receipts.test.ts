import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendFetchReceipt,
  readFetchReceipts,
  receiptFor,
} from "../../../src/core/evidence/receipts.ts";

describe("fetch receipts", () => {
  test("receiptFor is deterministic", () => {
    expect(receiptFor("https://example.com/a", "hello world", new Date("2026-09-13T00:00:00Z"))).toEqual({
      url: "https://example.com/a",
      fetched_at: "2026-09-13T00:00:00.000Z",
      sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      bytes: 11,
    });
  });

  test("receipts append and read back in order", async () => {
    const root = await mkdtemp(join(tmpdir(), "novel-evidence-"));
    await appendFetchReceipt(root, receiptFor("https://example.com/a", "one"));
    await appendFetchReceipt(root, receiptFor("https://example.com/b", "two"));
    const receipts = await readFetchReceipts(root);
    expect(receipts.map((entry) => entry.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });
});