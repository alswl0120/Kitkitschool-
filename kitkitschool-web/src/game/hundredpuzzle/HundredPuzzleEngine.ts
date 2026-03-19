import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/hundredpuzzle')

interface ProblemData {
  level: number
  problem: number
  column: number[]
  suggest: number[]
  isRandom: boolean
  problemNumber: number
}

interface Cell {
  value: number
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
  hidden: boolean
  filled: boolean
  correct: boolean
  animProgress: number
}

interface ChoiceButton {
  value: number
  x: number
  y: number
  width: number
  height: number
}

export default class HundredPuzzleEngine extends BaseEngine {
  level: number
  problems: ProblemData[] = []
  currentProblemIndex = 0
  cells: Cell[] = []
  choices: ChoiceButton[] = []
  selectedCell: Cell | null = null
  showResult: 'correct' | 'wrong' | null = null
  resultTimer = 0
  totalProblems = 0
  solvedCount = 0

  bgImage: HTMLImageElement
  boardImage: HTMLImageElement
  blockSurface: HTMLImageElement
  blockTexture: HTMLImageElement
  blockDepth: HTMLImageElement
  blockShadow: HTMLImageElement

  sfxCorrect: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    this.bgImage = loadImage(`${ASSET_PATH}/hundredpuzzle_bg.jpg`)
    this.boardImage = loadImage(`${ASSET_PATH}/hundredpuzzle_board.png`)
    this.blockSurface = loadImage(`${ASSET_PATH}/hundredpuzzle_block_middle_1_surface.png`)
    this.blockTexture = loadImage(`${ASSET_PATH}/hundredpuzzle_block_middle_2_texture.png`)
    this.blockDepth = loadImage(`${ASSET_PATH}/hundredpuzzle_block_middle_3_depth.png`)
    this.blockShadow = loadImage(`${ASSET_PATH}/hundredpuzzle_block_middle_4_shadow.png`)

    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
  }

  async loadLevel() {
    const resp = await fetch('/data/games/hundredpuzzle.json')
    const data = await resp.json()
    const levelKey = String(this.level)
    this.problems = data.levels[levelKey] || []

    if (this.problems.length === 0) return

    this.totalProblems = this.problems.length
    this.solvedCount = 0
    this.currentProblemIndex = 0
    this.setupProblem()
  }

  setupProblem() {
    const prob = this.problems[this.currentProblemIndex]
    if (!prob) return

    this.cells = []
    this.choices = []
    this.selectedCell = null
    this.showResult = null
    this.resultTimer = 0

    const column = prob.column
    const totalNums = column.length
    const cols = 10
    const rows = Math.ceil(totalNums / cols)

    // Determine which numbers to hide
    const suggestCount = prob.suggest.length
    let hiddenValues: number[]

    if (prob.isRandom && suggestCount > 0) {
      // Use suggest count to determine how many to hide, pick randomly
      const numToHide = Math.min(prob.problemNumber || suggestCount, totalNums)
      const indices = column.map((_, i) => i)
      // Shuffle and pick
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }
      hiddenValues = indices.slice(0, numToHide).map(i => column[i])
    } else {
      hiddenValues = [...prob.suggest]
    }

    // C++ unitSize = Size(138, 138), boardMargin = Size(82, 120)
    // C++ _gameBoard->setPosition(34, 36) with ANCHOR_BOTTOM_LEFT
    // In web Y-down: board bottom-left at (34, GAME_HEIGHT - 36 - boardHeight)
    // C++ target position for cell number n:
    //   x = boardPosX + boardMarginX + unitW * (n % 10)
    //   y = boardPosY + boardMarginY + unitH * (9 - n/10)  [Cocos2d Y-up]
    // In web Y-down, we invert: y = boardTopY + boardMarginY + unitH * row
    const cellW = 138
    const cellH = 138
    const boardMarginX = 82
    const boardMarginY = 120
    const boardPosX = 34
    // C++ board image size determines the visual area
    // Board total width = boardMarginX*2 + cols*cellW = 82*2 + 10*138 = 1544
    // Board total height = boardMarginY + rows*cellH (+ some bottom margin)
    const boardImageW = boardMarginX * 2 + cols * cellW  // 1544
    const boardImageH = boardMarginY + rows * cellH + 36  // approximate
    // In web Y-down: board top = GAME_HEIGHT - 36 - boardImageH
    const boardTopY = GAME_HEIGHT - 36 - boardImageH
    const boardLeftX = boardPosX

    for (let i = 0; i < totalNums; i++) {
      const value = column[i]
      const row = Math.floor(i / cols)
      const col = i % cols
      const isHidden = hiddenValues.includes(value)

      this.cells.push({
        value,
        row,
        col,
        x: boardLeftX + boardMarginX + col * cellW,
        y: boardTopY + boardMarginY + row * cellH,
        width: cellW,
        height: cellH,
        hidden: isHidden,
        filled: false,
        correct: false,
        animProgress: 0,
      })
    }

    // Create choice buttons from hidden values (shuffled)
    const choiceValues = [...hiddenValues]
    for (let i = choiceValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[choiceValues[i], choiceValues[j]] = [choiceValues[j], choiceValues[i]]
    }

    // Place choice buttons in the empty upper area (above the board), centred horizontally.
    // The board starts at boardTopY ≈ GAME_HEIGHT - 36 - boardImageH, so the upper area
    // spans 0..boardTopY. We put choices + label in the lower half of that space.
    const choiceBtnW = 138
    const choiceBtnH = 138
    const choiceGap = 24
    const choicesPerRow = Math.min(choiceValues.length, 8)
    const totalChoiceW = choicesPerRow * (choiceBtnW + choiceGap) - choiceGap
    const choiceStartX = (GAME_WIDTH - totalChoiceW) / 2
    // Place the choice row about 200px above the board top, centred vertically in upper area
    const choiceAreaCenterY = boardTopY * 0.65          // 65% down the upper empty area
    const choiceY = Math.max(choiceAreaCenterY - choiceBtnH / 2, 100)

    for (let i = 0; i < choiceValues.length; i++) {
      const row = Math.floor(i / choicesPerRow)
      const col = i % choicesPerRow
      const rowTotalW = Math.min(choiceValues.length - row * choicesPerRow, choicesPerRow) * (choiceBtnW + choiceGap) - choiceGap
      const rowStartX = (GAME_WIDTH - rowTotalW) / 2
      this.choices.push({
        value: choiceValues[i],
        x: rowStartX + col * (choiceBtnW + choiceGap),
        y: choiceY + row * (choiceBtnH + choiceGap),
        width: choiceBtnW,
        height: choiceBtnH,
      })
    }

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  start() {
    super.start()
    this.loadLevel()
  }

  onPointerDown(x: number, y: number) {
    if (this.showResult) return

    // Check if tapping on a hidden (unfilled) cell
    for (const cell of this.cells) {
      if (cell.hidden && !cell.filled) {
        if (x >= cell.x && x <= cell.x + cell.width &&
            y >= cell.y && y <= cell.y + cell.height) {
          this.selectedCell = cell
          return
        }
      }
    }

    // Check if tapping on a choice button
    if (this.selectedCell) {
      for (const choice of this.choices) {
        if (x >= choice.x && x <= choice.x + choice.width &&
            y >= choice.y && y <= choice.y + choice.height) {
          this.checkAnswer(choice.value)
          return
        }
      }
    }
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  checkAnswer(value: number) {
    if (!this.selectedCell) return

    if (value === this.selectedCell.value) {
      this.selectedCell.filled = true
      this.selectedCell.correct = true
      this.showResult = 'correct'
      playSound(this.sfxCorrect)

      // Remove the used choice
      this.choices = this.choices.filter(c => c.value !== value)

      const allFilled = this.cells.filter(c => c.hidden).every(c => c.filled)

      setTimeout(() => {
        this.showResult = null
        this.selectedCell = null

        if (allFilled) {
          this.solvedCount++
          this.advanceProblem()
        }
      }, 600)
    } else {
      this.showResult = 'wrong'
      setTimeout(() => {
        this.showResult = null
      }, 500)
    }
  }

  advanceProblem() {
    if (this.currentProblemIndex < this.problems.length - 1) {
      this.currentProblemIndex++
      this.setupProblem()
    } else {
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  update(_time: number, dt: number) {
    for (const cell of this.cells) {
      if (cell.correct && cell.animProgress < 1) {
        cell.animProgress = Math.min(cell.animProgress + dt * 4, 1)
      }
    }
    if (this.showResult) {
      this.resultTimer += dt
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)
    if (this.bgImage.complete && this.bgImage.naturalWidth > 0) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      ctx.fillStyle = '#3E2723'
      ctx.fillRect(0, 0, w, h)
    }

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw board background - C++ board at position (34, 36) anchor BOTTOM_LEFT
    // In web Y-down, we need to compute the board position to match cell positions
    if (this.boardImage.complete && this.boardImage.naturalWidth > 0 && this.cells.length > 0) {
      const boardCols = 10
      const boardRows = Math.ceil(this.cells.length / boardCols)
      const boardWidth = boardCols * 138 + 82 * 2  // 1544
      const boardHeight = 120 + boardRows * 138 + 36
      const boardImageH = boardHeight
      const boardTopY = GAME_HEIGHT - 36 - boardImageH
      const bx = 34 * gs
      const by = boardTopY * gs
      ctx.drawImage(this.boardImage, bx, by, boardWidth * gs, boardHeight * gs)
    }

    // Draw cells
    for (const cell of this.cells) {
      this.drawCell(cell, gs)
    }

    // Draw selected cell highlight
    if (this.selectedCell && !this.selectedCell.filled) {
      ctx.strokeStyle = '#FFD700'
      ctx.lineWidth = 4 * gs
      ctx.strokeRect(
        this.selectedCell.x * gs, this.selectedCell.y * gs,
        this.selectedCell.width * gs, this.selectedCell.height * gs
      )
    }

    // Draw choice buttons
    this.drawChoices(gs)

    // Draw result feedback
    if (this.showResult) {
      ctx.fillStyle = this.showResult === 'correct'
        ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)
    }

    ctx.restore()
  }

  drawCell(cell: Cell, gs: number) {
    const { ctx } = this
    const x = cell.x * gs
    const y = cell.y * gs
    const w = cell.width * gs
    const h = cell.height * gs
    const pad = 2 * gs

    if (cell.hidden && !cell.filled) {
      // Empty slot - draw shadow/outline
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2)
      ctx.strokeStyle = '#8B7355'
      ctx.lineWidth = 2 * gs
      ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2)

      // Draw question mark
      ctx.fillStyle = '#8B7355'
      ctx.font = `bold ${75 * gs}px TodoSchoolV2, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', x + w / 2, y + h / 2)
    } else {
      // Filled cell - draw block
      if (this.blockSurface.complete && this.blockSurface.naturalWidth > 0) {
        ctx.drawImage(this.blockSurface, x + pad, y + pad, w - pad * 2, h - pad * 2)
      } else {
        ctx.fillStyle = cell.correct ? '#A5D6A7' : '#D2B48C'
        ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2)
      }

      ctx.strokeStyle = '#8B7355'
      ctx.lineWidth = 1 * gs
      ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2)

      // Draw number - C++ fontSize: 75, color: Color4B(240, 240, 213, 255)
      ctx.fillStyle = '#F0F0D5'
      ctx.font = `bold ${75 * gs}px TodoSchoolV2, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (cell.correct && cell.animProgress < 1) {
        const scale = 1 + Math.sin(cell.animProgress * Math.PI) * 0.3
        ctx.save()
        ctx.translate(x + w / 2, y + h / 2)
        ctx.scale(scale, scale)
        ctx.fillText(String(cell.value), 0, 0)
        ctx.restore()
      } else {
        ctx.fillText(String(cell.value), x + w / 2, y + h / 2)
      }
    }
  }

  drawChoices(gs: number) {
    const { ctx } = this

    if (this.choices.length === 0) return

    // Draw label above the first choice row
    const firstChoice = this.choices[0]
    const labelY = firstChoice.y - 70
    ctx.fillStyle = '#FFF8E1'
    ctx.font = `bold ${40 * gs}px TodoSchoolV2, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Choose a number:', GAME_WIDTH / 2 * gs, labelY * gs)

    for (const choice of this.choices) {
      const x = choice.x * gs
      const y = choice.y * gs
      const w = choice.width * gs
      const h = choice.height * gs

      // Button background
      ctx.fillStyle = '#F5DEB3'
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 6 * gs
      ctx.shadowOffsetY = 3 * gs
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 12 * gs)
      ctx.fill()
      ctx.shadowColor = 'transparent'

      ctx.strokeStyle = '#8B6914'
      ctx.lineWidth = 2 * gs
      ctx.stroke()

      // Number text
      ctx.fillStyle = '#3E2723'
      ctx.font = `bold ${40 * gs}px TodoSchoolV2, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(choice.value), x + w / 2, y + h / 2)
    }
  }
}
