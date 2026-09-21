import { compareWhen } from "../bundle/timeline.ts";

export interface KnowledgeRow {
  season: string;
  character: string;
  knows: string;
  since?: string;
  learned: string;
}

const HEADER_RE = /^\| *Character *\|/;
const ROW_RE = /^\|/;
const CELL_EMPTY_RE = /^[-:\s]+$/;

/** Parse every knowledge-matrix row in a Knowledge document body. */
export function parseKnowledgeBody(body: string): KnowledgeRow[] {
  const rows: KnowledgeRow[] = [];
  let season = "Season 1";
  let inTable = false;
  for (const line of body.split("\n")) {
    const seasonMatch = /^##\s+(.+)$/.exec(line.trim());
    if (seasonMatch) {
      season = seasonMatch[1]!.trim();
      inTable = false;
      continue;
    }
    if (HEADER_RE.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable || !ROW_RE.test(line)) {
      inTable = false;
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;
    if (cells.every((cell) => cell === "")) continue;
    if (cells.every((cell) => CELL_EMPTY_RE.test(cell))) continue;
    rows.push({
      season,
      character: cells[0] ?? "",
      knows: cells[1] ?? "",
      since: cells[2] && cells[2] !== "" ? cells[2] : undefined,
      learned: cells[3] ?? "",
    });
  }
  return rows;
}

/** Rows a character would know by `when` — Since at or before it, or undated. */
export function rowsAtOrBefore(rows: KnowledgeRow[], when: string): KnowledgeRow[] {
  return rows.filter((row) => row.since === undefined || compareWhen(row.since, when) <= 0);
}