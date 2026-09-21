import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { auditSources, fixQuotedSources } from "../../../src/core/ops/audit-sources.ts";
import { validateBundle } from "../../../src/core/validate/index.ts";
import { makeBundle } from "../../helpers.ts";

const auditFiles = {
  "novel.md": [
    "---",
    "type: Novel",
    "title: T",
    "sources:",
    "  - resource: https://x",
    "  - resource: /references/work.md",
    "  - resource: /references/missing.md",
    '  - resource: \'"https://quoted"\'',
    "  - resource: Teen Wolf Wiki",
    "  - resource: author-provided timeline data",
    "---",
    "",
  ].join("\n"),
  "references/work.md": "---\ntype: Reference\ntitle: Work\nresource: https://x\n---\n",
};

describe("audit-sources", () => {
  test("classifies resources and resolves bundle links", async () => {
    const root = await makeBundle(auditFiles);
    const bundle = await loadBundle(root);
    const audit = auditSources(bundle);

    expect(audit.totals.total).toBe(6);
    expect(audit.totals.url).toBe(1);
    expect(audit.totals.bundle).toBe(2);
    expect(audit.totals.quoted).toBe(1);
    expect(audit.totals["bare-wiki"]).toBe(1);
    expect(audit.totals["non-followable"]).toBe(1);
    expect(audit.totals.resolved).toBe(1);
    expect(audit.totals.unresolved).toBe(1);

    const byResource = new Map(audit.entries.map((entry) => [entry.resource, entry]));
    expect(byResource.get("/references/work.md")?.resolved).toBe(true);
    expect(byResource.get("/references/missing.md")?.resolved).toBe(false);
    expect(byResource.get('"https://quoted"')?.category).toBe("quoted");
    expect(byResource.get("Teen Wolf Wiki")?.category).toBe("bare-wiki");
    expect(byResource.get("author-provided timeline data")?.category).toBe("non-followable");
  });

  test("fixQuotedSources strips the surrounding quotes", async () => {
    const root = await makeBundle(auditFiles);
    const bundle = await loadBundle(root);
    const fixed = await fixQuotedSources(bundle);
    expect(fixed).toEqual(["novel.md"]);

    const reloaded = await loadBundle(root);
    const novel = reloaded.concepts.find((concept) => concept.id === "novel");
    const sources = novel?.frontmatter.sources as { resource: string }[] | undefined;
    expect(sources?.map((entry) => entry.resource)).toContain("https://quoted");
    expect(sources?.map((entry) => entry.resource)).not.toContain('"https://quoted"');

    const audit = auditSources(reloaded);
    expect(audit.totals.quoted).toBe(0);
    expect(audit.totals.url).toBe(2);
  });
});

const GENERATED = "generated: { by: human:a, at: 2026-09-12T00:00:00Z }";

function novelFile(): string {
  return `---\ntype: Novel\ntitle: Test\nstatus: stable\n${GENERATED}\n---\n`;
}

function heroFile(sources: string[]): string {
  const lines = sources.map((resource) => `  - id: s\n    resource: ${resource}`).join("\n");
  return `---\ntype: Character\ntitle: Hero\nrole: protagonist\nfate: alive\norigin: source\nsources:\n${lines}\nstatus: stable\n${GENERATED}\n---\n`;
}

async function build(files: Record<string, string>) {
  return loadBundle(await makeBundle({ "novel.md": novelFile(), ...files }));
}

describe("relative source resources", () => {
  test("relative resources are followable and audited as bundle", async () => {
    const bundle = await build({
      "references/work.md": `---\ntype: Reference\ntitle: Work\nresource: https://example.com/work\nstatus: stable\n${GENERATED}\n---\n`,
      "characters/hero.md": heroFile(["../references/work.md"]),
    });
    const codes = validateBundle(bundle).diagnostics.map((entry) => entry.code);
    expect(codes).not.toContain("fanfic/unverifiable-source");
    expect(codes).not.toContain("fanfic/unresolved-source");

    const audit = auditSources(bundle);
    const entry = audit.entries.find((candidate) => candidate.path === "characters/hero.md");
    expect(entry?.category).toBe("bundle");
    expect(entry?.id).toBe("references/work");
    expect(entry?.resolved).toBe(true);
  });

  test("missing relative resources warn as unresolved", async () => {
    const bundle = await build({
      "characters/hero.md": heroFile(["../references/missing.md"]),
    });
    const codes = validateBundle(bundle)
      .diagnostics.filter((entry) => entry.code === "fanfic/unresolved-source")
      .map((entry) => entry.message);
    expect(codes).toEqual(["sources resource ../references/missing.md does not exist in the bundle"]);
  });
});