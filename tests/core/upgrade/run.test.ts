import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type { InstallInfo } from "../../../src/core/upgrade/detect.ts";
import { compareVersions } from "../../../src/core/upgrade/latest.ts";
import {
  assetName,
  normalizeTag,
  parseChecksum,
  runUpgrade,
  type UpgradeDeps,
} from "../../../src/core/upgrade/run.ts";

interface Harness {
  deps: UpgradeDeps;
  runs: string[][];
  writes: { path: string; size: number }[];
  moved: [string, string][];
  text: Record<string, string>;
  bytes: Record<string, Uint8Array>;
}

function harness(install: InstallInfo, overrides: Partial<UpgradeDeps> = {}): Harness {
  const runs: string[][] = [];
  const writes: { path: string; size: number }[] = [];
  const moved: [string, string][] = [];
  const text: Record<string, string> = {};
  const bytes: Record<string, Uint8Array> = {};

  const deps: UpgradeDeps = {
    detect: () => install,
    get: async (url) => ({
      status: text[url] === undefined ? 404 : 200,
      text: text[url] ?? "",
    }),
    getBytes: async (url) => ({
      status: bytes[url] === undefined ? 404 : 200,
      bytes: bytes[url] ?? new Uint8Array(),
    }),
    fetchLatest: async () => ({ tag: "v0.2.0", version: "0.2.0", url: "https://example.test" }),
    run: async (command) => {
      runs.push(command);
      return { code: 0, stdout: "", stderr: "" };
    },
    write: async (path, data) => {
      writes.push({ path, size: typeof data === "string" ? data.length : data.byteLength });
    },
    move: async (from, to) => {
      moved.push([from, to]);
    },
    chmod: async () => {},
    execPath: install.method === "binary" ? "/usr/local/bin/novel" : "/usr/local/bin/bun",
    currentVersion: "0.1.0",
    platform: "linux",
    arch: "x64",
    tempPath: "/usr/local/bin/.novel-upgrade-1",
    ...overrides,
  };

  return { deps, runs, writes, moved, text, bytes };
}

const sourceInstall: InstallInfo = {
  method: "source",
  location: "/repo",
  updateCommand: "cd /repo && git pull --ff-only && bun install",
  selfUpdatable: true,
  sourceRoot: "/repo",
};

const binaryInstall: InstallInfo = {
  method: "binary",
  location: "/usr/local/bin/novel",
  updateCommand: "novel upgrade --yes",
  selfUpdatable: true,
};

const npmInstall: InstallInfo = {
  method: "npm-global",
  location: "/usr/bin/node",
  updateCommand: "npm install -g novel-harness@latest",
  selfUpdatable: false,
};

describe("upgrade helpers", () => {
  test("assetName maps supported platforms", () => {
    expect(assetName("linux", "x64")).toBe("novel-linux-x64");
    expect(assetName("darwin", "arm64")).toBe("novel-darwin-arm64");
    expect(assetName("win32", "x64")).toBeUndefined();
    expect(assetName("linux", "ia32")).toBeUndefined();
  });

  test("normalizeTag adds the v prefix once", () => {
    expect(normalizeTag("0.2.0")).toBe("v0.2.0");
    expect(normalizeTag("v0.2.0")).toBe("v0.2.0");
  });

  test("parseChecksum finds the matching entry", () => {
    const sums = `aaaa  novel-linux-x64\n${"b".repeat(64)}  novel-darwin-arm64\n`;
    expect(parseChecksum(sums, "novel-darwin-arm64")).toBe("b".repeat(64));
    expect(parseChecksum(sums, "novel-linux-arm64")).toBeUndefined();
  });

  test("compareVersions orders dotted versions", () => {
    expect(compareVersions("0.1.0", "0.2.0")).toBe(-1);
    expect(compareVersions("v0.2.0", "0.2.0")).toBe(0);
    expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
  });
});

