#!/usr/bin/env bash
# Improvement 1 / Tier 2: Playwright CLI screenshot capture
# Usage: bash scripts/capture-screenshots.sh [BASE_URL] [OUTPUT_DIR]
# Zero agent tokens — runs headless Playwright from CLI only.

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
OUTPUT_DIR="${2:-tests/screenshots}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "[capture-screenshots] Starting capture at $BASE_URL"
echo "[capture-screenshots] Output: $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR"

# Check if Playwright is available
if ! npx playwright --version > /dev/null 2>&1; then
  echo "[capture-screenshots] ERROR: Playwright not installed. Run: npx playwright install"
  exit 1
fi

# Check if the app is running
if ! curl -sf "$BASE_URL" > /dev/null 2>&1; then
  echo "[capture-screenshots] WARNING: App not reachable at $BASE_URL — skipping screenshots"
  exit 0
fi

# Capture main page
echo "[capture-screenshots] Capturing main page..."
npx playwright screenshot \
  --browser chromium \
  "$BASE_URL" \
  "$OUTPUT_DIR/main-$TIMESTAMP.png" \
  2>&1 || echo "[capture-screenshots] WARN: screenshot failed (non-fatal)"

echo "[capture-screenshots] Done. Files saved to $OUTPUT_DIR/"
ls -la "$OUTPUT_DIR/"*.png 2>/dev/null || echo "[capture-screenshots] No PNG files found"
