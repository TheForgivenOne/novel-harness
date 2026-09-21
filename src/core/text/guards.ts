export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function mergeUnique(...arrays: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of arrays) {
    for (const value of group) {
      if (seen.has(value)) continue;
      seen.add(value);
      merged.push(value);
    }
  }
  return merged;
}
