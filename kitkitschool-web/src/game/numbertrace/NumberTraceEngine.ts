/**
 * NumberTraceEngine — Number tracing with animated insect counting.
 *
 * Matches C++ NumberTraceScene behavior:
 *   - LEFT half: CountField with animated insects
 *   - RIGHT half: TraceField for number tracing (CatmullRom path-based)
 *   - Flow: insects fly in → user traces the count number → user taps insects → next
 *
 * C++ layout:
 *   - CountField: contentSize=(1280, ~1800), position=(0,0), anchor=BOTTOM_LEFT
 *   - TraceField: contentSize=(1280, 1800), position=(1280,0), anchor=BOTTOM_LEFT
 *   - EnableDefaultBackground = true, tracefield_background.png (1218x1616)
 *   - Cursor: TraceField_Cursor2.png, scale 1.75 normal / 2.1 picked
 */

import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'
import type { TracePath, TraceString } from '../common/TraceFieldUtils'
import {
  loadGlyphJSON, measureCharBB, glyphFromKnots,
  buildStringFromChars,
  resizeString,
  stringToTracePaths,
  getPointAtDistance, getAngleAtDistance,
  drawPathUpToDistance, drawFullPath,
  CURSOR_PICK_DISTANCE, BACKWARD_TOLERANCE, COMPLETION_RATIO, STROKE_SKIP_DISTANCE,
} from '../common/TraceFieldUtils'

// ── TraceField layout (right half) ──────────────────────
const FIELD_WIDTH = GAME_WIDTH / 2     // 1280
const FIELD_HEIGHT = GAME_HEIGHT       // 1800
const FIELD_OFFSET_X = GAME_WIDTH / 2  // 1280
const FIELD_OFFSET_Y_COCOS = 0

// Default background: 1218x1616 image, centered in field
// PointBound uses Size(1218,980) with MLT padding
const BG_WIDTH = 1218
const BG_HEIGHT = 980
const BG_IMG_HEIGHT = 1616
const MAIN_LINE_THICKNESS = 144
const BG_ORIGIN_X = (FIELD_WIDTH - BG_WIDTH) / 2    // 31
const BG_ORIGIN_Y = (FIELD_HEIGHT - BG_HEIGHT) / 2  // 410
const POINT_BOUND = {
  x: BG_ORIGIN_X + MAIN_LINE_THICKNESS / 2,   // 103
  y: BG_ORIGIN_Y + MAIN_LINE_THICKNESS / 2,   // 482
  w: BG_WIDTH - MAIN_LINE_THICKNESS,           // 1074
  h: BG_HEIGHT - MAIN_LINE_THICKNESS,          // 836
}

// C++ cursor: TraceField_Cursor2.png, cursorScaleNormal=1.75, cursorScalePicked=2.1
const CURSOR_SCALE_NORMAL = 1.75
const CURSOR_SCALE_PICKED = 2.1

// ── CountField (left half) ──────────────────────────────
const COUNT_FIELD_WIDTH = GAME_WIDTH / 2   // 1280
const COUNT_FIELD_HEIGHT = GAME_HEIGHT     // 1800

