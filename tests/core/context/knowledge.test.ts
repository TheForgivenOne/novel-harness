import { describe, expect, test } from "bun:test";
import { parseKnowledgeBody, rowsAtOrBefore } from "../../../src/core/context/knowledge.ts";

const BODY = `# Who Knows What, When

## Season 1

| Character | Knows about | Since | How they learned |
| --------- | ----------- | ----- | ---------------- |
| Scott McCall | the bite | January 5, 2011 | He was bitten |
| Scott McCall | the pack | February 1, 2011 | He was told |

## Season 2

| Character | Knows about | Since | How they learned |
| --------- | ----------- | ----- | ---------------- |
| Elena Voss | the archive | before season 1 | She built it |
`;

describe("knowledge matrix parsing", () => {
  test("parses rows under their season headings", () => {
    const rows = parseKnowledgeBody(BODY);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.season).toBe("Season 1");
    expect(rows[0]?.character).toBe("Scott McCall");
    expect(rows[1]?.since).toBe("February 1, 2011");
    expect(rows[2]?.season).toBe("Season 2");
  });

  test("keeps undated rows and rows at or before when", () => {
    const rows = rowsAtOrBefore(parseKnowledgeBody(BODY), "January 9, 2011");
    expect(rows.map((row) => row.knows)).toEqual(["the bite", "the archive"]);
  });

  test("separator rows and blank rows are skipped", () => {
    const body =
      "| Character | Knows about | Since | How they learned |\n" +
      "| --- | --- | --- | --- |\n" +
      "|   |   |   |   |\n" +
      "| A | B | January 5, 2011 | C |";
    const rows = parseKnowledgeBody(body);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.character).toBe("A");
  });
});