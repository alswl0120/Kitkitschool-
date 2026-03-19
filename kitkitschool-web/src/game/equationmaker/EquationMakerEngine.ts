import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/equationmaker')

// C++ EquationMakerScene constants
// C++ winSize = Size(2048, 1440) -- game view size
// C++ gameView anchored MIDDLE_BOTTOM at (dirSize.width/2, 0)
// We scale from 2048x1440 to GAME_WIDTH x GAME_HEIGHT (2560x1800)
const CPP_W = 2048
const CPP_H = 1440
const SCALE_X = GAME_WIDTH / CPP_W    // 1.25
const SCALE_Y = GAME_HEIGHT / CPP_H   // 1.25

// C++ sign type constants (for reference)
// K_TYPE_SIGN_PLUS = 100, K_TYPE_SIGN_MINUS = 101, K_TYPE_SIGN_EQ = 102

// C++ object type constants
const K_OBJECT_TYPE_NUMBER = 2
// K_OBJECT_TYPE_OBJECT = 3 (for reference)

interface LevelConfig {
  level: number
  type: string
  mathSign: string
  minNumber: number
  maxNumber: number
  blankCount: number
  panelCount: number
}

interface EquationProblem {
  parts: string[]        // e.g. ["3", "+", "2", "=", "5"]
  blankIndices: number[] // which indices are blanks the player must fill
  answer: number[]       // correct values for blank indices
}

interface Tile {
  value: string
  x: number
  y: number
  w: number
  h: number
  originX: number
  originY: number
  dragging: boolean
  placed: boolean
  slotIndex: number
  type: number     // C++: type value (number or sign constant)
  rowType: number  // C++: rowType for slot matching
}

interface Slot {
  x: number
  y: number
  w: number
  h: number
  filled: boolean
  value: string
  tileIndex: number
  type: number     // C++: expected type
  rowType: number  // C++: expected rowType
}

export class EquationMakerEngine extends BaseEngine {
  level: number
  levelData: LevelConfig | null = null
  problems: EquationProblem[] = []
  currentProblem = 0
  totalProblems = 6  // C++ default: 6 problems
  solvedCount = 0

  tiles: Tile[] = []
  slots: Slot[] = []
  equationParts: string[] = []

  dragTileIndex = -1
  dragOffsetX = 0
  dragOffsetY = 0

  showResult: 'correct' | 'wrong' | null = null
  resultTimer = 0

  // C++ panelHeight
  panelHeight = 486

  bgImage: HTMLImageElement
  boardImage: HTMLImageElement
  blockCardImage: HTMLImageElement
  blockLineImage: HTMLImageElement
  blockShadowImage: HTMLImageElement
  blockDropBgImage: HTMLImageElement

  sfxCorrect: HTMLAudioElement
  sfxPlace: HTMLAudioElement
  sfxMiss: HTMLAudioElement

