#!/usr/bin/env node
/**
 * extract_missingnumber_layout.cjs
 *
 * Reads actual MissingNumber PNG asset dimensions, then computes every
 * element position using C++ TextToNumberStage.cpp formulas + asset proportions.
 *
 * Pattern: same as extract_layout.cjs — no guessing, all values from:
 *   1. Actual PNG header dimensions
 *   2. C++ code formulas (TextToNumberStage.cpp, MainDepot.cpp, AnswerTextButton.cpp)
 *   3. Proportional derivation from asset sizes
 */
const fs = require('fs');
const path = require('path');

// ── PNG dimension reader (from extract_layout.cjs) ──
function getImageSize(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  return null;
}

const ASSET_DIR = path.join(__dirname, '..', 'public', 'assets', 'games', 'missingnumber');
const GAME_W = 2560, GAME_H = 1800;

function imgSize(name) {
  const full = path.join(ASSET_DIR, name);
  const sz = getImageSize(full);
  if (!sz) {
    console.warn(`  ⚠ Missing: ${name}`);
    return { width: 0, height: 0 };
  }
  return sz;
}

console.log('╔══════════════════════════════════════════╗');
console.log('║  MissingNumber Layout Extraction          ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`\nDesign resolution: ${GAME_W}×${GAME_H} (Google Pixel C)`);

// ════════════════════════════════════════════════════════
// 1. Read ALL actual asset dimensions from PNG headers
// ════════════════════════════════════════════════════════
console.log('\n═══ Asset Dimensions (from PNG headers) ═══');

const assets = {};
const assetFiles = [
  'back_image.png',
  'egg_01.png', 'egg_02.png', 'egg_03.png', 'egg_04.png', 'egg_05.png',
  'egg_01_top.png', 'egg_01_bottom.png',
  'crack_01.png', 'crack_02.png', 'crack_03.png', 'crack_04.png',
  'egg_number_image.png',
  'egg-lamp.png',
  'lamp_light_01.png', 'lamp_light_02.png', 'lamp_light_03.png',
  'animal_bird.png', 'cloud.png',
  'nest.png', 'nest_back.png', 'nest_shadow.png',
  'card-slot-question-mark_normal.png', 'card-slot-question-mark_selected.png',
  'card_forsingledigit.png', 'card_forthreedigit.png',
  'card-slot_empty.png', 'card-slot_selected.png',
  'card-slot_empty_forthreedigit.png', 'card-slot_selected_forthreedigit.png',
  'digital-quiz_button_answer_large_normal.png',
  'digital-quiz_button_answer_large_touch.png',
  'digital-quiz_button_answer_medium_normal.png',
  'digital-quiz_button_answer_medium_touch.png',
  'digital-quiz_button_answer_small_normal.png',
  'digital-quiz_button_answer_small_touch.png',
];

for (const f of assetFiles) {
  const sz = imgSize(f);
  const key = f.replace('.png', '').replace(/-/g, '_');
  assets[key] = sz;
  console.log(`  ${f}: ${sz.width}×${sz.height}`);
}

// ════════════════════════════════════════════════════════
// 2. C++ TextToNumberStage.cpp layout formulas
// ════════════════════════════════════════════════════════
console.log('\n═══ C++ TextToNumberStage.cpp Values ═══');

// CS = gameSize() = (2560, 1800) — from MainDepot.cpp: DeviceSpec::Google_Pixel_C()
// Question RichText: Point(CS.width / 2.f, CS.height * 2.f / 3.f)
//   Cocos Y-up: (1280, 1200)
//   Canvas Y-down: (1280, 1800 - 1200) = (1280, 600)
const questionCenter = {
  x: GAME_W / 2,                          // 1280
  y_cocos: Math.round(GAME_H * 2 / 3),   // 1200 from bottom
  y_canvas: GAME_H - Math.round(GAME_H * 2 / 3), // 600 from top
};
console.log(`  Question center: (${questionCenter.x}, ${questionCenter.y_cocos}) Cocos → (${questionCenter.x}, ${questionCenter.y_canvas}) Canvas`);

// Button Y: 113 from bottom, ANCHOR_BOTTOM_LEFT
// Canvas: button top = GAME_H - 113 - btnH
const buttonY_cocos = 113;
console.log(`  Button Y: ${buttonY_cocos} from bottom (Cocos), ANCHOR_BOTTOM_LEFT`);

// Button sizes from actual PNG dimensions
const btnLarge = assets['digital_quiz_button_answer_large_normal'];
const btnMedium = assets['digital_quiz_button_answer_medium_normal'];
const btnSmall = assets['digital_quiz_button_answer_small_normal'];
console.log(`  Button Large: ${btnLarge.width}×${btnLarge.height}, margin=104`);
console.log(`  Button Medium: ${btnMedium.width}×${btnMedium.height}, margin=70`);
console.log(`  Button Small: ${btnSmall.width}×${btnSmall.height}, margin=40`);

// Button text: font 180, color(23,163,232), at (w/2, h/2+5) — from AnswerTextButton.cpp
// Press: position (w/2, h/2+5-10), color(204,235,255), opacity 50%
console.log(`  Button text: font=180, color=(23,163,232), pos=(w/2, h/2+5)`);
console.log(`  Button press: pos=(w/2, h/2-5), color=(204,235,255), alpha=0.5`);

// Fade: EaseIn(FadeOut(.2f), 2.f) → alpha = 1 - t² for out, t² for in
console.log(`  Fade: 0.2s, EaseIn power 2`);

// ════════════════════════════════════════════════════════
// 3. Compute egg layout (eggs replace C++ question text)
// ════════════════════════════════════════════════════════
console.log('\n═══ Computed Egg Layout ═══');

const egg = assets['egg_01'];
const eggTop = assets['egg_01_top'];
const eggBottom = assets['egg_01_bottom'];

// Eggs at 1:1 scale (designed for 2560×1800 game space)
// Center Y = C++ question Y in canvas coords = 600
const eggLayout = {
  width: egg.width,       // 340
  height: egg.height,     // 432
  scale: 1.0,             // native size
  centerY: questionCenter.y_canvas,  // 600 (matches C++ question position)
  // Egg occupies: Y = [600-216, 600+216] = [384, 816] in canvas coords
  topY: questionCenter.y_canvas - egg.height / 2,     // 384
  bottomY: questionCenter.y_canvas + egg.height / 2,   // 816
};

// Gap between eggs: proportional to egg width
// For 4 eggs in 2560px: we want them comfortably spread
// Using ~24% of egg width as gap (similar to C++ small button margin/width ratio: 40/194≈0.21)
const eggGap = Math.round(egg.width * 0.24);  // 82

// For 4 eggs: total = 4*340 + 3*82 = 1606, centered in 2560 → startX = 477
const count4_totalW = 4 * egg.width + 3 * eggGap;
const count4_startX = (GAME_W - count4_totalW) / 2 + egg.width / 2;

console.log(`  Egg size: ${egg.width}×${egg.height} (native, scale=1.0)`);
console.log(`  Egg center Y: ${eggLayout.centerY} (from C++ question pos)`);
console.log(`  Egg gap: ${eggGap} (egg_width × 0.24)`);
console.log(`  4 eggs: totalW=${count4_totalW}, firstCenterX=${count4_startX}`);
console.log(`  Egg vertical range: [${eggLayout.topY}, ${eggLayout.bottomY}]`);

// ════════════════════════════════════════════════════════
// 4. Compute number sprite layout on eggs
// ════════════════════════════════════════════════════════
console.log('\n═══ Number Sprite Layout ═══');

const numSprite = assets['egg_number_image'];
const digitW = numSprite.width / 10;  // 82.8
const digitH = numSprite.height;       // 112

// Scale digits to fit on egg surface
// Target: single digit occupies ~50% of egg width
// 2 digits: ~80% of egg width
// 3 digits: ~85% of egg width
const numScale1 = (egg.width * 0.50) / digitW;            // 340*0.5/82.8 = 2.05
const numScale2 = (egg.width * 0.80) / (2 * digitW);      // 340*0.8/165.6 = 1.64
const numScale3 = (egg.width * 0.85) / (3 * digitW);      // 340*0.85/248.4 = 1.16

console.log(`  Sprite sheet: ${numSprite.width}×${numSprite.height}, digitW=${digitW.toFixed(1)}, digitH=${digitH}`);
console.log(`  Scale 1-digit: ${numScale1.toFixed(3)} → rendered: ${(digitW*numScale1).toFixed(0)}×${(digitH*numScale1).toFixed(0)}`);
console.log(`  Scale 2-digit: ${numScale2.toFixed(3)} → total width: ${(2*digitW*numScale2).toFixed(0)}`);
console.log(`  Scale 3-digit: ${numScale3.toFixed(3)} → total width: ${(3*digitW*numScale3).toFixed(0)}`);

// ════════════════════════════════════════════════════════
// 5. Compute question mark layout
// ════════════════════════════════════════════════════════
console.log('\n═══ Question Mark Layout ═══');

const qmark = assets['card_slot_question_mark_normal'];
// Scale question mark to be proportional to egg
// Target height: ~35% of egg height
const qmarkScale = (egg.height * 0.35) / qmark.height;  // 432*0.35/117 = 1.29

console.log(`  Question mark: ${qmark.width}×${qmark.height}`);
console.log(`  Scale: ${qmarkScale.toFixed(3)} → rendered: ${(qmark.width*qmarkScale).toFixed(0)}×${(qmark.height*qmarkScale).toFixed(0)}`);

// ════════════════════════════════════════════════════════
// 6. Compute lamp layout
// ════════════════════════════════════════════════════════
console.log('\n═══ Lamp Layout ═══');

const lamp = assets['egg_lamp'];
const light1 = assets['lamp_light_01'];
const light2 = assets['lamp_light_02'];

// Lamp fixture at top center, native size
// The lamp (145×50) is small — it's a subtle ceiling fixture
// The light cone (1218×706) is the main visual element
const lampY = 10;  // 10px from top of game area
const lightY = lampY + lamp.height;  // light starts below lamp

console.log(`  Lamp fixture: ${lamp.width}×${lamp.height} at (${GAME_W/2}, ${lampY})`);
console.log(`  Light cone 1: ${light1.width}×${light1.height} at (${GAME_W/2}, ${lightY})`);
console.log(`  Light cone 2: ${light2.width}×${light2.height}`);
console.log(`  Light bottom edge: ${lightY + light1.height} (${lightY + light1.height > eggLayout.topY ? 'overlaps eggs ✓' : 'does not reach eggs ✗'})`);

// ════════════════════════════════════════════════════════
// 7. Compute egg-bottom (cup) positioning
// ════════════════════════════════════════════════════════
console.log('\n═══ Egg Bottom (Cup) Layout ═══');

// egg_bottom: 340×340, sits beneath the egg as a cup/holder
// The bottom edge of the full egg is at eggLayout.bottomY = 816
// The egg_bottom should be centered at the bottom of the egg
// Its top should roughly align with the middle of the full egg
const eggBottomCupY = eggLayout.centerY + egg.height * 0.15;  // cup center slightly below egg center

console.log(`  Egg bottom: ${eggBottom.width}×${eggBottom.height}`);
console.log(`  Cup center Y: ${eggBottomCupY} (egg center + egg_h*0.15)`);

// ════════════════════════════════════════════════════════
// 8. Compute button layout (from C++ exactly)
// ════════════════════════════════════════════════════════
console.log('\n═══ Button Layout (from C++) ═══');

// For each button count, compute exact positions
for (const count of [4, 10]) {
  let btnW, btnH, margin;
  if (count <= 3) { btnW = btnLarge.width; btnH = btnLarge.height; margin = 104; }
  else if (count <= 5) { btnW = btnMedium.width; btnH = btnMedium.height; margin = 70; }
  else { btnW = btnSmall.width; btnH = btnSmall.height; margin = 40; }

  const fullW = count * btnW + (count - 1) * margin;
  const startX = (GAME_W - fullW) / 2;
  const topY_canvas = GAME_H - buttonY_cocos - btnH;

  console.log(`  ${count} buttons: size=${btnW}×${btnH}, margin=${margin}`);
  console.log(`    fullWidth=${fullW}, startX=${startX}`);
  console.log(`    topY=${topY_canvas} (canvas), bottomY=${topY_canvas + btnH}`);
  console.log(`    first button: (${startX}, ${topY_canvas})`);
}

// ════════════════════════════════════════════════════════
// 9. Compute vertical space analysis
// ════════════════════════════════════════════════════════
console.log('\n═══ Vertical Space Analysis ═══');

const btnH_small = btnSmall.height;
const btnTopY_10 = GAME_H - buttonY_cocos - btnH_small;  // 10 buttons (0-9 keypad)

console.log(`  Top of game: 0`);
console.log(`  Lamp: ${lampY} → ${lampY + lamp.height}`);
console.log(`  Light cone: ${lightY} → ${lightY + light1.height}`);
console.log(`  Eggs: ${eggLayout.topY} → ${eggLayout.bottomY}`);
console.log(`  Button area (10 btns): ${btnTopY_10} → ${btnTopY_10 + btnH_small}`);
console.log(`  Bottom of game: ${GAME_H}`);
console.log(`  Gap egg→buttons: ${btnTopY_10 - eggLayout.bottomY}px`);

// ════════════════════════════════════════════════════════
// Output JSON
// ════════════════════════════════════════════════════════
const layout = {
  _meta: {
    description: 'MissingNumber game layout — extracted from C++ + actual PNG dimensions',
    designResolution: `${GAME_W}×${GAME_H}`,
    coordinateSystem: 'Canvas: Y=0 at top, increases downward',
    sources: [
      'C++ TextToNumberStage.cpp: question pos, button layout',
      'C++ MainDepot.cpp: gameSize, fontSize, fontColor',
      'C++ AnswerTextButton.cpp: button text pos, press behavior',
      'PNG headers: all asset dimensions',
    ],
    generatedAt: new Date().toISOString(),
  },

  assets: Object.fromEntries(
    Object.entries(assets).map(([k, v]) => [k, { w: v.width, h: v.height }])
  ),

  egg: {
    width: egg.width,
    height: egg.height,
    scale: 1.0,
    centerY: eggLayout.centerY,
    gap: eggGap,
  },

  eggTop: { width: eggTop.width, height: eggTop.height },
  eggBottom: { width: eggBottom.width, height: eggBottom.height, cupCenterY: eggBottomCupY },

  numberSprite: {
    totalWidth: numSprite.width,
    height: numSprite.height,
    digitWidth: digitW,
    scale1: parseFloat(numScale1.toFixed(3)),
    scale2: parseFloat(numScale2.toFixed(3)),
    scale3: parseFloat(numScale3.toFixed(3)),
  },

  questionMark: {
    width: qmark.width,
    height: qmark.height,
    scale: parseFloat(qmarkScale.toFixed(3)),
  },

  lamp: {
    width: lamp.width,
    height: lamp.height,
    y: lampY,
    centerX: GAME_W / 2,
  },

  lampLight1: {
    width: light1.width,
    height: light1.height,
    y: lightY,
    centerX: GAME_W / 2,
    alpha: 0.5,
  },

  buttons: {
    y_cocos: buttonY_cocos,
    fontSize: 180,
    fontColor: '23,163,232',
    fontColorPress: '204,235,255',
    textOffsetY: 5,
    pressOffsetY: -5,
    pressAlpha: 0.5,
    large: { w: btnLarge.width, h: btnLarge.height, margin: 104 },
    medium: { w: btnMedium.width, h: btnMedium.height, margin: 70 },
    small: { w: btnSmall.width, h: btnSmall.height, margin: 40 },
  },
};

const outPath = path.join(__dirname, '..', 'public', 'data', 'games', 'missingnumber_layout.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(layout, null, 2));
console.log(`\n✅ Output: ${outPath}`);
console.log(`   File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
