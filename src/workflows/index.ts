import type { Workflow } from "../core/adapters/types.ts";

export const INSTRUCTIONS = `# novel-harness

This project is a novel stored as an OKF v0.2 knowledge bundle under \`story/\`.
You write the novel by reading and editing plain markdown files. There is no
database and no MCP server.

## Start here

1. Read \`story/index.md\`; it lists every concept and links to them.
2. Read \`story/novel.md\` for the premise, point of view, and tense.
3. Read \`story/plan.md\` and \`story/outline.md\` for the agreed premise, cast,
   rules, divergence goals, and chapter structure. Nothing may contradict
   them; changes go through the author.
4. Read \`story/knowledge.md\` for who knows what, when.
5. For any writing task, load context with \`novel context <concept>\`, for
   example \`novel context chapters/ch-01/sc-01\`. If the CLI is unavailable,
   read the target file and follow its links and backlinks yourself.

## Bundle rules

- Every concept file starts with YAML frontmatter containing a \`type\`.
- Prose lives in \`type: Scene\` bodies. Frontmatter holds facts; the body
  holds the writing.
- \`status\` is canon state: \`draft\` (tentative), \`stable\` (canon),
  \`deprecated\` (cut, kept for history).
- \`generated: { by, at }\` records authorship. Use \`human:<name>\` only for
  human-authored text; agents use \`<agent>/<model>\`.
- \`verified: { by, at }\` records author sign-off. Never add a \`human:\`
  verifier on the author's behalf unless they asked for it.
- Links are bundle-relative and include \`.md\`, for example
  \`[Elena](/characters/elena-voss.md)\`.
- Never invent facts that contradict canon. If the story needs a new fact,
  write it into the relevant concept first, then use it.

## Creating things

- Prefer \`novel new <type> <name>\`; it places the file correctly and sets
  required frontmatter. Types: character, location, faction, worldbuilding,
  plot-thread, chapter, scene, timeline-event, theme, relationship,
  reference, research-note, plan, knowledge.
- If the CLI is unavailable, mirror an existing concept of the same type and
  copy its required fields.
- \`novel rename\`, \`novel mv\`, and \`novel set\` change names, paths, and
  frontmatter safely — never edit with raw \`mv\` or \`sed\`.
- Get explicit approval before bulk-creating chapters or scenes (for example
  a full season outline); review the batch with \`novel diff\` before and
  after.

## Fanfiction

- Work in three phases: \`/recon\` records source canon, \`/outline\` plans
  against it, then \`/draft\` writes. Never plan or draft a fanfic before recon
  has recorded the canon baseline.
- Canon is sourced, never remembered. Recon reads sources with web tools and
  cites each fact; if no web tools are available it stops and says so rather
  than reconstructing canon from memory.
- The source work is a Reference concept in \`story/references/\`; \`novel.md\`
  carries \`fandom\`, \`canon_type\`, and \`source_works\`.
- One entity is one concept. Search titles and aliases before creating;
  merge duplicates and record alternate names in \`aliases\`.
- Mark where every fact comes from with \`origin\`:
  - \`source\` — from the original work; cite it in \`sources\` and attribute
    claims with a footnote keyed to the source \`id\`.
  - \`fanon\` — invented for this story.
  - \`divergent\` — changed from source canon; set \`diverges_at\` to the Scene
    or Timeline Event where the change happens.
- Never contradict a fact marked \`origin: source\` without marking the concept
  \`origin: divergent\` and recording the divergence point.

## Continuity

- A scene's \`cast\` lists every character present; the POV must be in cast.
- A character with \`fate: dead\` sets \`dies_in\` to the scene where they die;
  never cast them in a later scene.
- After changes, run \`novel validate\` and fix errors. Warnings are guidance.
- Run \`novel index\` after adding or renaming concepts.

## Finishing a task

- Update \`generated.at\` on every file you touch.
- Review your own bulk edits with \`novel diff\` before reporting done.
- Leave \`status: draft\` unless the author asks to promote to canon.
- Do not rewrite prose the author wrote unless the workflow asks for it.
- Report what you changed in two or three lines.
`;

