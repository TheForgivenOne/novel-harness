import type { Diagnostic } from "./diagnostics.ts";

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesOnly(path: string | undefined, only: string | undefined): boolean {
  if (only === undefined) return true;
  if (path === undefined) return false;
  if (only.includes("*")) {
    const pattern = new RegExp(`^${only.split("*").map(escapeRegExp).join(".*")}$`);
    return pattern.test(path);
  }
  return path === only || path.startsWith(`${only.replace(/\/$/, "")}/`) || path.includes(only);
}

export function keepDiagnostic(
  diagnostic: Diagnostic,
  only: string | undefined,
  severity: string | undefined,
  quiet: boolean,
): boolean {
  if (quiet && diagnostic.severity !== "error") return false;
  if (severity === "error" && diagnostic.severity !== "error") return false;
  if (severity === "warning" && diagnostic.severity !== "warning") return false;
  return matchesOnly(diagnostic.path, only);
}
