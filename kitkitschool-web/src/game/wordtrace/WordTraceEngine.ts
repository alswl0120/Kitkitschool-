/**
 * WordTraceEngine — Word tracing with stroke-by-stroke guided tracing.
 *
 * Uses the TraceField system (CatmullRom glyph archives + path following)
 * matching the C++ WordTraceScene behavior.
 *
 * C++ reference: WordTraceScene.cpp
 *   - TraceField contentSize = (GameSize.width, GameSize.height * 0.65) = (2560, 1170)
 *   - Position: (1280, 795.864), anchor=MIDDLE
 *   - EnableDefaultBackground = false
 *   - ScrollLetterByLetter = true → resizeStringVertically()
 *   - MainLineThickness = 130
 *   - Style: WhiteLine(255,249,237) guide + StrokeLine(179,230,79) green + MintLine(107,185,232) highlight
 */

import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'
import type { TracePath, TraceString } from '../common/TraceFieldUtils'
import {
  buildStringFromChars, resizeStringVertically,
  stringToTracePaths, getGlyphStrokeCounts, getGlyphCenterX,
  getPointAtDistance, getAngleAtDistance,
  drawPathUpToDistance, drawFullPath,
  CURSOR_PICK_DISTANCE, BACKWARD_TOLERANCE, COMPLETION_RATIO, STROKE_SKIP_DISTANCE,
} from '../common/TraceFieldUtils'

// C++ WordTraceScene layout constants
// traceFieldOffset = (0, 900 - (1394 + 614.272)/2) = (0, -104.136)
// Field position = (1280, 795.864), anchor=MIDDLE
// Field contentSize = (2560, 1170)
// Field bottom-left in Cocos = (0, 210.864)
const FIELD_WIDTH = GAME_WIDTH            // 2560
const FIELD_HEIGHT = GAME_HEIGHT * 0.65   // 1170
const FIELD_OFFSET_X = 0
const FIELD_OFFSET_Y_COCOS = 210.864     // bottom edge in Cocos Y-up

// Guide line positions (web Y-down game coords, from existing code)
const TOP_LINE_Y = 510
const MID_LINE_Y = 853
const BOT_LINE_Y = 1290

// C++ style
const MAIN_LINE_THICKNESS = 130

// C++ cursor: TraceField_Cursor2.png, cursorScaleNormal=1.75, cursorScalePicked=2.1
const CURSOR_SCALE_NORMAL = 1.75
const CURSOR_SCALE_PICKED = 2.1

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; color: string; size: number
}

export class WordTraceEngine extends BaseEngine {
  level: number
  words: string[] = []
  currentWordIndex = 0
  word = ''

  bgImage: HTMLImageElement
  cursorImage: HTMLImageElement
  topLineImage: HTMLImageElement
  midLineImage: HTMLImageElement

  // C++ sounds: pencil loop while tracing, trace end, work complete
  sfxPencilLoop: HTMLAudioElement
  sfxTraceEnd: HTMLAudioElement
  sfxWorkComplete: HTMLAudioElement
  pencilLoopPlaying = false

  // TraceField state
  traceString: TraceString | null = null
  tracePaths: TracePath[] = []
  glyphStrokeCounts: number[] = []   // strokes per glyph
  currentStrokeIndex = 0
  pathProgress = 0
  cursorPicked = false
  isDrawing = false

  // Visual state
  strokeStates: ('future' | 'active' | 'done')[] = []
  particles: Particle[] = []

  // Scroll state (ScrollLetterByLetter)
  // C++ uses 0.3s duration with pow(t, 0.3) easing
  scrollCurrentX = 0
  scrollTargetX = 0
  scrollStartX = 0
  scrollElapsed = 0
  scrollDuration = 0.3
  scrollAnimating = false

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(assetUrl('/assets/games/wordtrace/wordtracing_blackboard.jpg'))
    this.cursorImage = loadImage(assetUrl('/assets/games/numbertrace/tracefield_cursor2.png'))
    this.topLineImage = loadImage(assetUrl('/assets/games/wordtrace/wordtracing_topbottom_line.png'))
    this.midLineImage = loadImage(assetUrl('/assets/games/wordtrace/wordtracing_middle_line.png'))

