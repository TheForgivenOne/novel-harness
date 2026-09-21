import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { parseDocument } from "../../../src/core/bundle/frontmatter.ts";
import { applySourceWork } from "../../../src/core/project/source-work.ts";
import { makeBundle } from "../../helpers.ts";

function fanficFiles(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "novel.md":
      "---\ntype: Novel\ntitle: The Boy Who Lived Again\nfandom: Harry Potter\ncanon_type: canon-divergent\nsource_works: [/references/hp-books.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "references/hp-books.md":
      "---\ntype: Reference\ntitle: Harry Potter novels\nresource: https://example.com/hp\n---\n",
    "characters/harry.md":
      "---\ntype: Character\ntitle: Harry Potter\nrole: protagonist\nfate: alive\ntags: [gryffindor]\norigin: source\nsources:\n  - id: hp-books\n    resource: /references/hp-books.md\n    title: Harry Potter novels\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n\nHarry is a wizard.[^hp-books]\n\n[^hp-books]: Harry Potter novels\n",
    "characters/draco.md":
      "---\ntype: Character\ntitle: Draco Malfoy\nrole: deuteragonist\nfate: alive\ntags: [slytherin]\norigin: divergent\ndiverges_at: /chapters/ch-01/sc-01.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01.md":
      "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/harry.md\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01/sc-01.md":
      "---\ntype: Scene\ntitle: S\nsequence: 1\npov: /characters/harry.md\ncast:\n  - /characters/harry.md\n  - /characters/draco.md\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nProse.\n",
    ...extra,
  };
}

describe("source work attachment", () => {
  test("applySourceWork appends a link once and is idempotent", async () => {
    const bundle = await loadBundle(await makeBundle(fanficFiles()));
    const novel = bundle.concepts.find((concept) => concept.id === "novel");
    expect(novel).toBeDefined();

    const once = applySourceWork(novel!, "/references/teen-wolf.md");
    const parsed = parseDocument(once);
    expect(parsed.data.source_works).toContain("/references/hp-books.md");
    expect(parsed.data.source_works).toContain("/references/teen-wolf.md");

    const twice = applySourceWork({ ...novel!, raw: once }, "/references/teen-wolf.md");
    const reparsed = parseDocument(twice);
    const links = (reparsed.data.source_works as string[]).filter(
      (link) => link === "/references/teen-wolf.md",
    );
    expect(links).toHaveLength(1);
  });
});