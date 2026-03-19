#!/usr/bin/env node
/**
 * extract_layout.cjs – Extract exact positions and sizes from C++ Cocos2d-x layout.
 *
 * Reads actual image dimensions from assets, then computes every element's
 * position, size, and anchor using the same formulas as the C++ code.
 *
 * Output: public/data/layout.json
 */
const fs = require('fs');
const path = require('path');

// ── PNG / JPEG dimension reader (no external deps) ──
function getImageSize(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);

  // PNG: width at offset 16 (4 bytes BE), height at 20
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }

  // JPEG: scan for SOF0 (0xFFC0) or SOF2 (0xFFC2)
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] === 0xFF) {
        const marker = buf[i + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          return {
            height: buf.readUInt16BE(i + 5),
            width: buf.readUInt16BE(i + 7),
          };
        }
        const len = buf.readUInt16BE(i + 2);
        i += 2 + len;
      } else {
        i++;
      }
    }
  }
  return null;
}

// ── Asset root ──
const ASSET_ROOT = path.join(__dirname, '..', 'public', 'assets');

function imgSize(relPath) {
  const full = path.join(ASSET_ROOT, relPath);
  const sz = getImageSize(full);
  if (!sz) {
    console.warn(`  ⚠ Missing image: ${relPath}`);
    return { width: 0, height: 0 };
  }
  return sz;
}

// ════════════════════════════════════════════════════════════════
// 1. COOP SCENE  (CoopScene.cpp)
// ════════════════════════════════════════════════════════════════
const COOP_DESIGN = { width: 2560, height: 1800 };
const BIRD_SCALE = 0.7;         // CoopSceneSpace::birdScale
const BIRD_INTERNAL_SCALE = 1.0 / 0.35;  // Bird.cpp setupAnim scale ≈ 2.857

