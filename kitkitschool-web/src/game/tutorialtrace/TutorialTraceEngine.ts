import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'
import type { TracePath } from '../common/TraceFieldUtils'
import {
  getPointAtDistance, closestDistOnPath, distToPath, getAngleAtDistance,
  CURSOR_PICK_DISTANCE, BACKWARD_TOLERANCE, COMPLETION_RATIO,
} from '../common/TraceFieldUtils'

/**
 * TutorialTraceEngine – Scratch-reveal tracing game.
 *
 * C++ ScratchField mechanic:
 *   - Each stroke has a top image (brown guide) and bottom image (colored reveal)
 *   - User traces along the JSON path; top layer is "scratched off" to reveal bottom
 *   - 3-layer system: bottom image → mask (erased by tracing) → top image
 *
 * Web implementation:
 *   - Offscreen canvas per active stroke for scratch compositing
 *   - Bottom image drawn first, then top image with traced portion erased via 'destination-out'
 */

const ASSET_BASE = assetUrl('/assets/games/tutorialtrace')

// C++ constants
const TRACE_THICKNESS = 144    // C++ TSAlphabetThickness

interface StrokeConfig {
  x: number
  y: number
  top: string
  bottom: string
}

interface ProblemConfig {
  problem: number
  strokeFile: string
  strokes: StrokeConfig[]
}

interface ProblemsData {
  levels: Record<string, number[]>
  problems: ProblemConfig[]
}

interface StrokeState {
  config: StrokeConfig
  topImg: HTMLImageElement
  bottomImg: HTMLImageElement
  state: 'future' | 'active' | 'done'
}

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; color: string; size: number
}

// C++ cursor scale constants: cursorScaleNormal = 1.10 * (118/130), cursorScalePicked = 1.25 * (118/130)
const CURSOR_SCALE_NORMAL = 1.10 * (118 / 130)   // ≈ 1.0
const CURSOR_SCALE_PICKED = 1.25 * (118 / 130)   // ≈ 1.13

export class TutorialTraceEngine extends BaseEngine {
  level: number
  problemIds: number[] = []
  allProblems: ProblemConfig[] = []
  currentProblemIndex = 0

  bgImage: HTMLImageElement | null = null
  cursorImg: HTMLImageElement | null = null
  strokeStates: StrokeState[] = []
  tracePaths: TracePath[] = []
  currentPathIndex = 0
  pathProgress = 0

  isDrawing = false
  particles: Particle[] = []

