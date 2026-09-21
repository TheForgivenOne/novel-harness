import { describe, expect, test } from "bun:test";
import { loadBundle } from "../../../src/core/bundle/bundle.ts";
import { threads } from "../../../src/core/query/query.ts";
import { makeBundle } from "../../helpers.ts";

const threadFiles = {
  "novel.md": "---\ntype: Novel\ntitle: T\nstatus: draft\n---\n",
  "plot/main-thread.md":
    "---\ntype: Plot Thread\ntitle: The Pack\nkind: main\nstatus: draft\n---\nThe pack.\n",
  "plot/lost-key.md":
    "---\ntype: Plot Thread\ntitle: The Lost Key\nkind: sub\nstatus: draft\n---\nNever advanced.\n",
  "chapters/ch-01.md": "---\ntype: Chapter\ntitle: One\nsequence: 1\nstatus: draft\n---\n",
  "chapters/ch-01/sc-01.md":
    "---\ntype: Scene\ntitle: First\nsequence: 1\nstatus: draft\n---\nHe found the pack: [The Pack](/plot/main-thread.md).\n",
};

describe("plot threads", () => {
  test("lists threads and the scenes that advance them", async () => {
    const bundle = await loadBundle(await makeBundle(threadFiles));
    const report = threads(bundle).data.threads;
    const pack = report.find((thread) => thread.id === "plot/main-thread");
    expect(pack?.kind).toBe("main");
    expect(pack?.scenes.map((scene) => scene.id)).toEqual(["chapters/ch-01/sc-01"]);
    expect(pack?.scenes[0]?.chapter).toBe("chapters/ch-01");
  });

  test("--dangling lists only threads no scene references", async () => {
    const bundle = await loadBundle(await makeBundle(threadFiles));
    const report = threads(bundle, { dangling: true }).data.threads;
    expect(report.map((thread) => thread.id)).toEqual(["plot/lost-key"]);
  });
});