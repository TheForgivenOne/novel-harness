import type { Bundle } from "../bundle/bundle.ts";
import { refEntries, sourceEntries } from "../bundle/entries.ts";
import type { FetchReceipt } from "./receipts.ts";

export interface CitedUrl {
  path: string;
  url: string;
}

export function citedUrls(bundle: Bundle): CitedUrl[] {
  const cited: CitedUrl[] = [];
  const seen = new Set<string>();

  const add = (path: string, url: unknown): void => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
    const key = `${path}\u0000${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    cited.push({ path, url });
  };

  for (const concept of bundle.concepts) {
    for (const entry of refEntries(concept)) {
      add(concept.path, entry.url);
    }
    for (const entry of sourceEntries(concept)) {
      add(concept.path, entry.resource);
    }
  }

  return cited;
}

export interface ReceiptCoverageEntry {
  path: string;
  url: string;
  fetched: boolean;
  fetched_at?: string;
}

export interface ReceiptCoverage {
  cited: number;
  fetched: number;
  missing: number;
  entries: ReceiptCoverageEntry[];
}

export function auditReceipts(bundle: Bundle, receipts: FetchReceipt[]): ReceiptCoverage {
  const byUrl = new Map(receipts.map((receipt) => [receipt.url, receipt]));
  const entries: ReceiptCoverageEntry[] = citedUrls(bundle).map(({ path, url }) => {
    const receipt = byUrl.get(url);
    return receipt === undefined
      ? { path, url, fetched: false }
      : { path, url, fetched: true, fetched_at: receipt.fetched_at };
  });
  const fetched = entries.filter((entry) => entry.fetched).length;
  return { cited: entries.length, fetched, missing: entries.length - fetched, entries };
}
