import { serializeDocument } from "../bundle/frontmatter.ts";

/**
 * Scaffold templates for the two planning artifacts: `story/plan.md`
 * (premise, cast, rules, divergence goals, decision log) and
 * `story/knowledge.md` (per-season "who knows what, when" matrix).
 *
 * Shared by `initProject` (fresh projects) and `fixProject` (legacy bundles
 * missing the artifacts).
 */

export function renderPlanDoc(author: string, now: string): string {
  return serializeDocument({
    data: {
      type: "Plan",
      title: "Story Plan",
      status: "draft",
      generated: { by: author, at: now },
    },
    body: `# Premise

Who wants what, and what stands in the way.

# Logline

One sentence that captures the story.

# Cast

| Character | Role | Fate | Notes |
| --------- | ---- | ---- | ----- |
|           |      |      |       |

# Divergence Goals

| Divergence | Type | Why |
| ---------- | ---- | --- |
|            |      |     |

# Rules

- Form rules, power system limits, harem list, anything the story must obey.

# POV & Tense

- Point of view and tense for the narration.

# Open Questions

- Anything not yet decided; resolve before drafting depends on it.

# Decisions

Freeze every agreed decision here, dated, before creating concepts. Restate
the decision in one line, get the author's confirmation, then record it.

- \`<date>\` — decision
`,
  });
}

export function renderOutlineDoc(author: string, now: string): string {
  return serializeDocument({
    data: {
      type: "Outline",
      title: "Story Outline",
      status: "draft",
      generated: { by: author, at: now },
    },
    body: `# Structure

| Arc | Chapter | Sequence | POV | When | Words |
| --- | ------- | -------- | --- | ---- | ----- |
|     |         |          |     |      |       |

# Scenes

| Chapter | Scene | Sequence | POV | When | Status |
| ------- | ----- | -------- | --- | ---- | ------ |
|         |       |          |     |      |        |

# Next

<!-- Guidance: one row per chapter in # Structure; sequence is in-story
order. One row per scene in # Scenes; status: stub | drafted | revised.
# Next names the chapter or scene to draft next. Keep rows in sync with the
chapter and scene files (novel outline --check). -->
`,
  });
}

export function renderChapterOutlineDoc(
  author: string,
  now: string,
  chapterTitle: string,
): string {
  return serializeDocument({
    data: {
      type: "Chapter Outline",
      title: `${chapterTitle} — Outline`,
      status: "draft",
      generated: { by: author, at: now },
    },
    body: `# Intent

What this chapter is for, in one or two sentences. What must change by the end.

# Scenes

| Scene | Sequence | POV | When | Beat | Payoffs/Callbacks |
| ----- | -------- | --- | ---- | ---- | ----------------- |
|       |          |     |      |      |                   |

# Story So Far

State entering this chapter: who's alive and where, open threads, what the
POV characters know. Keep current as scenes are drafted.

# Canon Refs

Clippings or pointers to canon material this chapter leans on (link to
\`references/\` concepts or notes with sources).

# Notes

Freeform: half-ideas, reminders, links, observations that are not structure
yet. Promote anything structural into # Scenes or \`story/outline.md\` when it
hardens.

# Open Questions

Anything unresolved for this chapter — resolve or defer explicitly.
`,
  });
}

export function renderKnowledgeDoc(author: string, now: string): string {
  return serializeDocument({
    data: {
      type: "Knowledge",
      title: "Knowledge Matrix",
      status: "draft",
      generated: { by: author, at: now },
    },
    body: `# Who Knows What, When

Track what each character knows and when they learn it. Update this file
before drafting each season and after every reveal. Write scenes from the
POV character's knowledge, never from the audience's.

<!-- One section per season; add rows as the cast and secrets grow. -->

## Season 1

| Character | Knows about | Since | How they learned |
| --------- | ----------- | ----- | ---------------- |
|           |             |       |                 |
`,
  });
}