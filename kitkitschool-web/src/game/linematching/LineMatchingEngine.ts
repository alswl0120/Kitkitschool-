import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { generateProblem, parseLevelSets, type GeneratedProblem } from './ProblemGenerator'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/linematching')

// ── Card dimensions (from box.png: 378×400) ──
const BASE_BOX_W = 378
const BASE_BOX_H = 400

// ── Dot image sizes (natural 127×127, displayed smaller) ──
const DOT_DISPLAY = 54

// ── Layout ──
const DOT_GAP = 18           // gap from card edge to dot center
const CARD_GAP_Y = 24        // vertical gap between cards
const TOP_MARGIN = 140        // top margin (below progress bar)
const BOTTOM_MARGIN = 60

// Column X centers
const COL2 = { left: 640, right: 1920 }
const COL3 = { left: 440, center: GAME_WIDTH / 2, right: 2120 }

// ── Line drawing ──
const LINE_THICKNESS = 9
const LINE_COLOR = 'rgb(242, 190, 10)'

// ── Hit test ──
const HIT_EXTRA = 30  // extra pixels around card for touch

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawSet = any

// ── Board object ──
interface BoardObject {
  categoryIndex: number
  normalImage: HTMLImageElement
  successImage: HTMLImageElement
  x: number           // card center x
  y: number           // card center y
  cardW: number       // rendered card width (may be scaled)
  cardH: number       // rendered card height
  matched: boolean
  column: 'left' | 'center' | 'right'
  successShown: boolean
  // Dot positions (game coords) — set during layout
  dotLeftX: number
  dotLeftY: number
  dotRightX: number
  dotRightY: number
  hasDotLeft: boolean
  hasDotRight: boolean
}

interface DrawnLine {
  x1: number; y1: number
  x2: number; y2: number
}

export class LineMatchingEngine extends BaseEngine {
  level: number
  objectCount = 8
  problemCount = 8
  sets: RawSet[] = []
  currentSetIndex = 0

  boardObjects: BoardObject[] = []
  matchedLines: DrawnLine[] = []
  currentMode: 'two-column' | 'three-column' = 'two-column'

  // Drag state
  dragging = false
  dragStartObj: BoardObject | null = null
  dragCurX = 0
  dragCurY = 0
  soundPlayed = false

  // Assets
  bgImage: HTMLImageElement
  boxImage: HTMLImageElement
  boxGreenImage: HTMLImageElement
  dotYellowImage: HTMLImageElement
  dotBlueImage: HTMLImageElement   // dot_red.png is actually blue

  // Sounds
  sfxLineStart: HTMLAudioElement
  sfxLineBack: HTMLAudioElement
  sfxBoom: HTMLAudioElement

  // Progress
  onProgressChange?: (current: number, max: number) => void

