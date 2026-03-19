/**
 * TraceFieldUtils — Shared utilities for TraceField-based tracing games.
 *
 * Ports the C++ TraceField system (CatmullRom splines, glyph loading,
 * path following, coordinate transforms) to TypeScript.
 *
 * Reference C++ files:
 *   - TraceModelFactory.cpp (CatmullRom + glyph building)
 *   - DarkMagicMath.cpp (spline math)
 *   - TraceLocator.cpp (path following constants)
 *   - TraceString.cpp (multi-glyph layout)
 */

import { assetUrl } from '../../utils/assetPath'

// ── Types ─────────────────────────────────────────────

export interface KnotPoint {
  x: number
  y: number
  type: 'Point' | 'Separator'
}

export interface TracePoint {
  x: number  // position
  y: number
  vx: number // tangent velocity
  vy: number
}

export interface TraceStroke {
  samplePoints: TracePoint[]
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface TraceGlyph {
  strokes: TraceStroke[]
  roughBB: Rect
  tightBB: Rect
}

export interface TraceString {
  glyphs: TraceGlyph[]
  offsets: { x: number; y: number }[]
  roughBB: Rect
  tightBB: Rect
}

export interface TracePath {
  points: { x: number; y: number }[]
  lengths: number[]       // cumulative distance at each point
  totalLength: number
}

// ── Constants (from C++ TraceLocator.cpp) ──────────────

export const CURSOR_PICK_DISTANCE = 120
export const DISTANCE_LIMIT = 160
export const STROKE_SKIP_DISTANCE = 700
export const BACKWARD_TOLERANCE = 30
export const COMPLETION_RATIO = 0.90

// ── CatmullRom Spline Math (from DarkMagicMath.cpp) ───

/** Cubic Bezier via de Casteljau (a → d) */
function cubicBezier(a: number, b: number, c: number, d: number, t: number): number {
  const ab = (1 - t) * a + t * b
  const bc = (1 - t) * b + t * c
  const cd = (1 - t) * c + t * d
  const abc = (1 - t) * ab + t * bc
  const bcd = (1 - t) * bc + t * cd
  return (1 - t) * abc + t * bcd
}

/** Cubic Bezier tangent (derivative) */
function cubicBezierTangential(a: number, b: number, c: number, d: number, t: number): number {
  const ab = (1 - t) * a + t * b
  const bc = (1 - t) * b + t * c
  const cd = (1 - t) * c + t * d
  const abc = (1 - t) * ab + t * bc
  const bcd = (1 - t) * bc + t * cd

  const ab_ = -a + b
  const bc_ = -b + c
  const cd_ = -c + d
  const abc_ = -ab + (1 - t) * ab_ + bc + t * bc_
  const bcd_ = -bc + (1 - t) * bc_ + cd + t * cd_
  return -abc + (1 - t) * abc_ + bcd + t * bcd_
}

/**
 * CatmullRom spline (curve from b to c, a and d are tangent controls).
 * Converts to cubic Bezier: bPrime = b + (c-a)/6, cPrime = c + (b-d)/6
 */
function catmullRom(a: number, b: number, c: number, d: number, t: number): number {
  const bPrime = b + (c - a) / 6
  const cPrime = c + (b - d) / 6
  return cubicBezier(b, bPrime, cPrime, c, t)
}

function catmullRomTangential(a: number, b: number, c: number, d: number, t: number): number {
  const bPrime = b + (c - a) / 6
  const cPrime = c + (b - d) / 6
  return cubicBezierTangential(b, bPrime, cPrime, c, t)
}

function catmullRom2D(
  pa: { x: number; y: number }, pb: { x: number; y: number },
  pc: { x: number; y: number }, pd: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return {
    x: catmullRom(pa.x, pb.x, pc.x, pd.x, t),
    y: catmullRom(pa.y, pb.y, pc.y, pd.y, t),
  }
}

function catmullRomTangential2D(
  pa: { x: number; y: number }, pb: { x: number; y: number },
  pc: { x: number; y: number }, pd: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return {
    x: catmullRomTangential(pa.x, pb.x, pc.x, pd.x, t),
    y: catmullRomTangential(pa.y, pb.y, pc.y, pd.y, t),
  }
}

// ── Glyph Loading ─────────────────────────────────────

/** Construct the URL path for a glyph archive JSON file. */
export function glyphPath(char: string): string {
  const base = assetUrl('/assets/glyphs')
  if (/\d/.test(char)) {
    return `${base}/tsalphabets.digit/${char}/tsalphabets.digit.${char}.json`
  } else if (/[A-Z]/.test(char)) {
    const lower = char.toLowerCase()
    return `${base}/tsalphabets.latin_capital/${lower}/tsalphabets.latin_capital.${lower}.json`
  } else if (/[a-z]/.test(char)) {
    return `${base}/tsalphabets.latin_small/${char}/tsalphabets.latin_small.${char}.json`
  } else {
    // Special character — URL encode
    const encoded = encodeURIComponent(char)
    return `${base}/tsalphabets.special/${encoded}/tsalphabets.special.${encoded}.json`
  }
}

/** Load knot points from a glyph archive JSON file. */
export async function loadGlyphJSON(char: string): Promise<KnotPoint[]> {
  const path = glyphPath(char)
  const resp = await fetch(path)
  if (!resp.ok) throw new Error(`Failed to load glyph for '${char}': ${resp.status}`)
  return resp.json()
}

/**
 * Measure approximate character bounding box using canvas.
 * C++ uses BigLabel::createWithTTF(Str, "fonts/TSAlphabets.ttf", 500).
 * We approximate with Arial at 500px.
 */
export function measureCharBB(char: string): { w: number; h: number } {
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 600
  const ctx = canvas.getContext('2d')!
  ctx.font = '500px Arial, sans-serif'
  const metrics = ctx.measureText(char)
  const w = metrics.width
  // Use font-level bounding box (consistent for all chars) — matches C++ Label::getContentSize()
  // which returns line height, not per-character actual bounds.
  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? 400
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 100
  const h = ascent + descent
  return { w, h }
}

// ── CatmullRom Glyph Building (from TraceModelFactory.cpp) ──

/**
 * Build a TraceGlyph from knot points using CatmullRom spline interpolation.
 * Port of TraceModelFactory::glyphWithKnotList().
 *
 * The algorithm uses a 4-point sliding window [C, C+1, C+2, C+3] and
 * energy-based uniform sampling to produce evenly-spaced sample points.
 */
export function glyphFromKnots(knots: KnotPoint[], roughBB: { w: number; h: number }): TraceGlyph {
  const postTranslateX = roughBB.w / 2
  const postTranslateY = roughBB.h / 2

  const ENERGY_FOR_UNIT_STEP = 1.5  // C++ constant

  const glyph: TraceGlyph = {
    strokes: [],
    roughBB: { x: 0, y: 0, w: roughBB.w, h: roughBB.h },
    tightBB: { x: 0, y: 0, w: 0, h: 0 },
  }

  const count = knots.length
  let energyLeft = 0
  let lastTimeInSpline = 0
  let currentStroke: TracePoint[] = []

  let c = 0
  while (c + 3 < count) {
    const kpa = knots[c + 0]
    const kpb = knots[c + 1]
    const kpc = knots[c + 2]
    const kpd = knots[c + 3]

    // Check all 4 points are "Point" (not Separator)
    const isGood =
      kpa.type === 'Point' &&
      kpb.type === 'Point' &&
      kpc.type === 'Point' &&
      kpd.type === 'Point'

    if (!isGood) {
      // Flush current stroke
      if (currentStroke.length > 0) {
        glyph.strokes.push({ samplePoints: currentStroke })
        currentStroke = []
      }
      energyLeft = 0
      lastTimeInSpline = 0
      c += 1
      continue
    }

    const pa = { x: kpa.x, y: kpa.y }
    const pb = { x: kpb.x, y: kpb.y }
    const pc = { x: kpc.x, y: kpc.y }
    const pd = { x: kpd.x, y: kpd.y }

    const velocity = catmullRomTangential2D(pa, pb, pc, pd, lastTimeInSpline)
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)

    if (speed < 1e-9) {
      // Avoid division by zero
      c += 1
      energyLeft = 0
      lastTimeInSpline = 0
      continue
    }

    const advanceTime = energyLeft / speed
    const newTimeInSpline = lastTimeInSpline + advanceTime

    if (newTimeInSpline > 1.0) {
      // Advance to next spline segment
      const lastPoint = catmullRom2D(pa, pb, pc, pd, lastTimeInSpline)
      const energyUsed = Math.sqrt(
        (pc.x - lastPoint.x) ** 2 + (pc.y - lastPoint.y) ** 2
      )
      energyLeft = Math.max(0, energyLeft - energyUsed)
      lastTimeInSpline = 0
      c += 1
      continue
    }

    const newPoint = catmullRom2D(pa, pb, pc, pd, newTimeInSpline)
    const newTangent = catmullRomTangential2D(pa, pb, pc, pd, newTimeInSpline)

    currentStroke.push({
      x: newPoint.x + postTranslateX,
      y: newPoint.y + postTranslateY,
      vx: newTangent.x,
      vy: newTangent.y,
    })

    energyLeft = ENERGY_FOR_UNIT_STEP
    lastTimeInSpline = newTimeInSpline
  }

