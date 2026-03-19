/**
 * CoopScene layout data — extracted from C++ Cocos2d-x source.
 *
 * Design: 2560×1800 (Cocos Y=0 at bottom).
 * All pixel values are in design coords.
 * CSS percentages: leftPct = px / 2560 * 100, bottomPct = py / 1800 * 100.
 */

export const COOP_DESIGN = { width: 2560, height: 1800 } as const

// ── Asset sizes in design pixels ──
// (read from actual PNG headers via extract_layout.cjs)

export const NEST_SIZE = { width: 562, height: 215 }     // both english & math
export const PANEL_SIZE = { width: 520, height: 92 }      // english, math, prek
export const EGG_SIZE = { width: 298, height: 382 }       // all eggs are same size
export const BIRD_SHADOW_SIZE = { width: 407, height: 156 }
export const EGG_SHADOW_SIZE = { width: 354, height: 82 }

// ── Bird scales from C++ ──
// Bird.cpp: _scale = 1.0/0.35 ≈ 2.857 (internal sprite scale)
// CoopScene.cpp: birdScale = 0.7 (node scale when hatched)
// Effective visual scale = 0.7 * 2.857 * progressScale = 2.0 * progressScale
// At full progress (progressScale=1.0): effectiveScale = 2.0
const BIRD_EFFECTIVE_SCALE = 2.0  // at full progress

// ── Per-bird data ──
// birdIndex: from Bird.cpp type mapping
// rawFrame: pixel size of idle frame PNG (before any scaling)
// anchor: from Bird.cpp refreshSize() — (x, y) where 0,0 = bottom-left
// visualSize: rawFrame * effectiveScale (final size in design coords)

interface BirdData {
  birdIndex: number
  rawFrame: { width: number; height: number }
  anchor: { x: number; y: number }
  visualSize: { width: number; height: number }
}

const BIRD_DATA: Record<string, BirdData> = {
  'L_0': { birdIndex: 1,  rawFrame: { width: 99,  height: 100 }, anchor: { x: 0.50, y: 0.02 }, visualSize: { width: 198,  height: 200 } },
  'M_0': { birdIndex: 2,  rawFrame: { width: 153, height: 91  }, anchor: { x: 0.50, y: 0.05 }, visualSize: { width: 306,  height: 182 } },
  'L_1': { birdIndex: 5,  rawFrame: { width: 161, height: 213 }, anchor: { x: 0.50, y: 0.02 }, visualSize: { width: 322,  height: 426 } },
  'L_2': { birdIndex: 4,  rawFrame: { width: 195, height: 221 }, anchor: { x: 0.50, y: 0.02 }, visualSize: { width: 390,  height: 442 } },
  'L_3': { birdIndex: 3,  rawFrame: { width: 220, height: 256 }, anchor: { x: 0.50, y: 0.02 }, visualSize: { width: 440,  height: 512 } },
  'L_4': { birdIndex: 6,  rawFrame: { width: 152, height: 246 }, anchor: { x: 0.45, y: 0.05 }, visualSize: { width: 304,  height: 492 } },
  'L_5': { birdIndex: 7,  rawFrame: { width: 279, height: 239 }, anchor: { x: 0.45, y: 0.02 }, visualSize: { width: 558,  height: 478 } },
  'M_1': { birdIndex: 8,  rawFrame: { width: 233, height: 136 }, anchor: { x: 0.45, y: 0.12 }, visualSize: { width: 466,  height: 272 } },
  'M_2': { birdIndex: 9,  rawFrame: { width: 254, height: 178 }, anchor: { x: 0.45, y: 0.18 }, visualSize: { width: 508,  height: 356 } },
  'M_3': { birdIndex: 11, rawFrame: { width: 255, height: 188 }, anchor: { x: 0.45, y: 0.10 }, visualSize: { width: 510,  height: 376 } },
  'M_4': { birdIndex: 10, rawFrame: { width: 275, height: 165 }, anchor: { x: 0.55, y: 0.10 }, visualSize: { width: 550,  height: 330 } },
  'M_5': { birdIndex: 12, rawFrame: { width: 267, height: 199 }, anchor: { x: 0.50, y: 0.08 }, visualSize: { width: 534,  height: 398 } },
}

export function getBirdData(category: string, categoryLevel: number): BirdData | null {
  return BIRD_DATA[`${category}_${categoryLevel}`] ?? null
}

/**
 * Compute CSS styles for a coop slot element.
 *
 * Cocos anchor → CSS transform:
 *   translateX = -anchor.x * 100%  (shifts left edge to align anchor horizontally)
 *   translateY = +anchor.y * 100%  (shifts down to align anchor with CSS `bottom`)
 *
 * This works because CSS `bottom: Y%` places the element's bottom edge at Y%,
 * and translateY(N%) moves the element DOWN by N% of its height.
 */
export function birdTransform(category: string, categoryLevel: number): string {
  const data = getBirdData(category, categoryLevel)
  if (!data) return 'translate(-50%, 2%)'
  const { anchor } = data
  return `translate(${-anchor.x * 100}%, ${anchor.y * 100}%)`
}

/**
 * Get bird visual size as CSS percentages of the design.
 */
export function birdSizePct(category: string, categoryLevel: number) {
  const data = getBirdData(category, categoryLevel)
  if (!data) return { widthPct: 8, heightPct: 11 }
  return {
    widthPct: (data.visualSize.width / COOP_DESIGN.width) * 100,
    heightPct: (data.visualSize.height / COOP_DESIGN.height) * 100,
  }
}

// ── CSS percentage constants ──
export const NEST_WIDTH_PCT = (NEST_SIZE.width / COOP_DESIGN.width) * 100     // ~21.95%
export const PANEL_WIDTH_PCT = (PANEL_SIZE.width / COOP_DESIGN.width) * 100   // ~20.31%
export const EGG_WIDTH_PCT = (EGG_SIZE.width / COOP_DESIGN.width) * 100       // ~11.64%
export const EGG_HEIGHT_PCT = (EGG_SIZE.height / COOP_DESIGN.height) * 100    // ~21.22%
