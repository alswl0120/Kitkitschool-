#!/usr/bin/env python3
"""
Extract the first idle frame from each bird's sprite sheet.
Parses Cocos2d plist format, extracts the frame from the atlas PNG.
Outputs individual bird PNGs for web use.
"""
import plistlib
import os
import re
from PIL import Image

BIRD_DIR = os.path.join(os.path.dirname(__file__), '..',
    'downloads', 'extracted', 'mainapp_resources', 'Resources', 'main', 'birdanimation')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'birdanimation')

os.makedirs(OUT_DIR, exist_ok=True)

# Bird type mapping from Bird.cpp:
# BIRD_L0=Bird1, BIRD_M0=Bird2, BIRD_L3=Bird3, BIRD_L2=Bird4, BIRD_L1=Bird5,
# BIRD_L4=Bird6, BIRD_L5=Bird7, BIRD_M1=Bird8, BIRD_M2=Bird9, BIRD_M4=Bird10,
# BIRD_M3=Bird11, BIRD_M5=Bird12, Bird13-23 for higher levels
BIRD_MAP = {
    'L_0': 'bird1', 'M_0': 'bird2',
    'L_1': 'bird5', 'L_2': 'bird4', 'L_3': 'bird3', 'L_4': 'bird6', 'L_5': 'bird7',
    'L_6': 'bird13', 'L_7': 'bird14', 'L_8': 'bird15', 'L_9': 'bird16', 'L_10': 'bird17',
    'M_1': 'bird8', 'M_2': 'bird9', 'M_3': 'bird11', 'M_4': 'bird10', 'M_5': 'bird12',
    'M_6': 'bird18', 'M_7': 'bird19', 'M_8': 'bird20', 'M_9': 'bird21', 'M_10': 'bird22',
}

def parse_cocos_string(s):
    """Parse '{x,y}' or '{{x,y},{w,h}}' format"""
    nums = re.findall(r'-?\d+', s)
    return [int(n) for n in nums]

def extract_first_frame(bird_folder, bird_name):
    """Extract the first frame from a bird's sprite sheet"""
    plist_path = os.path.join(BIRD_DIR, bird_folder, f'{bird_folder}-0.plist')
    png_path = os.path.join(BIRD_DIR, bird_folder, f'{bird_folder}-0.png')

    if not os.path.exists(plist_path) or not os.path.exists(png_path):
        print(f'  SKIP: {bird_folder} - files not found')
        return False

    with open(plist_path, 'rb') as f:
        plist = plistlib.load(f)

    frames = plist.get('frames', {})
    if not frames:
        print(f'  SKIP: {bird_folder} - no frames')
        return False

    # Find the first idle frame (01_0001.png pattern)
    first_frame_name = None
    first_frame_data = None
    for name, data in frames.items():
        if '0001' in name or '_0001' in name:
            first_frame_name = name
            first_frame_data = data
            break

    if not first_frame_data:
        # Just use the very first frame
        first_frame_name = list(frames.keys())[0]
        first_frame_data = frames[first_frame_name]

    # Parse textureRect: '{{x,y},{w,h}}'
    rect = parse_cocos_string(first_frame_data['textureRect'])
    x, y, w, h = rect[0], rect[1], rect[2], rect[3]

    rotated = first_frame_data.get('textureRotated', False)

    atlas = Image.open(png_path)

    if rotated:
        # When rotated, w and h are swapped in the atlas
        crop_box = (x, y, x + h, y + w)
        frame_img = atlas.crop(crop_box).transpose(Image.ROTATE_90)
    else:
        crop_box = (x, y, x + w, y + h)
        frame_img = atlas.crop(crop_box)

    out_path = os.path.join(OUT_DIR, f'{bird_name}_idle.png')
    frame_img.save(out_path)
    print(f'  OK: {bird_folder} -> {bird_name}_idle.png ({frame_img.size[0]}x{frame_img.size[1]})')
    return True

# Extract all birds
print('=== Extracting bird idle frames ===')
for key, folder in BIRD_MAP.items():
    extract_first_frame(folder, folder)

# Also extract any remaining birds (bird13-23) that might not be in the map
for i in range(1, 24):
    folder = f'bird{i}'
    out = os.path.join(OUT_DIR, f'{folder}_idle.png')
    if not os.path.exists(out):
        extract_first_frame(folder, folder)

print('=== Done ===')