function computeCoopLayout() {
  console.log('\n═══ COOP SCENE ═══');

  // Background
  const bgSize = imgSize('coopscene/coop_bg.jpg');
  console.log(`  bg: ${bgSize.width}×${bgSize.height}`);

  // Nest sizes
  const nestEnglish = imgSize('coopscene/coop_english_nest.png');
  const nestMath = imgSize('coopscene/coop_math_nest.png');
  console.log(`  nest english: ${nestEnglish.width}×${nestEnglish.height}`);
  console.log(`  nest math: ${nestMath.width}×${nestMath.height}`);

  // Panel sizes
  const panelEnglish = imgSize('coopscene/coop_woodpanel_english.png');
  const panelMath = imgSize('coopscene/coop_woodpanel_math.png');
  const panelPrek = imgSize('coopscene/coop_woodpanel_prek.png');
  console.log(`  panel english: ${panelEnglish.width}×${panelEnglish.height}`);
  console.log(`  panel math: ${panelMath.width}×${panelMath.height}`);
  console.log(`  panel prek: ${panelPrek.width}×${panelPrek.height}`);

  // Shadow sizes
  const birdShadow = imgSize('coopscene/coop_bird_shadow.png');
  const eggShadow = imgSize('coopscene/coop_egg_shadow.png');
  console.log(`  bird shadow: ${birdShadow.width}×${birdShadow.height}`);
  console.log(`  egg shadow: ${eggShadow.width}×${eggShadow.height}`);

  // Egg sizes (sample)
  const eggEnglish1 = imgSize('birdanimation/coop_egg_english_1.png');
  const eggMath1 = imgSize('birdanimation/coop_egg_math_1.png');
  console.log(`  egg english 1: ${eggEnglish1.width}×${eggEnglish1.height}`);
  console.log(`  egg math 1: ${eggMath1.width}×${eggMath1.height}`);

  // Bird idle sizes (these are extracted single frames from sprite sheets)
  const birdIdleSizes = {};
  for (let i = 1; i <= 23; i++) {
    const sz = imgSize(`birdanimation/bird${i}_idle.png`);
    birdIdleSizes[`bird${i}`] = sz;
    if (i <= 12) console.log(`  bird${i}_idle: ${sz.width}×${sz.height}`);
  }

  // All egg sizes
  const eggSizes = {};
  for (let i = 1; i <= 10; i++) {
    const eE = imgSize(`birdanimation/coop_egg_english_${i}.png`);
    const eM = imgSize(`birdanimation/coop_egg_math_${i}.png`);
    eggSizes[`english_${i}`] = eE;
    eggSizes[`math_${i}`] = eM;
  }

  // Bird type → bird index mapping (from Bird.cpp)
  const birdTypeMap = {
    'L_0': 'bird1',   // BIRD_L0
    'M_0': 'bird2',   // BIRD_M0
    'L_1': 'bird5',   // BIRD_L1
    'L_2': 'bird4',   // BIRD_L2
    'L_3': 'bird3',   // BIRD_L3
    'L_4': 'bird6',   // BIRD_L4
    'L_5': 'bird7',   // BIRD_L5
    'M_1': 'bird8',   // BIRD_M1
    'M_2': 'bird9',   // BIRD_M2
    'M_3': 'bird11',  // BIRD_M3
    'M_4': 'bird10',  // BIRD_M4
    'M_5': 'bird12',  // BIRD_M5
  };

  // Bird anchor points per type (from Bird.cpp refreshSize)
  const birdAnchors = {
    'L_0': { x: 0.5, y: 0.02 },
    'M_0': { x: 0.5, y: 0.05 },
    'L_1': { x: 0.5, y: 0.02 },
    'L_2': { x: 0.5, y: 0.02 },
    'L_3': { x: 0.5, y: 0.02 },
    'L_4': { x: 0.45, y: 0.05 },
    'L_5': { x: 0.45, y: 0.02 },
    'M_1': { x: 0.45, y: 0.12 },
    'M_2': { x: 0.45, y: 0.18 },
    'M_3': { x: 0.45, y: 0.10 },
    'M_4': { x: 0.55, y: 0.10 },
    'M_5': { x: 0.50, y: 0.08 },
  };

  // Egg anchor: (0.5, 0.05) for all
  const EGG_ANCHOR = { x: 0.5, y: 0.05 };

  // Compute grid positions
  const slots = [];
  const categories = ['L', 'M'];
  for (const cat of categories) {
    for (let lv = 0; lv <= 5; lv++) {
      const isL = cat === 'L';
      const gridX = isL ? 1 - (lv % 2) : 2 + (lv % 2);
      const gridY = 2 - Math.floor(lv / 2);

      // Panel position (C++ pixel coords, Y from bottom)
      const panelPosX = COOP_DESIGN.width / 8 * (1 + 2 * gridX);
      const panelPosY = 545 * gridY;

      // Bird position: panelPos + (0, 120)
      const birdPosX = panelPosX;
      const birdPosY = panelPosY + 120;

      // Nest position: panelPos + (0, 20)
      const nestPosX = panelPosX;
      const nestPosY = panelPosY + 20;

      // Get actual asset sizes
      const key = `${cat}_${lv}`;
      const birdName = birdTypeMap[key];
      const birdIdleSize = birdName ? birdIdleSizes[birdName] : { width: 0, height: 0 };

      // Bird node bounding box in coop:
      // The bird idle frame is at internal scale (_scale = 2.857), and bird node is at BIRD_SCALE=0.7
      // But our extracted bird_idle.png is the RAW sprite frame (before _scale)
      // Effective visual size = frameSize * _scale * _progressScale * BIRD_SCALE
      // At full progress: frameSize * 2.857 * 1.0 * 0.7 = frameSize * 2.0
      const birdEffectiveScale = BIRD_INTERNAL_SCALE * 1.0 * BIRD_SCALE;  // ~2.0 at full progress
      const birdVisualWidth = birdIdleSize.width * birdEffectiveScale;
      const birdVisualHeight = birdIdleSize.height * birdEffectiveScale;

      const nestSize = isL ? nestEnglish : nestMath;
      let panelSize;
      if (lv === 0) panelSize = panelPrek;
      else panelSize = isL ? panelEnglish : panelMath;

      // Egg size (no scaling)
      const eggKey = isL ? `english_${lv + 1}` : `math_${lv + 1}`;
      const eggSize = eggSizes[eggKey] || { width: 0, height: 0 };

      // Shadow scale = bird bounding box width / shadow sprite width
      const shadowScale = birdVisualWidth / (birdShadow.width || 1);

      const slot = {
        key,
        category: cat,
        level: lv,
        gridX,
        gridY,

        // All positions in C++ design coords (2560×1800, Y from bottom)
        panelPos: { x: panelPosX, y: panelPosY },
        birdPos: { x: birdPosX, y: birdPosY },
        nestPos: { x: nestPosX, y: nestPosY },

        // Panel: ANCHOR_MIDDLE_BOTTOM at panelPos
        panel: {
          anchor: { x: 0.5, y: 0 },
          pos: { x: panelPosX, y: panelPosY },
          size: { width: panelSize.width, height: panelSize.height },
          labelFontSize: 42,
          labelOffset: { x: 0, y: -5 },  // from panel center
        },

        // Nest: ANCHOR_MIDDLE_BOTTOM at panelPos+(0,20)
        nest: {
          anchor: { x: 0.5, y: 0 },
          pos: { x: nestPosX, y: nestPosY },
          size: { width: nestSize.width, height: nestSize.height },
        },

        // Bird: default anchor (see birdAnchors) at panelPos+(0,120), scale=0.7
        bird: {
          birdName,
          anchor: birdAnchors[key] || { x: 0.5, y: 0.05 },
          pos: { x: birdPosX, y: birdPosY },
          rawFrameSize: { width: birdIdleSize.width, height: birdIdleSize.height },
          nodeScale: BIRD_SCALE,
          internalScale: BIRD_INTERNAL_SCALE,
          effectiveScale: birdEffectiveScale,
          visualSize: { width: Math.round(birdVisualWidth), height: Math.round(birdVisualHeight) },
        },

        // Egg: anchor (0.5, 0.05) at panelPos+(0,120)
        egg: {
          anchor: EGG_ANCHOR,
          pos: { x: birdPosX, y: birdPosY },
          size: { width: eggSize.width, height: eggSize.height },
        },

        // Shadow: at bird position
        shadow: {
          birdShadowSize: { width: birdShadow.width, height: birdShadow.height },
          eggShadowSize: { width: eggShadow.width, height: eggShadow.height },
          birdShadowScale: shadowScale,
          pos: { x: birdPosX, y: birdPosY },
        },

        // CSS percentages (for web layout)
        css: {
          leftPct: (panelPosX / COOP_DESIGN.width) * 100,
          panelBottomPct: (panelPosY / COOP_DESIGN.height) * 100,
          nestBottomPct: (nestPosY / COOP_DESIGN.height) * 100,
          birdBottomPct: (birdPosY / COOP_DESIGN.height) * 100,
          // Sizes as % of design
          nestWidthPct: (nestSize.width / COOP_DESIGN.width) * 100,
          panelWidthPct: (panelSize.width / COOP_DESIGN.width) * 100,
          birdVisualWidthPct: (birdVisualWidth / COOP_DESIGN.width) * 100,
          birdVisualHeightPct: (birdVisualHeight / COOP_DESIGN.height) * 100,
          eggWidthPct: (eggSize.width / COOP_DESIGN.width) * 100,
          eggHeightPct: (eggSize.height / COOP_DESIGN.height) * 100,
        },
      };

      slots.push(slot);

      console.log(`  ${key}: panel(${panelPosX},${panelPosY}) bird(${birdPosX},${birdPosY}) `
        + `nest(${nestPosX},${nestPosY}) | birdVisual: ${Math.round(birdVisualWidth)}×${Math.round(birdVisualHeight)} `
        + `| nest: ${nestSize.width}×${nestSize.height} | panel: ${panelSize.width}×${panelSize.height}`);
    }
  }

  return {
    designSize: COOP_DESIGN,
    birdScale: BIRD_SCALE,
    birdInternalScale: BIRD_INTERNAL_SCALE,
    bgSize,
    assets: {
      nestEnglish, nestMath,
      panelEnglish, panelMath, panelPrek,
      birdShadow, eggShadow,
    },
    slots,
  };
}

