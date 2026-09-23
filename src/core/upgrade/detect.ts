import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export type InstallMethod =
  | "source"
  | "binary"
  | "bun-global"
  | "npm-global"
  | "brew"
  | "nix"
  | "unknown";

export interface InstallInfo {
  method: InstallMethod;
  /** Where this install lives: the exec path, or the source checkout root. */
  location: string;
  /** Shell command that updates this install, or null when it cannot be known. */
  updateCommand: string | null;
  /** True when `novel upgrade --yes` can update this install itself. */
  selfUpdatable: boolean;
  /** Checkout root; only present for method "source". */
  sourceRoot?: string;
}

export interface DetectEnv {
  /** process.execPath */
  execPath: string;
  /** Bun.main: the entry script path (a virtual path for compiled binaries). */
  main: string;
  exists: (path: string) => boolean;
  readText: (path: string) => string | undefined;
}

export function defaultDetectEnv(): DetectEnv {
  return {
    execPath: process.execPath,
    main: Bun.main,
    exists: (path) => existsSync(path),
    readText: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
  };
}

function isNovelPackage(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as { name?: unknown };
    return parsed.name === "novel-harness";
  } catch {
    return false;
  }
}

/** Walk up from the entry script to the enclosing novel-harness package. */
function packageRoot(main: string, env: DetectEnv): string | undefined {
  let dir = dirname(main);
  for (;;) {
    const pkg = env.readText(join(dir, "package.json"));
    if (pkg !== undefined && isNovelPackage(pkg)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** True when a package root belongs to a package manager, not a git checkout. */
function isManagedRoot(root: string): boolean {
  const norm = root.replaceAll("\\", "/");
  return (
    norm.includes("/node_modules/") ||
    norm.includes("/.bun/install/") ||
    norm.includes("/.bun/global/")
  );
}

/** True when running from a compiled standalone binary. */
function isCompiled(env: DetectEnv): boolean {
  if (env.main.startsWith("/$bunfs/")) return true;
  if (env.main.startsWith("/~BUN/")) return true;
  if (/^[A-Za-z]:[\\/]~BUN[\\/]/.test(env.main)) return true;
  const name = basename(env.execPath).toLowerCase();
  return (name === "novel" || name === "novel.exe") && !env.main.endsWith(".ts");
}

export function detectInstall(env: DetectEnv): InstallInfo {
  const exec = env.execPath.replaceAll("\\", "/");

  if (exec.includes("/nix/store/")) {
    return {
      method: "nix",
      location: env.execPath,
      updateCommand: "nix profile upgrade novel-harness",
      selfUpdatable: false,
    };
  }

  if (
    exec.includes("/Cellar/") ||
    exec.includes("/opt/homebrew/") ||
    exec.includes("/homebrew/")
  ) {
    return {
      method: "brew",
      location: env.execPath,
      updateCommand: "brew upgrade novel-harness",
      selfUpdatable: false,
    };
  }

  const root = packageRoot(env.main, env);

  if (root !== undefined && isManagedRoot(root)) {
    const managed = root.replaceAll("\\", "/");
    return managed.includes("/.bun/")
      ? {
          method: "bun-global",
          location: env.execPath,
          updateCommand: "bun add -g novel-harness@latest",
          selfUpdatable: false,
        }
      : {
          method: "npm-global",
          location: env.execPath,
          updateCommand: "npm install -g novel-harness@latest",
          selfUpdatable: false,
        };
  }

  if (root !== undefined && !isCompiled(env)) {
    return {
      method: "source",
      location: root,
      updateCommand: `cd ${root} && git pull --ff-only && bun install`,
      selfUpdatable: true,
      sourceRoot: root,
    };
  }

  if (isCompiled(env)) {
    return {
      method: "binary",
      location: env.execPath,
      updateCommand: "novel upgrade --yes",
      selfUpdatable: true,
    };
  }

  if (exec.includes("/.bun/")) {
    return {
      method: "bun-global",
      location: env.execPath,
      updateCommand: "bun add -g novel-harness@latest",
      selfUpdatable: false,
    };
  }
  if (exec.includes("/node_modules/")) {
    return {
      method: "npm-global",
      location: env.execPath,
      updateCommand: "npm install -g novel-harness@latest",
      selfUpdatable: false,
    };
  }

  return {
    method: "unknown",
    location: env.execPath,
    updateCommand: null,
    selfUpdatable: false,
  };
}
