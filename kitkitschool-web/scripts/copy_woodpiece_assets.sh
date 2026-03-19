#!/bin/bash
# Copy AlphabetPuzzle and NumberPuzzle assets from extracted APK

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_RES="$PROJECT_DIR/downloads/extracted/mainapp_resources/Resources/games"
DST="$PROJECT_DIR/public/assets/games"

echo "=== Copying AlphabetPuzzle assets ==="
mkdir -p "$DST/alphabetpuzzle"
cp -r "$SRC_RES/alphabetpuzzle/background" "$DST/alphabetpuzzle/"
cp -r "$SRC_RES/alphabetpuzzle/latin_capital" "$DST/alphabetpuzzle/"
cp -r "$SRC_RES/alphabetpuzzle/latin_small" "$DST/alphabetpuzzle/"

# Sounds from localized
SRC_LOC="$PROJECT_DIR/downloads/extracted/mainapp_en_us/Resources/localized/en-us/games"
if [ -d "$SRC_LOC/alphabetpuzzle/sounds" ]; then
  cp -r "$SRC_LOC/alphabetpuzzle/sounds" "$DST/alphabetpuzzle/"
fi

echo "AlphabetPuzzle: $(find "$DST/alphabetpuzzle" -type f | wc -l | tr -d ' ') files"

echo ""
echo "=== Copying NumberPuzzle assets ==="
mkdir -p "$DST/numberpuzzle"
cp -r "$SRC_RES/numberpuzzle/background" "$DST/numberpuzzle/"
for d in number_1_to_10 number_1_to_20 number_level2 number_level3 number_level5 number_level6; do
  if [ -d "$SRC_RES/numberpuzzle/$d" ]; then
    cp -r "$SRC_RES/numberpuzzle/$d" "$DST/numberpuzzle/"
  fi
done

if [ -d "$SRC_LOC/numberpuzzle/sounds" ]; then
  cp -r "$SRC_LOC/numberpuzzle/sounds" "$DST/numberpuzzle/"
fi

echo "NumberPuzzle: $(find "$DST/numberpuzzle" -type f | wc -l | tr -d ' ') files"

echo ""
echo "=== Done ==="
