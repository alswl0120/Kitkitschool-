#!/bin/bash
# Copy CompMatching + LineMatching assets

SRC_BASE="downloads/extracted/mainapp_resources/Resources/games"
DST_BASE="public/assets/games"
DATA_BASE="public/data/games"

# ── CompMatching ──
echo "=== CompMatching assets ==="
mkdir -p "$DST_BASE/compmatching/sounds"

# Matching UI images
cp "$SRC_BASE/comprehensiontest/matching/illustration_small.png" "$DST_BASE/compmatching/"
cp "$SRC_BASE/comprehensiontest/matching/illustration_small_border.png" "$DST_BASE/compmatching/"
cp "$SRC_BASE/comprehensiontest/matching/comprehention_connect_box.png" "$DST_BASE/compmatching/"
cp "$SRC_BASE/comprehensiontest/matching/comprehention_connect_box_a.png" "$DST_BASE/compmatching/"
cp "$SRC_BASE/comprehensiontest/matching/comprehention_connect_box_b.png" "$DST_BASE/compmatching/"
cp "$SRC_BASE/comprehensiontest/matching/comprehention_connect_box_c.png" "$DST_BASE/compmatching/"

# CompMatching sounds (same as LineMatching sounds)
cp "$SRC_BASE/comprehensiontest/matching/sounds/boom.m4a" "$DST_BASE/compmatching/sounds/"
cp "$SRC_BASE/comprehensiontest/matching/sounds/lineback.m4a" "$DST_BASE/compmatching/sounds/"
cp "$SRC_BASE/comprehensiontest/matching/sounds/linestart.m4a" "$DST_BASE/compmatching/sounds/"

# ComprehensionTest background (shared)
cp "$SRC_BASE/comprehensiontest/common/_comprehenson_background.png" "$DST_BASE/compmatching/"

echo "CompMatching: $(find "$DST_BASE/compmatching" -type f | wc -l) files"

# ── LineMatching ──
echo "=== LineMatching assets ==="
mkdir -p "$DST_BASE/linematching/sounds"
mkdir -p "$DST_BASE/linematching/images"

# Root-level assets
for f in line-matching_image_wooden-bgpng.png box.png box_green.png \
         dot.png dot_red.png dot_yellow.png \
         line-matching_image_stone.png line-matching_image_dot_bg.png \
         backobject.png star1.png \
         waterdrop1.png waterdrop2.png waterdrop3.png \
         tutorial_image_guidehand_normal.png tutorial_image_guidehand_touch.png; do
  if [ -f "$SRC_BASE/linematching/$f" ]; then
    cp "$SRC_BASE/linematching/$f" "$DST_BASE/linematching/"
  fi
done

# HD versions (~ suffix)
for f in dot~.png dot_red~.png dot_yellow~.png; do
  if [ -f "$SRC_BASE/linematching/$f" ]; then
    cp "$SRC_BASE/linematching/$f" "$DST_BASE/linematching/"
  fi
done

# Sounds
cp "$SRC_BASE/linematching/sounds/"*.m4a "$DST_BASE/linematching/sounds/" 2>/dev/null

# All image subdirectories (581 files across 23 dirs)
cp -r "$SRC_BASE/linematching/images/"* "$DST_BASE/linematching/images/"

echo "LineMatching images: $(find "$DST_BASE/linematching/images" -type f | wc -l) files"
echo "LineMatching total: $(find "$DST_BASE/linematching" -type f | wc -l) files"

# ── LineMatching data (problem JSON files) ──
echo "=== LineMatching data ==="
LM_PROB_SRC="$SRC_BASE/linematching/problems"
LM_PROB_DST="$DATA_BASE/linematching"
mkdir -p "$LM_PROB_DST"

for f in "$LM_PROB_SRC"/lm_*.json; do
  cp "$f" "$LM_PROB_DST/"
done

# basic subdirectory
if [ -d "$LM_PROB_SRC/basic" ]; then
  mkdir -p "$LM_PROB_DST/basic"
  cp "$LM_PROB_SRC/basic/"*.json "$LM_PROB_DST/basic/"
fi

echo "LineMatching data: $(find "$LM_PROB_DST" -type f | wc -l) files"

echo "=== Done ==="
