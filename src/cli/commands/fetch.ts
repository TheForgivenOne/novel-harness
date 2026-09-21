import { appendFetchReceipt, receiptFor } from "../../core/evidence/receipts.ts";
import { httpGet } from "../../core/net/http.ts";
import { flagNumber, type ParsedArgs } from "../args.ts";
import { openProject } from "../project.ts";

const DEFAULT_MAX_BYTES = 20_000;

export function truncatePage(body: string, maxBytes: number): string {
  if (body.length <= maxBytes) return body;
  const omitted = body.length - maxBytes;
  return `${body.slice(0, maxBytes)}\n… truncated (${omitted} more characters)`;
}

export async function cmdFetch(args: ParsedArgs, cwd: string): Promise<number> {
  const [url] = args.positional;
  if (!url) {
    process.stderr.write("error: usage: novel fetch <url> [--max-bytes <n>]\n");
    return 1;
  }
  try {
    const result = await httpGet(url);
    if (result.status < 200 || result.status >= 300) {
      process.stderr.write(`error: fetch ${url} returned ${result.status}\n`);
      return 1;
    }
    const body = result.text;
    const project = await openProject(cwd);
    const receipt = receiptFor(url, body);
    await appendFetchReceipt(project.root, receipt);

    const maxBytes = flagNumber(args, "max-bytes") ?? DEFAULT_MAX_BYTES;
    const page = truncatePage(body, maxBytes);
    process.stdout.write(page.endsWith("\n") ? page : `${page}\n`);
    process.stderr.write(`receipt: ${receipt.sha256.slice(0, 12)} (${receipt.bytes} bytes)\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
