#!/bin/bash
# Copy shell (launcher) assets from extracted C++ resources to web public/assets/
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"
RES_DIR="$WEB_DIR/downloads/extracted/mainapp_resources/Resources/main"

echo "=== Copying Shell Assets ==="

# 1. CoopScene assets
echo "Copying coopscene..."
mkdir -p "$WEB_DIR/public/assets/coopscene"
cp "$RES_DIR/coopscene/"*.{png,jpg} "$WEB_DIR/public/assets/coopscene/" 2>/dev/null || true

# 2. MainScene assets (top-level files only)
echo "Copying mainscene..."
mkdir -p "$WEB_DIR/public/assets/mainscene"
cp "$RES_DIR/mainscene/"*.{png,jpg} "$WEB_DIR/public/assets/mainscene/" 2>/dev/null || true

# 3. DaySelect assets (subdirectory of mainscene)
echo "Copying dayselect..."
mkdir -p "$WEB_DIR/public/assets/mainscene/dayselect"
cp "$RES_DIR/mainscene/dayselect/"*.{png,jpg} "$WEB_DIR/public/assets/mainscene/dayselect/" 2>/dev/null || true

# 4. Bird/Egg images (only egg PNGs, not full sprite sheets)
echo "Copying egg images..."
mkdir -p "$WEB_DIR/public/assets/birdanimation"
cp "$RES_DIR/birdanimation/coop_egg_"*.png "$WEB_DIR/public/assets/birdanimation/" 2>/dev/null || true

# 5. Game icons
echo "Copying game icons..."
mkdir -p "$WEB_DIR/public/assets/icons"
cp "$RES_DIR/icons/game_icon_"*.png "$WEB_DIR/public/assets/icons/" 2>/dev/null || true
cp "$RES_DIR/icons/game_level_circle"*.png "$WEB_DIR/public/assets/icons/" 2>/dev/null || true

echo "=== Done ==="
echo "Assets copied to $WEB_DIR/public/assets/"
