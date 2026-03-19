import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/woodenpuzzles')

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

export default class WoodenPuzzlesEngine extends BaseEngine {
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
  board10Image: HTMLImageElement
  board20Image: HTMLImageElement
  board30Image: HTMLImageElement
  buttonMiddle: HTMLImageElement
  buttonShadow: HTMLImageElement
  buttonTopImages: HTMLImageElement[] = []

  sfxCorrect: HTMLAudioElement
  sfxWrong: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    this.bgImage = loadImage(`${ASSET_PATH}/boards_image_background.jpg`)
    this.board10Image = loadImage(`${ASSET_PATH}/boards_image_10board.png`)
    this.board20Image = loadImage(`${ASSET_PATH}/boards_image_20board.png`)
    this.board30Image = loadImage(`${ASSET_PATH}/boards_image_30board.png`)
    this.buttonMiddle = loadImage(`${ASSET_PATH}/boards_button_middle.png`)
    this.buttonShadow = loadImage(`${ASSET_PATH}/boards_button_shadow.png`)

    // Load number button tops 00-10
    for (let i = 0; i <= 10; i++) {
      const pad = i < 10 ? `0${i}` : `${i}`
      this.buttonTopImages.push(loadImage(`${ASSET_PATH}/boards_button_top_${pad}.png`))
    }