// ════════════════════════════════════════════════════════════════
// 2. DAY SELECT POPUP  (DaySelectPopup.cpp)
// ════════════════════════════════════════════════════════════════
function computeDaySelectLayout() {
  console.log('\n═══ DAY SELECT ═══');
  const DESIGN = { width: 2560, height: 1800 };

  // Board
  const boardBg = imgSize('mainscene/dayselect/daily_window_bg.png');
  console.log(`  board bg: ${boardBg.width}×${boardBg.height}`);

  // Board position: ANCHOR_TOP_LEFT at (122, 1800) in mainView
  const boardPos = { x: 122, y: DESIGN.height };  // Y from bottom in Cocos

  // Button grid
  const btnSize = { width: 289, height: 358 };
  const btnMargin = { width: 36, height: 38 };
  const numBtnX = 4;
  const leftX = (boardBg.width - (numBtnX * btnSize.width + (numBtnX - 1) * btnMargin.width)) / 2;
  const topY = 3 * (btnMargin.height + btnSize.height);  // = 1188

  console.log(`  board: ${boardBg.width}×${boardBg.height} at (${boardPos.x}, ${boardPos.y})`);
  console.log(`  btnSize: ${btnSize.width}×${btnSize.height}, margin: ${btnMargin.width}×${btnMargin.height}`);
  console.log(`  leftX: ${leftX}, topY: ${topY}`);

  // Compute button positions (in board-local coords, Y from bottom)
  const buttonPositions = [];
  let x = leftX;
  let y = topY;
  for (let i = 0; i < 16; i++) {
    buttonPositions.push({
      index: i,
      // Center of button
      x: x + btnSize.width / 2,
      y: y - btnSize.height / 2,
    });
    if (i % numBtnX === (numBtnX - 1)) {
      x = leftX;
      y -= (btnSize.height + btnMargin.height);
    } else {
      x += (btnSize.width + btnMargin.width);
    }
  }

  // Day button icons
  const iconTodo = imgSize('mainscene/dayselect/daily_window_icon_todo.png');
  const iconTodoComplete = imgSize('mainscene/dayselect/daily_window_icon_todo_complete.png');
  const iconChallenge = imgSize('mainscene/dayselect/daily_window_icon_challenge.png');
  const iconChallengeComplete = imgSize('mainscene/dayselect/daily_window_icon_challenge_complete.png');
  console.log(`  icon todo: ${iconTodo.width}×${iconTodo.height}`);
  console.log(`  icon challenge: ${iconChallenge.width}×${iconChallenge.height}`);

  // Stage area
  const stageSize = { width: 960, height: 1700 };
  // Stage: ANCHOR_TOP_RIGHT at viewSize (2560, 1800)
  // So stage occupies x: [2560-960, 2560] = [1600, 2560], y: [100, 1800]

  // Tree stump: ANCHOR_MIDDLE_BOTTOM at (480, 0) in stage
  const treestump = imgSize('mainscene/dayselect/daily_treestump.png');
  const treetop = imgSize('mainscene/dayselect/daily_treetop.png');
  const treeshadow = imgSize('mainscene/dayselect/daily_treestump_charactershadow.png');
  console.log(`  treestump: ${treestump.width}×${treestump.height}`);
  console.log(`  treetop: ${treetop.width}×${treetop.height}`);

  // Title panels
  const titleEnglish = imgSize('mainscene/dayselect/daily_window_title_panel_english_.png');
  const titleMath = imgSize('mainscene/dayselect/daily_window_title_panel_math.png');
  const titlePrek = imgSize('mainscene/dayselect/daily_window_title_panel_prek.png');
  console.log(`  title english: ${titleEnglish.width}×${titleEnglish.height}`);
  console.log(`  title math: ${titleMath.width}×${titleMath.height}`);

  // Background
  const bg = imgSize('mainscene/dayselect/daily_bg.jpg');
  console.log(`  bg: ${bg.width}×${bg.height}`);

  // Beam
  const beam = imgSize('mainscene/dayselect/daily_window_beam.png');
  console.log(`  beam: ${beam.width}×${beam.height}`);

  return {
    designSize: DESIGN,
    board: {
      pos: boardPos,
      anchor: { x: 0, y: 1 },  // ANCHOR_TOP_LEFT
      size: { width: boardBg.width, height: boardBg.height },
    },
    buttonGrid: {
      btnSize,
      btnMargin,
      numBtnX,
      leftX,
      topY,
      dayLabelY: 62,
      dayLabelYComp: 56,
      positions: buttonPositions,
    },
    titlePanel: {
      anchor: { x: 0.5, y: 0 },  // ANCHOR_MIDDLE_BOTTOM
      // pos: (boardSize.width/2, boardSize.height-300) in board coords
      posInBoard: { x: boardBg.width / 2, y: boardBg.height - 300 },
      sizes: {
        english: titleEnglish,
        math: titleMath,
        prek: titlePrek,
      },
    },
    stage: {
      size: stageSize,
      anchor: { x: 1, y: 1 },  // ANCHOR_TOP_RIGHT
      pos: { x: DESIGN.width, y: DESIGN.height },
      treestump: {
        anchor: { x: 0.5, y: 0 },  // ANCHOR_MIDDLE_BOTTOM
        pos: { x: stageSize.width / 2, y: 0 },  // in stage coords
        size: treestump,
      },
      treeshadow: {
        pos: { x: stageSize.width / 2, y: 438 },
        size: treeshadow,
      },
      bird: {
        pos: { x: stageSize.width / 2, y: 448 },
      },
      treetop: {
        anchor: { x: 1, y: 1 },
        size: treetop,
      },
    },
    beam: {
      anchor: { x: 1, y: 1 },
      pos: { x: stageSize.width, y: 1700 },
      size: beam,
    },
    bg: { size: bg },
    icons: {
      todo: iconTodo,
      todoComplete: iconTodoComplete,
      challenge: iconChallenge,
      challengeComplete: iconChallengeComplete,
    },
  };
}