  // Flush final stroke
  if (currentStroke.length > 0) {
    glyph.strokes.push({ samplePoints: currentStroke })
  }

  // Compute tight bounding box from all sample points
  refreshGlyphBoundingBox(glyph)

  return glyph
}

function refreshGlyphBoundingBox(glyph: TraceGlyph) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const stroke of glyph.strokes) {
    for (const pt of stroke.samplePoints) {
      if (pt.x < minX) minX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.x > maxX) maxX = pt.x
      if (pt.y > maxY) maxY = pt.y
    }
  }

  if (minX <= maxX && minY <= maxY) {
    glyph.tightBB = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  } else {
    glyph.tightBB = { ...glyph.roughBB }
  }
}

// ── String Assembly (from TraceString.cpp) ────────────

/**
 * Build a TraceString from a text string by loading each character's glyph.
 * Port of TraceModelFactory::stringWithString().
 */
export async function buildStringFromChars(text: string): Promise<TraceString> {
  const glyphs: TraceGlyph[] = []

  for (const char of text) {
    const knots = await loadGlyphJSON(char)
    const bb = measureCharBB(char)
    const glyph = glyphFromKnots(knots, bb)
    glyphs.push(glyph)
  }

  // Compute glyph offsets (from TraceString::refreshBoundingBox)
  const SPACING = 40
  const offsets: { x: number; y: number }[] = []
  let offsetX = 0

  let stringTightBB = glyphs.length > 0 ? { ...glyphs[0].tightBB } : { x: 0, y: 0, w: 0, h: 0 }
  let stringRoughBB = glyphs.length > 0 ? { ...glyphs[0].roughBB } : { x: 0, y: 0, w: 0, h: 0 }

  for (let i = 0; i < glyphs.length; i++) {
    const localRoughBB = glyphs[i].roughBB

    if (i > 0) {
      offsetX += SPACING
      offsetX -= localRoughBB.x  // -= minX
    }

    offsets.push({ x: offsetX, y: 0 })

    // Union bounding boxes
    const glyphTight = {
      x: glyphs[i].tightBB.x + offsetX,
      y: glyphs[i].tightBB.y,
      w: glyphs[i].tightBB.w,
      h: glyphs[i].tightBB.h,
    }
    const glyphRough = {
      x: glyphs[i].roughBB.x + offsetX,
      y: glyphs[i].roughBB.y,
      w: glyphs[i].roughBB.w,
      h: glyphs[i].roughBB.h,
    }

    stringTightBB = rectUnion(stringTightBB, glyphTight)
    stringRoughBB = rectUnion(stringRoughBB, glyphRough)

    offsetX += localRoughBB.x + localRoughBB.w  // += maxX
  }

  return {
    glyphs,
    offsets,
    roughBB: stringRoughBB,
    tightBB: stringTightBB,
  }
}

