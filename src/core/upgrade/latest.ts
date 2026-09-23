import { httpGet, type HttpGetResult } from "../net/http.ts";

export const REPO = "TheForgivenOne/novel-harness";
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface ReleaseInfo {
  /** Raw release tag, for example "v0.2.0". */
  tag: string;
  /** Tag without a leading "v". */
  version: string;
  /** Human-facing release page. */
  url: string;
}

type TextGet = (
  url: string,
  options?: { timeoutMs?: number; maxBytes?: number },
) => Promise<HttpGetResult>;

export async function fetchLatestRelease(get: TextGet = httpGet): Promise<ReleaseInfo> {
  const response = await get(RELEASES_API, { timeoutMs: 10_000, maxBytes: 64_000 });
  if (response.status === 404) {
    throw new Error("no published releases found");
  }
  if (response.status !== 200) {
    throw new Error(`GitHub releases API returned ${response.status}`);
  }

  let parsed: { tag_name?: unknown; html_url?: unknown };
  try {
    parsed = JSON.parse(response.text) as typeof parsed;
  } catch {
    throw new Error("GitHub releases API returned invalid JSON");
  }

  if (typeof parsed.tag_name !== "string" || parsed.tag_name === "") {
    throw new Error("GitHub releases API response has no tag_name");
  }

  return {
    tag: parsed.tag_name,
    version: parsed.tag_name.replace(/^v/, ""),
    url: typeof parsed.html_url === "string" ? parsed.html_url : RELEASES_PAGE,
  };
}

function parseVersion(value: string): number[] {
  const core = value.replace(/^v/, "").split("-")[0] ?? "";
  return core.split(".").map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

/** Compare two dotted versions; returns -1, 0, or 1. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
