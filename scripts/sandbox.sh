#!/usr/bin/env bash
# Rebuild the opencode test sandbox for novel-harness.
#
#   bash scripts/sandbox.sh [preset] [dir]
#
# Presets:
#   teenwolf (default)  Teen Wolf fanfic seed, waiting for /recon
#   sherlock            Sherlock Holmes fanfic seed with a little canon recorded
#   blank               original fiction, no fandom
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRESET="${1:-teenwolf}"
SANDBOX="${2:-$ROOT/sandbox/$PRESET}"
NOVEL=(bun "$ROOT/bin/novel.ts")

if ! command -v novel >/dev/null 2>&1; then
  echo "note: \`novel\` is not on PATH; agents will fall back to reading files."
  echo "      Run \`bun link\` in $ROOT to expose it (undo with \`bun unlink\`)."
fi

rm -rf "$SANDBOX"
mkdir -p "$SANDBOX"

seed_teenwolf() {
  "${NOVEL[@]}" init "$SANDBOX" \
    --name "Beacon Hills: First Run" \
    --fandom "Teen Wolf" \
    --canon-type canon-divergent \
    --author human:author >/dev/null

  cd "$SANDBOX"

  # Source works are attached to novel.md with --source-work; /recon then
  # reads them on the web and records canon as origin: source concepts.
  "${NOVEL[@]}" new reference "Teen Wolf (2011 TV series)" \
    --resource "https://en.wikipedia.org/wiki/Teen_Wolf_(2011_TV_series)" \
    --source-work >/dev/null
}

seed_sherlock() {
  "${NOVEL[@]}" init "$SANDBOX" \
    --name "The Adventure of the Gilded Cipher" \
    --fandom "Sherlock Holmes" \
    --canon-type canon-divergent \
    --author human:author >/dev/null

  cd "$SANDBOX"

  "${NOVEL[@]}" new reference "The Adventures of Sherlock Holmes" \
    --resource https://www.gutenberg.org/ebooks/1661 --source-work >/dev/null
  "${NOVEL[@]}" new character "Sherlock Holmes" --role protagonist --origin source --tags protagonist >/dev/null
  "${NOVEL[@]}" new character "John Watson" --role deuteragonist --origin source --tags deuteragonist >/dev/null
  "${NOVEL[@]}" new location "221B Baker Street" --origin source --tags london >/dev/null
  "${NOVEL[@]}" new chapter "The Gilded Cipher" --tags ch-01 >/dev/null
  seed_outline_rows "The Gilded Cipher" "A Telegram from Mycroft"
  "${NOVEL[@]}" new scene "A Telegram from Mycroft" \
    --chapter chapters/the-gilded-cipher \
    --cast john-watson \
    --location 221b-baker-street \
    --tags ch-01 >/dev/null
  "${NOVEL[@]}" new character "Irene Adler" --origin divergent \
    --diverges-at chapters/the-gilded-cipher/scenes/a-telegram-from-mycroft \
    --tags antagonist >/dev/null

  # Cite the source work on imported canon concepts.
  CITATION='sources:\
  - id: canon\
    resource: /references/the-adventures-of-sherlock-holmes.md\
    title: The Adventures of Sherlock Holmes'
  sed -i "/^fate: alive$/a\\
$CITATION" story/characters/sherlock-holmes.md
  sed -i "/^fate: alive$/a\\
$CITATION" story/characters/john-watson.md
  sed -i "/^title: 221B Baker Street$/a\\
$CITATION" story/locations/221b-baker-street.md
}

seed_blank() {
  "${NOVEL[@]}" init "$SANDBOX" \
    --name "Untitled Sandbox" \
    --author human:author >/dev/null

  cd "$SANDBOX"

  "${NOVEL[@]}" new character "Avery Quinn" --role protagonist --tags protagonist >/dev/null
  "${NOVEL[@]}" new chapter "The First Day" --tags ch-01 >/dev/null
  seed_outline_rows "The First Day" "Arrival"
  "${NOVEL[@]}" new scene "Arrival" --chapter chapters/the-first-day --tags ch-01 >/dev/null
}

seed_fandom() {
  "${NOVEL[@]}" init "$SANDBOX" \
    --name "$1" \
    --fandom "$2" \
    --canon-type canon-divergent \
    --author human:author >/dev/null

  cd "$SANDBOX"

  "${NOVEL[@]}" new reference "$3" --resource "$4" --source-work >/dev/null
}