function rectUnion(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.w, b.x + b.w)
  const maxY = Math.max(a.y + a.h, b.y + b.h)
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// ── Resize / Transform (from TraceModelFactory.cpp) ───

/**
 * Resize a TraceString to fit within a target rect, preserving aspect ratio.
 * Port of TraceModelFactory::resizeString().
 *
 * C++ positions at TargetRect.min(), relying on TSAlphabets font metrics
 * for approximate centering. Web uses Arial (narrower glyphs), so we
 * add explicit centering to compensate for the font metric difference.
 */
export function resizeString(
  source: TraceString,
  targetRect: Rect,
  useTightBB = false,
): TraceString {
  const bb = useTightBB ? source.tightBB : source.roughBB
  const preTranslateX = -bb.x
  const preTranslateY = -bb.y
  const scale = Math.min(targetRect.w / bb.w, targetRect.h / bb.h)
  // Center within target rect (compensates for Arial vs TSAlphabets metric difference)
  const scaledW = bb.w * scale
  const scaledH = bb.h * scale
  const postTranslateX = targetRect.x + (targetRect.w - scaledW) / 2
  const postTranslateY = targetRect.y + (targetRect.h - scaledH) / 2

  return transformString(source, preTranslateX, preTranslateY, scale, postTranslateX, postTranslateY)
}