  // Transition
  transitioning = false
  transitionTimer = 0

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(`${ASSET_PATH}/line-matching_image_wooden-bgpng.png`)
    this.boxImage = loadImage(`${ASSET_PATH}/box.png`)
    this.boxGreenImage = loadImage(`${ASSET_PATH}/box_green.png`)
    this.dotYellowImage = loadImage(`${ASSET_PATH}/dot_yellow.png`)
    this.dotBlueImage = loadImage(`${ASSET_PATH}/dot_red.png`)  // blue despite name
    this.sfxLineStart = loadAudio(`${ASSET_PATH}/sounds/linestart.m4a`)
    this.sfxLineBack = loadAudio(`${ASSET_PATH}/sounds/lineback.m4a`)
    this.sfxBoom = loadAudio(`${ASSET_PATH}/sounds/boom.m4a`)
    this.loadLevel()
  }

  async loadLevel() {
    try {
      const resp = await fetch(`/data/games/linematching/lm_${this.level}.json`)
      const data = await resp.json()
      const parsed = parseLevelSets(data)
      this.objectCount = parsed.objectCount
      this.problemCount = parsed.problemCount
      this.sets = parsed.sets
      this.currentSetIndex = 0
      this.setupProblem()
    } catch (e) {
      console.error('Failed to load LineMatching data:', e)
    }
  }

  setupProblem() {
    if (this.currentSetIndex >= this.sets.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    const set = this.sets[this.currentSetIndex]
    const problem: GeneratedProblem = generateProblem(set, this.objectCount)
    this.currentMode = problem.mode
    this.matchedLines = []
    this.dragging = false
    this.dragStartObj = null
    this.transitioning = false

    // Create board objects with layout
    this.boardObjects = []
    this.layoutBoard(problem)

    this.onProgressChange?.(this.currentSetIndex + 1, this.problemCount)
  }

  // ── Layout ──
  layoutBoard(problem: GeneratedProblem) {
    const mode = problem.mode

    // Separate objects by column
    type ColKey = 'left' | 'center' | 'right'
    const columns: Record<ColKey, { obj: typeof problem.objects[0]; idx: number }[]> = {
      left: [], center: [], right: [],
    }

    if (mode === 'three-column') {
      // Objects already have column assignments from ProblemGenerator
      problem.objects.forEach((obj, i) => {
        const col = obj.column || 'left'
        columns[col].push({ obj, idx: i })
      })
    } else {
      // 2-column: distribute by category (one per side)
      const byCat: Map<number, number[]> = new Map()
      problem.objects.forEach((obj, i) => {
        const arr = byCat.get(obj.categoryIndex) || []
        arr.push(i)
        byCat.set(obj.categoryIndex, arr)
      })

      const leftIdxs: number[] = []
      const rightIdxs: number[] = []

      for (const [, indices] of byCat) {
        if (indices.length >= 2) {
          leftIdxs.push(indices[0])
          rightIdxs.push(indices[1])
          for (let k = 2; k < indices.length; k++) {
            if (k % 2 === 0) leftIdxs.push(indices[k])
            else rightIdxs.push(indices[k])
          }
        } else {
          if (leftIdxs.length <= rightIdxs.length) leftIdxs.push(indices[0])
          else rightIdxs.push(indices[0])
        }
      }

      // Shuffle each side
      for (const idx of this.shuffleArr(leftIdxs)) {
        columns.left.push({ obj: problem.objects[idx], idx })
      }
      for (const idx of this.shuffleArr(rightIdxs)) {
        columns.right.push({ obj: problem.objects[idx], idx })
      }
    }

    // Determine max items in any column → card scale
    const maxPerCol = Math.max(
      columns.left.length,
      columns.center.length,
      columns.right.length,
      1
    )

    const availH = GAME_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN
    const neededH = maxPerCol * BASE_BOX_H + (maxPerCol - 1) * CARD_GAP_Y
    const scale = neededH > availH ? availH / neededH : 1.0
    const cardW = Math.round(BASE_BOX_W * scale)
    const cardH = Math.round(BASE_BOX_H * scale)
    const gapY = Math.round(CARD_GAP_Y * scale)

    // Column X positions
    const colXs = mode === 'three-column' ? COL3 : COL2

    // Initialize all positions
    const boardObjs: BoardObject[] = new Array(problem.objects.length)

    for (const colKey of ['left', 'center', 'right'] as const) {
      const items = columns[colKey]
      if (items.length === 0) continue

      const colX = colXs[colKey as keyof typeof colXs]
      if (colX === undefined) continue

      const totalH = items.length * cardH + (items.length - 1) * gapY
      const startY = TOP_MARGIN + (availH - totalH) / 2 + cardH / 2

      for (let j = 0; j < items.length; j++) {
        const { obj, idx } = items[j]
        const x = colX
        const y = startY + j * (cardH + gapY)

        // Determine dot sides
        let hasDotLeft = false
        let hasDotRight = false
        if (mode === 'three-column') {
          if (colKey === 'left') hasDotRight = true
          else if (colKey === 'right') hasDotLeft = true
          else { hasDotLeft = true; hasDotRight = true }
        } else {
          if (colKey === 'left') hasDotRight = true
          else hasDotLeft = true
        }

        const dotOffset = cardW / 2 + DOT_GAP + DOT_DISPLAY / 2

        boardObjs[idx] = {
          categoryIndex: obj.categoryIndex,
          normalImage: loadImage(obj.normalImage),
          successImage: loadImage(obj.successImage),
          x, y,
          cardW, cardH,
          matched: false,
          column: colKey,
          successShown: false,
          dotLeftX: x - dotOffset,
          dotLeftY: y,
          dotRightX: x + dotOffset,
          dotRightY: y,
          hasDotLeft,
          hasDotRight,
        }
      }
    }

    this.boardObjects = boardObjs.filter(Boolean)
  }

  shuffleArr<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  // ── Get dot position for connecting two objects ──
  getDotPos(from: BoardObject, to: BoardObject): { x: number; y: number } {
    // Use the dot on the side facing the other object
    if (from.x < to.x && from.hasDotRight) {
      return { x: from.dotRightX, y: from.dotRightY }
    }
    if (from.x > to.x && from.hasDotLeft) {
      return { x: from.dotLeftX, y: from.dotLeftY }
    }
    // Fallback: use whichever dot exists
    if (from.hasDotRight) return { x: from.dotRightX, y: from.dotRightY }
    if (from.hasDotLeft) return { x: from.dotLeftX, y: from.dotLeftY }
    return { x: from.x, y: from.y }
  }

  // ── Check if all same-category items are matched ──
  isFullyConnected(obj: BoardObject): boolean {
    return this.boardObjects
      .filter(o => o.categoryIndex === obj.categoryIndex)
      .every(o => o.matched)
  }

  // ── Hit test (skip only fully-connected items) ──
  hitTestObject(x: number, y: number): BoardObject | null {
    for (const obj of this.boardObjects) {
      // Skip only if ALL items of this category are matched
      if (this.isFullyConnected(obj)) continue
      const hw = obj.cardW / 2 + HIT_EXTRA
      const hh = obj.cardH / 2 + HIT_EXTRA
      if (x >= obj.x - hw && x <= obj.x + hw &&
          y >= obj.y - hh && y <= obj.y + hh) {
        return obj
      }
      // Also check dot areas
      if (obj.hasDotLeft) {
        const dx = x - obj.dotLeftX
        const dy = y - obj.dotLeftY
        if (dx * dx + dy * dy <= (DOT_DISPLAY / 2 + HIT_EXTRA) ** 2) return obj
      }
      if (obj.hasDotRight) {
        const dx = x - obj.dotRightX
        const dy = y - obj.dotRightY
        if (dx * dx + dy * dy <= (DOT_DISPLAY / 2 + HIT_EXTRA) ** 2) return obj
      }
    }
    return null
  }

  // ── Pointer events ──
  onPointerDown(x: number, y: number) {
    if (this.transitioning) return
    if (this.dragging) return
    const obj = this.hitTestObject(x, y)
    if (!obj) return
    this.dragging = true
    this.dragStartObj = obj
    this.dragCurX = x
    this.dragCurY = y
    this.soundPlayed = false
  }

  onPointerMove(x: number, y: number) {
    if (!this.dragging) return
    this.dragCurX = x
    this.dragCurY = y
    if (!this.soundPlayed) {
      playSound(this.sfxLineStart)
      this.soundPlayed = true
    }
  }

  onPointerUp(x: number, y: number) {
    if (!this.dragging || !this.dragStartObj) {
      this.dragging = false
      return
    }

    const endObj = this.hitTestObject(x, y)

    if (endObj && endObj !== this.dragStartObj &&
        endObj.categoryIndex === this.dragStartObj.categoryIndex &&
        !(endObj.matched && this.dragStartObj.matched)) {
      // Match! (reject if both already matched — they're already connected)
      this.matchObjects(this.dragStartObj, endObj)
    } else if (endObj === this.dragStartObj) {
      playSound(this.sfxLineBack)
    } else {
      playSound(this.sfxLineBack)
    }

    this.dragging = false
    this.dragStartObj = null
  }

  matchObjects(obj1: BoardObject, obj2: BoardObject) {
    playSound(this.sfxBoom)

    // Draw line between the two objects' dots
    const dot1 = this.getDotPos(obj1, obj2)
    const dot2 = this.getDotPos(obj2, obj1)
    this.matchedLines.push({
      x1: dot1.x, y1: dot1.y,
      x2: dot2.x, y2: dot2.y,
    })

    // Mark only these 2 items as matched (in 3-column mode, player must connect each pair separately)
    obj1.matched = true
    obj1.successShown = true
    obj2.matched = true
    obj2.successShown = true

    // Check completion
    const allMatched = this.boardObjects.every(o => o.matched)
    if (allMatched) {
      this.transitioning = true
      this.transitionTimer = 0.8
    }
  }

  update(_time: number, dt: number) {
    if (this.transitioning) {
      this.transitionTimer -= dt
      if (this.transitionTimer <= 0) {
        this.transitioning = false
        this.currentSetIndex++
        if (this.currentSetIndex >= this.problemCount) {
          this.gameState = 'complete'
          this.onComplete?.()
        } else {
          this.setupProblem()
        }
      }
    }
  }

  draw() {
    const { ctx, canvas, gameScale: gs } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Background
    if (imgOk(this.bgImage)) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      ctx.fillStyle = '#8B7355'
      ctx.fillRect(0, 0, w, h)
    }

    // Transform to game coordinates
    const offsetX = (w - GAME_WIDTH * gs) / 2
    const offsetY = (h - GAME_HEIGHT * gs) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(gs, gs)

    // Draw matched lines (behind objects)
    for (const line of this.matchedLines) {
      this.drawLine(line.x1, line.y1, line.x2, line.y2)
    }

    // Draw active drag line
    if (this.dragging && this.dragStartObj) {
      const startDot = this.getDragStartDot()
      this.drawLine(startDot.x, startDot.y, this.dragCurX, this.dragCurY)
    }

    // Draw objects (on top of lines)
    for (const obj of this.boardObjects) {
      this.drawObject(obj)
    }

    ctx.restore()
  }

  getDragStartDot(): { x: number; y: number } {
    if (!this.dragStartObj) return { x: 0, y: 0 }
    const obj = this.dragStartObj
    // Use the dot closest to the current drag position
    if (obj.hasDotRight && obj.hasDotLeft) {
      // Center column: pick side closer to drag cursor
      const dxR = this.dragCurX - obj.dotRightX
      const dyR = this.dragCurY - obj.dotRightY
      const dxL = this.dragCurX - obj.dotLeftX
      const dyL = this.dragCurY - obj.dotLeftY
      if (dxR * dxR + dyR * dyR < dxL * dxL + dyL * dyL) {
        return { x: obj.dotRightX, y: obj.dotRightY }
      }
      return { x: obj.dotLeftX, y: obj.dotLeftY }
    }
    if (obj.hasDotRight) return { x: obj.dotRightX, y: obj.dotRightY }
    if (obj.hasDotLeft) return { x: obj.dotLeftX, y: obj.dotLeftY }
    return { x: obj.x, y: obj.y }
  }

  drawObject(obj: BoardObject) {
    const { ctx } = this
    const { x, y, cardW, cardH } = obj
    const cx = x - cardW / 2
    const cy = y - cardH / 2

    // Card background (box.png or box_green.png)
    const boxImg = obj.matched ? this.boxGreenImage : this.boxImage
    if (imgOk(boxImg) && boxImg.naturalWidth > 0) {
      ctx.drawImage(boxImg, cx, cy, cardW, cardH)
    } else {
      // Fallback
      ctx.fillStyle = obj.matched ? '#6a9e3e' : '#F5EED4'
      ctx.beginPath()
      ctx.roundRect(cx, cy, cardW, cardH, 16)
      ctx.fill()
    }

    // Content image (inside card with padding)
    const img = obj.successShown ? obj.successImage : obj.normalImage
    if (imgOk(img) && img.naturalWidth > 0) {
      const padding = cardW * 0.08
      const availW = cardW - padding * 2
      const availH = cardH - padding * 2
      const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight)
      const iw = img.naturalWidth * scale
      const ih = img.naturalHeight * scale
      ctx.drawImage(img, x - iw / 2, y - ih / 2, iw, ih)
    }

    // Dots — show if this category still has unmatched items (item can still form connections)
    if (!this.isFullyConnected(obj)) {
      if (obj.hasDotLeft) {
        this.drawDot(obj.dotLeftX, obj.dotLeftY, obj.column === 'right' ? 'blue' : 'yellow')
      }
      if (obj.hasDotRight) {
        this.drawDot(obj.dotRightX, obj.dotRightY, obj.column === 'left' ? 'yellow' : 'yellow')
      }
    }
  }

  drawDot(cx: number, cy: number, color: 'yellow' | 'blue') {
    const { ctx } = this
    const img = color === 'blue' ? this.dotBlueImage : this.dotYellowImage
    const size = DOT_DISPLAY

    if (imgOk(img) && img.naturalWidth > 0) {
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
    } else {
      // Fallback circle
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
      ctx.fillStyle = color === 'blue' ? '#4FC3F7' : '#FDD835'
      ctx.fill()
    }
  }

  drawLine(x1: number, y1: number, x2: number, y2: number) {
    const { ctx } = this

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = LINE_COLOR
    ctx.lineWidth = LINE_THICKNESS
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}