# Fill the empty placeholder rows in story/outline.md for the seeded chapter
# and scene so `novel new scene` passes its outline gate (AC1).
seed_outline_rows() {
  local chapter="$1"
  local scene="$2"
  sed -i "s/^|     |         |          |     |      |       |$/|  | $chapter | 1 |  |  |  |/" story/outline.md
  sed -i "s/^|         |       |          |     |      |        |$/| $chapter | $scene | 1 |  |  | stub |/" story/outline.md
}

case "$PRESET" in
  teenwolf)
    seed_teenwolf
    SEEDED="Teen Wolf fanfic seed. No canon is recorded yet: run \`/recon\` first, which must read sources on the web and cite every fact rather than trusting model memory."
    ;;
  sherlock)
    seed_sherlock
    SEEDED="Sherlock Holmes fanfic seed with a few canon concepts already recorded."
    ;;
  harrypotter)
    seed_fandom "Hogwarts: First Run" "Harry Potter" "Harry Potter (book series)" "https://en.wikipedia.org/wiki/Harry_Potter"
    SEEDED="Harry Potter fanfic seed. Run \`/recon\` to pull the canon baseline from the web."
    ;;
  naruto)
    seed_fandom "Konoha: First Run" "Naruto" "Naruto (manga)" "https://en.wikipedia.org/wiki/Naruto"
    SEEDED="Naruto fanfic seed. Run \`/recon\` to pull the canon baseline from the web."
    ;;
  supernatural)
    seed_fandom "The Family Business: First Run" "Supernatural" "Supernatural (American TV series)" "https://en.wikipedia.org/wiki/Supernatural_(American_TV_series)"
    SEEDED="Supernatural fanfic seed. Run \`/recon\` to pull the canon baseline from the web."
    ;;
  twilight)
    seed_fandom "Forks: First Run" "Twilight" "Twilight (novel series)" "https://en.wikipedia.org/wiki/Twilight_(novel_series)"
    SEEDED="Twilight fanfic seed. Run \`/recon\` to pull the canon baseline from the web."
    ;;
  blank)
    seed_blank
    SEEDED="Original fiction. No fandom; go straight to \`/outline\` and \`/draft\`."
    ;;
  *)
    echo "error: unknown preset \"$PRESET\" (expected teenwolf, sherlock, harrypotter, naruto, supernatural, twilight, or blank)" >&2
    exit 1
    ;;
esac

cat > README.md <<EOF
# Sandbox

A test playground for novel-harness, rebuilt from the repo root with:

\`\`\`bash
bash scripts/sandbox.sh [teenwolf|sherlock|harrypotter|naruto|supernatural|twilight|blank]
\`\`\`

Each preset gets its own folder under \`sandbox/\`, so several can coexist.

This sandbox: ${SEEDED}

## Try it with opencode

\`\`\`bash
cd sandbox/${PRESET}
opencode
\`\`\`

Then invoke the rendered workflows:

- \`/recon\` — learn the source canon from the web and record it (fanfic only)
- \`/outline\` — plan; mark divergences from canon with \`diverges_at\`
- \`/draft <scene>\` — write one scene from bundle context
- \`/weave <canon event>\` — play a canon event with the MC woven in
- \`/continue\` — draft the next unwritten scene
- \`/revise <target>\` — revision pass
- \`/continuity\` — audit canon vs. fanon
- \`/query what happens in season 3A?\` — structured queries over the bundle
- \`/ask <question>\` — answer from the bundle

The agent reads \`AGENTS.md\` and \`.opencode/command/*.md\`, then calls the
\`novel\` CLI for context and validation. If \`novel\` is not on PATH, run
\`bun link\` in the repo root first.

## Try it without an agent

\`\`\`bash
novel validate
novel context <concept>
novel build          # dist/manuscript.md
novel graph --html   # dist/graph.html
\`\`\`

## Reset

From the repo root:

\`\`\`bash
bash scripts/sandbox.sh ${PRESET}
\`\`\`
EOF

"${NOVEL[@]}" validate
"${NOVEL[@]}" build
"${NOVEL[@]}" graph --html

echo
echo "Sandbox ready at $SANDBOX (preset: $PRESET)"
