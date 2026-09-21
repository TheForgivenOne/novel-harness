import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { exportPack, importPack, readPackMeta } from "../../../src/core/canon/pack.ts";
import { makeBundle } from "../../helpers.ts";

function fanficFiles(): Record<string, string> {
  return {
    "novel.md":
      "---\ntype: Novel\ntitle: Fic\nfandom: Test Fandom\ncanon_type: canon-divergent\nsource_works: [/references/work.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "references/work.md":
      "---\ntype: Reference\ntitle: Source Work\nresource: https://example.com/work\n---\n",
    "characters/canon-hero.md":
      "---\ntype: Character\ntitle: Canon Hero\nrole: protagonist\nfate: alive\ntags: [hero]\norigin: source\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "characters/oc.md":
      "---\ntype: Character\ntitle: Original Character\nrole: supporting\nfate: alive\ntags: [oc]\norigin: fanon\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01.md":
      "---\ntype: Chapter\ntitle: One\nsequence: 1\npov: /characters/canon-hero.md\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    "chapters/ch-01/sc-01.md":
      "---\ntype: Scene\ntitle: S\nsequence: 1\npov: /characters/canon-hero.md\ncast: [/characters/canon-hero.md]\ntags: [ch-01]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  };
}

describe("canon packs", () => {
  test("export includes only canon concepts and references", async () => {
    const bundle = await loadBundle(await makeBundle(fanficFiles()));
    const out = await mkdtemp(join(tmpdir(), "pack-"));
    const { meta, files } = await exportPack(bundle, out, "2026-09-12T00:00:00Z");

    expect(meta.fandom).toBe("Test Fandom");
    expect(meta.concepts).toBe(2);
    expect(files).toEqual(["characters/canon-hero.md", "references/work.md"]);
    expect(existsSync(join(out, "pack.json"))).toBe(true);
    expect(existsSync(join(out, "characters/oc.md"))).toBe(false);
    expect(existsSync(join(out, "chapters"))).toBe(false);

    const readBack = await readPackMeta(out);
    expect(readBack.name).toBe("Test Fandom");
  });

  test("refuses to export inside the story bundle", async () => {
    const root = await makeBundle(fanficFiles());
    const bundle = await loadBundle(root);
    await expect(exportPack(bundle, join(root, "nested"))).rejects.toThrow("story bundle");
  });

  test("import adds canon into a fresh bundle and keeps links intact", async () => {
    const source = await loadBundle(await makeBundle(fanficFiles()));
    const packDir = await mkdtemp(join(tmpdir(), "pack-"));
    await exportPack(source, packDir);

    const targetRoot = await makeBundle({
      "novel.md":
        "---\ntype: Novel\ntitle: Other Fic\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    });
    const result = await importPack(targetRoot, packDir);
    expect(result.added.sort()).toEqual(["characters/canon-hero.md", "references/work.md"]);

    const imported = await loadBundle(targetRoot);
    const hero = imported.concepts.find((concept) => concept.id === "characters/canon-hero");
    expect(hero?.frontmatter.origin).toBe("source");

    const again = await importPack(targetRoot, packDir);
    expect(again.unchanged.sort()).toEqual(["characters/canon-hero.md", "references/work.md"]);
  });

  test("keeps author-owned divergences and reports conflicts", async () => {
    const source = await loadBundle(await makeBundle(fanficFiles()));
    const packDir = await mkdtemp(join(tmpdir(), "pack-"));
    await exportPack(source, packDir);

    const targetRoot = await makeBundle({
      "novel.md":
        "---\ntype: Novel\ntitle: Other Fic\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
    });
    await importPack(targetRoot, packDir);

    const heroPath = join(targetRoot, "characters/canon-hero.md");
    const divergent = (await readFile(heroPath, "utf8")).replace("origin: source", "origin: divergent");
    await writeFile(heroPath, divergent, "utf8");

    const kept = await importPack(targetRoot, packDir);
    expect(kept.keptLocal).toContain("characters/canon-hero.md");
    expect(kept.conflicts).not.toContain("characters/canon-hero.md");

    const sourceAgain = (await readFile(heroPath, "utf8")).replace("origin: divergent", "origin: source");
    await writeFile(heroPath, `${sourceAgain}\nchanged\n`, "utf8");

    const conflicted = await importPack(targetRoot, packDir);
    expect(conflicted.conflicts).toContain("characters/canon-hero.md");

    const forced = await importPack(targetRoot, packDir, { force: true });
    expect(forced.updated).toContain("characters/canon-hero.md");
    expect(await readFile(heroPath, "utf8")).not.toContain("\nchanged\n");
  });
});