  // Offscreen canvas for scratch-reveal compositing
  private scratchCanvas: HTMLCanvasElement | null = null
  private scratchCtx: CanvasRenderingContext2D | null = null

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    // Load cursor sprite once
    this.cursorImg = loadImage(`${ASSET_BASE}/scratchfield_cursor.png`)
  }

  async start() {
    super.start()
    await this.loadProblems()
  }

  async loadProblems() {
    const resp = await fetch('/data/games/tutorialtrace_problems.json')
    const data: ProblemsData = await resp.json()

    const levelKey = String(this.level)
    this.problemIds = data.levels[levelKey] || data.levels['1']
    this.allProblems = this.problemIds.map(id =>
      data.problems.find(p => p.problem === id)!
    ).filter(Boolean)

    this.currentProblemIndex = 0
    await this.setupProblem()
  }

  async setupProblem() {
    if (this.currentProblemIndex >= this.allProblems.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    const problem = this.allProblems[this.currentProblemIndex]
    const problemId = problem.problem

    // Load background
    this.bgImage = loadImage(`${ASSET_BASE}/images/${problemId}/tutorialtracing${problemId}_background.png`)

    // Load stroke JSON paths
    const pathResp = await fetch(`${ASSET_BASE}/${problem.strokeFile}`)
    const pathData: Array<{ x: number; y: number; type: string }> = await pathResp.json()

    // Parse paths: split by Separators, convert coordinates
    this.tracePaths = this.parsePaths(pathData)

    // Create stroke states — C++ uses identity mapping: path[i] → stroke[i]
    this.strokeStates = problem.strokes.map((cfg) => ({
      config: cfg,
      topImg: loadImage(`${ASSET_BASE}/${cfg.top}`),
      bottomImg: loadImage(`${ASSET_BASE}/${cfg.bottom}`),
      state: 'future' as const,
    }))

    // Activate first stroke
    if (this.strokeStates.length > 0) {
      this.strokeStates[0].state = 'active'
    }

    this.currentPathIndex = 0
    this.pathProgress = 0
    this.isDrawing = false
    this.particles = []

    this.onProgressChange?.(this.currentProblemIndex + 1, this.allProblems.length)
  }

  parsePaths(data: Array<{ x: number; y: number; type: string }>): TracePath[] {
    const paths: TracePath[] = []
    let currentKnots: { x: number; y: number }[] = []

    for (const entry of data) {
      if (entry.type === 'Separator') {
        if (currentKnots.length > 0) {
          paths.push(this.buildPathFromKnots(currentKnots))
          currentKnots = []
        }
      } else if (entry.type === 'Point') {
        // Convert from C++ centered coords to game coords
        // C++ JSON: (0,0) = center, Y-up
        // Game: (0,0) = top-left, Y-down
        currentKnots.push({
          x: entry.x + GAME_WIDTH / 2,
          y: -entry.y + GAME_HEIGHT / 2,
        })
      }
    }
    if (currentKnots.length > 0) {
      paths.push(this.buildPathFromKnots(currentKnots))
    }

    return paths
  }

  /**
   * Build a TracePath from raw JSON knot points.
   * C++ CatmullRom spline: uses 4-point sliding window [PA, PB, PC, PD],
   * generating curve between PB and PC. The first and last knot points
   * are tangent controls only — the actual curve runs from point[1] to point[N-2].
   */
  buildPathFromKnots(knots: { x: number; y: number }[]): TracePath {
    // Skip first and last knot points (CatmullRom tangent controls)
    const points = knots.length >= 4 ? knots.slice(1, -1) : knots

    const lengths: number[] = [0]
    let total = 0
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      total += Math.sqrt(dx * dx + dy * dy)
      lengths.push(total)
    }
    return { points, lengths, totalLength: total }
  }

  onPointerDown(x: number, y: number) {
    const path = this.tracePaths[this.currentPathIndex]
    if (!path) return

    if (distToPath(path, x, y) < CURSOR_PICK_DISTANCE) {
      this.isDrawing = true
      this.advanceProgress(x, y)
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.isDrawing) return
    this.advanceProgress(x, y)
  }

  onPointerUp(_x: number, _y: number) {
    this.isDrawing = false
  }

  advanceProgress(x: number, y: number) {
    const path = this.tracePaths[this.currentPathIndex]
    if (!path) return

    if (distToPath(path, x, y) > CURSOR_PICK_DISTANCE * 1.5) return

    const along = closestDistOnPath(path, x, y)

    // Only allow forward progress (+ small backward tolerance)
    if (along > this.pathProgress - BACKWARD_TOLERANCE) {
      this.pathProgress = Math.max(this.pathProgress, along)
    }

    // Check if stroke is complete
    if (this.pathProgress >= path.totalLength * COMPLETION_RATIO) {
      this.pathProgress = path.totalLength
      this.completeCurrentStroke()
    }
  }

  completeCurrentStroke() {
    // Mark current stroke as done (C++ identity: path[i] = stroke[i])
    if (this.currentPathIndex < this.strokeStates.length) {
      this.strokeStates[this.currentPathIndex].state = 'done'
    }

    // Spawn celebration particles at end of path
    const path = this.tracePaths[this.currentPathIndex]
    if (path) {
      const endPt = path.points[path.points.length - 1]
      this.spawnParticles(endPt.x, endPt.y)
    }

    // Advance to next path
    this.currentPathIndex++
    this.pathProgress = 0

    if (this.currentPathIndex < this.tracePaths.length) {
      // Activate next stroke
      if (this.currentPathIndex < this.strokeStates.length) {
        this.strokeStates[this.currentPathIndex].state = 'active'
      }
    } else {
      // All strokes done - advance to next problem
      setTimeout(() => {
        this.currentProblemIndex++
        this.setupProblem()
      }, 500)
    }
  }

  spawnParticles(gx: number, gy: number) {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF69B4']
    for (let i = 0; i < 20; i++) {
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

  // ── Drawing ──────────────────────────────────────────────

  /** Draw a stroke image at its Cocos BOTTOM_LEFT anchor position */
  private drawStrokeImage(img: HTMLImageElement, config: StrokeConfig, gs: number) {
    if (!img.complete || img.naturalWidth === 0) return
    const drawX = config.x * gs
    const drawY = (GAME_HEIGHT - config.y - img.naturalHeight) * gs
    this.ctx.drawImage(img, drawX, drawY, img.naturalWidth * gs, img.naturalHeight * gs)
  }

  /**
   * Scratch-reveal effect for the active stroke.
   * Draws bottom image fully, then overlays top image with the traced portion erased.
   */
  private drawScratchReveal(ss: StrokeState, pathIndex: number, gs: number) {
    const path = this.tracePaths[pathIndex]
    if (!path) {
      // No path for this stroke - just draw top image
      this.drawStrokeImage(ss.topImg, ss.config, gs)
      return
    }

    const topImg = ss.topImg
    const bottomImg = ss.bottomImg

    if (!topImg.complete || topImg.naturalWidth === 0) return
    if (!bottomImg.complete || bottomImg.naturalWidth === 0) {
      // Bottom not loaded yet, just draw top
      this.drawStrokeImage(topImg, ss.config, gs)
      return
    }

    // 1. Draw bottom image (the colored/revealed state) fully
    this.drawStrokeImage(bottomImg, ss.config, gs)

    if (this.pathProgress <= 0) {
      // No progress yet - draw top image fully on top (hides bottom completely)
      this.drawStrokeImage(topImg, ss.config, gs)
      return
    }

    // 2. Create scratch canvas to composite top image with traced portion erased
    const iw = topImg.naturalWidth
    const ih = topImg.naturalHeight

    if (!this.scratchCanvas) {
      this.scratchCanvas = document.createElement('canvas')
      this.scratchCtx = this.scratchCanvas.getContext('2d')!
    }

    // Resize if needed
    if (this.scratchCanvas.width !== iw || this.scratchCanvas.height !== ih) {
      this.scratchCanvas.width = iw
      this.scratchCanvas.height = ih
    }

    const sctx = this.scratchCtx!

    // Draw top image on scratch canvas
    sctx.clearRect(0, 0, iw, ih)
    sctx.globalCompositeOperation = 'source-over'
    sctx.drawImage(topImg, 0, 0)

    // Erase the traced portion using 'destination-out'
    sctx.globalCompositeOperation = 'destination-out'
    sctx.lineWidth = TRACE_THICKNESS
    sctx.lineCap = 'round'
    sctx.lineJoin = 'round'
    sctx.strokeStyle = 'rgba(255,255,255,1)'

    // Convert game coords → image-local coords
    // Image position in game coords (Cocos BOTTOM_LEFT → screen top-left):
    const imgGameX = ss.config.x
    const imgGameY = GAME_HEIGHT - ss.config.y - ih

    sctx.beginPath()
    const p0 = path.points[0]
    sctx.moveTo(p0.x - imgGameX, p0.y - imgGameY)

    for (let j = 1; j < path.points.length; j++) {
      if (path.lengths[j] <= this.pathProgress) {
        sctx.lineTo(path.points[j].x - imgGameX, path.points[j].y - imgGameY)
      } else {
        // Partial segment
        const segStart = path.lengths[j - 1]
        const segLen = path.lengths[j] - segStart
        const t = segLen > 0 ? (this.pathProgress - segStart) / segLen : 0
        const px = path.points[j - 1].x + (path.points[j].x - path.points[j - 1].x) * t
        const py = path.points[j - 1].y + (path.points[j].y - path.points[j - 1].y) * t
        sctx.lineTo(px - imgGameX, py - imgGameY)
        break
      }
    }
    sctx.stroke()

    // Reset compositing for next use
    sctx.globalCompositeOperation = 'source-over'

    // 3. Draw the masked top image (with traced hole) onto main canvas
    const drawX = ss.config.x * gs
    const drawY = imgGameY * gs
    const drawW = iw * gs
    const drawH = ih * gs
    this.ctx.drawImage(this.scratchCanvas, 0, 0, iw, ih, drawX, drawY, drawW, drawH)
  }

  /**
   * Draw the yellow arrow cursor sprite at the current trace position.
   * C++ behavior: positioned at cursor point, rotates to match direction, scales up when picked.
   */
  private drawCursor(gs: number) {
    const activePath = this.tracePaths[this.currentPathIndex]
    if (!activePath || this.currentPathIndex >= this.tracePaths.length) return

    const cursorPt = getPointAtDistance(activePath, this.pathProgress)
    const angle = getAngleAtDistance(activePath, this.pathProgress)
    const cx = cursorPt.x * gs
    const cy = cursorPt.y * gs
    const { ctx } = this

    const hasCursorImg = this.cursorImg?.complete && this.cursorImg.naturalWidth > 0
    if (hasCursorImg) {
      const scale = this.isDrawing ? CURSOR_SCALE_PICKED : CURSOR_SCALE_NORMAL
      const imgSize = this.cursorImg!.naturalWidth
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      ctx.scale(scale, scale)
      const halfSize = imgSize * gs / 2
      ctx.drawImage(this.cursorImg!, -halfSize, -halfSize, imgSize * gs, imgSize * gs)
      ctx.restore()
    } else {
      const r = (this.isDrawing ? 56 : 46) * gs
      ctx.save()
      ctx.translate(cx, cy)
      ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,220,80,0.25)'; ctx.fill()
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = this.isDrawing ? '#FF9800' : '#FFD700'; ctx.fill()
      ctx.strokeStyle = '#B26800'; ctx.lineWidth = 4 * gs; ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = '#7A4400'; ctx.fill()
      ctx.restore()
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Background
    if (this.bgImage?.complete && this.bgImage.naturalWidth > 0) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      ctx.fillStyle = '#F5E6D0'
      ctx.fillRect(0, 0, w, h)
    }

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw stroke images with scratch-reveal
    for (let i = 0; i < this.strokeStates.length; i++) {
      const ss = this.strokeStates[i]

      if (ss.state === 'done') {
        // Completed: show bottom (colored) image
        this.drawStrokeImage(ss.bottomImg, ss.config, gs)
      } else if (ss.state === 'active') {
        // Active: scratch-reveal effect (identity mapping: strokeIndex == pathIndex)
        this.drawScratchReveal(ss, i, gs)
      } else {
        // Future: show top (brown guide) image
        this.drawStrokeImage(ss.topImg, ss.config, gs)
      }
    }

    // Draw cursor sprite at current trace position
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

    ctx.restore()
  }
}
