/**
 * LetterTraceEngine — Letter tracing with stroke-by-stroke guided tracing.
 *
 * Uses the TraceField system (CatmullRom glyph archives + path following)
 * matching the C++ LetterTraceScene behavior.
 *
 * C++ reference: LetterTraceScene.cpp
 *   - TraceField contentSize = GameSize * 0.85 = (2176, 1530)
 *   - Position: (GameSize/2) + (0, -134.5) (Cocos Y-up)
 *   - EnableDefaultBackground = false
 *   - MainLineThickness = 130
 *   - Style: multi-layer brown strokes with white shadows
 */

import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'
import type { TracePath, TraceString } from '../common/TraceFieldUtils'
import {
  loadGlyphJSON, measureCharBB, glyphFromKnots,
  resizeString,
  stringToTracePaths,
  getPointAtDistance, getAngleAtDistance,
  drawPathUpToDistance, drawFullPath,
  CURSOR_PICK_DISTANCE, BACKWARD_TOLERANCE, COMPLETION_RATIO, STROKE_SKIP_DISTANCE,
} from '../common/TraceFieldUtils'

// C++ LetterTraceScene layout constants
const FIELD_WIDTH = GAME_WIDTH * 0.85   // 2176
const FIELD_HEIGHT = GAME_HEIGHT * 0.85 // 1530
// traceFieldOffset = (0, 900 - (1535+534)/2) = (0, -134.5) in Cocos Y-up
// Field anchor=MIDDLE, pos = (1280, 900-134.5) = (1280, 765.5)
// Field bottom-left in Cocos = (1280-1088, 765.5-765) = (192, 0.5)
const FIELD_OFFSET_X = (GAME_WIDTH - FIELD_WIDTH) / 2   // 192
const FIELD_OFFSET_Y_COCOS = 0.5  // bottom edge in Cocos Y-up

// Guide line positions (already in web Y-down game coords)
const TOP_LINE_Y = 400
const MID_LINE_Y = 854
const BOT_LINE_Y = 1400

// C++ style
const MAIN_LINE_THICKNESS = 130

// Cursor
const CURSOR_SCALE_NORMAL = 1.0
const CURSOR_SCALE_PICKED = 1.2

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; color: string; size: number
}

export class LetterTraceEngine extends BaseEngine {
  level: number
  letters: string[] = []
  currentLetterIndex = 0
  letter = ''

  bgImage: HTMLImageElement
  cursorImage: HTMLImageElement
  topLineImage: HTMLImageElement
  midLineImage: HTMLImageElement

  // Sound effects
  sfxPencilLoop: HTMLAudioElement
  sfxTraceEnd: HTMLAudioElement
  sfxWorkComplete: HTMLAudioElement
  pencilLoopPlaying = false

  // TraceField state
  traceString: TraceString | null = null
  tracePaths: TracePath[] = []
  currentStrokeIndex = 0
  pathProgress = 0
  cursorPicked = false
  isDrawing = false

  // Visual state
  strokeStates: ('future' | 'active' | 'done')[] = []
  particles: Particle[] = []
  completeTimer = 0

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(assetUrl('/assets/games/lettertrace/lettertracing_image_bg.png'))
    this.cursorImage = loadImage(assetUrl('/assets/games/lettertrace/lettertracing_image_cursor.png'))
    this.topLineImage = loadImage(assetUrl('/assets/games/lettertrace/lettertracing_topbottom_line.png'))
    this.midLineImage = loadImage(assetUrl('/assets/games/lettertrace/lettertracing_middle_line.png'))