export const WORKFLOWS: Workflow[] = [
  {
    name: "recon",
    description: "Learn the source canon for a fanfiction and record it in the bundle",
    argumentHint: "[source work or scope]",
    body: `# Task: Canon recon

Learn the source material for this fanfiction and record it in the bundle.
Scope: {{args}}

## Ground rules (these matter more than speed)

- Never write canon from your own memory. Every fact you record must come from
  a page you actually read during this task with a web tool. Use
  \`novel_fetch\` when it is available so every page leaves a receipt in
  \`.novel/fetch-log.jsonl\`.
- Keep three claim states straight: attested (a fetched page says it),
  inferred (your deduction from attested facts), unknown (not found).
  Inferred material never becomes canon: put it under a \`# Open questions\`
  heading or mark it \`origin: fanon\` with a note.
- Recon maps, it does not extract. Record medium-depth documentation — enough
  to plan, outline, and fact-check — and attach \`refs\` to the authoritative
  pages so a later agent can fetch full detail (transcripts, scene
  choreography, exact dialogue) on demand. Never paste long transcripts into
  the bundle.
- If you have no web tools available, stop and say so. Do not reconstruct
  canon from memory; ask the author to enable web access first.
- Prefer primary and authoritative sources in this order: the work itself
  where readable, official sites, published guides and interviews, then
  community wikis.
- Cite the exact page for each fact. A fact without a source is not canon.
- When sources disagree, record the disagreement in the concept body and
  prefer the primary work. Do not silently pick one.
- Material the author gives you in chat is a source too: save it into the
  bundle first (a Reference concept or a file under \`story/references/\`) and
  cite that file. Never cite an unfollowable label like "author-provided
  data", and never cite a wiki's name without the page URL.
- One entity is one concept. Search existing titles and aliases before
  creating anything; if the entity exists, update it and add the new name to
  \`aliases\`. A duo is two Character concepts plus a Relationship concept,
  never a merged character file.
- Do not fill gaps with plausible invention. Put unknowns under a
  \`# Open questions\` heading instead.

## Update mode

If the bundle already contains \`origin: source\` concepts, you are updating,
not crawling:

1. Run \`novel query stale\` to list canon facts due for a refresh, and
   \`novel query refs <concept>\` for where to check them.
2. Re-fetch only those pages and update the facts, keeping citations exact.
3. Bump \`generated\` and set a fresh \`stale_after\` (for example 90 days out).
4. Do not re-crawl the whole fandom, and never touch author-owned
   (\`origin: fanon\` or \`divergent\`) concepts.

## Steps

1. Read \`story/novel.md\` for \`fandom\` and \`source_works\`. Create one
   Reference concept per source work with:
   \`novel new reference "<work>" --resource <url> --source-work\`
   (the flag attaches it to \`source_works\` automatically).
2. Research the source broadly: major characters, locations, factions,
   worldbuilding, the timeline of established events, and the relationships
   between main characters. Delegate crawling to the \`researcher\` subagent
   when it exists, and have it return findings labeled attested, inferred, or
   unknown.
3. Create or update one concept per canon element:
   - Characters in \`story/characters/\`, locations in \`story/locations/\`,
     factions in \`story/factions/\`, lore in \`story/world/\`, objects and
     artifacts in \`story/items/\`, dated events in \`story/timeline/\`, bonds
     in \`story/relationships/\`, seasons and arcs in \`story/arcs/\`, and canon
     episodes in \`story/episodes/\`.
   - Never create \`story/chapters/\` or Scenes during recon. Chapters and
     scenes belong to the author's story; canon seasons go to \`arcs/\` and
     canon episodes to \`episodes/\`.
   - Link timeline events to their arc and episode with \`arc:\` and
     \`episode:\` bundle links.
   - Search the bundle first for the same entity under any title or alias; if
     it exists, update it and add the new name to \`aliases\` instead of
     creating a second file.
   - Set \`origin: source\` on every concept taken from the original work.
   - Add a \`sources\` entry per source with \`id\`, \`resource\` (the exact URL or
     the bundle file for author-provided material), \`title\`, and \`author\`
     where known; attribute each claim with a footnote keyed to the source
     \`id\` (OKF §5.1).
   - Tag every concept you create (season or arc, species, pack, region,
     role, status) so \`novel query tag\` and \`novel query timeline\` can
     filter it.
   - Attach \`refs\` to every concept pointing at its authoritative pages, for
     example a character's wiki page or an episode's transcript:
     \`refs\` entries are \`{ title, url, kind }\` with kind one of transcript,
     recap, wiki, interview, or other.
   - For each Episode, write a compact scene-by-scene \`# Recap\` (cited) in
     the body and attach the transcript URL in \`refs\`. The recap is for
     planning and fact-checking; the transcript stays on the web.
   - Create a Reference concept \`story/references/voice-<work>.md\` capturing
     the work's voice: point of view, register, verbal tics, slang, how it
     does banter and exposition. Cite it and keep examples short.
   - Put in-world dates in \`when\` on timeline events, and keep them precise
     (day and month where the source gives one). Inline the facts planning
     depends on — character debuts, deaths, and key plot mechanics — into the
     relevant concepts now; do not leave a placeholder file that says the
     author will provide the data later.
   - Set \`stale_after\` on canon concepts (for example 90 days out) so
     \`novel query stale\` and update mode can refresh them incrementally.
4. Do not invent or change canon here. Recon records what the source says;
   planning decides what changes.
5. Write a Research Note (create it with
   \`novel new research-note "Canon: <work>"\`) listing coverage, the exact
   sources used, conflicts between sources, and what you left out.
6. Audit before finishing: merge duplicate titles and aliases; fix the cause
   of any \`profile/duplicate-concept\` or \`fanfic/unverifiable-source\`
   warning. Then run the \`skeptic\` pass over the concepts you touched and
   apply its required edits before declaring canon complete.
7. Gate: run \`novel audit --receipts\`. Every cited URL must have a receipt
   in \`.novel/fetch-log.jsonl\`; if one is missing, fetch the page with
   \`novel_fetch\` until it has one. Unfetched sources are not canon.
8. Run \`novel validate\` and \`novel index\`, and fix errors.

Close with what canon is now recorded, how many sources you read, and what is
still missing.`,
  },
  {
    name: "outline",
    description: "Develop or expand the story outline, plot threads, and scene stubs",
    argumentHint: "[scope, for example 'act two']",
    body: `# Task: Outline

Develop the story structure. Scope: {{args}}

1. Ground in the whole story first: run \`novel context --story\` and read the
   slice it prints — novel, plan, outline, plot threads, arcs, and timeline.
   Read \`story/index.md\`, \`story/novel.md\`, and every file under
   \`story/plot/\` as well.
2. Read \`story/plan.md\`. If it is still the init template (empty cast and
   rules) or missing, stop: extract the premise, cast, rules, and divergence
   goals from the author before creating any chapters. Freeze what you agree
   into \`story/plan.md\` under \`# Decisions\`.
3. Ground every decision: name the concept path it comes from. If the bundle
   does not state something, say so and ask — never act like you know. Restate
   each author decision in one line and wait for a "yes" before creating
   concepts from it. If shorthand is ambiguous, list the readings and let the
   author pick; never guess.
4. Run \`novel query threads --dangling\` and surface every thread no scene
   advances; ask the author how to resolve it before planning around it.
5. If a scope was given above, work on that part of the story. Otherwise work
   on whatever is least developed.
6. Fanfiction: if \`story/novel.md\` declares a \`fandom\`, plan against the
   canon recorded by \`/recon\`. If no \`origin: source\` concepts exist yet,
   stop and ask the author to run \`/recon\` first. Set \`canon_type\` and
   \`source_works\` on \`novel.md\`; mark each deliberate change from canon with
   \`origin: divergent\` and a \`diverges_at\` point.
7. Write the outline before any scene file exists:
   - \`story/outline.md\`: one row per chapter in \`# Structure\` (Arc | Chapter |
     Sequence | POV | When | Words) and one row per scene in \`# Scenes\`
     (Chapter | Scene | Sequence | POV | When | Status: stub | drafted |
     revised). This is the story spine; \`novel new scene\` refuses to create a
     scene whose row is missing.
   - One \`chapters/<slug>/outline.md\` per chapter: \`# Intent\`, a \`# Scenes\`
     table with beats, \`# Story So Far\`, \`# Canon Refs\`, \`# Notes\`, and
     \`# Open Questions\`. Foreshadowing is gated here: if a beat foreshadows a
     later event, mark it explicitly in the row (for example \`Foreshadows:
     <event>\`), because drafting is barred from foreshadowing otherwise.
   - Set \`# Next\` in \`story/outline.md\` to the scene to draft first.
8. Produce or update:
   - Plot Thread concepts in \`story/plot/\` (one file per thread; \`kind: main\`
     or \`kind: sub\`; \`status\`).
   - Chapter concepts with \`sequence\`, tags for their arc or season, and a
     drafting range (\`words: { min, max }\`) when the author has a target
     length.
   - Scene stubs with \`novel new scene\` — rows already exist in
     \`story/outline.md\`, so sequence, POV, and \`when\` fill themselves in.
   - Run \`novel query timeline\` first, and set each Scene's \`when\` to its
     in-world date so the MC's story lines up with canon events
     (\`novel query when <date>\` shows what happens around it).
   - Timeline Events for anything with an in-world date.
   - Divergence ledger: for every canon Timeline Event the MC's story
     touches, set \`divergence: intact | altered | averted | added\` (intact is
     the default). \`altered\` and \`averted\` require \`diverges_at\` pointing at
     the scene that changes or prevents it; \`added\` events are
     \`origin: fanon\`. Describe the change in a \`# Divergence\` section of the
     event. Review with \`novel query divergences\`.
9. Keep each scene stub's body to a one-paragraph intent, never prose.
10. Do not create a full season of scenes in one pass: present the chapter
    structure (titles, sequences, POV) and get approval before creating the
    scene stubs.
11. Run \`novel validate\`, fix errors, then run \`novel index\` and
    \`novel outline --check\` (drift must be zero).
12. Leave every new concept at \`status: draft\`.

The knowledge matrix is maintained by \`/knowledge\`, not by this workflow.

Close with a short summary of what you added and the open questions.`,
  },
  {
    name: "knowledge",
    description: "Maintain story/knowledge.md: who knows what, when, and how they learned it",
    argumentHint: "[scene, character, or season to reconcile]",
    body: `# Task: Knowledge matrix

Maintain the knowledge matrix. Focus: {{args}}

1. Read \`story/knowledge.md\`, the timeline, and the scenes that reveal or
   withhold information. Read \`story/plan.md\` and \`story/outline.md\` for the
   agreed reveals.
2. For every row, verify the \`Since\` date against the scene that revealed the
   fact: a character cannot know something before the scene they learned it in.
   If a row's \`Since\` predates its reveal scene's \`when\`, fix the row.
3. After any scene reveal, update the affected rows: add the fact to the right
   character (with \`Since\` equal to the reveal scene's \`when\`), or confirm it
   is still correctly absent.
4. Use \`novel context <scene> --so-far\` to see the reader state a drafter
   would get, and confirm it matches the matrix.
5. Keep one table per season under \`## Season N\` with columns Character |
   Knows about | Since | How they learned. Do not invent knowledge: every row
   must trace to a scene or a confirmed plan decision.
6. Run \`novel validate\` and fix errors.

Close with what changed and any reveals still unplanned.`,
  },
  {
    name: "draft",
    description: "Draft a scene's prose from bundle context",
    argumentHint: "<scene concept id>",
    body: `# Task: Draft

Draft the prose for the scene \`{{args}}\`.

1. Run \`novel context {{args}}\`. Read the target scene, its chapter, cast,
   location, and neighboring scenes. The timeline in this slice stops at the
   scene's \`when\` — nothing dated after it is shown.
2. Run \`novel context {{args}} --so-far\` and read the reader state: who knows
   what at the scene's \`when\`, from \`story/knowledge.md\`.
3. Read \`story/plan.md\` and \`story/outline.md\` (start where \`# Next\` points).
   Write from what the POV character knows at the scene's \`when\` — never from
   audience or future knowledge.
4. Scope wall (strict): the prose may not reference events, people, or
   concepts dated after the scene's \`when\`. Foreshadowing is allowed only
   where this scene's row in the chapter outline explicitly marks it;
   otherwise, no hinting at future events. Stay in the moment: this scene does
   what its outline beat says and nothing more — do not escalate plans,
   telegraph later reveals, or dump future information.
5. If the scene needs canon detail — exact choreography, how a character
   speaks, what was actually said — run \`novel query refs <concept>\` for the
   scene, its cast, and the relevant episode, and fetch those pages with your
   web tool. Read \`story/references/voice-<work>.md\` if it exists. Match the
   beats and voice; quote sparingly instead of copying long passages.
6. Write the prose into the body of the target file. Keep existing
   frontmatter except \`generated\` and \`status\`.
7. Honor canon:
   - The POV must match the scene's \`pov\`; do not head-hop.
   - Every character who acts or speaks must be in \`cast\`; add them if needed.
   - Never use a character after their \`dies_in\` scene.
   - Match the tense and POV style declared in \`story/novel.md\`.
   - Facts you invent are fanon: mark new concepts \`origin: fanon\`. If this
     scene changes a fact from the source work, update that concept to
     \`origin: divergent\` with \`diverges_at\` pointing at this scene.
   - If the scene has a \`when\`, run \`novel query when <when>\` first. Keep the
     canon beats, locations, and recorded dialogue intact and weave the cast
     into them instead of rewriting them.
   - Honor the event's \`divergence\`: \`intact\` plays the canon beats
     unchanged; \`altered\` plays the changed version described in the event;
     \`averted\` does not happen; \`added\` is fanon.
8. Budget the chapter's words. If the chapter declares a \`words:\` range,
   run \`novel query stats\` and read the chapter's written total. Spread what
   remains of the range across its unwritten scenes and aim mid-range; expand
   or trim this scene to land inside it. If the minimum cannot be reached
   without padding, add a scene stub to the chapter and write that instead of
   bloating one scene.
9. Update the outline: flip the scene's Status in \`story/outline.md\` \`# Scenes\`
   (\`stub\` → \`drafted\` → \`revised\`), mark the beat done in the chapter's
   \`chapters/<slug>/outline.md\` \`# Scenes\` table, refresh \`# Story So Far\`, and
   advance \`# Next\` to the next unwritten scene.
10. If a needed fact is missing, write it into the relevant concept first.
11. Set \`generated: { by: <your actor>, at: <now ISO> }\` and leave
    \`status: draft\`.
12. Run \`/scene-check {{args}}\` and fix every finding it reports before
    declaring the scene done. Then run \`novel validate\` and fix errors. Do
    not modify other scenes.

When the chapter declares no \`words:\` range, write at least 800 words unless
the scene stub says otherwise. End with a one-line note about what changed
and the chapter's new word total.`,
  },
  {
    name: "scene-check",
    description: "Audit one scene for POV integrity, knowledge bleed, and future-dated references",
    argumentHint: "<scene concept id>",
    body: `# Task: Scene check

Audit the scene \`{{args}}\`. You never edit anything; report findings.

1. Run \`novel context {{args}}\` and \`novel context {{args}} --so-far\`. Read the
   scene file, its chapter outline (\`chapters/<slug>/outline.md\`), and
   \`story/knowledge.md\`.
2. Check POV integrity: the prose stays in the scene's declared \`pov\`; no
   head-hop. Every character who acts or speaks is in \`cast\`; no one appears
   after \`dies_in\`.
3. Check knowledge bleed: compare what every character says or implies against
   the matrix \`Since\` column at the scene's \`when\`. Flag any moment a
   character shows knowledge they should not have yet.
4. Check future-dated references: nothing in the prose references an event or
   concept dated after the scene's \`when\` unless this scene's row in the
   chapter outline explicitly marks it as foreshadowing.
5. Check grounding: dialogue, staging, and beats match the scene stub, the
   chapter outline, and canon; flag anything that contradicts the bundle.
6. Check budget and status: the scene lands inside the chapter's \`words:\`
   range; outline statuses (\`story/outline.md\` \`# Scenes\`) match reality.
7. Use \`novel query when <date>\` and \`novel validate\` as needed. Report
   findings grouped by severity with exact file paths and line references.

Close with a prioritized list of fixes for the primary agent.`,
  },
  {
    name: "weave",
    description: "Draft a scene that plays a canon event with the main character woven in",
    argumentHint: "<canon event or date>",
    body: `# Task: Weave the main character into a canon event

Canon event or date: {{args}}

1. Run \`novel query when {{args}}\` to load the event, its arc, episode,
   participants, location, and the events before and after it.
2. Read the POV character concept, its relationships, the voice reference
   (\`story/references/voice-<work>.md\`), and \`story/novel.md\`.
3. Fetch the full scene before writing: run \`novel query refs\` on the event
   and its episode, then open the transcript with your web tool. Match the
   beats, staging, and voice; quote sparingly instead of copying long
   passages.
4. Draft a scene where the MC is present for the canon event. Keep the canon
   beats faithful: same time, same place, same participants, same outcome,
   and the source's dialogue where it is recorded. The MC joins the scene;
   canon does not change around them. The event is \`intact\` by default: if
   this MC changes or prevents it, mark the event \`divergence: altered\` or
   \`averted\` with \`diverges_at\` pointing at this scene before writing.
5. Set the scene's frontmatter: \`when\`, \`location\`, \`cast\` (canon characters
   plus the MC), \`pov\`, and tags for the arc or season. Link the event in the
   body, for example \`[Scott Gets Bitten](/timeline/scott-gets-bitten.md)\`.
6. If the story requires changing a canon fact, stop and mark the affected
   concept \`origin: divergent\` with a \`diverges_at\` point instead of
   silently changing it.
7. Set \`generated\`, leave \`status: draft\`, run \`novel validate\`.

Close with which canon beats the scene preserves and where the MC changed.`,
  },
  {
    name: "continue",
    description: "Draft the next unwritten scene in manuscript order",
    argumentHint: "[chapter or scene to start from]",
    body: `# Task: Continue

Draft the next unwritten scene. Start from: {{args}}

1. Order chapters by \`sequence\`, then scenes within each chapter by
   \`sequence\`.
2. Find the first scene whose body contains no prose. If an argument was
   given above, start from that chapter or scene instead.
3. Draft it the way \`/draft\` would: run \`novel context <scene>\`, write the
   prose into the body, honor canon, budget the chapter's \`words:\` range,
   set \`generated\`, and leave
   \`status: draft\`.
4. If every scene is already written, stop and say so. Do not invent new
   scenes without asking.
5. Run \`novel validate\` and fix errors.`,
  },
  {
    name: "revise",
    description: "Revise a scene or chapter for clarity, pacing, and voice",
    argumentHint: "<concept id> [notes]",
    body: `# Task: Revise

Revise \`{{args}}\`.

1. Run \`novel context\` for the target to reload its cast, location, and
   neighbors.
2. Apply the requested revision. If no notes were given, revise for clarity,
   pacing, and voice consistency while preserving every canon fact.
3. Do not change frontmatter except \`generated\`. If the target was
   \`status: stable\`, set it back to \`draft\` after a substantive change so
   the author can re-approve; keep \`verified\` for history.
4. Preserve the POV and tense. Do not add or remove plot facts.
5. Run \`novel validate\` and fix errors.

Report what you changed in two or three lines.`,
  },
  {
    name: "continuity",
    description: "Audit the whole bundle for contradictions and timeline errors",
    body: `# Task: Continuity audit

Audit the novel for continuity problems.

1. Run \`novel validate\` and \`novel query divergences\`, and record every error
   and warning.
2. Reason across the bundle for issues deterministic checks cannot see:
   - facts that contradict between scenes and concept files;
   - a character knowing something before they could know it, checked
     against the \`story/knowledge.md\` matrix: every reveal there must still
     hold, and every reveal in the scenes must be recorded there;
   - chapters where the \`chapters/<slug>/outline.md\` \`# Story So Far\` or
     \`# Scenes\` rows disagree with the scenes themselves or with
     \`story/outline.md\` \`# Scenes\` statuses;
   - timeline events out of order or impossible travel;
   - POV, tense, or name drift;
   - any contradiction with a concept marked \`origin: source\` that is not
     marked \`origin: divergent\` with a \`diverges_at\` point;
   - the divergence ledger: \`altered\` or \`averted\` events must point at the
     scene that changes them, and that scene must actually play the changed
     outcome; \`unmarked\` events need a status.
3. Write findings to a Research Note concept: create it with
   \`novel new research-note "Continuity <today>"\`, then fill its body with
   one bullet per issue, each linking the offending concepts.
4. Fix only unambiguous mechanical errors. List judgment calls for the author
   instead of guessing.
5. Run \`novel validate\` and \`novel index\`.

Close with the three most important issues.`,
  },
  {
    name: "ask",
    description: "Answer a question using only what the bundle states",
    argumentHint: "<question>",
    body: `# Task: Answer from the bundle

Answer this question about the novel: {{args}}

1. Start at \`story/index.md\` and search the bundle for relevant concepts.
2. Answer using only what the bundle states, and cite concept paths.
3. If the bundle does not answer it, say so and list the concepts that would
   need to be written. Do not invent canon.
4. If the question implies a canon change, propose the exact file edits but do
   not apply them without confirmation.
5. When an answer comes from the source work, cite its Reference concept under
   \`story/references/\`.`,
  },
  {
    name: "query",
    description: "Answer a structured question by querying the bundle",
    argumentHint: "<question>",
    body: `# Task: Query the bundle

Answer this question from the bundle: {{args}}

1. Translate the question into one or more structured queries and run them:
   - \`novel query search "<terms>"\`
   - \`novel query timeline [--tag season-3a] [--from 2011] [--to 2012]\`
   - \`novel query divergences [--status altered]\`
   - \`novel query when <date>\`
   - \`novel query character <name>\`
   - \`novel query at <location>\`
   - \`novel query tag <tag>\`
   - \`novel query refs <concept>\`
   Add \`--json\` when you want to reason over exact fields.
2. If the query commands are unavailable, read \`story/index.md\` and follow
   links instead. Prefer facts from the bundle over anything else.
3. Answer from the query results only, and cite concept paths for every claim.
4. If the bundle does not answer it, say which concepts are missing instead of
   guessing.

Keep the answer tight and cite paths.`,
  },
  {
    name: "migrate",
    description: "Upgrade an older bundle to the current model and structure",
    body: `# Task: Migrate this bundle

Bring an older novel-harness project up to the current model.

1. Run \`novel doctor\` and read the report. It lists outdated config, missing
   bundle directories, stale adapters, and content warnings grouped by code.
2. Run \`novel doctor --fix\` to apply the mechanical fixes: config version,
   missing directories, regenerated indexes, and re-rendered adapters.
3. Then migrate the content by hand, guided by \`novel validate\`:
   - **Seasons and arcs recorded as Chapters** (\`profile/orphan-chapter\`):
     recreate each as an \`Arc\` under \`arcs/\` (use \`novel new arc "<season>"\`),
     move the body and metadata across, and delete the old chapter file.
     Canon episodes belong under \`episodes/\`.
   - **Missing tags** (\`profile/missing-tags\`): tag every concept — arc or
     season, species, pack, region, role — so \`novel query\` can filter it.
   - **Unfollowable sources** (\`fanfic/unverifiable-source\`): if the author
     provided material, save it as a Reference concept under \`references/\`
     and point \`sources[].resource\` at that file; otherwise cite the exact
     source URL or remove the claim.
   - **Duplicate concepts** (\`profile/duplicate-concept\`): merge into one
     concept and record the other names in \`aliases\`.
4. Do not rewrite prose or change canon facts while migrating; only change how
   the data is modeled and cited.
5. Run \`novel validate\` and \`novel index\` until only judgment-call warnings
   remain, and run \`novel doctor\` to confirm the project is clean.

Close with what you migrated and what still needs the author's decision.`,
  },
  {
    name: "skeptic",
    description: "Verify recorded canon against its cited pages and demote unsupported claims",
    argumentHint: "[concept id or scope]",
    body: `# Task: Skeptic

Verify recorded canon against its cited pages. Scope: {{args}}

1. Resolve the targets: a concept path from the argument, or every
   \`origin: source\` concept in the bundle.
2. For each concept, read \`sources\`, \`refs\`, and \`verified\`. If it has no
   citable URL, mark it unverifiable and move on.
3. Fetch each cited page with \`novel_fetch\` so the fetch leaves a receipt in
   \`.novel/fetch-log.jsonl\`; without that tool, use your web tool.
4. Check every claim in the body against the fetched pages. Verdicts:
   supported (the page states it), unsupported (the page does not say it or
   contradicts it), unclear (the page could not be read).
5. Apply corrections: demote unsupported claims to a \`# Open questions\`
   heading, mark invented material \`origin: fanon\`, fix or drop citations.
   Never keep a fact whose page does not support it.
6. Set \`verified: { by: <your actor>, at: <now ISO> }\` only when every claim
   in the concept is supported.
7. Run \`novel validate\` and fix errors.

Report verified concepts, demotions, and citations you could not resolve.`,
  },
];

export function defaultWorkflows(): Workflow[] {
  return WORKFLOWS.map((workflow) => ({ ...workflow }));
}

export type { Workflow } from "../core/adapters/types.ts";