/**
 * Resize a TraceString to fit vertically within a target rect.
 * Horizontal extent may overflow (for ScrollLetterByLetter).
 * Port of TraceModelFactory::resizeStringVertically().
 */
export function resizeStringVertically(
  source: TraceString,
  targetRect: Rect,
  useTightBB = false,
): TraceString {
  const bb = useTightBB ? source.tightBB : source.roughBB
  const preTranslateX = -bb.x
  const preTranslateY = -bb.y
  const scale = targetRect.h / bb.h
  const postTranslateX = targetRect.x
  const postTranslateY = targetRect.y

  return transformString(source, preTranslateX, preTranslateY, scale, postTranslateX, postTranslateY)
}

function transformString(
  source: TraceString,
  preTranslateX: number, preTranslateY: number,
  scale: number,
  postTranslateX: number, postTranslateY: number,
): TraceString {
  // C++ TraceModelFactory::transformedString:
  //   1. Transform each glyph's LOCAL points (WITHOUT string offset)
  //   2. Transform local roughBB
  //   3. After all glyphs, recalculate offsets with 40px spacing (refreshBoundingBox)
  // This ensures spacing stays at 40px regardless of scale factor.

  const newGlyphs: TraceGlyph[] = []

  for (let gi = 0; gi < source.glyphs.length; gi++) {
    const glyph = source.glyphs[gi]
    // C++: does NOT apply glyph offset during transformation

    const newStrokes: TraceStroke[] = []
    for (const stroke of glyph.strokes) {
      const newPoints: TracePoint[] = []
      for (const pt of stroke.samplePoints) {
        newPoints.push({
          x: (pt.x + preTranslateX) * scale + postTranslateX,
          y: (pt.y + preTranslateY) * scale + postTranslateY,
          vx: pt.vx * scale,
          vy: pt.vy * scale,
        })
      }
      newStrokes.push({ samplePoints: newPoints })
    }

    const rbb = glyph.roughBB
    const newRoughBB: Rect = {
      x: (rbb.x + preTranslateX) * scale + postTranslateX,
      y: (rbb.y + preTranslateY) * scale + postTranslateY,
      w: rbb.w * scale,
      h: rbb.h * scale,
    }

    const newGlyph: TraceGlyph = {
      strokes: newStrokes,
      roughBB: newRoughBB,
      tightBB: { x: 0, y: 0, w: 0, h: 0 },
    }
    refreshGlyphBoundingBox(newGlyph)
    newGlyphs.push(newGlyph)
  }

  // C++ refreshBoundingBox: recalculate offsets with fixed 40px spacing
  const SPACING = 40
  const newOffsets: { x: number; y: number }[] = []
  let offsetX = 0

  let stringRoughBB = newGlyphs.length > 0 ? { ...newGlyphs[0].roughBB } : { x: 0, y: 0, w: 0, h: 0 }
  let stringTightBB = newGlyphs.length > 0 ? { ...newGlyphs[0].tightBB } : { x: 0, y: 0, w: 0, h: 0 }

  for (let i = 0; i < newGlyphs.length; i++) {
    const localRoughBB = newGlyphs[i].roughBB

    if (i > 0) {
      offsetX += SPACING
      offsetX -= localRoughBB.x  // -= minX
    }

    newOffsets.push({ x: offsetX, y: 0 })

    const glyphRough = { x: localRoughBB.x + offsetX, y: localRoughBB.y, w: localRoughBB.w, h: localRoughBB.h }
    const glyphTight = { x: newGlyphs[i].tightBB.x + offsetX, y: newGlyphs[i].tightBB.y, w: newGlyphs[i].tightBB.w, h: newGlyphs[i].tightBB.h }

    if (i === 0) {
      stringRoughBB = { ...glyphRough }
      stringTightBB = { ...glyphTight }
    } else {
      stringRoughBB = rectUnion(stringRoughBB, glyphRough)
      stringTightBB = rectUnion(stringTightBB, glyphTight)
    }

    offsetX += localRoughBB.x + localRoughBB.w  // += maxX
  }

  return {
    glyphs: newGlyphs,
    offsets: newOffsets,
    roughBB: stringRoughBB,
    tightBB: stringTightBB,
  }
}

