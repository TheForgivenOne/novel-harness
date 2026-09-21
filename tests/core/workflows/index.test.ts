import { describe, expect, test } from "bun:test";
import { defaultWorkflows } from "../../../src/workflows/index.ts";

describe("draft guidance", () => {
  test("draft, continue, and outline reference the chapter range", () => {
    const workflows = defaultWorkflows();
    const body = (name: string) => workflows.find((workflow) => workflow.name === name)?.body ?? "";
    expect(body("draft")).toContain("words:");
    expect(body("draft")).toContain("novel query stats");
    expect(body("continue")).toContain("words:");
    expect(body("outline")).toContain("words: { min, max }");
  });
});

describe("guardrail guidance", () => {
  test("outline grounds in the whole story and surfaces dangling threads", () => {
    const workflows = defaultWorkflows();
    const body = (name: string) => workflows.find((workflow) => workflow.name === name)?.body ?? "";
    expect(body("outline")).toContain("--story");
    expect(body("outline")).toContain("threads --dangling");
    expect(body("outline")).toContain("Foreshadows:");
  });

  test("draft enforces the scope wall and reader state", () => {
    const workflows = defaultWorkflows();
    const body = (name: string) => workflows.find((workflow) => workflow.name === name)?.body ?? "";
    expect(body("draft")).toContain("--so-far");
    expect(body("draft")).toContain("Scope wall");
    expect(body("draft")).toContain("/scene-check");
  });

  test("scene-check workflow audits knowledge bleed", () => {
    const workflows = defaultWorkflows();
    const body = (name: string) => workflows.find((workflow) => workflow.name === name)?.body ?? "";
    expect(body("scene-check")).toContain("knowledge bleed");
    expect(body("scene-check")).toContain("--so-far");
  });

  test("knowledge workflow maintains the matrix", () => {
    const workflows = defaultWorkflows();
    const body = (name: string) => workflows.find((workflow) => workflow.name === name)?.body ?? "";
    expect(body("knowledge")).toContain("story/knowledge.md");
    expect(body("knowledge")).toContain("Since");
  });
});