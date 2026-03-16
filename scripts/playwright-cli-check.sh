#!/usr/bin/env bash
# Improvement 1 / Tier 2: Playwright CLI check (headless, zero agent tokens)
# Usage: bash scripts/playwright-cli-check.sh [TEST_FILE]
# Runs existing Playwright test specs via CLI — no MCP, no interactive session.

set -euo pipefail

TEST_FILE="${1:-}"
REPORTER="${PLAYWRIGHT_REPORTER:-line}"

echo "[playwright-cli-check] Running Playwright tests (Tier 2 — CLI mode)"

# Check if Playwright is available
if ! npx playwright --version > /dev/null 2>&1; then
  echo "[playwright-cli-check] ERROR: Playwright not installed. Run: npx playwright install"
  exit 1
fi

if [ -n "$TEST_FILE" ]; then
  echo "[playwright-cli-check] Running: $TEST_FILE"
  npx playwright test "$TEST_FILE" --reporter="$REPORTER"
else
  # Run all existing specs
  if ls tests/e2e/*.spec.{js,ts} > /dev/null 2>&1; then
    echo "[playwright-cli-check] Running all specs in tests/e2e/"
    npx playwright test --reporter="$REPORTER"
  else
    echo "[playwright-cli-check] No test specs found — skipping"
    exit 0
  fi
fi

echo "[playwright-cli-check] Done"
