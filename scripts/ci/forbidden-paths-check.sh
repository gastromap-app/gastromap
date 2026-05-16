#!/usr/bin/env bash
#
# Guard #16 — File-diff guard against forbidden paths.
# Spec: .kiro/specs/data-loading-architecture/design.md (Testing Strategy table, row 16)
# Requirements: R17.1, R17.2, R17.3, R13.8
#
# This guard fails the build when a PR diff modifies any file inside the
# data-loading-architecture non-regression allow-list, OR adds new files
# under api/ (Vercel Hobby caps total functions at 12).
#
# Usage:
#   ./scripts/ci/forbidden-paths-check.sh                  # diff vs. origin/main
#   ./scripts/ci/forbidden-paths-check.sh <BASE_REF>       # diff vs. a specific ref
#   BASE_REF=<sha> ./scripts/ci/forbidden-paths-check.sh   # via env var
#
# When no merge-base can be computed (shallow clone, fresh checkout) the
# script falls back to scanning the working-tree changes via `git status`.
# In that mode "forbidden" means "currently modified/added/staged" relative
# to HEAD, which is conservative enough for local pre-commit use.

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────
# Glob-like patterns expanded into regex below. Keep this aligned with
# the spec's Forbidden-In-Tasks list (R17 non-regression) plus the
# Vercel-function cap (R13.8).
FORBIDDEN_PATTERNS=(
    '^src/shared/api/ai/'
    '^src/shared/api/chat-history\.api\.js$'
    '^src/shared/store/useAIChatStore\.js$'
    '^src/locales/'
    '^api/telegram/process\.js$'
)

# A new file under api/ is forbidden too. We detect that with --diff-filter=A.
NEW_API_FILE_PATTERN='^api/.*\.(js|ts|mjs|cjs)$'

# ─── Resolve base ref ──────────────────────────────────────────────────────
BASE_REF="${BASE_REF:-${1:-origin/main}}"

if git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
    DIFF_BASE="$BASE_REF"
elif git rev-parse --verify --quiet origin/main >/dev/null; then
    DIFF_BASE="origin/main"
elif git rev-parse --verify --quiet main >/dev/null; then
    DIFF_BASE="main"
else
    DIFF_BASE=""
fi

# ─── Collect changed files ─────────────────────────────────────────────────
if [[ -n "$DIFF_BASE" ]]; then
    CHANGED_ALL=$(git diff --name-only "$DIFF_BASE"...HEAD 2>/dev/null || true)
    CHANGED_ADDED=$(git diff --name-only --diff-filter=A "$DIFF_BASE"...HEAD 2>/dev/null || true)
else
    # Fallback: working tree against HEAD (covers local pre-commit use).
    CHANGED_ALL=$(git status --porcelain | awk '{print $2}')
    CHANGED_ADDED=$(git status --porcelain | awk '$1 ~ /^A/ || $1 ~ /^\?\?/ {print $2}')
fi

# ─── Run checks ────────────────────────────────────────────────────────────
fail=0

check_pattern() {
    local pattern="$1"
    local matches
    matches=$(printf '%s\n' "$CHANGED_ALL" | grep -E "$pattern" || true)
    if [[ -n "$matches" ]]; then
        echo "❌ Forbidden path modified (matches /$pattern/):" >&2
        echo "$matches" | sed 's/^/   /' >&2
        fail=1
    fi
}

for p in "${FORBIDDEN_PATTERNS[@]}"; do
    check_pattern "$p"
done

# New file under api/ → fail (R13.8).
new_api=$(printf '%s\n' "$CHANGED_ADDED" | grep -E "$NEW_API_FILE_PATTERN" || true)
if [[ -n "$new_api" ]]; then
    echo "❌ New file under api/ — Vercel Hobby caps total functions at 12 (R13.8):" >&2
    echo "$new_api" | sed 's/^/   /' >&2
    fail=1
fi

if [[ $fail -ne 0 ]]; then
    echo "" >&2
    echo "Guard #16 failed. See .kiro/specs/data-loading-architecture/design.md (Testing Strategy)." >&2
    exit 1
fi

echo "✅ Guard #16 — no forbidden paths touched (base: ${DIFF_BASE:-working-tree})."
