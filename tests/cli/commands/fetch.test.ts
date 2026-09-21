import { describe, expect, test } from "bun:test";
import { truncatePage } from "../../../src/cli/commands/fetch.ts";

describe("truncatePage", () => {
  test("leaves short pages alone and marks truncation", () => {
    expect(truncatePage("short", 100)).toBe("short");
    const truncated = truncatePage("abcdef", 3);
    expect(truncated.startsWith("abc")).toBe(true);
    expect(truncated).toContain("truncated");
  });
});