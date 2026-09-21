export type Severity = "error" | "warning";

export interface Diagnostic {
  severity: Severity;
  /** Stable code, for example `okf/type` or `continuity/dead-character`. */
  code: string;
  message: string;
  /** Bundle-relative path of the offending file, when known. */
  path?: string;
}

export interface ValidationResult {
  diagnostics: Diagnostic[];
  errors: number;
  warnings: number;
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = diagnostic.path ? ` ${diagnostic.path}` : "";
  return `${diagnostic.severity}:${location} [${diagnostic.code}] ${diagnostic.message}`;
}

export function summarize(diagnostics: Diagnostic[]): ValidationResult {
  return {
    diagnostics,
    errors: diagnostics.filter((d) => d.severity === "error").length,
    warnings: diagnostics.filter((d) => d.severity === "warning").length,
  };
}

export function groupByCode(diagnostics: Diagnostic[]): Map<string, number> {
  const byCode = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    byCode.set(diagnostic.code, (byCode.get(diagnostic.code) ?? 0) + 1);
  }
  return byCode;
}
