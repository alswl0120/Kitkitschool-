import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/compmatching')

// ── C++ MatchingScene.cpp layout constants (exact values) ──
const IMAGE_FRAME_W = 510
const IMAGE_FRAME_H = 374
const IMAGE_CONTENT_H = 364
const ITEM_GAP_Y = 50
const GAP_BETWEEN_LR = 250         // horizontal gap from wrapper edge to item column
const WRAPPER_MARGIN_X = 200        // wrapper offset from gameNode center
const WRAPPER_MARGIN_Y = 250        // wrapper vertical offset below center
const HEIGHT_CORRECTION = 100       // downward offset subtracted from initial Y
const LINE_THICKNESS = 9
const DOT_RADIUS = 15
const DOT_OFFSET = 70               // dot distance from item edge

// ── C++ derived positions ──
// Left wrapper: anchor MIDDLE_RIGHT at (gameW/2 - WRAPPER_MARGIN_X, gameH/2 - WRAPPER_MARGIN_Y) = (1080, 650)
// Left items: X = wrapperX - GAP_BETWEEN_LR = 1080 - 250 = 830 (anchor MIDDLE_RIGHT → right edge)
// Left item center: 830 - FRAME_W/2 = 575
// Left dot: 830 + DOT_OFFSET = 900
//
// Right wrapper: anchor MIDDLE_LEFT at (1480, 650)
// Right items: X = wrapperX + GAP_BETWEEN_LR = 1480 + 250 = 1730 (anchor MIDDLE_LEFT → left edge)
// Right item center: 1730 + FRAME_W/2 = 1985
// Right dot: 1730 - DOT_OFFSET = 1660
const LEFT_ITEM_RIGHT_EDGE = GAME_WIDTH / 2 - WRAPPER_MARGIN_X - GAP_BETWEEN_LR   // 830
const LEFT_ITEM_CENTER_X = LEFT_ITEM_RIGHT_EDGE - IMAGE_FRAME_W / 2                // 575
const LEFT_DOT_X = LEFT_ITEM_RIGHT_EDGE + DOT_OFFSET                               // 900

const RIGHT_ITEM_LEFT_EDGE = GAME_WIDTH / 2 + WRAPPER_MARGIN_X + GAP_BETWEEN_LR    // 1730
const RIGHT_ITEM_CENTER_X = RIGHT_ITEM_LEFT_EDGE + IMAGE_FRAME_W / 2               // 1985
const RIGHT_DOT_X = RIGHT_ITEM_LEFT_EDGE - DOT_OFFSET                              // 1660

// ── Colors (C++ exact) ──
const LINE_COLOR = 'rgb(242, 190, 10)'      // golden yellow #F2BE0A
const DOT_COLOR = 'rgb(77, 77, 77)'         // dark gray #4D4D4D
const TEXT_COLOR = 'rgb(77, 77, 77)'
const TEXT_FONT_SIZE = 80
const TEXT_FONT = 'TodoSchoolV2, sans-serif'
const BG_COLOR = '#E8DDD0'

// ── Item types ──
interface MatchItem {
  id: number
  side: 'left' | 'right'
  type: 'text' | 'image'
  value: string
  x: number        // center x in game coords
  y: number        // center y in game coords
  dotX: number     // dot center x
  dotY: number     // dot center y
  closed: boolean  // already matched
  image?: HTMLImageElement
}

interface DrawnLine {
  x1: number; y1: number
  x2: number; y2: number
}

interface PairData {
  id: number
  leftValue: string
  rightValue: string
}

interface ProblemData {
  questionText: string
  leftType: 'text' | 'image'
  rightType: 'text' | 'image'
  pairs: PairData[]
}

interface LevelData {
  level: number
  problems: ProblemData[]
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class CompMatchingEngine extends BaseEngine {
  level: number
  problems: ProblemData[] = []
  currentProblem = 0
  items: MatchItem[] = []
  matchedLines: DrawnLine[] = []
  questionText = ''

  // Drag state
  dragging = false
  dragStartItem: MatchItem | null = null
  dragCurX = 0
  dragCurY = 0
  soundPlayed = false

  // Assets
  bgImage: HTMLImageElement
  frameImage: HTMLImageElement

  // Sounds
  sfxLineStart: HTMLAudioElement
  sfxLineBack: HTMLAudioElement
  sfxBoom: HTMLAudioElement

  // Progress
  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(`${ASSET_PATH}/_comprehenson_background.png`)
    this.frameImage = loadImage(`${ASSET_PATH}/illustration_small.png`)
    this.sfxLineStart = loadAudio(`${ASSET_PATH}/sounds/linestart.m4a`)
    this.sfxLineBack = loadAudio(`${ASSET_PATH}/sounds/lineback.m4a`)
    this.sfxBoom = loadAudio(`${ASSET_PATH}/sounds/boom.m4a`)
    this.loadLevel()
  }

