import { describe, expect, test } from "bun:test";
import {
  canonicalizeKeys,
  FrontmatterError,
  parseDocument,
  serializeDocument,
} from "../../../src/core/bundle/frontmatter.ts";

describe("parseDocument", () => {
  test("parses frontmatter and body", () => {
    const raw = "---\ntype: Character\ntitle: Elena\n---\n\nBody text.\n";
    const doc = parseDocument(raw);
    expect(doc.data.type).toBe("Character");
    expect(doc.data.title).toBe("Elena");
    expect(doc.body.trim()).toBe("Body text.");
  });

  test("throws when frontmatter is missing", () => {
    expect(() => parseDocument("# No frontmatter\n")).toThrow(FrontmatterError);
  });

  test("throws when frontmatter is unterminated", () => {
    expect(() => parseDocument("---\ntype: Character\n")).toThrow(FrontmatterError);
  });

  test("throws on invalid YAML", () => {
    expect(() => parseDocument("---\ntype: [unclosed\n---\n")).toThrow(FrontmatterError);
  });

  test("throws when frontmatter is not a mapping", () => {
    expect(() => parseDocument("---\n- one\n- two\n---\n")).toThrow(FrontmatterError);
  });
});

describe("serializeDocument", () => {
  test("round-trips a document", () => {
    const raw = "---\ntype: Character\ntitle: Elena\n---\n\nShe reads maps.\n";
    const serialized = serializeDocument(parseDocument(raw));
    expect(serialized).toBe(raw);
  });

  test("orders known keys canonically", () => {
    const serialized = serializeDocument({
      data: { generated: { by: "human:a", at: "2026-01-01T00:00:00Z" }, title: "X", type: "Theme" },
      body: "",
    });
    const lines = serialized.split("\n");
    expect(lines[1]).toBe("type: Theme");
    expect(lines[2]).toBe("title: X");
    expect(lines[3]).toBe("generated:");
  });

  test("keeps unknown keys after known ones, alphabetically", () => {
    const data = canonicalizeKeys({ zeta: 1, alpha: 2, type: "Theme" });
    expect(Object.keys(data)).toEqual(["type", "alpha", "zeta"]);
  });
});
