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

describe("novel upgrade", () => {
  test("prints its own usage", async () => {
    const { code, out } = await capture(["upgrade", "--help"]);
    expect(code).toBe(0);
    expect(out).toContain("novel upgrade");
    expect(out).toContain("--check");
    expect(out).toContain("--yes");
  });

  test("prints an offline report as JSON without --check or --yes", async () => {
    const { code, out } = await capture(["upgrade", "--json"]);
    expect(code).toBe(0);
    const report = JSON.parse(out) as { currentVersion: string; install: { method: string } };
    expect(typeof report.currentVersion).toBe("string");
    expect(typeof report.install.method).toBe("string");
  });

  test("novel update prints its own usage", async () => {
    const { code, out } = await capture(["update", "--help"]);
    expect(code).toBe(0);
    expect(out).toContain("novel update");
  });
});
