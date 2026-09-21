export function toPosix(path: string): string {
  return path.split("\\").join("/");
}

export function stripMarkdownExtension(path: string): string {
  return path.endsWith(".md") ? path.slice(0, -3) : path;
}

export function conceptIdFromPath(relPath: string): string {
  return stripMarkdownExtension(toPosix(relPath));
}

export function isBundleLink(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && value.endsWith(".md");
}

export const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function isFollowableResource(value: string): boolean {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (!trimmed.endsWith(".md")) return false;
  if (SCHEME_RE.test(trimmed)) return false;
  return !/\s/.test(trimmed);
}

function normalizeSegments(path: string): string | undefined {
  const parts: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return undefined;
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return parts.join("/");
}

export function normalizeBundlePath(target: string, fromPath: string): string | undefined {
  if (SCHEME_RE.test(target)) return undefined;
  if (target.startsWith("/")) {
    const normalized = normalizeSegments(target.slice(1));
    return normalized === undefined || normalized === "" ? undefined : `/${normalized}`;
  }
  const dir = parentDir(fromPath);
  const joined = dir === "" ? target : `${dir}/${target}`;
  const normalized = normalizeSegments(joined);
  return normalized === undefined || normalized === "" ? undefined : `/${normalized}`;
}

export function linkTargetId(link: string): string {
  const normalized = link.startsWith("/") ? link.slice(1) : link;
  return stripMarkdownExtension(normalized);
}

export function parentDir(relPath: string): string {
  const idx = relPath.lastIndexOf("/");
  return idx === -1 ? "" : relPath.slice(0, idx);
}

export function basename(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}