// C++ insect sprite configurations
// { folder name, file prefix, rest frame count, walk frame count }
const INSECT_CONFIG: Record<string, {
  folder: string; prefix: string;
  normalFrames: number; outFrames: number;
  defaultScale: number
}> = {
  Ant:             { folder: 'ant',             prefix: 'ant',        normalFrames: 32, outFrames: 13, defaultScale: 0.75 },
  Bee:             { folder: 'bee',             prefix: 'bee',        normalFrames: 19, outFrames: 2,  defaultScale: 1.0  },
  Beetle:          { folder: 'beetle',          prefix: 'beetle',     normalFrames: 35, outFrames: 16, defaultScale: 0.75 },
  BlueButterfly:   { folder: 'blue_butterfly',  prefix: 'bf2',        normalFrames: 60, outFrames: 18, defaultScale: 0.65 },
  Cockroach:       { folder: 'cockroach',       prefix: 'cockroach',  normalFrames: 37, outFrames: 9,  defaultScale: 0.70 },
  Ladybug:         { folder: 'ladybug',         prefix: 'ladybug',    normalFrames: 50, outFrames: 13, defaultScale: 0.75 },
  Moth:            { folder: 'moth',            prefix: 'moth',       normalFrames: 69, outFrames: 30, defaultScale: 0.55 },
  Spider:          { folder: 'spider',          prefix: 'spider',     normalFrames: 16, outFrames: 13, defaultScale: 0.80 },
  StagBeetle:      { folder: 'stag_beetle',     prefix: 'sb',         normalFrames: 36, outFrames: 13, defaultScale: 0.70 },
  YellowButterfly: { folder: 'yellow_butterfly', prefix: 'bf',        normalFrames: 59, outFrames: 19, defaultScale: 0.60 },
}

// ── Types ───────────────────────────────────────────────

interface CountInsect {
  x: number; y: number      // rest (target) position
  rotation: number          // canvas rotation in radians at rest
  scale: number
  collected: boolean
  fadeAlpha: number
  moveInDelay: number       // stagger entrance delay (seconds)
  moveInProgress: number    // 0→1 move-in animation progress
  // Pre-computed start position for move-in (fixed per insect)
  startX: number; startY: number
  // Bezier midpoint for curved path
  midX: number; midY: number
  // Touch response animation
  walkOutProgress: number
  walkOutTargetX: number
  walkOutTargetY: number
  isMoving: boolean         // true during move-in / move-out → use walk frames
}

interface Problem {
  assetType: string
  count: number
}

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; color: string; size: number
}

type GamePhase = 'counting_in' | 'tracing' | 'collecting' | 'transition'

// ═════════════════════════════════════════════════════════

export class NumberTraceEngine extends BaseEngine {
  level: number
  problems: Problem[] = []
  currentProblemIndex = 0

  // Images
  bgImage: HTMLImageElement
  panelImage: HTMLImageElement
  cursorImage: HTMLImageElement
  numberSound: HTMLAudioElement | null = null

  // CountField — insect sprites (rest = _normal_, walk = _out_)
  restFrames: HTMLImageElement[] = []   // idle animation (_normal_)
  walkFrames: HTMLImageElement[] = []   // movement animation (_out_)
  restFrameIndex = 0
  walkFrameIndex = 0
  frameTimer = 0
  insects: CountInsect[] = []

  // TraceField state
  traceString: TraceString | null = null
  tracePaths: TracePath[] = []
  currentStrokeIndex = 0
  pathProgress = 0
  cursorPicked = false
  isDrawing = false
  strokeStates: ('future' | 'active' | 'done')[] = []

  // Game flow
  phase: GamePhase = 'counting_in'
  phaseTimer = 0

  // Sound effects
  traceEndSound: HTMLAudioElement | null = null
  insectTouchSound: HTMLAudioElement | null = null
  sfxPencilLoop: HTMLAudioElement | null = null
  pencilLoopPlaying = false

