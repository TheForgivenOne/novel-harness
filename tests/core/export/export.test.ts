import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { exportBundle, renderManuscriptHtml } from "../../../src/core/export/export.ts";
import { makeBundle } from "../../helpers.ts";

const storyFiles = {
  "novel.md":
    "---\ntype: Novel\ntitle: The Hollow Crown\ndescription: A map that should not exist.\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "characters/scott.md":
    "---\ntype: Character\ntitle: Scott McCall\nrole: protagonist\nfate: alive\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n",
  "chapters/ch-01.md":
    "---\ntype: Chapter\ntitle: The Archive\nsequence: 1\npov: /characters/scott.md\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\n# Summary\n",
  "chapters/ch-01/sc-01.md":
    '---\ntype: Scene\ntitle: The Map\nsequence: 1\npov: /characters/scott.md\ncast: [/characters/scott.md]\nstatus: draft\ngenerated: { by: human:a, at: 2026-09-12T00:00:00Z }\n---\nThe archivist set <script>alert("intruder")</script> on the table.\n\nA second paragraph follows.\n',
};

describe("export", () => {
  test("renders a self-contained html manuscript", async () => {
    const bundle = await loadBundle(await makeBundle(storyFiles));
    const html = renderManuscriptHtml(bundle);

    expect(html).toContain("The Hollow Crown");
    expect(html).toContain("A map that should not exist.");
    expect(html).toContain("<h1>Chapter 1 — The Archive</h1>");
    expect(html).toContain("The archivist set");
    expect(html).toContain("A second paragraph follows.");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('src="http');
    expect(html).not.toContain('href="http');
  });

  test("exportBundle writes manuscript.html and manuscript.md", async () => {
    const root = await makeBundle(storyFiles);
    const bundle = await loadBundle(root);
    const outDir = join(root, "dist");

    const htmlPath = await exportBundle(bundle, outDir, "html");
    expect(htmlPath).toBe(join(outDir, "manuscript.html"));
    expect(await readFile(htmlPath, "utf8")).toContain("The Hollow Crown");

    const mdPath = await exportBundle(bundle, outDir, "md");
    expect(mdPath).toBe(join(outDir, "manuscript.md"));
    expect(await readFile(mdPath, "utf8")).toContain("# The Hollow Crown");
  });

  test("exportBundle rejects epub and pdf formats", async () => {
    const root = await makeBundle(storyFiles);
    const bundle = await loadBundle(root);
    const outDir = join(root, "dist");

    await expect(exportBundle(bundle, outDir, "pdf")).rejects.toThrow(
      "export --format epub|pdf is not supported yet; use md or html",
    );
    await expect(exportBundle(bundle, outDir, "epub")).rejects.toThrow("not supported yet");
  });
});