// ════════════════════════════════════════════════════════════════
// 3. MAIN SCENE  (MainScene.cpp)
// ════════════════════════════════════════════════════════════════
function computeMainSceneLayout() {
  console.log('\n═══ MAIN SCENE ═══');
  const DESIGN = { width: 2560, height: 1800 };
  const SKY_SIZE = { width: 2560, height: 3600 };
  const BIRD_POS = { x: 1280, y: 600 };
  const PANEL_NODE_SIZE = { width: 670, height: 162 };

  // Images
  const sky = imgSize('mainscene/main_bg_sky.png');
  const grass = imgSize('mainscene/day_grass_ground.png');
  const leavesLeft = imgSize('mainscene/main_leaves_left.png');
  const leavesRight = imgSize('mainscene/main_leaves_right.png');
  const cloud1 = imgSize('mainscene/cloud_day_1.png');
  const cloud2 = imgSize('mainscene/cloud_day_2.png');
  const cloud3 = imgSize('mainscene/cloud_day_3.png');
  const charShadow = imgSize('mainscene/character_shadow.png');
  const panelEnglish = imgSize('mainscene/panel_english.png');
  const panelMath = imgSize('mainscene/panel_math.png');
  const panelPrek = imgSize('mainscene/panel_prek.png');
  const panelDay = imgSize('mainscene/panel_day.png');

  // Game icon assets
  const iconFrame = imgSize('icons/game_icon_frame.png');
  const iconFrameEggQuiz = imgSize('icons/game_icon_frame_eggquiz.png');
  const iconFrameShadow = imgSize('icons/game_icon_frame_shadow.png');
  const iconCompleted = imgSize('icons/game_icon_frame_completed.png');
  const levelCircle = imgSize('icons/game_level_circle.png');

  console.log(`  sky: ${sky.width}×${sky.height}`);
  console.log(`  grass: ${grass.width}×${grass.height}`);
  console.log(`  leavesLeft: ${leavesLeft.width}×${leavesLeft.height}`);
  console.log(`  leavesRight: ${leavesRight.width}×${leavesRight.height}`);
  console.log(`  cloud1: ${cloud1.width}×${cloud1.height}`);
  console.log(`  cloud2: ${cloud2.width}×${cloud2.height}`);
  console.log(`  cloud3: ${cloud3.width}×${cloud3.height}`);
  console.log(`  character shadow: ${charShadow.width}×${charShadow.height}`);
  console.log(`  panel english: ${panelEnglish.width}×${panelEnglish.height}`);
  console.log(`  panel day: ${panelDay.width}×${panelDay.height}`);
  console.log(`  icon frame: ${iconFrame.width}×${iconFrame.height}`);
  console.log(`  level circle: ${levelCircle.width}×${levelCircle.height}`);

  // Sky sprite covers skyNode: scale = MAX(skyW/spriteW, skyH/spriteH)
  const skyScale = Math.max(SKY_SIZE.width / sky.width, SKY_SIZE.height / sky.height);

  // Grass: ANCHOR_BOTTOM_LEFT at (0, 0) in groundNode
  // Leaves left: ANCHOR_BOTTOM_LEFT at (0, frameSize.height-474)
  // Leaves right: ANCHOR_BOTTOM_RIGHT at (frameSize.width, frameSize.height-382)
  // Note: frameSize ≈ visibleSize if no scaling, or visibleSize/rootScale

  // Cloud positions (Y in skyNode, which is 3600 tall)
  const clouds = {
    cloud1: {
      size: cloud1,
      startX: 'visibleSize.width',
      yRange: [1350, 1450],  // in skyNode coords
      speedRange: [40.0, 50.0],
      moveRange: 'visibleSize.width + 1000',
      resetX: -500,
    },
    cloud2: {
      size: cloud2,
      startX: 'visibleSize.width',
      yRange: [1450, 1550],
      speedRange: [35.0, 40.0],
      moveRange: 'visibleSize.width + 1000',
      resetX: -500,
    },
    cloud3: {
      size: cloud3,
      startX: 'visibleSize.width',
      yRange: [1650, 1750],
      speedRange: [25.0, 35.0],
      moveRange: 'visibleSize.width + 1000',
      resetX: -500,
    },
  };

  // Game icon layout: evenly distributed across rootNode width (2560)
  // y = 150 (normal mode)
  // For N icons: positions at (2560/(N+1) * i, 150) for i = 1..N
  const gameIconLayout = {
    y: 150,  // from bottom in design coords
    // step = designSize.width / (numIcons + 1)
    // x_i = step * (i + 1) where i is 0-based
    designWidth: DESIGN.width,
    iconFrame: { width: iconFrame.width, height: iconFrame.height },
    levelCircle: {
      size: { width: levelCircle.width, height: levelCircle.height },
      anchor: { x: 1, y: 0 },  // ANCHOR_BOTTOM_RIGHT
      pos: { x: iconFrame.width, y: 15 },  // in btnFrame coords
    },
  };

  // Leaves position reference (474px from top for left, 382px for right)
  const leavesLeftBottomY = 'frameSize.height - 474';
  const leavesRightBottomY = 'frameSize.height - 382';

  return {
    designSize: DESIGN,
    skySize: SKY_SIZE,

    // Root node: ANCHOR_MIDDLE_BOTTOM at (visibleSize.width/2, 0)
    rootNode: {
      size: DESIGN,
      anchor: { x: 0.5, y: 0 },
    },

    sky: {
      size: sky,
      scale: skyScale,
      anchor: { x: 0, y: 0 },
    },

    grass: {
      size: grass,
      anchor: { x: 0, y: 0 },
      pos: { x: 0, y: 0 },
    },

    leavesLeft: {
      size: leavesLeft,
      anchor: { x: 0, y: 0 },
      bottomOffset: 474,  // from top: pos.y = frameHeight - 474
    },

    leavesRight: {
      size: leavesRight,
      anchor: { x: 1, y: 0 },
      bottomOffset: 382,  // from top: pos.y = frameHeight - 382
    },

    clouds,

    bird: {
      pos: BIRD_POS,
      shadowSize: charShadow,
    },

    panelNode: {
      size: PANEL_NODE_SIZE,
      anchor: { x: 0.5, y: 1 },  // ANCHOR_MIDDLE_TOP
      // pos: (frameSize.width/2, frameSize.height)
    },

    panels: {
      english: panelEnglish,
      math: panelMath,
      prek: panelPrek,
    },

    dayPanel: {
      size: panelDay,
      anchor: { x: 0, y: 0.5 },  // ANCHOR_MIDDLE_LEFT
      pos: { x: PANEL_NODE_SIZE.width - 44, y: 60 },  // in panelNode
      labelOffset: { x: 20, y: -5 },
      labelFontSize: 70,
    },

    panelLabel: {
      fontSize: 55,
      offset: { x: 0, y: -25 },  // from panel center
    },

    gameIcons: gameIconLayout,
    iconAssets: {
      frame: iconFrame,
      frameEggQuiz: iconFrameEggQuiz,
      frameShadow: iconFrameShadow,
      completed: iconCompleted,
      levelCircle,
    },

    // CSS reference values
    css: {
      birdBottomPct: (BIRD_POS.y / DESIGN.height) * 100,    // 33.33%
      birdLeftPct: (BIRD_POS.x / DESIGN.width) * 100,       // 50%
      gameIconBottomPct: (150 / DESIGN.height) * 100,        // 8.33%
      grassHeightPct: (grass.height / DESIGN.height) * 100,
      leavesLeftTopPct: (474 / DESIGN.height) * 100,         // from top
      leavesRightTopPct: (382 / DESIGN.height) * 100,
    },
  };
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
console.log('╔══════════════════════════════════════════╗');
console.log('║  C++ Layout Extraction                   ║');
console.log('╚══════════════════════════════════════════╝');

const layout = {
  _meta: {
    description: 'Extracted from C++ Cocos2d-x source code',
    designResolution: '2560×1800 (Google Pixel C)',
    coordinateSystem: 'Cocos2d-x: Y=0 at bottom, Y increases upward',
    generatedAt: new Date().toISOString(),
  },
  coopScene: computeCoopLayout(),
  daySelect: computeDaySelectLayout(),
  mainScene: computeMainSceneLayout(),
};

// Write output
const outPath = path.join(__dirname, '..', 'public', 'data', 'layout.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(layout, null, 2));

console.log(`\n✅ Output: ${outPath}`);
console.log(`   File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