  // Effects
  particles: Particle[] = []

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(assetUrl('/assets/games/numbertrace/trace_background.png'))
    this.panelImage = loadImage(assetUrl('/assets/games/numbertrace/tracefield_panel.png'))
    this.cursorImage = loadImage(assetUrl('/assets/games/numbertrace/tracefield_cursor2.png'))
    this.traceEndSound = loadAudio(assetUrl('/assets/games/numbertrace/sounds/trace_end.m4a'))
    this.insectTouchSound = loadAudio(assetUrl('/assets/games/numbertrace/sounds/insect_touch.m4a'))
    this.sfxPencilLoop = loadAudio(assetUrl('/assets/games/tutorialtrace/scratchfield/sounds/sfx_pencilloop.m4a'))
    this.sfxPencilLoop.loop = true
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
      const resp = await fetch('/data/games/numbertrace.json')
      const data = await resp.json()
      this.problems = data.levels[String(this.level)] || [{ assetType: 'Ant', count: 1 }]
    } catch {
      this.problems = [{ assetType: 'Ant', count: 1 }]
    }
    this.currentProblemIndex = 0
    this.onProgressChange?.(0, this.problems.length)
    await this.setupProblem()
  }

  // ── Problem Setup ─────────────────────────────────────

  async setupProblem() {
    const problem = this.problems[this.currentProblemIndex]
    if (!problem) return

    // Reset trace state
    this.pathProgress = 0
    this.currentStrokeIndex = 0
    this.cursorPicked = false
    this.isDrawing = false
    this.particles = []
    this.phase = 'counting_in'
    this.phaseTimer = 0

    // Load insect frames for this problem's asset type
    await this.loadInsectFrames(problem.assetType)

    // Position insects in left half
    this.positionInsects(problem.count, problem.assetType)

    // Load glyph(s) for the number to trace
    // C++ TraceText = String(AssetCount), e.g. "10" → two glyphs "1"+"0"
    const traceText = String(problem.count)
    try {
      if (traceText.length === 1) {
        // Single digit: load directly
        const knots = await loadGlyphJSON(traceText)
        const bb = measureCharBB(traceText)
        const glyph = glyphFromKnots(knots, bb)
        this.traceString = {
          glyphs: [glyph],
          offsets: [{ x: 0, y: 0 }],
          roughBB: glyph.roughBB,
          tightBB: glyph.tightBB,
        }
      } else {
        // Multi-digit (e.g. "10"): use buildStringFromChars
        this.traceString = await buildStringFromChars(traceText)
      }
      // Resize to PointBound (useTightBB=true — C++ EnableDefaultBackground)
      this.traceString = resizeString(this.traceString, POINT_BOUND, true)
      // Convert to game-coord TracePaths (Y-flip)
      this.tracePaths = stringToTracePaths(
        this.traceString,
        FIELD_HEIGHT,
        FIELD_OFFSET_X,
        GAME_HEIGHT - FIELD_OFFSET_Y_COCOS - FIELD_HEIGHT,
      )
      // Multi-digit: shift glyphs to bring them closer together
      if (traceText.length > 1 && this.traceString) {
        const glyphStrokeCounts = this.traceString.glyphs.map(g =>
          g.strokes.filter(s => s.samplePoints.length >= 2).length)
        const shifts = [80, -100]  // "1" right 80px, "0" left 100px
        let pathIdx = 0
        for (let gi = 0; gi < glyphStrokeCounts.length; gi++) {
          const shift = shifts[gi] ?? 0
          for (let si = 0; si < glyphStrokeCounts[gi]; si++) {
            if (pathIdx < this.tracePaths.length) {
              for (const pt of this.tracePaths[pathIdx].points) {
                pt.x += shift
              }
              pathIdx++
            }
          }
        }
      }
      this.strokeStates = this.tracePaths.map((_, i) => i === 0 ? 'active' : 'future')
    } catch (e) {
      console.error('Failed to load glyph for', traceText, e)
      this.tracePaths = []
      this.strokeStates = []
    }

    // Play number sound
    this.playNumberSound(problem.count)
  }

  async loadInsectFrames(assetType: string) {
    const config = INSECT_CONFIG[assetType]
    if (!config) return

    this.restFrames = []
    this.walkFrames = []
    this.restFrameIndex = 0
    this.walkFrameIndex = 0
    this.frameTimer = 0

    const loadFrames = async (suffix: string, total: number, maxLoad: number) => {
      const step = total <= maxLoad ? 1 : Math.ceil(total / maxLoad)
      const promises: Promise<HTMLImageElement>[] = []
      for (let i = 1; i <= total; i += step) {
        const num = String(i).padStart(4, '0')
        const path = assetUrl(`/assets/games/numbertrace/objects/${config.folder}/${config.prefix}_${suffix}_${num}.png`)
        promises.push(new Promise<HTMLImageElement>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => resolve(img)
          img.src = path
        }))
      }
      const results = await Promise.all(promises)
      return results.filter(img => imgOk(img) && img.naturalWidth > 0)
    }

    // Load rest (idle) frames — _normal_ prefix
    // Load walk (movement) frames — _out_ prefix
    const [rest, walk] = await Promise.all([
      loadFrames('normal', config.normalFrames, 16),
      loadFrames('out', config.outFrames, 12),
    ])
    this.restFrames = rest
    this.walkFrames = walk
  }

  positionInsects(count: number, assetType: string) {
    // C++ CountField: random positions, collision avoidance, staggered entrance
    const config = INSECT_CONFIG[assetType]
    const baseScale = config ? config.defaultScale : 0.75
    this.insects = []

    // Scale down if many insects (C++ behavior)
    let scale = baseScale
    if (count > 6) scale = baseScale * 0.8
    if (count > 8) scale = baseScale * 0.65

    const margin = 180
    const minDist = 180

    for (let i = 0; i < count; i++) {
      let x = 0, y = 0
      let placed = false
      for (let attempt = 0; attempt < 60; attempt++) {
        x = margin + Math.random() * (COUNT_FIELD_WIDTH - margin * 2)
        y = margin + Math.random() * (COUNT_FIELD_HEIGHT - margin * 2)
        const ok = this.insects.every(ins => {
          const dx = ins.x - x
          const dy = ins.y - y
          return Math.sqrt(dx * dx + dy * dy) >= minDist
        })
        if (ok) { placed = true; break }
      }
      if (!placed) {
        x = margin + Math.random() * (COUNT_FIELD_WIDTH - margin * 2)
        y = margin + Math.random() * (COUNT_FIELD_HEIGHT - margin * 2)
      }

      // C++ rotation:
      //   Pose.Rotation = RestRotation(2π/3) ± 35° noise
      //   Sprite.setRotation(90 - RAD_TO_DEG(Pose.Rotation))
      //   Rest: 90 - (120 ± 35) = -30 ∓ 35° in Cocos2D = small tilt
      // Canvas: convert Cocos degrees (CW) to canvas radians (CW)
      const poseRotation = (2 * Math.PI / 3) + (Math.random() - 0.5) * (35 * Math.PI / 180) * 2
      const cocosAngleDeg = 90 - (poseRotation * 180 / Math.PI)
      const canvasAngle = cocosAngleDeg * Math.PI / 180

      // C++ BeginPoses: origin (W, -H) in Cocos Y-up → (right, top) in screen Y-down
      const startX = COUNT_FIELD_WIDTH + 100 + Math.random() * 300
      const startY = -100 - Math.random() * 300
      // Bezier midpoint for curved arc path (C++ CircleAndStraight approximation)
      const midX = (startX + x) / 2 + (Math.random() - 0.5) * 400
      const midY = (startY + y) / 2 + (Math.random() - 0.5) * 400

      // Walk-out target: C++ EndPoses origin (-W, H) → (left, bottom) in screen
      const outX = -100 - Math.random() * 300
      const outY = COUNT_FIELD_HEIGHT + 100 + Math.random() * 300

      this.insects.push({
        x, y,
        rotation: canvasAngle,
        scale,
        collected: false,
        fadeAlpha: 0,
        moveInDelay: i * 0.3 + Math.random() * 0.5,
        moveInProgress: 0,
        startX, startY,
        midX, midY,
        walkOutProgress: 0,
        walkOutTargetX: outX,
        walkOutTargetY: outY,
        isMoving: true,  // starts as moving (walk-in)
      })
    }
  }

  playNumberSound(count: number) {
    if (count >= 1 && count <= 10) {
      const numIdx = String(count).padStart(2, '0')
      this.numberSound = loadAudio(assetUrl(`/assets/games/numbertrace/sounds/num_${numIdx}.wav`))
      setTimeout(() => {
        if (this.numberSound) playSound(this.numberSound, 0.5)
      }, 500)
    }
  }

  // ── Interaction ───────────────────────────────────────

  onPointerDown(x: number, y: number) {
    if (this.phase === 'tracing') {
      const path = this.tracePaths[this.currentStrokeIndex]
      if (!path) return

      // C++: check distance to CURSOR position only
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
    } else if (this.phase === 'collecting') {
      this.tryCollectInsect(x, y)
    }
  }

  onPointerMove(x: number, y: number) {
    if (this.phase === 'tracing' && this.cursorPicked) {
      this.advanceProgress(x, y)
    }
  }

  onPointerUp(_x: number, _y: number) {
    if (this.phase === 'tracing' && this.cursorPicked) {
      this.stopPencilLoop()
      const path = this.tracePaths[this.currentStrokeIndex]
      if (path) {
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

    const ENERGY_LIMIT = 500
    const ENERGY_PER_DISTANCE = 0.8
    const ENERGY_PER_DEGREE = 0.5
    const ENERGY_MAX_DEGREE = 20
    const DISTANCE_LIMIT = 160

    let startIdx = 0
    for (let i = 0; i < path.lengths.length; i++) {
      if (path.lengths[i] >= this.pathProgress) {
        startIdx = i
        break
      }
      startIdx = i
    }

    let energy = ENERGY_LIMIT
    let bestDist = DISTANCE_LIMIT
    let bestAlong = this.pathProgress

    for (let i = startIdx; i < path.points.length; i++) {
      if (i > startIdx) {
        const segLen = path.lengths[i] - path.lengths[i - 1]
        energy -= segLen * ENERGY_PER_DISTANCE

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

  tryCollectInsect(x: number, y: number) {
    const touchRange = 150
    let closest: CountInsect | null = null
    let closestDist = Infinity

    for (const ins of this.insects) {
      if (ins.collected) continue
      const dx = ins.x - x
      const dy = ins.y - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < touchRange && dist < closestDist) {
        closest = ins
        closestDist = dist
      }
    }

    if (closest) {
      closest.collected = true
      closest.walkOutProgress = 0
      closest.isMoving = true  // switch to walk sprite for move-out

      // C++ soundForGoodAssetTouch = Cards_2.m4a
      if (this.insectTouchSound) {
        try { playSound(this.insectTouchSound, 0.5) } catch { /* ignore */ }
      }

      // Check if all collected → transition after walkout animation
      const allCollected = this.insects.every(ins => ins.collected)
      if (allCollected) {
        setTimeout(() => {
          this.phase = 'transition'
          this.phaseTimer = 0
        }, 1500)  // wait for walk-out animation
      }
    }
  }

  completeCurrentStroke() {
    this.stopPencilLoop()

    if (this.currentStrokeIndex < this.strokeStates.length) {
      this.strokeStates[this.currentStrokeIndex] = 'done'
    }

    const path = this.tracePaths[this.currentStrokeIndex]
    if (path && path.points.length > 0) {
      const endPt = path.points[path.points.length - 1]
      this.spawnParticles(endPt.x, endPt.y)
    }

    this.currentStrokeIndex++
    this.pathProgress = 0
    this.cursorPicked = false

    if (this.currentStrokeIndex < this.tracePaths.length) {
      this.strokeStates[this.currentStrokeIndex] = 'active'
    } else {
      // All strokes complete — play trace end sound, enter collecting phase
      // C++ soundForTraceEnd = Cards_1.m4a
      if (this.traceEndSound) {
        try { playSound(this.traceEndSound, 0.5) } catch { /* ignore */ }
      }
      this.phase = 'collecting'
    }
  }

  startPencilLoop() {
    if (!this.pencilLoopPlaying && this.sfxPencilLoop) {
      this.sfxPencilLoop.volume = 0.4
      this.sfxPencilLoop.currentTime = 0
      this.sfxPencilLoop.play().catch(() => {})
      this.pencilLoopPlaying = true
    }
  }

  stopPencilLoop() {
    if (this.pencilLoopPlaying && this.sfxPencilLoop) {
      this.sfxPencilLoop.pause()
      this.sfxPencilLoop.currentTime = 0
      this.pencilLoopPlaying = false
    }
  }

  spawnParticles(gx: number, gy: number) {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
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

  // ── Update ────────────────────────────────────────────

  update(_time: number, dt: number) {
    // Animate insect frames — C++ uses 30fps
    this.frameTimer += dt
    if (this.frameTimer >= 1 / 15) {
      this.frameTimer -= 1 / 15
      if (this.restFrames.length > 1)
        this.restFrameIndex = (this.restFrameIndex + 1) % this.restFrames.length
      if (this.walkFrames.length > 1)
        this.walkFrameIndex = (this.walkFrameIndex + 1) % this.walkFrames.length
    }

    this.phaseTimer += dt

    // Phase: counting_in — insects fly in along curved paths
    if (this.phase === 'counting_in') {
      let allIn = true
      for (const ins of this.insects) {
        const t = this.phaseTimer - ins.moveInDelay
        if (t <= 0) {
          allIn = false
          continue
        }
        const prevProgress = ins.moveInProgress
        ins.moveInProgress = Math.min(1, t / 2.0)  // 2s move-in (C++ ~2-2.75s)
        ins.fadeAlpha = Math.min(1, t / 0.5)        // 0.5s fade-in
        if (ins.moveInProgress < 1) {
          allIn = false
          ins.isMoving = true
        } else if (prevProgress < 1) {
          // Just reached rest → switch to rest sprite (C++ rest())
          ins.isMoving = false
        }
      }
      if (allIn && this.phaseTimer > 3.0) {
        this.phase = 'tracing'
      }
    }

    // Walk-out + fade collected insects (C++ moveOut: 2s move + 0.5s fade)
    for (const ins of this.insects) {
      if (ins.collected) {
        ins.isMoving = true  // show walk sprite during move-out
        ins.walkOutProgress = Math.min(1, ins.walkOutProgress + dt * 0.5)  // ~2s
        // Fade starts after walkOut is 75% done (C++: delayed fade)
        if (ins.walkOutProgress > 0.75) {
          ins.fadeAlpha = Math.max(0, ins.fadeAlpha - dt * 4)
        }
      }
    }

    // Phase: transition → next problem
    if (this.phase === 'transition') {
      if (this.phaseTimer > 0.8) {
        const nextIdx = this.currentProblemIndex + 1
        if (nextIdx < this.problems.length) {
          this.onProgressChange?.(nextIdx, this.problems.length)
          this.currentProblemIndex = nextIdx
          this.setupProblem()
        } else {
          this.onProgressChange?.(this.problems.length, this.problems.length)
          this.gameState = 'complete'
          this.onComplete?.()
        }
      }
    }

    // Particles physics
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 400 * dt
      p.life -= dt * 0.8
    }
    this.particles = this.particles.filter(p => p.life > 0)
  }

  // ── Drawing ───────────────────────────────────────────

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Scene background
    if (imgOk(this.bgImage)) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      ctx.fillStyle = '#5D3A1A'
      ctx.fillRect(0, 0, w, h)
    }

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw right-half TraceField panel background
    this.drawTraceFieldPanel(gs)

    // Draw insects on left half
    this.drawInsects(gs)

    // Draw trace strokes on right half
    this.drawStrokes(gs)

    // Draw cursor (only during tracing phase)
    if (this.phase === 'tracing') {
      this.drawCursor(gs)
    }

    // Collecting-phase hint: pulsing "Tap!" label on the left side
    // so users know to tap the insects even when no audio cues are available
    if (this.phase === 'collecting') {
      const remaining = this.insects.filter(ins => !ins.collected).length
      if (remaining > 0) {
        const now = performance.now() / 1000
        const alpha = 0.65 + 0.35 * Math.sin(now * 3)
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.font = `bold ${Math.round(52 * gs)}px TodoMainCurly, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = '#FFD700'
        ctx.strokeStyle = '#7A4400'
        ctx.lineWidth = 4 * gs
        const hintX = (COUNT_FIELD_WIDTH / 2) * gs
        const hintY = 120 * gs
        ctx.strokeText(`Tap! (${remaining})`, hintX, hintY)
        ctx.fillText(`Tap! (${remaining})`, hintX, hintY)
        ctx.restore()
      }
    }

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

    // No further UI overlays

    ctx.restore()
  }

  drawTraceFieldPanel(gs: number) {
    // C++ default TraceField background: tracefield_background.png (1218x1616)
    // Centered in TraceField (contentSize 1280x1800)
    const { ctx } = this
    if (imgOk(this.panelImage) && this.panelImage.naturalWidth > 0) {
      const imgW = BG_WIDTH
      const imgH = BG_IMG_HEIGHT
      // Panel center in game coords (right half)
      const centerX = FIELD_OFFSET_X + FIELD_WIDTH / 2
      const centerY = GAME_HEIGHT / 2
      ctx.drawImage(
        this.panelImage,
        (centerX - imgW / 2) * gs,
        (centerY - imgH / 2) * gs,
        imgW * gs,
        imgH * gs,
      )
    }
  }

  /** Fallback: draw a bug-emoji circle when insect sprite images are missing */
  drawInsectFallback(ins: CountInsect, drawX: number, drawY: number, gs: number) {
    const { ctx } = this
    const r = 60 * ins.scale * gs
    ctx.save()
    ctx.globalAlpha = ins.fadeAlpha
    ctx.translate(drawX * gs, drawY * gs)
    // Outer circle (body)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = ins.collected ? '#AAD4F5' : '#88C057'
    ctx.fill()
    ctx.strokeStyle = '#5A8A2A'
    ctx.lineWidth = 3 * gs
    ctx.stroke()
    // Draw a simple insect body (two dots for eyes)
    ctx.fillStyle = '#2A4A10'
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(r * 0.25, -r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  drawInsects(gs: number) {
    const { ctx } = this
    const noSprites = this.restFrames.length === 0 && this.walkFrames.length === 0

    for (const ins of this.insects) {
      if (ins.fadeAlpha <= 0) continue

      // Compute draw position based on animation state (used for both sprites and fallback)
      let drawX = ins.x
      let drawY = ins.y

      if (ins.moveInProgress < 1 && ins.moveInProgress > 0) {
        const t = ins.moveInProgress
        const et = 1 - Math.pow(1 - t, 2.5)
        const u = 1 - et
        drawX = u * u * ins.startX + 2 * u * et * ins.midX + et * et * ins.x
        drawY = u * u * ins.startY + 2 * u * et * ins.midY + et * et * ins.y
      } else if (ins.collected && ins.walkOutProgress > 0) {
        const t = ins.walkOutProgress
        const et = t * t
        drawX = ins.x + (ins.walkOutTargetX - ins.x) * et
        drawY = ins.y + (ins.walkOutTargetY - ins.y) * et
      }

      // If no sprites loaded, use fallback circle drawing
      if (noSprites) {
        this.drawInsectFallback(ins, drawX, drawY, gs)
        continue
      }

      // Select correct frame set: walk frames during movement, rest frames when idle
      const frames = ins.isMoving ? this.walkFrames : this.restFrames
      const frameIdx = ins.isMoving ? this.walkFrameIndex : this.restFrameIndex
      if (frames.length === 0) { this.drawInsectFallback(ins, drawX, drawY, gs); continue }
      const frame = frames[frameIdx % frames.length]
      if (!frame || !imgOk(frame) || frame.naturalWidth === 0) { this.drawInsectFallback(ins, drawX, drawY, gs); continue }

      ctx.save()
      ctx.globalAlpha = ins.fadeAlpha

      // Compute sprite rotation (position already computed above)
      let drawRotation = ins.rotation
      if (ins.moveInProgress < 1 && ins.moveInProgress > 0) {
        const t = ins.moveInProgress
        const et = 1 - Math.pow(1 - t, 2.5)
        const u = 1 - et
        const tx = 2 * u * (ins.midX - ins.startX) + 2 * et * (ins.x - ins.midX)
        const ty = 2 * u * (ins.midY - ins.startY) + 2 * et * (ins.y - ins.midY)
        drawRotation = Math.atan2(ty, tx) - Math.PI / 2
      } else if (ins.collected && ins.walkOutProgress > 0) {
        const dx = ins.walkOutTargetX - ins.x
        const dy = ins.walkOutTargetY - ins.y
        drawRotation = Math.atan2(dy, dx) - Math.PI / 2
      }

      ctx.translate(drawX * gs, drawY * gs)
      ctx.rotate(drawRotation)

      const drawScale = ins.scale
      const imgW = frame.naturalWidth * drawScale * gs
      const imgH = frame.naturalHeight * drawScale * gs

      ctx.drawImage(frame, -imgW / 2, -imgH / 2, imgW, imgH)

      ctx.restore()
    }
  }

  drawStrokes(gs: number) {
    const { ctx } = this

    for (let i = 0; i < this.tracePaths.length; i++) {
      const path = this.tracePaths[i]
      const state = this.strokeStates[i]

      if (state === 'done') {
        // PassiveStroke(247,244,242) cream + PassiveGuide(125,63,34) brown center
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.62, color: 'rgb(247, 244, 242)' }, gs)
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.08, color: 'rgb(125, 63, 34)' }, gs)
      } else if (state === 'active') {
        // Guide: full path in cream + thin brown outline
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.62, color: 'rgba(247, 244, 242, 0.4)' }, gs)
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.08, color: 'rgba(161, 90, 50, 0.6)' }, gs)

        // Traced portion: ActiveStroke(247,244,242) + ActiveGuide(161,90,50)
        if (this.pathProgress > 0) {
          drawPathUpToDistance(ctx, path, this.pathProgress, { thickness: MAIN_LINE_THICKNESS * 0.62, color: 'rgb(247, 244, 242)' }, gs)
          drawPathUpToDistance(ctx, path, this.pathProgress, { thickness: MAIN_LINE_THICKNESS * 0.08, color: 'rgb(161, 90, 50)' }, gs)
        }
      } else {
        // Future: faint cream guide
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.62, color: 'rgba(247, 244, 242, 0.2)' }, gs)
        drawFullPath(ctx, path, { thickness: MAIN_LINE_THICKNESS * 0.08, color: 'rgba(125, 63, 34, 0.3)' }, gs)
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
      // Fallback: draw a pencil-like circle cursor so users know where to trace
      const r = (this.cursorPicked ? 56 : 46) * gs
      ctx.save()
      ctx.translate(cx, cy)
      // Outer glow ring
      ctx.beginPath()
      ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 220, 80, 0.25)'
      ctx.fill()
      // Main cursor circle
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = this.cursorPicked ? '#FF9800' : '#FFD700'
      ctx.fill()
      ctx.strokeStyle = '#B26800'
      ctx.lineWidth = 4 * gs
      ctx.stroke()
      // Inner dot
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = '#7A4400'
      ctx.fill()
      ctx.restore()
    }
  }
}
