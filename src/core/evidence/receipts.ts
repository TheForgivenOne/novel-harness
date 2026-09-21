import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface FetchReceipt {
  url: string;
  fetched_at: string;
  sha256: string;
  bytes: number;
}

export const FETCH_LOG_PATH = ".novel/fetch-log.jsonl";

export function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function receiptFor(url: string, body: string, at: Date = new Date()): FetchReceipt {
  return {
    url,
    fetched_at: at.toISOString(),
    sha256: sha256hex(body),
    bytes: Buffer.byteLength(body, "utf8"),
  };
}

export async function appendFetchReceipt(root: string, receipt: FetchReceipt): Promise<void> {
  const abs = join(root, FETCH_LOG_PATH);
  await mkdir(dirname(abs), { recursive: true });
  await appendFile(abs, `${JSON.stringify(receipt)}\n`, "utf8");
}

export async function readFetchReceipts(root: string): Promise<FetchReceipt[]> {
  const raw = await readFile(join(root, FETCH_LOG_PATH), "utf8").catch(() => undefined);
  if (!raw) return [];
  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as FetchReceipt);
}