// ── TracePath Conversion ──────────────────────────────

/**
 * Convert all strokes from a TraceString to TracePath[] format.
 * Each stroke becomes one TracePath with cumulative distances.
 * Applies Y-flip to convert from Cocos Y-up to web Y-down.
 */
export function stringToTracePaths(
  traceString: TraceString,
  fieldHeight: number,
  fieldOffsetX: number,
  fieldOffsetY: number,
): TracePath[] {
  const paths: TracePath[] = []

  for (let gi = 0; gi < traceString.glyphs.length; gi++) {
    const glyph = traceString.glyphs[gi]
    const glyphOffset = traceString.offsets[gi] || { x: 0, y: 0 }
    for (const stroke of glyph.strokes) {
      if (stroke.samplePoints.length < 2) continue

      const points: { x: number; y: number }[] = stroke.samplePoints.map(pt => ({
        x: pt.x + glyphOffset.x + fieldOffsetX,
        y: fieldHeight - (pt.y + glyphOffset.y) + fieldOffsetY,  // Y-flip: Cocos Y-up → web Y-down
      }))

      const lengths: number[] = [0]
      let total = 0
      for (let i = 1; i < points.length; i++) {
        total += Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        )
        lengths.push(total)
      }

      paths.push({ points, lengths, totalLength: total })
    }
  }

  return paths
}

/**
 * Get per-glyph stroke counts from a TraceString.
 * Returns array where glyphStrokeCounts[i] = number of strokes in glyph i.
 */
export function getGlyphStrokeCounts(traceString: TraceString): number[] {
  return traceString.glyphs.map(g => g.strokes.filter(s => s.samplePoints.length >= 2).length)
}

/**
 * Get the glyph center X position (in game coords after Y-flip) for scrolling.
 */
export function getGlyphCenterX(
  traceString: TraceString,
  glyphIndex: number,
  fieldOffsetX: number,
): number {
  if (glyphIndex >= traceString.glyphs.length) return 0
  const glyph = traceString.glyphs[glyphIndex]
  const offset = traceString.offsets[glyphIndex] || { x: 0, y: 0 }
  // C++ centerForGlyphAt: Offsets[N] + Point(BB.midX(), BB.midY())
  return glyph.roughBB.x + offset.x + glyph.roughBB.w / 2 + fieldOffsetX
}

// ── Path Following (from TutorialTraceEngine) ─────────

/** Find the point on a path at a given cumulative distance. */
export function getPointAtDistance(
  path: TracePath, dist: number,
): { x: number; y: number } {
  const d = Math.max(0, Math.min(dist, path.totalLength))
  for (let i = 1; i < path.points.length; i++) {
    if (d <= path.lengths[i]) {
      const segLen = path.lengths[i] - path.lengths[i - 1]
      const t = segLen > 0 ? (d - path.lengths[i - 1]) / segLen : 0
      return {
        x: path.points[i - 1].x + (path.points[i].x - path.points[i - 1].x) * t,
        y: path.points[i - 1].y + (path.points[i].y - path.points[i - 1].y) * t,
      }
    }
  }
  return path.points[path.points.length - 1]
}

