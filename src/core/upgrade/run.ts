import { createHash } from "node:crypto";
import { chmod, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { VERSION } from "../../version.ts";
import { httpGet, httpGetBuffer, type HttpGetBufferResult, type HttpGetResult } from "../net/http.ts";
import { defaultDetectEnv, detectInstall, type InstallInfo } from "./detect.ts";
import { compareVersions, fetchLatestRelease, REPO, RELEASES_PAGE, type ReleaseInfo } from "./latest.ts";

export interface UpgradeOptions {
  /** Look up the latest release over the network. */
  check?: boolean;
  /** Perform the update (source: git + bun; binary: download and replace). */
  yes?: boolean;
  /** Target a specific release tag instead of the latest. */
  version?: string;
}

export interface UpgradeReport {
  currentVersion: string;
  install: InstallInfo;
  latest?: ReleaseInfo;
  updateAvailable?: boolean;
  actions: string[];
  message?: string;
  ok: boolean;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface UpgradeDeps {
  detect: () => InstallInfo;
  get: (url: string, options?: { timeoutMs?: number; maxBytes?: number }) => Promise<HttpGetResult>;
  getBytes: (
    url: string,
    options?: { timeoutMs?: number; maxBytes?: number },
  ) => Promise<HttpGetBufferResult>;
  fetchLatest: () => Promise<ReleaseInfo>;
  run: (command: string[], cwd: string) => Promise<RunResult>;
  write: (path: string, data: string | Uint8Array) => Promise<void>;
  move: (from: string, to: string) => Promise<void>;
  chmod: (path: string, mode: number) => Promise<void>;
  execPath: string;
  currentVersion: string;
  platform: string;
  arch: string;
  /** Scratch path on the same filesystem as execPath, for the atomic swap. */
  tempPath: string;
}

const ASSET_PLATFORMS: Record<string, string> = { linux: "linux", darwin: "darwin" };
const ASSET_ARCHS: Record<string, string> = { x64: "x64", arm64: "arm64" };

export function assetName(platform: string, arch: string): string | undefined {
  const mappedPlatform = ASSET_PLATFORMS[platform];
  const mappedArch = ASSET_ARCHS[arch];
  if (mappedPlatform === undefined || mappedArch === undefined) return undefined;
  return `novel-${mappedPlatform}-${mappedArch}`;
}

export function normalizeTag(value: string): string {
  return value.startsWith("v") ? value : `v${value}`;
}

/** Read a sha256 digest for `filename` from a SHA256SUMS file. */
export function parseChecksum(text: string, filename: string): string | undefined {
  for (const line of text.split("\n")) {
    const match = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (!match) continue;
    const digest = match[1];
    const name = match[2];
    if (digest !== undefined && name !== undefined && name.trim() === filename) {
      return digest.toLowerCase();
    }
  }
  return undefined;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function firstLine(value: string): string {
  return value.trim().split("\n")[0]?.trim() ?? "";
}

async function spawnRun(command: string[], cwd: string): Promise<RunResult> {
  const proc = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

export function defaultUpgradeDeps(): UpgradeDeps {
  const execPath = process.execPath;
  return {
    detect: () => detectInstall(defaultDetectEnv()),
    get: httpGet,
    getBytes: httpGetBuffer,
    fetchLatest: () => fetchLatestRelease(httpGet),
    run: spawnRun,
    write: (path, data) => writeFile(path, data),
    move: (from, to) => rename(from, to),
    chmod: (path, mode) => chmod(path, mode),
    execPath,
    currentVersion: VERSION,
    platform: process.platform,
    arch: process.arch,
    tempPath: join(dirname(execPath), `.novel-upgrade-${process.pid}`),
  };
}

export async function runUpgrade(
  options: UpgradeOptions,
  deps: UpgradeDeps,
): Promise<UpgradeReport> {
  const install = deps.detect();
  const report: UpgradeReport = {
    currentVersion: deps.currentVersion,
    install,
    actions: [],
    ok: true,
  };

  const wantsNetwork = options.check === true || options.yes === true;
  if (wantsNetwork) {
    try {
      report.latest = await deps.fetchLatest();
      report.updateAvailable = compareVersions(report.latest.version, deps.currentVersion) > 0;
    } catch (error) {
      report.ok = false;
      report.message = `could not check for updates: ${(error as Error).message}`;
      return report;
    }
  }

  if (install.selfUpdatable && options.yes === true) {
    if (install.method === "source") {
      await upgradeSource(report, install, options, deps);
    } else if (install.method === "binary") {
      await upgradeBinary(report, options, deps);
    }
    return report;
  }

  report.message = install.updateCommand
    ? `update with: ${install.updateCommand}`
    : `no automatic update for this install; see ${RELEASES_PAGE}`;
  return report;
}

async function upgradeSource(
  report: UpgradeReport,
  install: InstallInfo,
  options: UpgradeOptions,
  deps: UpgradeDeps,
): Promise<void> {
  const root = install.sourceRoot ?? install.location;
  const commands: string[][] = [];
  if (options.version !== undefined) {
    commands.push(["git", "fetch", "--tags", "--force"]);
    commands.push(["git", "checkout", normalizeTag(options.version)]);
  } else {
    commands.push(["git", "pull", "--ff-only"]);
  }
  commands.push(["bun", "install"]);

  for (const command of commands) {
    const result = await deps.run(command, root);
    report.actions.push(`$ ${command.join(" ")}`);
    if (result.code !== 0) {
      report.ok = false;
      report.message = `${command.join(" ")} failed: ${
        firstLine(result.stderr) || firstLine(result.stdout) || `exit ${result.code}`
      }`;
      return;
    }
  }

  report.message =
    options.version !== undefined
      ? `checked out ${normalizeTag(options.version)} and installed dependencies`
      : "pulled the latest source and installed dependencies";
}

async function upgradeBinary(
  report: UpgradeReport,
  options: UpgradeOptions,
  deps: UpgradeDeps,
): Promise<void> {
  const tag = options.version !== undefined ? normalizeTag(options.version) : report.latest?.tag;
  const asset = assetName(deps.platform, deps.arch);
  if (asset === undefined) {
    report.ok = false;
    report.message = `no prebuilt binary for ${deps.platform}-${deps.arch}; build from source or use scripts/install.sh`;
    return;
  }

  const base =
    tag !== undefined
      ? `https://github.com/${REPO}/releases/download/${tag}`
      : `https://github.com/${REPO}/releases/latest/download`;

  let sums: HttpGetResult | undefined;
  try {
    sums = await deps.get(`${base}/SHA256SUMS`, { timeoutMs: 15_000, maxBytes: 1_000_000 });
  } catch (error) {
    report.ok = false;
    report.message = `could not download SHA256SUMS: ${(error as Error).message}`;
    return;
  }
  if (sums.status !== 200) {
    report.ok = false;
    report.message = `could not download SHA256SUMS (HTTP ${sums.status})`;
    return;
  }

  const expected = parseChecksum(sums.text, asset);
  if (expected === undefined) {
    report.ok = false;
    report.message = `SHA256SUMS has no entry for ${asset}`;
    return;
  }

  let download: HttpGetBufferResult | undefined;
  try {
    download = await deps.getBytes(`${base}/${asset}`, {
      timeoutMs: 60_000,
      maxBytes: 64 * 1024 * 1024,
    });
  } catch (error) {
    report.ok = false;
    report.message = `could not download ${asset}: ${(error as Error).message}`;
    return;
  }
  if (download.status !== 200) {
    report.ok = false;
    report.message = `could not download ${asset} (HTTP ${download.status})`;
    return;
  }

  const actual = sha256(download.bytes);
  if (actual !== expected) {
    report.ok = false;
    report.message = `checksum mismatch for ${asset}: expected ${expected}, got ${actual}`;
    return;
  }

  try {
    await deps.write(deps.tempPath, download.bytes);
    await deps.chmod(deps.tempPath, 0o755);
    await deps.move(deps.tempPath, deps.execPath);
  } catch (error) {
    report.ok = false;
    report.message = `could not replace ${deps.execPath}: ${(error as Error).message}`;
    return;
  }

  report.actions.push(`downloaded ${asset}`);
  report.actions.push(`replaced ${deps.execPath}`);
  report.message = `updated to ${tag ?? "latest"}`;
}
