import { describe, expect, test } from "bun:test";
import { escapeHtml } from "../../../src/core/text/html.ts";

describe("escapeHtml", () => {
  test("escapes markup characters", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});