/** Find the cumulative distance along path closest to point (px, py). */
export function closestDistOnPath(
  path: TracePath, px: number, py: number,
): number {
  let bestDist = Infinity
  let bestAlongPath = 0

  for (let i = 1; i < path.points.length; i++) {
    const ax = path.points[i - 1].x, ay = path.points[i - 1].y
    const bx = path.points[i].x, by = path.points[i].y
    const dx = bx - ax, dy = by - ay
    const segLenSq = dx * dx + dy * dy
    let t = segLenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / segLenSq : 0
    t = Math.max(0, Math.min(1, t))
    const cx = ax + t * dx, cy = ay + t * dy
    const d = Math.hypot(px - cx, py - cy)
    if (d < bestDist) {
      bestDist = d
      bestAlongPath = path.lengths[i - 1] + t * (path.lengths[i] - path.lengths[i - 1])
    }
  }
  return bestAlongPath
}

/** Find the minimum distance from point (px, py) to path. */
export function distToPath(
  path: TracePath, px: number, py: number,
): number {
  let bestDist = Infinity
  for (let i = 1; i < path.points.length; i++) {
    const ax = path.points[i - 1].x, ay = path.points[i - 1].y
    const bx = path.points[i].x, by = path.points[i].y
    const dx = bx - ax, dy = by - ay
    const segLenSq = dx * dx + dy * dy
    let t = segLenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / segLenSq : 0
    t = Math.max(0, Math.min(1, t))
    const cx = ax + t * dx, cy = ay + t * dy
    const d = Math.hypot(px - cx, py - cy)
    if (d < bestDist) bestDist = d
  }
  return bestDist
}

/** Get the direction angle at a given distance along a path. */
export function getAngleAtDistance(path: TracePath, dist: number): number {
  const d = Math.max(0, Math.min(dist, path.totalLength))
  for (let i = 1; i < path.points.length; i++) {
    if (d <= path.lengths[i]) {
      const dx = path.points[i].x - path.points[i - 1].x
      const dy = path.points[i].y - path.points[i - 1].y
      return Math.atan2(dy, dx)
    }
  }
  const n = path.points.length
  if (n >= 2) {
    const dx = path.points[n - 1].x - path.points[n - 2].x
    const dy = path.points[n - 1].y - path.points[n - 2].y
    return Math.atan2(dy, dx)
  }
  return 0
}

// ── Stroke Rendering Helpers ──────────────────────────

export interface StrokeStyle {
  thickness: number
  color: string
}

/**
 * Draw a trace path on canvas as a thick colored line.
 * Draws from start to the given distance along the path.
 */
export function drawPathUpToDistance(
  ctx: CanvasRenderingContext2D,
  path: TracePath,
  distance: number,
  style: StrokeStyle,
  gs: number,
) {
  if (path.points.length < 2) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = style.thickness * gs
  ctx.strokeStyle = style.color

  ctx.beginPath()
  ctx.moveTo(path.points[0].x * gs, path.points[0].y * gs)

  for (let i = 1; i < path.points.length; i++) {
    if (path.lengths[i] <= distance) {
      ctx.lineTo(path.points[i].x * gs, path.points[i].y * gs)
    } else {
      // Partial segment
      const segStart = path.lengths[i - 1]
      const segLen = path.lengths[i] - segStart
      if (segLen > 0 && distance > segStart) {
        const t = (distance - segStart) / segLen
        const px = path.points[i - 1].x + (path.points[i].x - path.points[i - 1].x) * t
        const py = path.points[i - 1].y + (path.points[i].y - path.points[i - 1].y) * t
        ctx.lineTo(px * gs, py * gs)
      }
      break
    }
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * Draw a full trace path on canvas as a thick colored line.
 */
export function drawFullPath(
  ctx: CanvasRenderingContext2D,
  path: TracePath,
  style: StrokeStyle,
  gs: number,
) {
  drawPathUpToDistance(ctx, path, path.totalLength, style, gs)
}
