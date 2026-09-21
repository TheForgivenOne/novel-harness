import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { detectDocument } from "../bundle/frontmatter.ts";
import { conceptIdFromPath, toPosix } from "../bundle/paths.ts";

export interface BundleChange {
  status: string;
  path: string;
  type?: string;
  title?: string;
  origin?: string;
  divergence?: string;
}

const STATUS_ORDER = ["M", "A", "D", "R"] as const;

const STATUS_WORDS: Record<string, string> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  T: "type changed",
  U: "unmerged",
};

const SECTION_HEADINGS: Record<string, string> = {
  M: "Modified",
  A: "Added",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  T: "Type Changed",
  U: "Unmerged",
};

function statusWord(status: string): string {
  return STATUS_WORDS[status] ?? (status.toLowerCase() || "changed");
}

function statusRank(status: string): number {
  const index = STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
  return index === -1 ? STATUS_ORDER.length : index;
}

function sectionHeading(status: string): string {
  const known = SECTION_HEADINGS[status];
  if (known !== undefined) return known;
  const word = statusWord(status);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function stripBundlePrefix(repoPath: string, prefix: string): string {
  if (prefix === "" || prefix === ".") return repoPath;
  const withSlash = `${prefix}/`;
  return repoPath.startsWith(withSlash) ? repoPath.slice(withSlash.length) : repoPath;
}

function readAnnotation(absPath: string): Record<string, unknown> | undefined {
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch {
    return undefined;
  }
  try {
    return detectDocument(raw).data;
  } catch {
    return undefined;
  }
}

function annotate(change: BundleChange, absPath: string): void {
  const data = readAnnotation(absPath);
  if (!data) return;

  const type = data.type;
  if (typeof type === "string" && type.trim() !== "") change.type = type;

  const title = data.title;
  change.title =
    typeof title === "string" && title.trim() !== "" ? title : conceptIdFromPath(change.path);

  const origin = data.origin;
  if (typeof origin === "string" && origin.trim() !== "") change.origin = origin;

  const divergence = data.divergence;
  if (typeof divergence === "string" && divergence.trim() !== "") {
    change.divergence = divergence;
  }
}

function parseNameStatus(output: string): BundleChange[] {
  const changes: BundleChange[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const fields = line.split("\t");
    const rawStatus = fields[0] ?? "";
    const path = fields[fields.length - 1] ?? "";
    if (rawStatus === "" || path === "") continue;
    changes.push({ status: rawStatus.charAt(0).toUpperCase(), path });
  }
  return changes;
}

export function gitBundleDiff(
  projectRoot: string,
  bundlePath: string,
  ref1?: string,
  ref2?: string,
): BundleChange[] {
  let repoRoot: string;
  try {
    repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error("novel diff needs a git repository");
  }

  const absBundle = isAbsolute(bundlePath) ? bundlePath : resolve(projectRoot, bundlePath);
  const prefix = toPosix(relative(repoRoot, absBundle));
  const pathspec = prefix === "" ? "." : prefix;

  const refs = [ref1, ref2].filter((ref): ref is string => ref !== undefined && ref !== "");
  const args =
    refs.length === 0
      ? ["diff", "--name-status", "HEAD", "--", pathspec]
      : refs.length === 1
        ? ["diff", "--name-status", refs[0]!, "--", pathspec]
        : ["diff", "--name-status", refs[0]!, refs[1]!, "--", pathspec];

  let output: string;
  try {
    output = execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  } catch (error) {
    throw new Error(`git diff failed: ${(error as Error).message}`);
  }

  const changes = parseNameStatus(output);
  for (const change of changes) {
    change.path = stripBundlePrefix(change.path, prefix);
    annotate(change, join(absBundle, change.path));
  }

  if (refs.length < 2) {
    const known = new Set(changes.map((change) => change.path));
    const untracked = execFileSync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "--", pathspec],
      { cwd: repoRoot, encoding: "utf8" },
    );
    for (const line of untracked.split(/\r?\n/)) {
      const repoPath = toPosix(line.trim());
      if (repoPath === "") continue;
      const rel = stripBundlePrefix(repoPath, prefix);
      if (known.has(rel) || !rel.endsWith(".md")) continue;
      const change: BundleChange = { status: "A", path: rel };
      annotate(change, join(absBundle, rel));
      changes.push(change);
    }
  }

  return changes;
}

function describeChange(change: BundleChange): string {
  const parts = [change.path];
  if (change.type !== undefined) parts.push(change.type);
  if (change.origin !== undefined) parts.push(`origin ${change.origin}`);
  if (change.divergence !== undefined) parts.push(change.divergence);
  return parts.join(" — ");
}

export function renderDiffMarkdown(
  from: string,
  to: string,
  changes: BundleChange[],
): string {
  const lines = [`# Diff ${from}..${to}`, ""];

  if (changes.length === 0) {
    lines.push("No changes.", "");
    return lines.join("\n");
  }

  const statuses = [...new Set(changes.map((change) => change.status))];
  statuses.sort((a, b) => statusRank(a) - statusRank(b) || a.localeCompare(b));

  const summary = statuses
    .map((status) => `${changes.filter((change) => change.status === status).length} ${statusWord(status)}`)
    .join(" · ");
  lines.push(`* ${summary}`, "");

  for (const status of statuses) {
    const group = changes.filter((change) => change.status === status);
    if (group.length === 0) continue;
    lines.push(`## ${sectionHeading(status)}`);
    for (const change of group) lines.push(`* ${describeChange(change)}`);
    lines.push("");
  }

  return lines.join("\n");
}