    // C++ sounds
    this.sfxPencilLoop = loadAudio(assetUrl('/assets/games/tutorialtrace/scratchfield/sounds/sfx_pencilloop.m4a'))
    this.sfxPencilLoop.loop = true
    this.sfxTraceEnd = loadAudio(assetUrl('/assets/tapping/cards_1.m4a'))
    this.sfxWorkComplete = loadAudio(assetUrl('/assets/tapping/cards_4.m4a'))
  }

  start() {
    super.start()
    this.loadLevel()
  }

  stop() {
    this.stopPencilLoop()
    super.stop()
  }

  async loadLevel() {
    try {
      const resp = await fetch('/data/games/lettertrace.json')
      const data = await resp.json()
      this.letters = data.levels[String(this.level)] || ['A']
    } catch {
      this.letters = ['A']
    }
    this.currentLetterIndex = 0
    this.onProgressChange?.(0, this.letters.length)
    await this.setupLetter()
  }

  async setupLetter() {
    this.letter = this.letters[this.currentLetterIndex] || 'A'
    this.pathProgress = 0
    this.currentStrokeIndex = 0
    this.cursorPicked = false
    this.isDrawing = false
    this.particles = []
    this.completeTimer = 0

    try {
      // Load glyph and build trace paths
      const knots = await loadGlyphJSON(this.letter)
      const bb = measureCharBB(this.letter)
      const glyph = glyphFromKnots(knots, bb)

      // Single-glyph string
      this.traceString = {
        glyphs: [glyph],
        offsets: [{ x: 0, y: 0 }],
        roughBB: glyph.roughBB,
        tightBB: glyph.tightBB,
      }

      // Resize to fit TraceField content area
      const targetRect = { x: 0, y: 0, w: FIELD_WIDTH, h: FIELD_HEIGHT }
      this.traceString = resizeString(this.traceString, targetRect, false)

      // Convert to TracePaths in game coordinates (Y-flipped)
      // Field bottom-left in game: (FIELD_OFFSET_X, 1800 - FIELD_OFFSET_Y_COCOS - FIELD_HEIGHT)
      // = (192, 1800 - 0.5 - 1530) = (192, 269.5)
      this.tracePaths = stringToTracePaths(
        this.traceString,
        FIELD_HEIGHT,
        FIELD_OFFSET_X,
        GAME_HEIGHT - FIELD_OFFSET_Y_COCOS - FIELD_HEIGHT,
      )

      // Initialize stroke states
      this.strokeStates = this.tracePaths.map((_, i) => i === 0 ? 'active' : 'future')
    } catch (e) {
      console.error('Failed to load glyph for', this.letter, e)
      this.tracePaths = []
      this.strokeStates = []
    }
  }

  // ── Interaction ─────────────────────────────────────

  onPointerDown(x: number, y: number) {
    const path = this.tracePaths[this.currentStrokeIndex]
    if (!path) return

    // C++: check distance to CURSOR position only (not any point on path)
    const cursorPt = getPointAtDistance(path, this.pathProgress)
    const dx = x - cursorPt.x
    const dy = y - cursorPt.y
    const distToCursor = Math.sqrt(dx * dx + dy * dy)

    if (distToCursor < CURSOR_PICK_DISTANCE) {
      this.cursorPicked = true
      this.isDrawing = true
      this.startPencilLoop()
      this.advanceProgress(x, y)
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.cursorPicked) return
    this.advanceProgress(x, y)
  }

  onPointerUp(_x: number, _y: number) {
    if (this.cursorPicked) {
      this.stopPencilLoop()
      const path = this.tracePaths[this.currentStrokeIndex]
      if (path) {
        // C++ isItGoodDayToAdvanceStroke: remaining < 700 → auto-complete
        const remaining = path.totalLength - this.pathProgress
        if (remaining < STROKE_SKIP_DISTANCE && this.pathProgress > 0) {
          this.pathProgress = path.totalLength
          this.completeCurrentStroke()
        }
      }
    }
    this.cursorPicked = false
    this.isDrawing = false
  }

  /** C++ TraceLocator::bestIndexByFinger — energy-based forward search */
  advanceProgress(x: number, y: number) {
    const path = this.tracePaths[this.currentStrokeIndex]
    if (!path || path.points.length < 2) return

    // C++ energy-based forward search constants (TraceLocator.cpp)
    const ENERGY_LIMIT = 500
    const ENERGY_PER_DISTANCE = 0.8
    const ENERGY_PER_DEGREE = 0.5
    const ENERGY_MAX_DEGREE = 20
    const DISTANCE_LIMIT = 160

    // Find path point index at current progress
    let startIdx = 0
    for (let i = 0; i < path.lengths.length; i++) {
      if (path.lengths[i] >= this.pathProgress) {
        startIdx = i
        break
      }
      startIdx = i
    }

    // Walk forward from current progress with energy budget
    let energy = ENERGY_LIMIT
    let bestDist = DISTANCE_LIMIT
    let bestAlong = this.pathProgress

    for (let i = startIdx; i < path.points.length; i++) {
      if (i > startIdx) {
        const segLen = path.lengths[i] - path.lengths[i - 1]
        energy -= segLen * ENERGY_PER_DISTANCE

        // C++ direction penalty
        const prev = path.points[i - 1]
        const cur = path.points[i]
        const dirX = cur.x - prev.x
        const dirY = cur.y - prev.y
        const thetaDeg = Math.atan2(dirY, dirX) * 180 / Math.PI
        energy -= Math.min(Math.abs(thetaDeg), ENERGY_MAX_DEGREE) * ENERGY_PER_DEGREE
      }
      if (energy < 0) break

      const pt = path.points[i]
      const dx = x - pt.x
      const dy = y - pt.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < bestDist) {
        bestDist = dist
        bestAlong = path.lengths[i]
      }
    }

    if (bestAlong > this.pathProgress - BACKWARD_TOLERANCE) {
      this.pathProgress = Math.max(this.pathProgress, bestAlong)
    }

    if (this.pathProgress >= path.totalLength * COMPLETION_RATIO) {
      this.pathProgress = path.totalLength
      this.completeCurrentStroke()
    }
  }

  completeCurrentStroke() {
    this.stopPencilLoop()
    playSound(this.sfxTraceEnd)

    // Mark current stroke as done
    if (this.currentStrokeIndex < this.strokeStates.length) {
      this.strokeStates[this.currentStrokeIndex] = 'done'
    }

    // Spawn particles at end of stroke
    const path = this.tracePaths[this.currentStrokeIndex]
    if (path && path.points.length > 0) {
      const endPt = path.points[path.points.length - 1]
      this.spawnParticles(endPt.x, endPt.y)
    }

    // Advance to next stroke
    this.currentStrokeIndex++
    this.pathProgress = 0
    this.cursorPicked = false

    if (this.currentStrokeIndex < this.tracePaths.length) {
      this.strokeStates[this.currentStrokeIndex] = 'active'
    } else {
      // All strokes complete — advance to next letter
      const nextIdx = this.currentLetterIndex + 1
      if (nextIdx < this.letters.length) {
        this.onProgressChange?.(nextIdx, this.letters.length)
        setTimeout(() => {
          this.currentLetterIndex = nextIdx
          this.setupLetter()
        }, 800)
      } else {
        this.onProgressChange?.(this.letters.length, this.letters.length)
        playSound(this.sfxWorkComplete)
        this.gameState = 'complete'
        this.onComplete?.()
      }
    }
  }

  startPencilLoop() {
    if (!this.pencilLoopPlaying) {
      this.sfxPencilLoop.volume = 0.4
      this.sfxPencilLoop.currentTime = 0
      this.sfxPencilLoop.play().catch(() => {})
      this.pencilLoopPlaying = true
    }
  }

  stopPencilLoop() {
    if (this.pencilLoopPlaying) {
      this.sfxPencilLoop.pause()
      this.sfxPencilLoop.currentTime = 0
      this.pencilLoopPlaying = false
    }
  }

  spawnParticles(gx: number, gy: number) {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF69B4']
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 200 + Math.random() * 400
      this.particles.push({
        x: gx, y: gy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 200,
        life: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 8 + Math.random() * 16,
      })
    }
  }

  update(_time: number, dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 400 * dt
      p.life -= dt * 0.8
    }
    this.particles = this.particles.filter(p => p.life > 0)
  }

  // ── Drawing ─────────────────────────────────────────

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Background
    if (imgOk(this.bgImage)) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      ctx.fillStyle = '#F5E6D3'
      ctx.fillRect(0, 0, w, h)
    }

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Guide lines
    this.drawWritingLines(gs)

    // Draw all strokes with multi-layer rendering
    this.drawStrokes(gs)

    // Draw cursor
    this.drawCursor(gs)

    // Particles
    for (const p of this.particles) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x * gs, p.y * gs, p.size * gs * p.life, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Letter label at top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.font = `bold ${36 * gs}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(
      `${this.letter}  (${this.currentLetterIndex + 1}/${this.letters.length})`,
      GAME_WIDTH / 2 * gs, 60 * gs,
    )

    ctx.restore()
  }

  drawWritingLines(gs: number) {
    const { ctx } = this
    if (imgOk(this.topLineImage) && imgOk(this.midLineImage)) {
      const drawLineImage = (img: HTMLImageElement, y: number) => {
        const imgW = img.width * gs
        const imgH = img.height * gs
        ctx.drawImage(img, GAME_WIDTH / 2 * gs - imgW / 2, y * gs - imgH / 2, imgW, imgH)
      }
      drawLineImage(this.topLineImage, TOP_LINE_Y)
      drawLineImage(this.midLineImage, MID_LINE_Y)
      drawLineImage(this.topLineImage, BOT_LINE_Y)
    } else {
      // Fallback
      const lineX1 = (GAME_WIDTH / 2 - 600) * gs
      const lineX2 = (GAME_WIDTH / 2 + 600) * gs

      ctx.strokeStyle = 'rgba(135, 88, 40, 0.3)'
      ctx.lineWidth = 2 * gs
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(lineX1, TOP_LINE_Y * gs); ctx.lineTo(lineX2, TOP_LINE_Y * gs); ctx.stroke()

      ctx.setLineDash([10 * gs, 5 * gs])
      ctx.strokeStyle = 'rgba(135, 88, 40, 0.2)'
      ctx.beginPath(); ctx.moveTo(lineX1, MID_LINE_Y * gs); ctx.lineTo(lineX2, MID_LINE_Y * gs); ctx.stroke()

      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(135, 88, 40, 0.3)'
      ctx.beginPath(); ctx.moveTo(lineX1, BOT_LINE_Y * gs); ctx.lineTo(lineX2, BOT_LINE_Y * gs); ctx.stroke()
      ctx.setLineDash([])
    }
  }

  drawStrokes(gs: number) {
    const { ctx } = this

    for (let i = 0; i < this.tracePaths.length; i++) {
      const path = this.tracePaths[i]
      const state = this.strokeStates[i]

      if (state === 'done') {
        // C++ done strokes: white shadow + brown main + dark brown focus
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.85, color: 'rgba(255,255,255,0.6)' }, gs)
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.62, color: 'rgb(86, 57, 29)' }, gs)
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.38, color: 'rgb(69, 45, 20)' }, gs)
      } else if (state === 'active') {
        // Guide: full path in light style
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.62, color: 'rgba(255,255,255,0.6)' }, gs)
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.08, color: 'rgba(135, 88, 40, 1)' }, gs)

        // Traced portion: multi-layer
        if (this.pathProgress > 0) {
          drawPathUpToDistance(ctx, path, this.pathProgress, { thickness: MAIN_LINE_THICKNESS * 0.85, color: 'rgba(255,255,255,0.6)' }, gs)
          drawPathUpToDistance(ctx, path, this.pathProgress, { thickness: MAIN_LINE_THICKNESS * 0.62, color: 'rgb(86, 57, 29)' }, gs)
          drawPathUpToDistance(ctx, path, this.pathProgress, { thickness: MAIN_LINE_THICKNESS * 0.38, color: 'rgb(69, 45, 20)' }, gs)
        }
      } else {
        // Future: light guide only
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.62, color: 'rgba(255,255,255,0.6)' }, gs)
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.08, color: 'rgba(135, 88, 40, 0.5)' }, gs)
      }
    }
  }

  drawCursor(gs: number) {
    const path = this.tracePaths[this.currentStrokeIndex]
    if (!path || this.currentStrokeIndex >= this.tracePaths.length) return

    const cursorPt = getPointAtDistance(path, this.pathProgress)
    const angle = getAngleAtDistance(path, this.pathProgress)
    const cx = cursorPt.x * gs
    const cy = cursorPt.y * gs
    const { ctx } = this

    const hasCursorImg = imgOk(this.cursorImage) && this.cursorImage.naturalWidth > 0
    if (hasCursorImg) {
      const scale = this.cursorPicked ? CURSOR_SCALE_PICKED : CURSOR_SCALE_NORMAL
      const imgSize = this.cursorImage!.naturalWidth
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      ctx.scale(scale, scale)
      const halfSize = imgSize * gs / 2
      ctx.drawImage(this.cursorImage!, -halfSize, -halfSize, imgSize * gs, imgSize * gs)
      ctx.restore()
    } else {
      // Fallback cursor: gold dot with glow so users can see where to trace
      const r = (this.cursorPicked ? 56 : 46) * gs
      ctx.save()
      ctx.translate(cx, cy)
      ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,220,80,0.25)'; ctx.fill()
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = this.cursorPicked ? '#FF9800' : '#FFD700'; ctx.fill()
      ctx.strokeStyle = '#B26800'; ctx.lineWidth = 4 * gs; ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = '#7A4400'; ctx.fill()
      ctx.restore()
    }
  }
}
