import { httpGet } from "../net/http.ts";

export type LinkStatus = "live" | "moved" | "blocked" | "missing" | "unverified";

export interface LinkCheckResult {
  url: string;
  status: LinkStatus;
  httpStatus?: number;
  finalUrl?: string;
  detail?: string;
}

const BLOCKED_STATUS = new Set([401, 403, 429]);
const MISSING_STATUS = new Set([404, 410]);

export async function checkLink(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<LinkCheckResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  try {
    const response = await httpGet(url, { timeoutMs });
    const httpStatus = response.status;
    if (httpStatus >= 200 && httpStatus < 300) {
      return response.finalUrl !== undefined
        ? { url, status: "moved", httpStatus, finalUrl: response.finalUrl }
        : { url, status: "live", httpStatus };
    }
    if (BLOCKED_STATUS.has(httpStatus)) return { url, status: "blocked", httpStatus };
    if (MISSING_STATUS.has(httpStatus)) return { url, status: "missing", httpStatus };
    return { url, status: "unverified", httpStatus };
  } catch (error) {
    return { url, status: "unverified", detail: (error as Error).message };
  }
}

export async function checkLinks(
  urls: string[],
  options: { timeoutMs?: number; concurrency?: number } = {},
): Promise<LinkCheckResult[]> {
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const results: LinkCheckResult[] = [];
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (index < urls.length) {
      const current = urls[index];
      index += 1;
      if (current === undefined) continue;
      results.push(await checkLink(current, options));
    }
  });
  await Promise.all(workers);

  const order = new Map(urls.map((url, position) => [url, position]));
  results.sort((a, b) => (order.get(a.url) ?? 0) - (order.get(b.url) ?? 0));
  return results;
}