  async loadLevel() {
    try {
      const resp = await fetch('/data/games/compmatching.json')
      const data = await resp.json()
      const levelData: LevelData | undefined = data.levels.find(
        (l: LevelData) => l.level === this.level
      )
      if (!levelData) return
      this.problems = levelData.problems
      this.currentProblem = 0
      this.setupProblem()
    } catch (e) {
      console.error('Failed to load CompMatching data:', e)
    }
  }

  setupProblem() {
    if (this.currentProblem >= this.problems.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    const prob = this.problems[this.currentProblem]
    this.questionText = prob.questionText
    this.items = []
    this.matchedLines = []
    this.dragging = false
    this.dragStartItem = null

    // Build left and right item arrays
    const leftPairs = shuffleArray(prob.pairs)
    const rightPairs = shuffleArray(prob.pairs)

    // Ensure no left[i].id == right[i].id (well-shuffled)
    let attempts = 0
    let rp = rightPairs
    while (attempts < 100) {
      let ok = true
      for (let i = 0; i < leftPairs.length; i++) {
        if (leftPairs[i].id === rp[i].id) { ok = false; break }
      }
      if (ok) break
      rp = shuffleArray(prob.pairs)
      attempts++
    }

    const count = leftPairs.length

    // ── Y position calculation (C++ Cocos bottom-up → Canvas top-down) ──
    // C++ Cocos:
    //   wrapperY = gameH/2 - WRAPPER_MARGIN_Y = 650
    //   wrapperH = FRAME_H * count + GAP_Y * (count-1)
    //   cocosY[i] = (wrapperY + wrapperH/2) - (FRAME_H*i + GAP_Y*i + HEIGHT_CORRECTION)
    // Canvas (top-down):
    //   canvasY[i] = 1800 - cocosY[i]
    //   = GAME_HEIGHT/2 + WRAPPER_MARGIN_Y + HEIGHT_CORRECTION - totalH/2 + (FRAME_H + GAP_Y)*i
    const totalH = count * IMAGE_FRAME_H + (count - 1) * ITEM_GAP_Y
    const firstItemCenterY = GAME_HEIGHT / 2 + WRAPPER_MARGIN_Y + HEIGHT_CORRECTION - totalH / 2

    for (let i = 0; i < count; i++) {
      const y = firstItemCenterY + i * (IMAGE_FRAME_H + ITEM_GAP_Y)

      // Left item
      this.items.push({
        id: leftPairs[i].id,
        side: 'left',
        type: prob.leftType,
        value: leftPairs[i].leftValue,
        x: LEFT_ITEM_CENTER_X,
        y,
        dotX: LEFT_DOT_X,
        dotY: y,
        closed: false,
      })

      // Right item
      this.items.push({
        id: rp[i].id,
        side: 'right',
        type: prob.rightType,
        value: rp[i].rightValue,
        x: RIGHT_ITEM_CENTER_X,
        y,
        dotX: RIGHT_DOT_X,
        dotY: y,
        closed: false,
      })
    }

    this.onProgressChange?.(this.currentProblem + 1, this.problems.length)
  }

  // ── Hit test (C++ uses bounding box union of item + dot) ──
  hitTestItem(x: number, y: number): MatchItem | null {
    for (const item of this.items) {
      if (item.closed) continue
      // Check item bounding box
      const hw = IMAGE_FRAME_W / 2
      const hh = IMAGE_FRAME_H / 2
      if (x >= item.x - hw && x <= item.x + hw &&
          y >= item.y - hh && y <= item.y + hh) {
        return item
      }
      // Check dot area (C++ dot content size = 150x150 → radius ~75)
      const dx = x - item.dotX
      const dy = y - item.dotY
      if (dx * dx + dy * dy <= 75 * 75) {
        return item
      }
    }
    return null
  }

  // ── Pointer events ──
  onPointerDown(x: number, y: number) {
    if (this.dragging) return
    const item = this.hitTestItem(x, y)
    if (!item) return
    this.dragging = true
    this.dragStartItem = item
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
    if (!this.dragging || !this.dragStartItem) {
      this.dragging = false
      return
    }

    const endItem = this.hitTestItem(x, y)

    if (endItem && endItem !== this.dragStartItem &&
        endItem.id === this.dragStartItem.id &&
        endItem.side !== this.dragStartItem.side) {
      // Match!
      this.matched(this.dragStartItem, endItem)
    } else if (endItem === this.dragStartItem) {
      // Canceled on same item
      playSound(this.sfxLineBack)
    } else {
      // Released elsewhere
      playSound(this.sfxLineBack)
    }

    this.dragging = false
    this.dragStartItem = null
  }

  matched(item1: MatchItem, item2: MatchItem) {
    playSound(this.sfxBoom)

    // Draw permanent line
    this.matchedLines.push({
      x1: item1.dotX, y1: item1.dotY,
      x2: item2.dotX, y2: item2.dotY,
    })

    // Mark items as closed (C++: isClosed = true, no visual change on items)
    for (const item of this.items) {
      if (item.id === item1.id) {
        item.closed = true
      }
    }

    // Check completion
    if (this.items.every(it => it.closed)) {
      setTimeout(() => {
        this.currentProblem++
        if (this.currentProblem >= this.problems.length) {
          this.gameState = 'complete'
          this.onComplete?.()
        } else {
          this.setupProblem()
        }
      }, 600)
    }
  }

  update(_time: number, _dt: number) {
    // No animation state to update
  }

  draw() {
    const { ctx, canvas, gameScale: gs } = this
    const w = canvas.width / (window.devicePixelRatio || 1)
    const h = canvas.height / (window.devicePixelRatio || 1)

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Background
    if (imgOk(this.bgImage)) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, w, h)
    }

