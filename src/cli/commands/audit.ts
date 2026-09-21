import { loadBundle } from "../../core/bundle/bundle.ts";
import {
  auditReceipts,
  citedUrls,
  type ReceiptCoverage,
} from "../../core/evidence/coverage.ts";
import { readFetchReceipts } from "../../core/evidence/receipts.ts";
import { regenerateIndexes } from "../../core/index/generate.ts";
import {
  auditSources,
  SOURCE_CATEGORIES,
  type SourceAudit,
} from "../../core/ops/audit-sources.ts";
import { checkLinks, type LinkCheckResult } from "../../core/ops/link-check.ts";
import { checkProject, type DoctorIssue } from "../../core/project/doctor.ts";
import { applyValidateFixes } from "../../core/validate/fix.ts";
import { groupByCode } from "../../core/validate/diagnostics.ts";
import { keepDiagnostic, matchesOnly } from "../../core/validate/filter.ts";
import { validateBundle, type Diagnostic } from "../../core/validate/index.ts";
import { flagBool, flagString, type ParsedArgs } from "../args.ts";
import { openProject, type ProjectContext } from "../project.ts";

interface AuditReport {
  project: DoctorIssue[];
  content: Diagnostic[];
  sources: SourceAudit;
  receipts?: ReceiptCoverage;
  links?: LinkCheckResult[];
}

function renderProject(issues: DoctorIssue[]): string[] {
  if (issues.length === 0) return ["* no project issues"];
  return issues.map((issue) => `* ${issue.severity} [${issue.code}] ${issue.message}`);
}

function renderSources(audit: SourceAudit, only: string | undefined, summary: boolean): string[] {
  const entries = audit.entries.filter((entry) => matchesOnly(entry.path, only));
  const lines: string[] = [
    `* link categories: url ${audit.totals.url ?? 0} · bundle ${audit.totals.bundle ?? 0} ` +
      `(unresolved ${audit.totals.unresolved ?? 0}) · quoted ${audit.totals.quoted ?? 0} · ` +
      `bare-wiki ${audit.totals["bare-wiki"] ?? 0} · non-followable ${audit.totals["non-followable"] ?? 0}`,
  ];
  if (summary) return lines;
  for (const category of SOURCE_CATEGORIES) {
    const group = entries.filter((entry) => entry.category === category);
    if (group.length === 0) continue;
    lines.push(`### ${category} (${group.length})`, "");
    for (const entry of group) lines.push(`* ${entry.path}: ${entry.resource}`);
    lines.push("");
  }
  return lines;
}

function renderReceipts(coverage: ReceiptCoverage): string[] {
  const lines = [
    `* cited URLs: ${coverage.cited} · fetched: ${coverage.fetched} · missing: ${coverage.missing}`,
  ];
  for (const entry of coverage.entries.filter((candidate) => !candidate.fetched)) {
    lines.push(`* missing receipt: ${entry.path} — ${entry.url}`);
  }
  return lines;
}

function renderLinks(results: LinkCheckResult[]): string[] {
  const counts = { live: 0, moved: 0, blocked: 0, missing: 0, unverified: 0 };
  for (const result of results) counts[result.status] += 1;
  const lines = [
    `* live ${counts.live} · moved ${counts.moved} · blocked ${counts.blocked} · ` +
      `missing ${counts.missing} · unverified ${counts.unverified}`,
  ];
  for (const result of results) {
    const status =
      result.httpStatus !== undefined ? `${result.status} (${result.httpStatus})` : result.status;
    const moved = result.finalUrl !== undefined ? ` → ${result.finalUrl}` : "";
    const detail = result.detail !== undefined ? ` — ${result.detail}` : "";
    lines.push(`* ${status} ${result.url}${moved}${detail}`);
  }
  return lines;
}

