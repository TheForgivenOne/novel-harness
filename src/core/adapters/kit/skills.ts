import type { SkillDefinition } from "../types.ts";

export const SKILLS: SkillDefinition[] = [
  {
    name: "novel-harness",
    description:
      "Use when working in a novel-harness project: bundle conventions, concept types, validation, and CLI cheatsheet for story/, chapters, and canon.",
    body: `# novel-harness

The project is an OKF v0.2 bundle under \`story/\`. Facts live in concepts; prose lives in Scene bodies.

## Find things
- \`novel context <concept>\` — prepared slice: scene, chapter, cast, location, neighbors.
- \`novel query search|timeline|when|character|at|tag|refs|stats\` — deterministic reads; add \`--json\`.

## Write things
- \`novel new <type> [name]\` creates the file at the right path with frontmatter.
- One entity is one concept; add alternate names to \`aliases\`, never fork duplicates.
- \`novel rename\`, \`novel mv\`, \`novel set\` for safe renames, moves, and frontmatter edits — never raw \`mv\`/\`sed\`.
- \`status\` is canon state (draft|stable|deprecated); \`origin\` is source|fanon|divergent.

## Check things
- \`novel validate\` — OKF + profile rules; never ignore errors.
- \`novel query stats\` — manuscript counts and chapter word targets.
- \`novel diff\` — review your own bulk edits before reporting done.
- \`novel doctor --fix\` — project drift (config, directories, indexes, adapters).

Read \`story/plan.md\` (agreed premise, cast, rules, divergence goals) and \`story/knowledge.md\` (who knows what, when) before planning or drafting. Never edit generated adapter files; run \`novel sync\` after upgrading. When the CLI is unavailable, follow the file conventions directly and proceed carefully.`,
  },
  {
    name: "novel-recon",
    description:
      "Use when researching source canon for fanfiction recon or refreshing stale canon. Enforces web-first citation discipline and the attested/inferred/unknown claim states.",
    body: `# Recon discipline

- Never write canon from memory. Every fact comes from a page fetched in this session; a fact without a source is not canon.
- Three claim states: attested (a fetched page says it), inferred (your deduction), unknown (not found). Inferred material is never recorded as canon — put it under \`# Open questions\` or mark it \`origin: fanon\`.
- Recon maps, it does not extract: medium-depth facts plus \`refs\` to authoritative pages; no long transcripts in the bundle.
- Cite the exact page per fact: \`sources\` entries with id, resource, and title, plus footnote keys in the body.
- Prefer the work itself, then official sites, guides, and interviews, then wikis.
- Fetch with \`novel_fetch\` when available; every fetch leaves a receipt in \`.novel/fetch-log.jsonl\`.
- When sources disagree, record both; never silently pick one.
- Update mode: \`novel query stale\` lists canon due for a refresh; re-fetch only those pages.
- Finish with \`novel validate\`, fix errors, and hand the result to the \`skeptic\`.`,
  },
  {
    name: "novel-drafting",
    description:
      "Use when drafting or revising prose in a novel-harness project: POV and cast rules, canon discipline, divergence handling, and chapter word budgets.",
    body: `# Drafting discipline

- Facts come from the bundle; \`novel context <scene>\` loads chapter, cast, location, and neighbors.
- Read \`story/plan.md\` and \`story/knowledge.md\`: write from what the POV knows at the scene's \`when\`, never from audience knowledge; update the matrix after reveals.
- POV must match the scene's \`pov\`; no head-hopping. Every character who acts or speaks must be in \`cast\`.
- Never use a character after their \`dies_in\` scene.
- Honor the chapter's \`words\` range: spread the remaining budget across unwritten scenes, aim mid-range, add a scene stub instead of padding.
- Invented facts are \`origin: fanon\`; changed source facts become \`origin: divergent\` with \`diverges_at\` pointing at the scene.
- \`divergence\`: intact plays canon beats unchanged; altered plays the changed version; averted does not happen; added is fanon.
- Set \`generated\`, leave \`status: draft\`, then run \`novel validate\`.`,
  },
  {
    name: "novel-fanfic",
    description:
      "Use when working with fanfiction canon: origin values, source works, divergence ledger, canon type, and canon packs.",
    body: `# Fanfiction canon model

- \`origin: source\` — from the original work; cite it in \`sources\` with a followable URL or bundle file.
- \`origin: fanon\` — invented here.
- \`origin: divergent\` — changed from source canon; requires \`diverges_at\` linking a Scene or Timeline Event.
- Novel frontmatter carries \`fandom\`, \`source_works\` (Reference links), and \`canon_type\`.
- Timeline Events carry the divergence ledger: \`intact | altered | averted | added\`; \`altered\` and \`averted\` require \`diverges_at\`, \`intact\` is implicit for source, \`added\` should be fanon.
- Canon packs move source concepts between projects with \`novel canon export\` and \`novel canon import\`.
- Recon records canon; outline plans changes; draft honors them.`,
  },
  {
    name: "novel-migration",
    description:
      "Use when migrating an older novel project: doctor/migrate commands, deterministic migration specs, seasons-as-chapters, tags, sources, and duplicate merging.",
    body: `# Migration playbook

- \`novel doctor\` reports drift; \`novel doctor --fix\` applies mechanical fixes only.
- \`novel migrate --spec <rules.yaml>\` runs deterministic content actions: \`convert\` (type slugs, optional file), \`merge\` (primary/remove), \`tag\` (match/add).
- Seasons recorded as Chapters become \`Arc\` concepts under \`arcs/\`; canon episodes go to \`episodes/\`.
- Restore citations: author material becomes a bundle file cited in \`sources[].resource\`.
- Merge duplicates and move alternate names into \`aliases\`.
- After any migration: \`novel validate\`, \`novel index\`, \`novel sync\`.
- Never rewrite \`origin: source\` facts from memory; re-fetch them with receipts.`,
  },
];