  // C++: stage clear animation state
  clearAnimActive = false
  clearAnimProgress = 0

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    this.bgImage = loadImage(`${ASSET_PATH}/equationmaker_bg_sky.jpg`)
    this.boardImage = loadImage(`${ASSET_PATH}/bg_wood_5level.jpg`)
    // C++ block images: block_01.png (card), block_02.png (line border), block_03_shadow.png
    this.blockCardImage = loadImage(`${ASSET_PATH}/block_01.png`)
    this.blockLineImage = loadImage(`${ASSET_PATH}/block_02.png`)
    this.blockShadowImage = loadImage(`${ASSET_PATH}/block_03_shadow.png`)
    this.blockDropBgImage = loadImage(`${ASSET_PATH}/block_drop_bg.png`)

    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxPlace = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxMiss = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
  }

  start() {
    super.start()
    this.loadLevel()
  }

  async loadLevel() {
    try {
      const resp = await fetch('/data/games/equationmaker.json')
      const data = await resp.json()
      this.levelData = data.levels.find((l: LevelConfig) => l.level === this.level) || null
    } catch {
      this.levelData = null
    }

    this.generateProblems()
    this.setupProblem()
  }

  generateProblems() {
    this.problems = []
    const config = this.levelData

    if (!config) {
      // Fallback: generate simple addition equations
      for (let i = 0; i < 6; i++) {
        const a = Math.floor(Math.random() * 5) + 1
        const b = Math.floor(Math.random() * 5) + 1
        this.problems.push({
          parts: [String(a), '+', String(b), '=', String(a + b)],
          blankIndices: [0, 2, 4],
          answer: [a, b, a + b],
        })
      }
      this.totalProblems = 6
      return
    }

    // C++: problem count is 6 for level types 3, 4; varies for type 5
    const problemCount = 6
    this.totalProblems = problemCount

    const { mathSign, minNumber, maxNumber } = config

    for (let i = 0; i < problemCount; i++) {
      const problem = this.generateOneProblem(mathSign, minNumber, maxNumber, config.blankCount)
      this.problems.push(problem)
    }
  }

  generateOneProblem(mathSign: string, min: number, max: number, blankCount: number): EquationProblem {
    // C++: getMathSign mapping: P=plus, M=minus, R=random
    const isPlus = mathSign === 'P' || (mathSign === 'R' && Math.random() > 0.5)
    const op = isPlus ? '+' : '-'

    let a: number, b: number, result: number

    if (isPlus) {
      // C++: generates two numbers where a + b <= max
      a = this.randInt(min, Math.max(min, max - 1))
      const bMax = Math.min(max - a, max)
      b = this.randInt(Math.max(1, min), Math.max(1, bMax))
      result = a + b
    } else {
      // C++: subtraction, a >= b, result >= 1
      result = this.randInt(Math.max(1, min), Math.max(1, max - 1))
      b = this.randInt(Math.max(1, min), Math.max(1, max - result))
      a = result + b
      // Swap so lhs > rhs
      if (a > max) {
        a = max
        b = a - result
      }
    }

    // Ensure valid
    if (a < 0) a = 1
    if (b < 0) b = 1
    if (isPlus) {
      result = a + b
    } else {
      result = a - b
      if (result < 0) { result = 0 }
    }

    const parts = [String(a), op, String(b), '=', String(result)]

    // C++ blank indices depend on level type:
    // Level type 3: both number row and object row; blanks are the non-slotIn items
    // For web simplification: blankCount from config determines how many parts are blanked
    // blankCount=0 means all numbers are blanks (default C++ behavior for levelType 3)
    let blankIndices: number[]

    if (blankCount === 0) {
      // C++: all three numbers are draggable (typical for most levels)
      blankIndices = [0, 2, 4]
    } else if (blankCount === 2) {
      // Two blanks: operands
      blankIndices = [0, 2]
    } else if (blankCount === 1) {
      // One blank: randomly choose
      const choices = [0, 2, 4]
      blankIndices = [choices[Math.floor(Math.random() * choices.length)]]
    } else {
      blankIndices = [0, 2, 4]
    }

    const answer = blankIndices.map(idx => parseInt(parts[idx], 10))

    return { parts, blankIndices, answer }
  }

  randInt(min: number, max: number): number {
    if (min > max) [min, max] = [max, min]
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  setupProblem() {
    if (this.currentProblem >= this.problems.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    const prob = this.problems[this.currentProblem]
    this.equationParts = [...prob.parts]
    this.showResult = null
    this.resultTimer = 0
    this.dragTileIndex = -1
    this.clearAnimActive = false

    // C++ object dimensions for levelType 3: 297 x 383 (width x height)
    // Scale from C++ 2048-based coords to GAME coords
    const objW = Math.round(297 * SCALE_X)  // ~371
    const objH = Math.round(383 * SCALE_Y)  // ~479

    // Create slots for blanks
    // C++: equation placed at upper area of game view
    // getStartPoint centers items horizontally
    this.slots = []
    const slotW = objW
    const slotH = objH
    const spacing = objW + 20

    // C++ equation Y: startY = getStartPoint(yCount, (winSize.height/2)+(panelHeight/2), objH, true)
    // For single equation row, yCount=1, center = (CPP_H/2 + panelHeight/2) * SCALE_Y
    const eqCenterY = ((CPP_H / 2) + (this.panelHeight / 2)) * SCALE_Y
    const eqY = eqCenterY

    const totalEqWidth = prob.parts.length * spacing
    const eqStartX = (GAME_WIDTH - totalEqWidth) / 2

    for (const blankIdx of prob.blankIndices) {
      const sx = eqStartX + blankIdx * spacing + (spacing - slotW) / 2
      this.slots.push({
        x: sx, y: eqY - slotH / 2,
        w: slotW, h: slotH,
        filled: false, value: '',
        tileIndex: -1,
        type: parseInt(prob.parts[blankIdx], 10) || 0,
        rowType: K_OBJECT_TYPE_NUMBER,
      })
    }

    // Create tiles (correct answers + distractors)
    this.tiles = []
    const correctValues = prob.blankIndices.map(idx => prob.parts[idx])

    // C++ adds dummy values (2 distractors from the number range)
    const allValues = new Set(correctValues)
    const config = this.levelData
    const maxVal = config ? config.maxNumber : 10
    const minVal = config ? config.minNumber : 1

    // Add distractors until we have enough tiles
    // C++ panelCount determines total tiles on panel
    const targetTileCount = Math.max(correctValues.length + 2, config ? config.panelCount : 5)
    let attempts = 0
    while (allValues.size < targetTileCount && attempts < 100) {
      const v = this.randInt(minVal, maxVal)
      allValues.add(String(v))
      attempts++
    }

    const tileValues = this.shuffleArray(Array.from(allValues))

    // C++: Panel at bottom (panelHeight area)
    // Objects positioned at panelHeight/2 vertically
    const tileY = (this.panelHeight / 2) * SCALE_Y
    const tileW = objW
    const tileH = objH
    const tileGap = 20
    const tilesStartX = this.getStartPointX(tileValues.length, GAME_WIDTH / 2, tileW)

    for (let i = 0; i < tileValues.length; i++) {
      const tx = tilesStartX + i * tileW
      this.tiles.push({
        value: tileValues[i],
        x: tx, y: tileY - tileH / 2,
        w: tileW, h: tileH,
        originX: tx, originY: tileY - tileH / 2,
        dragging: false,
        placed: false,
        slotIndex: -1,
        type: parseInt(tileValues[i], 10) || 0,
        rowType: K_OBJECT_TYPE_NUMBER,
      })
    }

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  // C++ getStartPoint: centers items horizontally
  getStartPointX(count: number, mid: number, itemWidth: number): number {
    const surplus = (count % 2 === 0) ? 2 : 1
    const halfValue = Math.floor(count / 2)
    let addValue = 0
    if (surplus === 2 && halfValue > 1) addValue = (halfValue - 1) * (itemWidth / surplus)
    return mid - (halfValue * (itemWidth / surplus) + addValue)
  }

  shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  onPointerDown(x: number, y: number) {
    if (this.showResult) return

    // Check if tapping a tile
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const tile = this.tiles[i]
      if (tile.placed) continue
      if (x >= tile.x && x <= tile.x + tile.w && y >= tile.y && y <= tile.y + tile.h) {
        tile.dragging = true
        this.dragTileIndex = i
        this.dragOffsetX = x - tile.x
        this.dragOffsetY = y - tile.y
        return
      }
    }

    // Check if tapping a filled slot to remove tile
    for (let s = 0; s < this.slots.length; s++) {
      const slot = this.slots[s]
      if (!slot.filled) continue
      if (x >= slot.x && x <= slot.x + slot.w && y >= slot.y && y <= slot.y + slot.h) {
        const tile = this.tiles[slot.tileIndex]
        tile.placed = false
        tile.slotIndex = -1
        tile.x = tile.originX
        tile.y = tile.originY
        slot.filled = false
        slot.value = ''
        slot.tileIndex = -1
        return
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (this.dragTileIndex < 0) return
    const tile = this.tiles[this.dragTileIndex]
    tile.x = x - this.dragOffsetX
    tile.y = y - this.dragOffsetY
  }

  onPointerUp(_x: number, _y: number) {
    if (this.dragTileIndex < 0) return
    const tile = this.tiles[this.dragTileIndex]
    tile.dragging = false

    // C++ isSlotIn: check if tile center is within slot rect, AND type/rowType match
    let placed = false
    let isMiss = false

    for (let s = 0; s < this.slots.length; s++) {
      const slot = this.slots[s]
      if (slot.filled) continue

      const tileCX = tile.x + tile.w / 2
      const tileCY = tile.y + tile.h / 2

      // C++: slot rect check - center of slot, half-size tolerance
      const slotCX = slot.x + slot.w / 2
      const slotCY = slot.y + slot.h / 2

      if (Math.abs(tileCX - slotCX) < slot.w / 2 && Math.abs(tileCY - slotCY) < slot.h / 2) {
        // C++: check type and rowType match
        if (tile.type === slot.type && tile.rowType === slot.rowType) {
          // Correct slot match
          tile.x = slot.x + (slot.w - tile.w) / 2
          tile.y = slot.y + (slot.h - tile.h) / 2
          tile.placed = true
          tile.slotIndex = s
          slot.filled = true
          slot.value = tile.value
          slot.tileIndex = this.dragTileIndex
          placed = true
          playSound(this.sfxPlace)
          break
        } else {
          // C++: wrong type in correct position -> miss
          isMiss = true
        }
      }
    }

    if (!placed) {
      // Return to origin
      tile.x = tile.originX
      tile.y = tile.originY

      if (isMiss) {
        playSound(this.sfxMiss)
      }
    }

    this.dragTileIndex = -1

    // C++: check if all slots filled (m_StageSuccCount >= m_StageClearCount)
    const filledCount = this.slots.filter(s => s.filled).length
    if (filledCount >= this.slots.length && this.slots.length > 0) {
      this.onAllSlotsFilled()
    }
  }

  onAllSlotsFilled() {
    // C++: increment stage, show clear animation, then next problem
    this.showResult = 'correct'
    this.solvedCount++
    playSound(this.sfxCorrect)

    // C++: setClearAnimationFlow with voice reading, then 1.2f delay x2
    setTimeout(() => {
      this.currentProblem++
      this.setupProblem()
    }, 2500)
  }

  update(_time: number, dt: number) {
    if (this.showResult) {
      this.resultTimer += dt
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)
    this.drawBackgroundImage(this.bgImage, w, h)

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw bottom panel (wooden board)
    this.drawPanel(gs)

    // Draw equation text (non-blank parts)
    this.drawEquationText(gs)

    // Draw slots (drop zones for blanks)
    this.drawSlots(gs)

    // Draw tiles (draggable number blocks)
    this.drawTiles(gs)

    // Draw result feedback
    if (this.showResult === 'correct') {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.2)'
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)
    }

    ctx.restore()
  }

  drawPanel(gs: number) {
    const { ctx } = this
    // C++: panel anchored MIDDLE_TOP at (winSize.width/2, panelHeight)
    // Panel is full width, panelHeight tall, at bottom
    const panelH = this.panelHeight * SCALE_Y
    const panelY = GAME_HEIGHT - panelH

    if (imgOk(this.boardImage)) {
      // Scale to fill width
      ctx.drawImage(this.boardImage, 0, panelY * gs, GAME_WIDTH * gs, panelH * gs)
    } else {
      ctx.fillStyle = '#8B7355'
      ctx.fillRect(0, panelY * gs, GAME_WIDTH * gs, panelH * gs)
    }
  }

  drawEquationText(gs: number) {
    const { ctx } = this
    if (this.problems.length === 0) return
    const prob = this.problems[this.currentProblem]
    if (!prob) return

    const objW = Math.round(297 * SCALE_X)
    const spacing = objW + 20
    const eqCenterY = ((CPP_H / 2) + (this.panelHeight / 2)) * SCALE_Y
    const eqY = eqCenterY
    const totalEqWidth = prob.parts.length * spacing
    const eqStartX = (GAME_WIDTH - totalEqWidth) / 2

    // C++ font: TodoSchoolV2.ttf, fontSize varies (220 for numbers, 200 for signs on cards)
    // Color: (165, 96, 83) for card text, (255,255,255) for hidden slots
    ctx.font = `bold ${90 * gs}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < prob.parts.length; i++) {
      if (prob.blankIndices.includes(i)) continue // skip blanks, drawn as slots
      const px = (eqStartX + i * spacing + spacing / 2) * gs
      const py = eqY * gs

      // Draw card background for non-blank parts
      const cardX = eqStartX + i * spacing + (spacing - objW) / 2
      const cardY = eqY - Math.round(383 * SCALE_Y) / 2
      const cardW = objW
      const cardH = Math.round(383 * SCALE_Y)

      if (imgOk(this.blockCardImage)) {
        ctx.drawImage(this.blockCardImage, cardX * gs, cardY * gs, cardW * gs, cardH * gs)
      } else {
        ctx.fillStyle = '#FFF3E0'
        ctx.beginPath()
        ctx.roundRect(cardX * gs, cardY * gs, cardW * gs, cardH * gs, 14 * gs)
        ctx.fill()
        ctx.strokeStyle = '#BCAAA4'
        ctx.lineWidth = 2 * gs
        ctx.stroke()
      }

      // C++ text color: (165, 96, 83)
      ctx.fillStyle = 'rgb(165, 96, 83)'
      ctx.fillText(prob.parts[i], px, py)
    }
  }

  drawSlots(gs: number) {
    const { ctx } = this

    for (const slot of this.slots) {
      // C++: block_drop_bg.png as slot background
      if (imgOk(this.blockDropBgImage)) {
        ctx.drawImage(this.blockDropBgImage, slot.x * gs, slot.y * gs, slot.w * gs, slot.h * gs)
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.strokeStyle = 'rgba(165, 96, 83, 0.5)'
        ctx.lineWidth = 3 * gs
        ctx.setLineDash([8 * gs, 6 * gs])
        ctx.beginPath()
        ctx.roundRect(slot.x * gs, slot.y * gs, slot.w * gs, slot.h * gs, 12 * gs)
        ctx.fill()
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw question mark if not filled
      if (!slot.filled) {
        ctx.fillStyle = 'rgba(165, 96, 83, 0.4)'
        ctx.font = `bold ${60 * gs}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('?', (slot.x + slot.w / 2) * gs, (slot.y + slot.h / 2) * gs)
      }
    }
  }

  drawTiles(gs: number) {
    const { ctx } = this

    // Draw non-dragging tiles first
    for (let i = 0; i < this.tiles.length; i++) {
      if (i === this.dragTileIndex) continue
      this.drawOneTile(this.tiles[i], gs, false)
    }

    // Draw dragging tile on top
    if (this.dragTileIndex >= 0) {
      this.drawOneTile(this.tiles[this.dragTileIndex], gs, true)
    }
  }

  drawOneTile(tile: Tile, gs: number, isDragging: boolean) {
    const { ctx } = this
    if (tile.placed && !isDragging) return

    const x = tile.x * gs
    const y = tile.y * gs
    const w = tile.w * gs
    const h = tile.h * gs
    // C++: scale to 1.2 when dragging
    const scale = isDragging ? 1.2 : 1.0

    ctx.save()
    if (isDragging) {
      ctx.translate(x + w / 2, y + h / 2)
      ctx.scale(scale, scale)
      ctx.translate(-(x + w / 2), -(y + h / 2))
    }

    // C++: shadow behind tile (block_03_shadow.png)
    if (!isDragging && imgOk(this.blockShadowImage)) {
      ctx.drawImage(this.blockShadowImage, x + 4 * gs, y + 4 * gs, w, h)
    } else if (isDragging) {
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur = 15 * gs
      ctx.shadowOffsetX = 4 * gs
      ctx.shadowOffsetY = 4 * gs
    }

    // C++: line border (block_02.png)
    if (imgOk(this.blockLineImage)) {
      ctx.drawImage(this.blockLineImage, x + 4 * gs, y, w, h)
    }

    // C++: card face (block_01.png)
    if (imgOk(this.blockCardImage)) {
      ctx.drawImage(this.blockCardImage, x, y, w, h)
    } else {
      const gradient = ctx.createLinearGradient(x, y, x, y + h)
      gradient.addColorStop(0, '#FFF3E0')
      gradient.addColorStop(1, '#FFE0B2')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 14 * gs)
      ctx.fill()
      ctx.strokeStyle = '#BCAAA4'
      ctx.lineWidth = 2 * gs
      ctx.stroke()
    }

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Number text on tile - C++: fontSize 220 for numbers, color (165, 96, 83)
    ctx.fillStyle = 'rgb(165, 96, 83)'
    ctx.font = `bold ${90 * gs}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(tile.value, x + w / 2, y + h / 2)

    ctx.restore()
  }
}
