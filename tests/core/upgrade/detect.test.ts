import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { detectInstall, type DetectEnv } from "../../../src/core/upgrade/detect.ts";

function makeEnv(opts: {
  execPath: string;
  main: string;
  packages?: Record<string, unknown>;
}): DetectEnv {
  const files = new Map<string, string>();
  for (const [dir, pkg] of Object.entries(opts.packages ?? {})) {
    files.set(join(dir, "package.json"), JSON.stringify(pkg));
  }
  return {
    execPath: opts.execPath,
    main: opts.main,
    exists: (path) => files.has(path),
    readText: (path) => files.get(path),
  };
}

const novelPackage = { name: "novel-harness", version: "0.1.0" };

describe("detectInstall", () => {
  test("recognizes a source checkout", () => {
    const root = "/home/me/novel-harness";
    const info = detectInstall(
      makeEnv({
        execPath: "/usr/local/bin/bun",
        main: join(root, "bin/novel.ts"),
        packages: { [root]: novelPackage },
      }),
    );
    expect(info.method).toBe("source");
    expect(info.sourceRoot).toBe(root);
    expect(info.selfUpdatable).toBe(true);
    expect(info.updateCommand).toContain("git pull --ff-only");
  });

  test("recognizes a compiled standalone binary", () => {
    const info = detectInstall(
      makeEnv({
        execPath: "/home/me/.local/bin/novel",
        main: "/$bunfs/root/bin/novel.ts",
      }),
    );
    expect(info.method).toBe("binary");
    expect(info.selfUpdatable).toBe(true);
  });

  test("recognizes a nix store install", () => {
    const info = detectInstall(
      makeEnv({
        execPath: "/nix/store/abc123-novel-harness-0.1.0/bin/novel",
        main: "/$bunfs/root/bin/novel.ts",
      }),
    );
    expect(info.method).toBe("nix");
    expect(info.selfUpdatable).toBe(false);
    expect(info.updateCommand).toBe("nix profile upgrade novel-harness");
  });

  test("recognizes a homebrew install", () => {
    const info = detectInstall(
      makeEnv({
        execPath: "/opt/homebrew/Cellar/novel-harness/0.1.0/bin/novel",
        main: "/$bunfs/root/bin/novel.ts",
      }),
    );
    expect(info.method).toBe("brew");
    expect(info.updateCommand).toBe("brew upgrade novel-harness");
  });

  test("recognizes a bun global install", () => {
    const root = "/Users/me/.bun/install/global/node_modules/novel-harness";
    const info = detectInstall(
      makeEnv({
        execPath: "/Users/me/.bun/bin/novel",
        main: join(root, "bin/novel.ts"),
        packages: { [root]: novelPackage },
      }),
    );
    expect(info.method).toBe("bun-global");
    expect(info.selfUpdatable).toBe(false);
  });

  test("recognizes an npm global install", () => {
    const root = "/usr/lib/node_modules/novel-harness";
    const info = detectInstall(
      makeEnv({
        execPath: "/usr/bin/node",
        main: join(root, "bin/novel.ts"),
        packages: { [root]: novelPackage },
      }),
    );
    expect(info.method).toBe("npm-global");
    expect(info.updateCommand).toContain("npm install -g");
  });

  test("falls back to unknown", () => {
    const info = detectInstall(
      makeEnv({ execPath: "/somewhere/novel", main: "/somewhere/novel.ts" }),
    );
    expect(info.method).toBe("unknown");
    expect(info.updateCommand).toBeNull();
  });
});
