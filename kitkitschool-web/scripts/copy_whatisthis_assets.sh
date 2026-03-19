#!/usr/bin/env bash
set -euo pipefail

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
SRC_RES="$PROJ/downloads/extracted/mainapp_resources/Resources/games/whatisthis"
SRC_LOC="$PROJ/downloads/extracted/mainapp_en_us/Resources/localized/en-us/games/whatisthis"
DST="$PROJ/public/assets/games/whatisthis"

echo "=== Copying WhatIsThis assets ==="

# --- UI images (card backgrounds, masks, etc.) ---
mkdir -p "$DST/images"
cp "$SRC_RES/images/"*.png "$DST/images/"
echo "  ✓ UI images ($(ls "$DST/images/" | wc -l | tr -d ' ') files)"

# --- UI sounds ---
mkdir -p "$DST/sounds"
cp "$SRC_RES/sounds/"*.m4a "$DST/sounds/"
cp "$SRC_RES/sounds/"*.tsv  "$DST/sounds/" 2>/dev/null || true
echo "  ✓ UI sounds ($(ls "$DST/sounds/" | wc -l | tr -d ' ') files)"

# --- Content images (localized) ---
mkdir -p "$DST/content/images"
cp "$SRC_LOC/images/"*.png "$DST/content/images/"
echo "  ✓ Content images ($(ls "$DST/content/images/" | wc -l | tr -d ' ') files)"

# --- Content sounds (localized) ---
mkdir -p "$DST/content/sounds"
cp "$SRC_LOC/sounds/"*.m4a "$DST/content/sounds/"
echo "  ✓ Content sounds ($(ls "$DST/content/sounds/" | wc -l | tr -d ' ') files)"

# --- TSV data ---
mkdir -p "$PROJ/public/data/games/whatisthis"
cp "$SRC_LOC/whatisthis.tsv" "$PROJ/public/data/games/whatisthis/"
echo "  ✓ TSV data copied"

echo ""
echo "=== Done! ==="
echo "  UI images:      $DST/images/"
echo "  UI sounds:      $DST/sounds/"
echo "  Content images: $DST/content/images/"
echo "  Content sounds: $DST/content/sounds/"
echo "  TSV data:       $PROJ/public/data/games/whatisthis/"
