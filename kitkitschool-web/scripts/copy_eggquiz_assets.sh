#!/bin/bash
# Copy EggQuiz assets from extracted APK to web public directory
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXTRACTED="$PROJECT_DIR/downloads/extracted"
DEST="$PROJECT_DIR/public/assets/games/eggquiz"

# --- 1. UI Parts (167 files) ---
echo "=== Copying UI parts (167 files)..."
SRC_PARTS="$EXTRACTED/mainapp_resources/Resources/games/eggquiz/parts"
mkdir -p "$DEST/parts"
cp "$SRC_PARTS"/*.png "$DEST/parts/" 2>/dev/null || true
cp "$SRC_PARTS"/*.jpg "$DEST/parts/" 2>/dev/null || true
echo "  Copied $(ls "$DEST/parts/" | wc -l | tr -d ' ') files"

# --- 2. Localized Images (684 files) ---
echo "=== Copying localized images (684 files)..."
SRC_IMAGES="$EXTRACTED/mainapp_en_us/Resources/localized/en-us/games/eggquiz/images"
mkdir -p "$DEST/images"
if [ -d "$SRC_IMAGES" ]; then
  cp "$SRC_IMAGES"/*.png "$DEST/images/" 2>/dev/null || true
  echo "  Copied $(ls "$DEST/images/" | wc -l | tr -d ' ') files"
else
  echo "  WARNING: Source images directory not found: $SRC_IMAGES"
fi

# --- 3. Localized Sounds (1417 files) ---
echo "=== Copying localized sounds (1417 files)..."
SRC_SOUNDS="$EXTRACTED/mainapp_en_us/Resources/localized/en-us/games/eggquiz/sounds"
mkdir -p "$DEST/sounds"
if [ -d "$SRC_SOUNDS" ]; then
  cp "$SRC_SOUNDS"/*.m4a "$DEST/sounds/" 2>/dev/null || true
  echo "  Copied $(ls "$DEST/sounds/"*.m4a 2>/dev/null | wc -l | tr -d ' ') sound files"
else
  echo "  WARNING: Source sounds directory not found: $SRC_SOUNDS"
fi

# --- 4. Shared Sounds (from other game folders) ---
echo "=== Copying shared sounds..."
SHARED_SFX="$EXTRACTED/mainapp_resources/Resources/main/common/sounds/effect"
mkdir -p "$DEST/sounds/shared"

# Page turn sound
cp "$SHARED_SFX/card_move_right.m4a" "$DEST/sounds/shared/sfx_pageturn.m4a" 2>/dev/null && echo "  sfx_pageturn.m4a" || echo "  WARN: card_move_right.m4a not found"

# Pass sound
cp "$SHARED_SFX/pretest_success.m4a" "$DEST/sounds/shared/sfx_pass.m4a" 2>/dev/null && echo "  sfx_pass.m4a" || echo "  WARN: pretest_success.m4a not found"

# Fail sound
cp "$SHARED_SFX/pretest_fail1.m4a" "$DEST/sounds/shared/sfx_fail.m4a" 2>/dev/null && echo "  sfx_fail.m4a" || echo "  WARN: pretest_fail1.m4a not found"

# Touch sound
cp "$SHARED_SFX/paneltouch.m4a" "$DEST/sounds/shared/sfx_touch.m4a" 2>/dev/null && echo "  sfx_touch.m4a" || echo "  WARN: paneltouch.m4a not found"

# Star collected / correct sound
cp "$SHARED_SFX/ui_star_collected.m4a" "$DEST/sounds/shared/sfx_star.m4a" 2>/dev/null && echo "  sfx_star.m4a" || echo "  WARN: ui_star_collected.m4a not found"

# Wrong sound (already in eggquiz sounds)
if [ -f "$EXTRACTED/mainapp_resources/Resources/games/eggquiz/sounds/c3.m4a" ]; then
  cp "$EXTRACTED/mainapp_resources/Resources/games/eggquiz/sounds/c3.m4a" "$DEST/sounds/shared/sfx_wrong.m4a"
  echo "  sfx_wrong.m4a"
fi

# --- 5. Fonts ---
echo "=== Copying fonts..."
FONT_DEST="$PROJECT_DIR/public/assets/fonts"
mkdir -p "$FONT_DEST"

# Aileron-Regular
AILERON_SRC="$EXTRACTED/mainapp_resources/Resources/main/fonts/aileron-regular.otf"
if [ -f "$AILERON_SRC" ]; then
  cp "$AILERON_SRC" "$FONT_DEST/Aileron-Regular.otf"
  echo "  Aileron-Regular.otf"
else
  echo "  WARN: Aileron font not found"
fi

# TodoMainCurly (check if already exists)
if [ ! -f "$FONT_DEST/TodoMainCurly.ttf" ]; then
  CURLY_SRC="$PROJECT_DIR/public/assets/launcher/TodoMainCurly.ttf"
  if [ -f "$CURLY_SRC" ]; then
    cp "$CURLY_SRC" "$FONT_DEST/TodoMainCurly.ttf"
    echo "  TodoMainCurly.ttf"
  fi
else
  echo "  TodoMainCurly.ttf (already exists)"
fi

echo ""
echo "=== Summary ==="
echo "Parts: $(ls "$DEST/parts/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "Images: $(ls "$DEST/images/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "Sounds: $(ls "$DEST/sounds/"*.m4a 2>/dev/null | wc -l | tr -d ' ') files"
echo "Shared sounds: $(ls "$DEST/sounds/shared/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "Fonts: $(ls "$FONT_DEST/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "Done!"