    // C++ uses WoodenPuzzles/Sounds/card_hit.N.m4a for correct, card_miss.m4a for wrong
    this.sfxCorrect = loadAudio(assetUrl('/assets/games/comprehensiontest/sounds/card_hit.m4a'))
    this.sfxWrong = loadAudio(assetUrl('/assets/games/comprehensiontest/sounds/card_miss.m4a'))
  }

  async loadLevel() {
    const resp = await fetch('/data/games/woodenpuzzles.json')
    const data = await resp.json()

    // Data is an array of problems, filter by level
    this.problems = data.levels.filter((p: ProblemData) => p.level === this.level)

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

    // Determine hidden cell indices (track by index to handle duplicate values correctly)
    const suggestCount = prob.suggest.length
    let hiddenIndices: number[]

    if (prob.isRandom && suggestCount > 0) {
      const numToHide = Math.min(prob.problemNumber || suggestCount, totalNums)
      const indices = column.map((_, i) => i)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]]
      }
      hiddenIndices = indices.slice(0, numToHide)
    } else {
      // suggest contains values, find their indices in column
      const usedIndices = new Set<number>()
      hiddenIndices = []
      for (const sv of prob.suggest) {
        const idx = column.findIndex((v, i) => v === sv && !usedIndices.has(i))
        if (idx >= 0) {
          hiddenIndices.push(idx)
          usedIndices.add(idx)
        }
      }
    }

    const hiddenIndexSet = new Set(hiddenIndices)

    // Calculate grid dimensions
    // C++: GameBoard at (100, 900) middle-left, PlayField at (1280, 900) center
    const boardWidth = GAME_WIDTH * 0.55
    const boardHeight = GAME_HEIGHT * 0.5
    const boardX = 100
    const boardY = 900 - boardHeight / 2
    const cellW = boardWidth / cols
    const cellH = boardHeight / rows

    for (let i = 0; i < totalNums; i++) {
      const value = column[i]
      const row = Math.floor(i / cols)
      const col = i % cols
      const isHidden = hiddenIndexSet.has(i)

      this.cells.push({
        value,
        row,
        col,
        x: boardX + col * cellW,
        y: boardY + row * cellH,
        width: cellW,
        height: cellH,
        hidden: isHidden,
        filled: false,
        correct: false,
        animProgress: 0,
      })
    }

    // Create choice buttons from hidden values (shuffled)
    const choiceValues = hiddenIndices.map(i => column[i])
    for (let i = choiceValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[choiceValues[i], choiceValues[j]] = [choiceValues[j], choiceValues[i]]
    }

    // C++: DeckBase at (2460, 900) middle-right - choices arranged vertically on the right
    const choiceBtnW = 120
    const choiceBtnH = 110
    const choiceGap = 16
    const totalChoiceH = choiceValues.length * (choiceBtnH + choiceGap) - choiceGap
    const choiceStartX = 2460 - choiceBtnW / 2
    const choiceStartY = 900 - totalChoiceH / 2
    const choiceY = choiceStartY

    for (let i = 0; i < choiceValues.length; i++) {
      this.choices.push({
        value: choiceValues[i],
        x: choiceStartX,
        y: choiceStartY + i * (choiceBtnH + choiceGap),
        width: choiceBtnW,
        height: choiceBtnH,
      })
    }

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  getBoardImage(): HTMLImageElement {
    const prob = this.problems[this.currentProblemIndex]
    if (!prob) return this.board10Image
    const totalNums = prob.column.length
    if (totalNums <= 10) return this.board10Image
    if (totalNums <= 20) return this.board20Image
    return this.board30Image
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

      // Remove only one matching choice (not all with same value, in case of duplicates)
      const choiceIdx = this.choices.findIndex(c => c.value === value)
      if (choiceIdx >= 0) {
        this.choices.splice(choiceIdx, 1)
      }

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
      playSound(this.sfxWrong)
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
    this.drawBackgroundImage(this.bgImage, w, h)

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw board background image - C++: GameBoard at (100, 900)
    const boardImg = this.getBoardImage()
    if (imgOk(boardImg)) {
      const boardWidth = GAME_WIDTH * 0.55
      const boardHeight = GAME_HEIGHT * 0.55
      const bx = 100 * gs
      const by = (900 - boardHeight / 2 - 30) * gs
      ctx.drawImage(boardImg, bx, by, boardWidth * gs, boardHeight * gs)
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
    const pad = 3 * gs

    if (cell.hidden && !cell.filled) {
      // Empty slot with wooden look
      if (imgOk(this.buttonShadow)) {
        ctx.drawImage(this.buttonShadow, x + pad, y + pad, w - pad * 2, h - pad * 2)
      } else {
        ctx.fillStyle = 'rgba(60,30,10,0.3)'
        ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2)
      }

      // Draw question mark
      ctx.fillStyle = '#D2B48C'
      ctx.font = `bold ${Math.min(w, h) * 0.45}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', x + w / 2, y + h / 2)
    } else {
      // Filled cell with wooden button texture
      if (imgOk(this.buttonMiddle)) {
        ctx.drawImage(this.buttonMiddle, x + pad, y + pad, w - pad * 2, h - pad * 2)
      } else {
        ctx.fillStyle = cell.correct ? '#A5D6A7' : '#C19A6B'
        ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2)
      }

      // Draw number top texture for single digits
      const numIdx = cell.value <= 10 ? cell.value : -1
      if (numIdx >= 0 && numIdx < this.buttonTopImages.length && imgOk(this.buttonTopImages[numIdx])) {
        ctx.drawImage(this.buttonTopImages[numIdx], x + pad, y + pad, w - pad * 2, h - pad * 2)
      } else {
        // Draw number as text
        ctx.fillStyle = '#3E2723'
        ctx.font = `bold ${Math.min(w, h) * 0.4}px TodoMainCurly, sans-serif`
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

      ctx.strokeStyle = '#6D4C41'
      ctx.lineWidth = 1 * gs
      ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2)
    }
  }

  drawChoices(gs: number) {
    const { ctx } = this

    // Draw label
    ctx.fillStyle = '#FFF8E1'
    ctx.font = `bold ${34 * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 3 * gs
    ctx.fillText('Choose a number:', 2460 * gs, (900 - 400) * gs)
    ctx.shadowColor = 'transparent'

    for (const choice of this.choices) {
      const x = choice.x * gs
      const y = choice.y * gs
      const w = choice.width * gs
      const h = choice.height * gs

      // Draw wooden button background
      if (imgOk(this.buttonMiddle)) {
        ctx.drawImage(this.buttonMiddle, x, y, w, h)
      } else {
        ctx.fillStyle = '#C19A6B'
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, 10 * gs)
        ctx.fill()
      }

      // Draw shadow underneath
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 6 * gs
      ctx.shadowOffsetY = 3 * gs

      ctx.strokeStyle = '#5D4037'
      ctx.lineWidth = 2 * gs
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, 10 * gs)
      ctx.stroke()

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0

      // Number text
      const numIdx = choice.value <= 10 ? choice.value : -1
      if (numIdx >= 0 && numIdx < this.buttonTopImages.length && imgOk(this.buttonTopImages[numIdx])) {
        ctx.drawImage(this.buttonTopImages[numIdx], x + 10 * gs, y + 10 * gs, w - 20 * gs, h - 20 * gs)
      } else {
        ctx.fillStyle = '#3E2723'
        ctx.font = `bold ${38 * gs}px TodoMainCurly, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(choice.value), x + w / 2, y + h / 2)
      }
    }
  }
}
