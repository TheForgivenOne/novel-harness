import { describe, expect, spyOn, test } from "bun:test";
import { main } from "../../src/cli/main.ts";

async function capture(argv: string[]): Promise<{ code: number; out: string }> {
  const chunks: string[] = [];
  const spy = spyOn(process.stdout, "write").mockImplementation(((chunk: string) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);
  const code = await main(argv);
  spy.mockRestore();
  return { code, out: chunks.join("") };
}

describe("per-command help", () => {
  test("novel new documents the accepted --chapter forms", async () => {
    const { code, out } = await capture(["new", "--help"]);
    expect(code).toBe(0);
    expect(out).toContain("novel new <type> [name]");
    expect(out).toContain("--chapter <id|title|slug>");
    expect(out).toContain("--from-template");
  });

  test.each([
    ["validate", "novel validate"],
    ["rename", "novel rename"],
    ["fetch", "novel fetch"],
    ["diff", "novel diff"],
    ["query", "novel query"],
    ["audit", "novel audit"],
    ["import", "novel import"],
    ["set", "novel set"],
    ["rm", "novel rm"],
    ["mv", "novel mv"],
    ["renumber", "novel renumber"],
  ])("%s prints its own usage", async (command, needle) => {
    const { code, out } = await capture([command, "--help"]);
    expect(code).toBe(0);
    expect(out).toContain(needle);
  });

  test("-h is accepted", async () => {
    const { code, out } = await capture(["sync", "-h"]);
    expect(code).toBe(0);
    expect(out).toContain("novel sync");
  });

  test("validate documents its filters and renumber its sort field", async () => {
    const validate = await capture(["validate", "--help"]);
    expect(validate.code).toBe(0);
    expect(validate.out).toContain("--only <id|glob>");
    expect(validate.out).toContain("--severity error|warning");
    expect(validate.out).toContain("--quiet");
    const renumber = await capture(["renumber", "--help"]);
    expect(renumber.code).toBe(0);
    expect(renumber.out).toContain("--sort sequence|when");
  });

  test("global help is unchanged", async () => {
    const { code, out } = await capture(["--help"]);
    expect(code).toBe(0);
    expect(out).toContain("Usage: novel <command> [options]");
  });
});