describe("runUpgrade", () => {
  test("reports the update command for a package-manager install without touching the network", async () => {
    const h = harness(npmInstall);
    const report = await runUpgrade({}, h.deps);
    expect(report.ok).toBe(true);
    expect(report.latest).toBeUndefined();
    expect(report.message).toContain("npm install -g novel-harness@latest");
    expect(h.runs).toEqual([]);
  });

  test("--check looks up the latest release without executing", async () => {
    const h = harness(sourceInstall);
    const report = await runUpgrade({ check: true }, h.deps);
    expect(report.latest?.tag).toBe("v0.2.0");
    expect(report.updateAvailable).toBe(true);
    expect(report.message).toContain("git pull --ff-only");
    expect(h.runs).toEqual([]);
  });

  test("--yes pulls source and installs dependencies", async () => {
    const h = harness(sourceInstall);
    const report = await runUpgrade({ yes: true }, h.deps);
    expect(report.ok).toBe(true);
    expect(h.runs).toEqual([
      ["git", "pull", "--ff-only"],
      ["bun", "install"],
    ]);
    expect(report.message).toContain("pulled the latest source");
  });

  test("--yes --version checks out a pinned tag", async () => {
    const h = harness(sourceInstall);
    const report = await runUpgrade({ yes: true, version: "0.2.0" }, h.deps);
    expect(report.ok).toBe(true);
    expect(h.runs).toEqual([
      ["git", "fetch", "--tags", "--force"],
      ["git", "checkout", "v0.2.0"],
      ["bun", "install"],
    ]);
    expect(report.message).toContain("v0.2.0");
  });

  test("--yes on a binary verifies the checksum and replaces the executable", async () => {
    const h = harness(binaryInstall);
    const payload = new TextEncoder().encode("#!/bin/sh\necho novel\n");
    const digest = createHash("sha256").update(payload).digest("hex");
    const asset = "novel-linux-x64";
    const base = "https://github.com/TheForgivenOne/novel-harness/releases/download/v0.2.0";
    h.text[`${base}/SHA256SUMS`] = `${digest}  ${asset}\n`;
    h.bytes[`${base}/${asset}`] = payload;

    const report = await runUpgrade({ yes: true, version: "v0.2.0" }, h.deps);
    expect(report.ok).toBe(true);
    expect(h.writes).toEqual([{ path: "/usr/local/bin/.novel-upgrade-1", size: payload.byteLength }]);
    expect(h.moved).toEqual([["/usr/local/bin/.novel-upgrade-1", "/usr/local/bin/novel"]]);
    expect(report.message).toBe("updated to v0.2.0");
  });

  test("--yes on a binary rejects a checksum mismatch", async () => {
    const h = harness(binaryInstall);
    const payload = new TextEncoder().encode("tampered");
    const asset = "novel-linux-x64";
    const base = "https://github.com/TheForgivenOne/novel-harness/releases/download/v0.2.0";
    h.text[`${base}/SHA256SUMS`] = `${"a".repeat(64)}  ${asset}\n`;
    h.bytes[`${base}/${asset}`] = payload;

    const report = await runUpgrade({ yes: true, version: "v0.2.0" }, h.deps);
    expect(report.ok).toBe(false);
    expect(report.message).toContain("checksum mismatch");
    expect(h.moved).toEqual([]);
  });

  test("--yes on a binary fails cleanly without a platform asset", async () => {
    const h = harness(binaryInstall, { platform: "win32" });
    const report = await runUpgrade({ yes: true }, h.deps);
    expect(report.ok).toBe(false);
    expect(report.message).toContain("no prebuilt binary");
  });

  test("reports up to date when the current version is not older", async () => {
    const h = harness(sourceInstall, {
      fetchLatest: async () => ({ tag: "v0.1.0", version: "0.1.0", url: "x" }),
    });
    const report = await runUpgrade({ check: true }, h.deps);
    expect(report.updateAvailable).toBe(false);
  });

  test("surfaces a failed source command", async () => {
    const h = harness(sourceInstall, {
      run: async (command) => {
        h.runs.push(command);
        return command[0] === "git"
          ? { code: 128, stdout: "", stderr: "fatal: not a git repository" }
          : { code: 0, stdout: "", stderr: "" };
      },
    });
    const report = await runUpgrade({ yes: true }, h.deps);
    expect(report.ok).toBe(false);
    expect(report.message).toContain("not a git repository");
    expect(h.runs).toHaveLength(1);
  });
});
