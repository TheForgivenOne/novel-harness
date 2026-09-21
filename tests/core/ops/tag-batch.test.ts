import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { applyTagRules } from "../../../src/core/ops/tag-batch.ts";
import { makeBundle } from "../../helpers.ts";

const tagFiles = {
  "novel.md": "---\ntype: Novel\ntitle: T\n---\n",
  "characters/derek.md":
    "---\ntype: Character\ntitle: Derek\nrole: deuteragonist\nfate: alive\nspecies: werewolf\ntags: [alpha]\n---\n",
  "characters/stiles.md":
    "---\ntype: Character\ntitle: Stiles\nrole: protagonist\nfate: alive\ntags: [human]\n---\n",
  "arcs/season-1.md": "---\ntype: Arc\ntitle: Season One\ntags: [canon]\n---\n",
  "rules.yaml":
    '- match:\n    type: character\n    species: werewolf\n  add: [werewolf]\n' +
    '- match:\n    file: "arcs/*.md"\n  add: [arc]\n',
};

describe("tag --batch", () => {
  test("adds tags only to matching concepts and is idempotent", async () => {
    const root = await makeBundle(tagFiles);
    const bundle = await loadBundle(root);
    const result = await applyTagRules(bundle, `${root}/rules.yaml`);

    expect(result.rules).toBe(2);
    expect(result.changed).toEqual([
      { path: "arcs/season-1.md", added: ["arc"] },
      { path: "characters/derek.md", added: ["werewolf"] },
    ]);
    expect(result.unchanged).toContain("characters/stiles.md");
    expect(result.unchanged).toContain("novel.md");

    const reloaded = await loadBundle(root);
    const derek = reloaded.concepts.find((concept) => concept.id === "characters/derek");
    const stiles = reloaded.concepts.find((concept) => concept.id === "characters/stiles");
    const arc = reloaded.concepts.find((concept) => concept.id === "arcs/season-1");
    expect(derek?.frontmatter.tags).toEqual(["alpha", "werewolf"]);
    expect(stiles?.frontmatter.tags).toEqual(["human"]);
    expect(arc?.frontmatter.tags).toEqual(["canon", "arc"]);

    const second = await applyTagRules(reloaded, `${root}/rules.yaml`);
    expect(second.changed).toEqual([]);
    expect(second.unchanged).toHaveLength(reloaded.concepts.length);
  });
});