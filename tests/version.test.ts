import { describe, expect, test } from "bun:test";
import pkg from "../package.json";
import { VERSION } from "../src/version.ts";

describe("VERSION", () => {
  test("matches package.json so release-please bumps it", () => {
    expect(VERSION).toBe(pkg.version);
  });

  test("is a plain semver string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });
});
