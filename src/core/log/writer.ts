import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Bundle } from "../bundle/bundle.ts";

const TITLE = "# Directory Update Log";
export const LOG_DATE_RE = /^## (\d{4}-\d{2}-\d{2})\s*$/;

export interface LogEntry {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** Conventionally Initialization, Creation, Update, or Deprecation. */
  action: string;
  message: string;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ParsedLog {
  header: string;
  sections: Map<string, string[]>;
}

function parseLog(existing: string | undefined): ParsedLog {
  if (!existing || existing.trim() === "") {
    return { header: TITLE, sections: new Map() };
  }

  const consumed: string[] = [];
  const sections = new Map<string, string[]>();
  let current: string | null = null;

  for (const line of existing.split("\n")) {
    const match = LOG_DATE_RE.exec(line);
    if (match?.[1]) {
      current = match[1];
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current === null) {
      if (line.trim() !== "") consumed.push(line.trimEnd());
    } else {
      sections.get(current)?.push(line);
    }
  }

  return { header: consumed.length > 0 ? consumed.join("\n") : TITLE, sections };
}

export function renderLogUpdate(existing: string | undefined, entry: LogEntry): string {
  const { header, sections } = parseLog(existing);
  const bucket = sections.get(entry.date) ?? [];
  bucket.unshift(`* **${entry.action}**: ${entry.message}`);
  sections.set(entry.date, bucket);

  const lines: string[] = [header, ""];
  const dates = [...sections.keys()].sort((a, b) => b.localeCompare(a));
  for (const date of dates) {
    lines.push(`## ${date}`);
    for (const item of sections.get(date) ?? []) {
      const text = item.trimEnd();
      if (text !== "") lines.push(text);
    }
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "")}\n`;
}

export async function appendLog(bundle: Bundle, dir: string, entry: LogEntry): Promise<string> {
  const rel = dir === "" ? "log.md" : `${dir}/log.md`;
  const existing = bundle.logFiles.find((file) => file.path === rel)?.raw;
  const next = renderLogUpdate(existing, entry);

  const abs = join(bundle.root, rel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, next, "utf8");
  return rel;
}
