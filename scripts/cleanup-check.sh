#!/usr/bin/env bash
# Open-source cleanup acceptance check (spec ##10).
# Fails if any AI-Studio / Morphix / Gemini / Vercel scaffolding remains.
set -euo pipefail

PATTERNS=(
  'Morphix'
  'GEMINI'
  'aistudiocdn'
  '@google/genai'
  'process\.env\.API_KEY'
  'metadata\.json'
)

# Search tracked files only; exclude docs, design mocks, and this script
# (they reference the forbidden terms on purpose).
fail=0
for pat in "${PATTERNS[@]}"; do
  matches=$(git ls-files \
    | grep -vE '^(docs/|design-mocks/|extension/test/|scripts/cleanup-check\.sh$)' \
    | xargs grep -nIE "$pat" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "CLEANUP FAIL: pattern '$pat' still present:"
    echo "$matches"
    fail=1
  fi
done

# The stray scaffolding file must not exist at the repo root.
if [ -f metadata.json ]; then
  echo "CLEANUP FAIL: metadata.json still exists at repo root"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "---"
  echo "Cleanup check FAILED."
  exit 1
fi

echo "Cleanup check PASSED: no AI-Studio / Morphix / Gemini / Vercel scaffolding found."
