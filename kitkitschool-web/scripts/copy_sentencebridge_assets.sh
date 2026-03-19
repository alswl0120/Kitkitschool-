#!/bin/bash
# Copy SentenceBridge assets from extracted APK resources

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RES_DIR="$PROJECT_DIR/downloads/extracted/mainapp_resources/Resources"
LOCALIZED_DIR="$PROJECT_DIR/downloads/extracted/mainapp_en_us/Resources/localized/en-us"
DST_DIR="$PROJECT_DIR/public/assets/games/sentencebridge"
FONT_DST="$PROJECT_DIR/public/assets/fonts"

SRC_IMG="$RES_DIR/games/sentencebridge"
SRC_SND="$LOCALIZED_DIR/games/sentencebridge/sound"
SRC_EFFECT="$RES_DIR/main/common/sounds/effect"
SRC_FONT="$RES_DIR/main/fonts"

mkdir -p "$DST_DIR/sounds"
mkdir -p "$FONT_DST"

echo "=== Copying SentenceBridge images ==="
cp "$SRC_IMG"/*.png "$DST_DIR/" 2>/dev/null
IMG_COUNT=$(ls "$DST_DIR"/*.png 2>/dev/null | wc -l)
echo "  Copied $IMG_COUNT PNG files"

echo "=== Copying sentence voice audio (125 files) ==="
cp "$SRC_SND"/*.m4a "$DST_DIR/sounds/" 2>/dev/null
VOICE_COUNT=$(ls "$DST_DIR/sounds"/*.m4a 2>/dev/null | wc -l)
echo "  Copied $VOICE_COUNT voice M4A files"

echo "=== Copying durations.tsv ==="
cp "$SRC_SND/durations.tsv" "$DST_DIR/sounds/" 2>/dev/null

echo "=== Copying common sound effects ==="
for sfx in right.m4a matrix_clickblock.m4a matrix_wrongmove.m4a sfx_wood_slideout.m4a success.m4a cardrive.m4a cardrive_gone.m4a; do
  if [ -f "$SRC_EFFECT/$sfx" ]; then
    cp "$SRC_EFFECT/$sfx" "$DST_DIR/sounds/"
    echo "  Copied $sfx"
  else
    echo "  WARNING: $sfx not found"
  fi
done

echo "=== Copying Andika font ==="
if [ -f "$SRC_FONT/andika-r.ttf" ]; then
  cp "$SRC_FONT/andika-r.ttf" "$FONT_DST/"
  echo "  Copied andika-r.ttf"
else
  echo "  WARNING: andika-r.ttf not found"
fi

TOTAL_SND=$(ls "$DST_DIR/sounds"/*.m4a 2>/dev/null | wc -l)
echo ""
echo "=== Summary ==="
echo "  Images: $IMG_COUNT PNG files"
echo "  Sounds: $TOTAL_SND M4A files"
echo "  Destination: $DST_DIR"
echo "Done!"
