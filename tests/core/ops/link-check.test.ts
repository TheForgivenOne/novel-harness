import { describe, expect, test } from "bun:test";
import { checkLinks } from "../../../src/core/ops/link-check.ts";

describe("link check", () => {
  test("classifies live, moved, blocked, missing, and server errors", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/ok") return new Response("ok");
        if (path === "/moved") return Response.redirect(new URL("/ok", request.url).toString(), 302);
        if (path === "/blocked") return new Response("no", { status: 403 });
        if (path === "/gone") return new Response("gone", { status: 404 });
        if (path === "/boom") return new Response("boom", { status: 500 });
        return new Response("missing", { status: 404 });
      },
    });
    const base = `http://localhost:${server.port}`;
    const results = await checkLinks(
      [`${base}/ok`, `${base}/moved`, `${base}/blocked`, `${base}/gone`, `${base}/boom`],
      { timeoutMs: 5_000 },
    );
    server.stop(true);
    expect(results.map((result) => result.status)).toEqual([
      "live",
      "moved",
      "blocked",
      "missing",
      "unverified",
    ]);
    expect(results[1]?.finalUrl).toBe(`${base}/ok`);
  });

  test("connection failures are unverified", async () => {
    const result = await checkLinks(["http://127.0.0.1:1/nope"], { timeoutMs: 2_000 });
    expect(result[0]?.status).toBe("unverified");
  });
});