function renderAudit(report: AuditReport, summary: boolean, only: string | undefined): string {
  const lines: string[] = ["# Audit", ""];

  lines.push("## Project", "");
  lines.push(...renderProject(report.project));
  lines.push("");

  lines.push("## Content", "");
  const errors = report.content.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = report.content.length - errors;
  lines.push(`* ${errors} error(s), ${warnings} warning(s)`);
  if (summary) {
    const byCode = groupByCode(report.content);
    for (const [code, count] of [...byCode.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`* ${code}: ${count}`);
    }
  } else {
    lines.push("");
    for (const diagnostic of report.content) {
      lines.push(
        `${diagnostic.severity}${diagnostic.path ? ` ${diagnostic.path}` : ""} ` +
          `[${diagnostic.code}] ${diagnostic.message}`,
      );
    }
  }
  lines.push("");

  lines.push("## Sources", "");
  lines.push(...renderSources(report.sources, only, summary));
  lines.push("");

  if (report.receipts !== undefined) {
    lines.push("## Receipts", "");
    lines.push(...renderReceipts(report.receipts));
    lines.push("");
  }

  if (report.links !== undefined) {
    lines.push("## Links", "");
    lines.push(...renderLinks(report.links));
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export async function cmdAudit(args: ParsedArgs, cwd: string): Promise<number> {
  try {
    let project: ProjectContext = await openProject(cwd);
    const fix = flagBool(args, "fix");
    if (fix) {
      const changes = await regenerateIndexes(project.bundle);
      const changed = changes.filter((change) => change.changed).length;
      process.stdout.write(`Regenerated ${changed} index file(s).\n`);
      project = await openProject(cwd);
      const fixes = await applyValidateFixes(project.bundle);
      for (const item of fixes) process.stdout.write(`fixed: ${item.path} — ${item.message}\n`);
      process.stdout.write(`${fixes.length} quick fix(es) applied\n`);
      project = await openProject(cwd);
    }
    const bundle = fix ? await loadBundle(project.bundlePath) : project.bundle;

    const only = flagString(args, "only");
    const severity = flagString(args, "severity");
    const quiet = flagBool(args, "quiet") || severity === "error";
    const summary = flagBool(args, "summary");
    const wantReceipts = flagBool(args, "receipts");
    const wantOnline = flagBool(args, "online");

    const validation = validateBundle(bundle);
    const projectReport = await checkProject(project.root, project.config);
    const sources = auditSources(bundle);
    const coverage =
      wantReceipts || wantOnline
        ? auditReceipts(bundle, await readFetchReceipts(project.root))
        : undefined;
    const links = wantOnline
      ? await checkLinks(citedUrls(bundle).map((entry) => entry.url))
      : undefined;

    const content = validation.diagnostics.filter((diagnostic) =>
      keepDiagnostic(diagnostic, only, severity, quiet),
    );
    const projectIssues = projectReport.issues.filter((issue) => {
      if (quiet && issue.severity !== "error") return false;
      if (severity === "error" && issue.severity !== "error") return false;
      if (severity === "warning" && issue.severity !== "warning") return false;
      return only === undefined;
    });
    const sourceEntries = sources.entries.filter((entry) => matchesOnly(entry.path, only));
    const filteredSources: SourceAudit = {
      totals: sources.totals,
      entries: sourceEntries,
    };

    const report: AuditReport = {
      project: projectIssues,
      content,
      sources: filteredSources,
      ...(coverage !== undefined ? { receipts: coverage } : {}),
      ...(links !== undefined ? { links } : {}),
    };

    if (flagBool(args, "json")) {
      const counts = {
        errors: validation.errors,
        warnings: validation.warnings,
        total: validation.diagnostics.length,
      };
      process.stdout.write(`${JSON.stringify({ ...report, counts }, null, 2)}\n`);
    } else {
      process.stdout.write(renderAudit(report, summary, only));
    }

    const failingSources = sourceEntries.some(
      (entry) =>
        entry.category === "non-followable" ||
        entry.category === "bare-wiki" ||
        (entry.category === "bundle" && entry.resolved === false),
    );
    const failing =
      validation.errors > 0 ||
      projectReport.issues.some((issue) => issue.severity === "error") ||
      failingSources ||
      (coverage !== undefined && coverage.missing > 0) ||
      (links !== undefined && links.some((result) => result.status === "missing"));
    return failing ? 1 : 0;
  } catch (error) {
    process.stderr.write(`error: ${(error as Error).message}\n`);
    return 1;
  }
}