    // Transform to game coordinates
    const offsetX = (w - GAME_WIDTH * gs) / 2
    const offsetY = (h - GAME_HEIGHT * gs) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(gs, gs)

    // Question text at top
    if (this.questionText) {
      ctx.fillStyle = TEXT_COLOR
      ctx.font = `bold ${60}px ${TEXT_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.questionText, GAME_WIDTH / 2, 120)
    }

    // Draw items
    for (const item of this.items) {
      this.drawItem(item)
    }

    // C++: lines/dots drawn on scene (same coordinate space as gameNode)
    // Line thickness 9 and dot radius 15 are in design-resolution units.
    // On small web viewports this can appear thin, so we enforce a minimum screen size.
    const minLineScreen = 4   // minimum screen CSS pixels for line
    const minDotScreen = 6    // minimum screen CSS pixels for dot radius
    const lineW = Math.max(LINE_THICKNESS, minLineScreen / gs)
    const dotR = Math.max(DOT_RADIUS, minDotScreen / gs)

    // Draw matched lines (permanent)
    for (const line of this.matchedLines) {
      this.drawMatchLine(line.x1, line.y1, line.x2, line.y2, lineW, dotR)
    }

    // Draw active drag line
    if (this.dragging && this.dragStartItem) {
      this.drawMatchLine(
        this.dragStartItem.dotX, this.dragStartItem.dotY,
        this.dragCurX, this.dragCurY, lineW, dotR
      )
    }

    ctx.restore()
  }

  drawItem(item: MatchItem) {
    const { ctx } = this

    if (item.type === 'image') {
      // C++: ImageObject has illustration_small.png frame
      const x = item.x - IMAGE_FRAME_W / 2
      const y = item.y - IMAGE_FRAME_H / 2
      if (imgOk(this.frameImage)) {
        ctx.drawImage(this.frameImage, x, y, IMAGE_FRAME_W, IMAGE_FRAME_H)
      } else {
        ctx.fillStyle = '#F5F0E8'
        ctx.strokeStyle = '#C0B8A8'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(x, y, IMAGE_FRAME_W, IMAGE_FRAME_H, 8)
        ctx.fill()
        ctx.stroke()
      }
      // TODO: draw actual image content if item.image loaded
    } else {
      // C++: TextObject has NO frame — just floating text + dot
      ctx.fillStyle = TEXT_COLOR
      ctx.font = `bold ${TEXT_FONT_SIZE}px ${TEXT_FONT}`
      ctx.textBaseline = 'middle'
      if (item.side === 'left') {
        // C++: text RIGHT-aligned, label anchor MIDDLE_RIGHT at X=830
        ctx.textAlign = 'right'
        ctx.fillText(item.value, LEFT_ITEM_RIGHT_EDGE, item.y)
      } else {
        // C++: text LEFT-aligned, label anchor MIDDLE_LEFT at X=1730
        ctx.textAlign = 'left'
        ctx.fillText(item.value, RIGHT_ITEM_LEFT_EDGE, item.y)
      }
    }

    // Dot (C++: gray, radius 15 design units)
    const gs = this.gameScale
    const dotR = Math.max(DOT_RADIUS, 6 / gs)
    ctx.beginPath()
    ctx.arc(item.dotX, item.dotY, dotR, 0, Math.PI * 2)
    ctx.fillStyle = DOT_COLOR
    ctx.fill()
  }

  drawMatchLine(x1: number, y1: number, x2: number, y2: number, lineW: number, dotR: number) {
    const { ctx } = this

    // Line (C++: golden yellow)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = LINE_COLOR
    ctx.lineWidth = lineW
    ctx.lineCap = 'round'
    ctx.stroke()

    // Endpoint circles (C++: gray)
    ctx.beginPath()
    ctx.arc(x1, y1, dotR, 0, Math.PI * 2)
    ctx.fillStyle = DOT_COLOR
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x2, y2, dotR, 0, Math.PI * 2)
    ctx.fillStyle = DOT_COLOR
    ctx.fill()
  }
}
