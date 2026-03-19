#!/bin/bash
# Copy TSAlphabets glyph archives from C++ resources to web public folder

SRC="$(dirname "$0")/../../mainpp/Resources/Common/Controls/TraceField/Glyphs"
DST="$(dirname "$0")/../public/assets/glyphs"

if [ ! -d "$SRC" ]; then
  echo "ERROR: Source directory not found: $SRC"
  exit 1
fi

mkdir -p "$DST"

# Copy all tsalphabets directories (digit, latin_capital, latin_small, special)
for dir in tsalphabets.digit tsalphabets.latin_capital tsalphabets.latin_small tsalphabets.special; do
  if [ -d "$SRC/$dir" ]; then
    echo "Copying $dir..."
    cp -r "$SRC/$dir" "$DST/"
  else
    echo "WARNING: $dir not found in source"
  fi
done

# Count copied files
count=$(find "$DST" -name "*.json" | wc -l | tr -d ' ')
echo "Done. Copied $count glyph JSON files to $DST"