    // C++ sounds: pencil loop while tracing, trace end on stroke complete, work complete
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
      const resp = await fetch('/data/games/wordtrace.json')
      const data = await resp.json()
      this.words = data.levels[String(this.level)] || ['cat', 'dog', 'sun']
    } catch {
      this.words = ['cat', 'dog', 'sun']
    }
    this.currentWordIndex = 0
    this.onProgressChange?.(1, this.words.length)
    await this.setupWord()
  }

  /** Derive current glyph index from flat stroke index */
  get currentGlyphIndex(): number {
    let strokesSoFar = 0
    for (let g = 0; g < this.glyphStrokeCounts.length; g++) {
      if (this.currentStrokeIndex < strokesSoFar + this.glyphStrokeCounts[g]) {
        return g
      }
      strokesSoFar += this.glyphStrokeCounts[g]
    }
    return this.glyphStrokeCounts.length - 1
  }

  async setupWord() {
    if (this.currentWordIndex >= this.words.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    this.word = this.words[this.currentWordIndex]
    this.pathProgress = 0
    this.currentStrokeIndex = 0
    this.cursorPicked = false
    this.isDrawing = false
    this.particles = []
    this.scrollCurrentX = 0
    this.scrollTargetX = 0

    try {
      // Load all character glyphs for the word
      this.traceString = await buildStringFromChars(this.word)

      // Resize vertically to fit field (ScrollLetterByLetter = true)
      const targetRect = { x: 0, y: 0, w: FIELD_WIDTH, h: FIELD_HEIGHT }
      this.traceString = resizeStringVertically(this.traceString, targetRect, false)

      // Convert to TracePaths in game coordinates (Y-flipped)
      this.tracePaths = stringToTracePaths(
        this.traceString,
        FIELD_HEIGHT,
        FIELD_OFFSET_X,
        GAME_HEIGHT - FIELD_OFFSET_Y_COCOS - FIELD_HEIGHT,
      )

      // Get per-glyph stroke counts for glyph tracking
      this.glyphStrokeCounts = getGlyphStrokeCounts(this.traceString)

      // Initialize stroke states
      this.strokeStates = this.tracePaths.map((_, i) => i === 0 ? 'active' : 'future')

      // Initialize scroll to first glyph (snap, no animation)
      this.updateScrollTarget()
      this.scrollCurrentX = this.scrollTargetX
      this.scrollAnimating = false  // no animation for initial position
    } catch (e) {
      console.error('Failed to load glyphs for', this.word, e)
      this.tracePaths = []
      this.strokeStates = []
      this.glyphStrokeCounts = []
    }

    this.onProgressChange?.(this.currentWordIndex + 1, this.words.length)
  }

  updateScrollTarget() {
    if (!this.traceString) return
    const glyphIdx = this.currentGlyphIndex

    // C++ TraceScrollView::scrollTheGlyphToRegion():
    //   If text fits in viewport → center the whole text
    //   Otherwise → clamp between begin/end camera positions
    const textBB = this.traceString.roughBB
    const textWidth = textBB.w

    let newTarget: number
    if (textWidth <= GAME_WIDTH) {
      // Text fits — center the whole string (no per-glyph scrolling needed)
      const textCenterX = textBB.x + textWidth / 2
      newTarget = GAME_WIDTH / 2 - textCenterX
    } else {
      // Text overflows — use C++ camera clamping
      const CURSOR_RADIUS = CURSOR_PICK_DISTANCE
      const firstGlyph = this.traceString.glyphs[0]
      const firstOffset = this.traceString.offsets[0] || { x: 0, y: 0 }
      const lastIdx = this.traceString.glyphs.length - 1
      const lastGlyph = this.traceString.glyphs[lastIdx]
      const lastOffset = this.traceString.offsets[lastIdx] || { x: 0, y: 0 }

      // C++ minPointForGlyphAt / maxPointForGlyphAt (include offset)
      const beginCameraX = firstGlyph.roughBB.x + firstOffset.x - CURSOR_RADIUS
      const endCameraX = (lastGlyph.roughBB.x + lastOffset.x + lastGlyph.roughBB.w + CURSOR_RADIUS) - GAME_WIDTH
      // CenterCamera: current glyph centered
      const glyphCenterX = getGlyphCenterX(this.traceString, glyphIdx, FIELD_OFFSET_X)
      const centerCameraX = glyphCenterX - GAME_WIDTH / 2

      // Clamp: Camera = min(max(Begin, Center), End)
      const cameraX = Math.min(Math.max(beginCameraX, centerCameraX), endCameraX)
      newTarget = -cameraX
    }

    this.scrollTargetX = newTarget
    this.scrollStartX = this.scrollCurrentX
    this.scrollElapsed = 0
    this.scrollAnimating = true
  }

  // ── Interaction ─────────────────────────────────────

  onPointerDown(x: number, y: number) {
    const path = this.tracePaths[this.currentStrokeIndex]
    if (!path) return

    // Adjust for scroll offset
    const sx = x - this.scrollCurrentX

    // C++: check distance to CURSOR position only (not any point on path)
    const cursorPt = getPointAtDistance(path, this.pathProgress)
    const dx = sx - cursorPt.x
    const dy = y - cursorPt.y
    const distToCursor = Math.sqrt(dx * dx + dy * dy)

    if (distToCursor < CURSOR_PICK_DISTANCE) {
      this.cursorPicked = true
      this.isDrawing = true
      this.startPencilLoop()
      this.advanceProgress(sx, y)
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.cursorPicked) return
    const sx = x - this.scrollCurrentX
    this.advanceProgress(sx, y)
  }

  onPointerUp(_x: number, _y: number) {
    if (this.cursorPicked) {
      this.stopPencilLoop()
      const path = this.tracePaths[this.currentStrokeIndex]
      if (path) {
        // C++ isItGoodDayToAdvanceStroke: check if remaining path distance < 700
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
    const ENERGY_PER_DEGREE = 0.5   // direction penalty
    const ENERGY_MAX_DEGREE = 20    // cap at 20 degrees
    const DISTANCE_LIMIT = 160      // max finger-to-path distance

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
      // Deduct energy for distance traveled + direction penalty (skip first point)
      if (i > startIdx) {
        const segLen = path.lengths[i] - path.lengths[i - 1]
        energy -= segLen * ENERGY_PER_DISTANCE

        // C++ direction penalty: atan2 of previous point's velocity
        const prev = path.points[i - 1]
        const cur = path.points[i]
        const dirX = cur.x - prev.x
        const dirY = cur.y - prev.y
        const thetaDeg = Math.atan2(dirY, dirX) * 180 / Math.PI
        energy -= Math.min(Math.abs(thetaDeg), ENERGY_MAX_DEGREE) * ENERGY_PER_DEGREE
      }
      if (energy < 0) break

      // Check distance from finger to this path point
      const pt = path.points[i]
      const dx = x - pt.x
      const dy = y - pt.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < bestDist) {
        bestDist = dist
        bestAlong = path.lengths[i]
      }
    }

    // Only advance forward (with small backward tolerance)
    if (bestAlong > this.pathProgress - BACKWARD_TOLERANCE) {
      this.pathProgress = Math.max(this.pathProgress, bestAlong)
    }

    // Check completion
    if (this.pathProgress >= path.totalLength * COMPLETION_RATIO) {
      this.pathProgress = path.totalLength
      this.completeCurrentStroke()
    }
  }

  completeCurrentStroke() {
    // Stop pencil loop and play trace end sound
    this.stopPencilLoop()
    playSound(this.sfxTraceEnd)

    if (this.currentStrokeIndex < this.strokeStates.length) {
      this.strokeStates[this.currentStrokeIndex] = 'done'
    }

    // Spawn particles at end of stroke
    const path = this.tracePaths[this.currentStrokeIndex]
    if (path && path.points.length > 0) {
      const endPt = path.points[path.points.length - 1]
      this.spawnParticles(endPt.x, endPt.y)
    }

    const prevGlyphIndex = this.currentGlyphIndex

    // Advance to next stroke
    this.currentStrokeIndex++
    this.pathProgress = 0
    this.cursorPicked = false

    if (this.currentStrokeIndex < this.tracePaths.length) {
      this.strokeStates[this.currentStrokeIndex] = 'active'

      // If glyph changed, update scroll target
      if (this.currentGlyphIndex !== prevGlyphIndex) {
        this.updateScrollTarget()
      }
    } else {
      // All strokes in word complete — advance to next word
      const nextIdx = this.currentWordIndex + 1
      if (nextIdx < this.words.length) {
        this.onProgressChange?.(nextIdx + 1, this.words.length)
        setTimeout(() => {
          this.currentWordIndex = nextIdx
          this.setupWord()
        }, 800)
      } else {
        this.onProgressChange?.(this.words.length, this.words.length)
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
    // Animate scroll — C++ uses 0.3s duration with pow(t, 0.3) easing
    if (this.scrollAnimating) {
      this.scrollElapsed += dt
      const t = Math.min(1, this.scrollElapsed / this.scrollDuration)
      const eased = Math.pow(t, 0.3)  // fast start, slow end
      this.scrollCurrentX = this.scrollStartX + (this.scrollTargetX - this.scrollStartX) * eased
      if (t >= 1) {
        this.scrollCurrentX = this.scrollTargetX
        this.scrollAnimating = false
      }
    }

    // Update particles
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
      ctx.fillStyle = '#2D4A3E'
      ctx.fillRect(0, 0, w, h)
    }

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw writing guide lines (not affected by scroll)
    this.drawWritingLines(gs)

    // C++ WordTrace does NOT show word label at top during tracing

    // Apply scroll offset for strokes and cursor
    ctx.save()
    ctx.translate(this.scrollCurrentX * gs, 0)

    // Draw all strokes with WordTrace style
    this.drawStrokes(gs)

    // Draw cursor
    this.drawCursor(gs)

    // Particles (in scrolled space)
    for (const p of this.particles) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x * gs, p.y * gs, p.size * gs * p.life, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    ctx.restore() // scroll

    ctx.restore() // main transform
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
      // Fallback: draw programmatic lines
      const lineX1 = (GAME_WIDTH / 2 - 800) * gs
      const lineX2 = (GAME_WIDTH / 2 + 800) * gs

      // C++ StrokeLine green for solid lines
      ctx.strokeStyle = 'rgba(179, 230, 79, 0.4)'
      ctx.lineWidth = 2 * gs
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(lineX1, TOP_LINE_Y * gs); ctx.lineTo(lineX2, TOP_LINE_Y * gs); ctx.stroke()

      // C++ MintLine blue for dashed middle line
      ctx.setLineDash([10 * gs, 5 * gs])
      ctx.strokeStyle = 'rgba(107, 185, 232, 0.3)'
      ctx.beginPath(); ctx.moveTo(lineX1, MID_LINE_Y * gs); ctx.lineTo(lineX2, MID_LINE_Y * gs); ctx.stroke()

      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(179, 230, 79, 0.4)'
      ctx.beginPath(); ctx.moveTo(lineX1, BOT_LINE_Y * gs); ctx.lineTo(lineX2, BOT_LINE_Y * gs); ctx.stroke()
      ctx.setLineDash([])
    }
  }

  drawWordDisplay(gs: number) {
    const { ctx } = this
    if (!this.word) return

    const currentGlyph = this.currentGlyphIndex

    ctx.font = `bold ${60 * gs}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const charWidth = 80
    const totalW = this.word.length * charWidth
    const startX = (GAME_WIDTH - totalW) / 2 + charWidth / 2

    for (let i = 0; i < this.word.length; i++) {
      if (i < currentGlyph) {
        // Completed letters — green
        ctx.fillStyle = '#4CAF50'
      } else if (i === currentGlyph && this.currentStrokeIndex < this.tracePaths.length) {
        // Active letter — C++ MintLine color (107, 185, 232)
        ctx.fillStyle = 'rgb(107, 185, 232)'
      } else {
        // Pending letters — light on dark blackboard
        ctx.fillStyle = 'rgba(255, 249, 237, 0.3)'
      }
      ctx.fillText(this.word[i], (startX + i * charWidth) * gs, 120 * gs)
    }
  }

  drawStrokes(gs: number) {
    const { ctx } = this
    // C++ WordTrace style:
    //   PassiveGuide/ActiveGuide: 80px rgba(255,249,237,0.9) warm white
    //   PassiveStroke/ActiveStroke: 80px rgba(179,230,79,0.9) green
    //   ActiveGuide highlight: 10px rgba(107,185,232,1) blue
    const GUIDE_THICKNESS = 80
    const STROKE_THICKNESS = 80
    const HIGHLIGHT_THICKNESS = 10

    for (let i = 0; i < this.tracePaths.length; i++) {
      const path = this.tracePaths[i]
      const state = this.strokeStates[i]

      if (state === 'done') {
        // PassiveStroke: green (traced path)
        drawFullPath(ctx, path, { thickness: STROKE_THICKNESS, color: 'rgba(179, 230, 79, 0.9)' }, gs)
      } else if (state === 'active') {
        // ActiveGuide: warm white (full path)
        drawFullPath(ctx, path, { thickness: GUIDE_THICKNESS, color: 'rgba(255, 249, 237, 0.9)' }, gs)
        // ActiveGuide highlight: blue (full path, thin)
        drawFullPath(ctx, path, { thickness: HIGHLIGHT_THICKNESS, color: 'rgba(107, 185, 232, 1)' }, gs)

        // ActiveStroke: green (traced portion)
        if (this.pathProgress > 0) {
          drawPathUpToDistance(ctx, path, this.pathProgress, { thickness: STROKE_THICKNESS, color: 'rgba(179, 230, 79, 0.9)' }, gs)
        }
      } else {
        // Future: PassiveGuide warm white
        drawFullPath(ctx, path, { thickness: GUIDE_THICKNESS, color: 'rgba(255, 249, 237, 0.9)' }, gs)
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
