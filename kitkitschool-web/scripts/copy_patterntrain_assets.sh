#!/bin/bash
# Copy PatternTrain assets from extracted APK to web public folder

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXTRACTED="$PROJECT_DIR/downloads/extracted"

# Image assets
SRC_IMG="$EXTRACTED/mainapp_resources/Resources/games/patterntrain"
DST_IMG="$PROJECT_DIR/public/assets/games/patterntrain"

# Sound assets
SRC_SOUNDTRAIN="$EXTRACTED/mainapp_resources/Resources/games/soundtrain/sound"
SRC_NUMBERTRAIN="$EXTRACTED/mainapp_resources/Resources/games/numbertrain/sounds"
SRC_COMMON="$EXTRACTED/mainapp_resources/Resources/main/common/sounds/effect"
DST_SND="$PROJECT_DIR/public/assets/games/patterntrain/sounds"

echo "=== Copying PatternTrain assets ==="

# Images (43 PNGs)
mkdir -p "$DST_IMG"
echo "Copying images from $SRC_IMG..."
cp "$SRC_IMG"/*.png "$DST_IMG/"
echo "  Copied $(ls "$DST_IMG"/*.png 2>/dev/null | wc -l) images"

# Sounds
mkdir -p "$DST_SND"

echo "Copying SoundTrain sounds..."
cp "$SRC_SOUNDTRAIN/pattern_train_1.m4a" "$DST_SND/"
cp "$SRC_SOUNDTRAIN/pattern_train_2.m4a" "$DST_SND/"
cp "$SRC_SOUNDTRAIN/pattern_train_3.m4a" "$DST_SND/"
cp "$SRC_SOUNDTRAIN/traincombine.m4a" "$DST_SND/"
cp "$SRC_SOUNDTRAIN/trainmoves.m4a" "$DST_SND/"

echo "Copying NumberTrain sounds..."
cp "$SRC_NUMBERTRAIN/train2.m4a" "$DST_SND/"

echo "Copying common effect sounds..."
cp "$SRC_COMMON/blockslotin.m4a" "$DST_SND/"
cp "$SRC_COMMON/blocktouch.m4a" "$DST_SND/"
cp "$SRC_COMMON/blockmiss.m4a" "$DST_SND/"
cp "$SRC_COMMON/sfx_jump.m4a" "$DST_SND/"

echo ""
echo "=== Summary ==="
echo "Images: $(ls "$DST_IMG"/*.png 2>/dev/null | wc -l) files"
echo "Sounds: $(ls "$DST_SND"/*.m4a 2>/dev/null | wc -l) files"
echo "Done!"
