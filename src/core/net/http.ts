export const USER_AGENT = "novel-harness";

export interface HttpGetOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface HttpGetResult {
  status: number;
  text: string;
  finalUrl?: string;
}

export async function httpGet(url: string, options: HttpGetOptions = {}): Promise<HttpGetResult> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  let text = await response.text();
  if (options.maxBytes !== undefined && text.length > options.maxBytes) {
    text = text.slice(0, options.maxBytes);
  }
  return {
    status: response.status,
    text,
    finalUrl: response.redirected ? response.url : undefined,
  };
}

export interface HttpGetBufferResult {
  status: number;
  bytes: Uint8Array;
  finalUrl?: string;
}

export async function httpGetBuffer(
  url: string,
  options: HttpGetOptions = {},
): Promise<HttpGetBufferResult> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  let bytes = new Uint8Array(await response.arrayBuffer());
  if (options.maxBytes !== undefined && bytes.byteLength > options.maxBytes) {
    bytes = bytes.slice(0, options.maxBytes);
  }
  return {
    status: response.status,
    bytes,
    finalUrl: response.redirected ? response.url : undefined,
  };
}