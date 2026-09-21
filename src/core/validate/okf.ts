import type { Bundle } from "../bundle/bundle.ts";
import { detectDocument } from "../bundle/frontmatter.ts";
import { LOG_DATE_RE } from "../log/writer.ts";
import type { Diagnostic } from "./diagnostics.ts";

export function validateOkf(bundle: Bundle): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const file of bundle.malformed) {
    diagnostics.push({
      severity: "error",
      code: "okf/frontmatter",
      path: file.path,
      message: `unparseable frontmatter: ${file.message}`,
    });
  }

  for (const concept of bundle.concepts) {
    const type = concept.frontmatter.type;
    if (typeof type !== "string" || type.trim() === "") {
      diagnostics.push({
        severity: "error",
        code: "okf/type",
        path: concept.path,
        message: "missing or empty required `type` field (OKF §4.1)",
      });
    }
  }

  for (const file of bundle.indexFiles) {
    let detected;
    try {
      detected = detectDocument(file.raw);
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code: "okf/index-frontmatter",
        path: file.path,
        message: `unparseable frontmatter: ${(error as Error).message}`,
      });
      continue;
    }
    if (!detected.hasFrontmatter) continue;

    if (file.path !== "index.md") {
      diagnostics.push({
        severity: "error",
        code: "okf/index-frontmatter",
        path: file.path,
        message: "index.md files must not contain frontmatter except at the bundle root (OKF §8)",
      });
      continue;
    }

    const extra = Object.keys(detected.data).filter((key) => key !== "okf_version");
    if (extra.length > 0) {
      diagnostics.push({
        severity: "error",
        code: "okf/index-frontmatter",
        path: file.path,
        message: `root index.md may only carry \`okf_version\`, found: ${extra.join(", ")}`,
      });
    }

    const version = detected.data.okf_version;
    if (version !== undefined && version !== "0.2") {
      diagnostics.push({
        severity: "warning",
        code: "okf/version",
        path: file.path,
        message: `declared okf_version ${JSON.stringify(version)} is not "0.2"`,
      });
    }
  }

  for (const file of bundle.logFiles) {
    try {
      const detected = detectDocument(file.raw);
      if (detected.hasFrontmatter) {
        diagnostics.push({
          severity: "error",
          code: "okf/log-frontmatter",
          path: file.path,
          message: "log.md files must not contain frontmatter (OKF §9)",
        });
        continue;
      }
      for (const line of detected.body.split("\n")) {
        if (!line.startsWith("## ")) continue;
        const match = LOG_DATE_RE.exec(line);
        const date = match?.[1];
        const valid = date !== undefined && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime());
        if (!valid) {
          diagnostics.push({
            severity: "error",
            code: "okf/log-date",
            path: file.path,
            message: "log.md date headings must use ISO 8601 YYYY-MM-DD (OKF §9)",
          });
          break;
        }
      }
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code: "okf/log-frontmatter",
        path: file.path,
        message: `unparseable frontmatter: ${(error as Error).message}`,
      });
    }
  }

  return diagnostics;
}
