import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/movinginsects')
const INSECT_TYPES = ['ant', 'bee', 'beetle', 'bf', 'bf2', 'cockroach', 'ladybug', 'moth', 'sb', 'spider']

interface ProblemData {
  work: number
  op: 'PLUS' | 'MINUS'
  lhs: number
  rhs: number
  answer: number
}

interface WorkSetData {
  workSet: number
  problems: ProblemData[]
}

interface LevelData {
  level: number
  workSets: WorkSetData[]
}

interface Insect {
  x: number
  y: number
  type: string
  speed: number
  direction: number
  scale: number
  passed: boolean
}

interface AnswerCard {
  x: number
  y: number
  width: number
  height: number
  value: number
  selected: boolean
  correct: boolean | null
  animTime: number
}

export class MovingInsectsEngine extends BaseEngine {
  level: number
  levelData: LevelData | null = null
  currentWorkSet = 0
  currentProblem = 0
  insects: Insect[] = []
  answerCards: AnswerCard[] = []
  answer = 0
  lhs = 0
  rhs = 0
  op: 'PLUS' | 'MINUS' = 'PLUS'

  // Phase 1: show LHS insects moving right
  // Phase 2: show RHS insects (right for PLUS, leaving for MINUS)
  // Phase 3: show answer cards
  phase: 'lhs' | 'rhs' | 'answering' = 'lhs'
  insectsSpawned = 0
  insectsPassed = 0
  spawnTimer = 0
  phaseDelay = 0
  totalProblems = 0
  solvedCount = 0
  waitingForNext = false

  bgImage: HTMLImageElement
  insectImages: Map<string, HTMLImageElement> = new Map()
  cardFront: HTMLImageElement
  sfxHit: HTMLAudioElement
  sfxMiss: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(`${ASSET_PATH}/background/moving_image_bg.png`)
    this.cardFront = loadImage(`${ASSET_PATH}/card/moving_image_card-front.png`)

    for (const type of INSECT_TYPES) {
      this.insectImages.set(type, loadImage(`${ASSET_PATH}/shadows/${type}_normal_0001.png`))
    }

    this.sfxHit = loadAudio(`${ASSET_PATH}/sounds/card_hit.0.m4a`)
    this.sfxMiss = loadAudio(`${ASSET_PATH}/sounds/card_miss.m4a`)
  }

  async loadLevel() {
    const resp = await fetch('/data/games/movinginsects.json')
    const data = await resp.json()
    this.levelData = data.levels.find((l: LevelData) => l.level === this.level) || data.levels[0]
    if (!this.levelData) return
    this.totalProblems = this.levelData.workSets.reduce((sum, ws) => sum + ws.problems.length, 0)
    this.solvedCount = 0
    this.currentWorkSet = 0
    this.currentProblem = 0
    this.setupProblem()
  }

  setupProblem() {
    if (!this.levelData) return
    const ws = this.levelData.workSets[this.currentWorkSet]
    if (!ws) return
    const prob = ws.problems[this.currentProblem]
    if (!prob) return

    this.lhs = prob.lhs
    this.rhs = prob.rhs
    this.op = prob.op
    this.answer = prob.answer
    this.insects = []
    this.answerCards = []
    this.insectsSpawned = 0
    this.insectsPassed = 0
    this.spawnTimer = 0
    this.phaseDelay = 0
    this.phase = 'lhs'
    this.waitingForNext = false

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  start() {
    super.start()
    this.loadLevel()
  }

  generateChoices(): number[] {
    // C++ uses 10 cards numbered 0-9 (numberOfChoices() = 10)
    const choices: number[] = []
    for (let i = 0; i < 10; i++) {
      choices.push(i)
    }
    return choices
  }

  setupAnswerPhase() {
    this.phase = 'answering'
    const choices = this.generateChoices()

    // C++ Card size: 218 x 338 (MainDepot::cardSize)
    // C++ PlayerBase at (GameSize.width/2, 36) anchor MIDDLE_BOTTOM
    // PlayerBase contentSize = (GameSize.width, cardSize.height) = (2560, 338)
    // C++ card slot: MarginX = 34, OffsetX = (cardW + MarginX) * (Index - (SlotCount-1)/2)
    // SlotCount = 10, so center offset = (10-1)/2 = 4.5
    // Card center X = GameSize.width/2 + (218+34)*(i - 4.5) = 1280 + 252*(i-4.5)
    // C++ card center Y in PlayerBase = cardH/2 = 169
    // PlayerBase at y=36 from bottom => card center at y=36+169=205 from bottom
    // In web Y-down: cardY = GAME_HEIGHT - 205 = 1595
    const cardW = 218
    const cardH = 338
    const marginX = 34
    const cardY = GAME_HEIGHT - 36 - cardH / 2

    this.answerCards = choices.map((value, i) => ({
      x: GAME_WIDTH / 2 + (cardW + marginX) * (i - 4.5),
      y: cardY,
      width: cardW, height: cardH,
      value, selected: false, correct: null, animTime: 0,
    }))
  }

  onPointerDown(x: number, y: number) {
    if (this.waitingForNext || this.phase !== 'answering') return

    for (const card of this.answerCards) {
      if (card.selected) continue
      const hw = card.width / 2
      const hh = card.height / 2
      if (x >= card.x - hw && x <= card.x + hw && y >= card.y - hh && y <= card.y + hh) {
        card.selected = true
        card.correct = card.value === this.answer

        if (card.correct) {
          playSound(this.sfxHit)
          this.solvedCount++
          this.waitingForNext = true
          setTimeout(() => this.advanceProblem(), 1200)
        } else {
          playSound(this.sfxMiss)
          setTimeout(() => { card.selected = false; card.correct = null }, 600)
        }
        break
      }
    }
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  advanceProblem() {
    if (!this.levelData) return
    const ws = this.levelData.workSets[this.currentWorkSet]
    if (this.currentProblem < ws.problems.length - 1) {
      this.currentProblem++
      this.setupProblem()
    } else if (this.currentWorkSet < this.levelData.workSets.length - 1) {
      this.currentWorkSet++
      this.currentProblem = 0
      this.setupProblem()
    } else {
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  spawnInsect(direction: number) {
    const type = INSECT_TYPES[Math.floor(Math.random() * INSECT_TYPES.length)]
    // C++ CountField: positioned at (GameSize.width/2, GameSize.height) anchor MIDDLE_TOP
    // ContentSize height = GameSize.height - (36+338+50+453) = 1800 - 877 = 923
    // So CountField spans from y=0 to y=923 in web (top of screen to GameBoard top)
    // GameBoard bottom in web: GAME_HEIGHT - 424 = 1376
    // GameBoard top in web: 1376 - 453 = 923
    // CountField in web: y=0 to y=923 (with some margin)
    const insectAreaTop = 50
    const insectAreaBottom = 870
    const y = insectAreaTop + Math.random() * (insectAreaBottom - insectAreaTop)
    this.insects.push({
      x: direction === 1 ? -100 : GAME_WIDTH + 100,
      y, type,
      speed: 350 + Math.random() * 200,
      direction,
      scale: 0.8 + Math.random() * 0.4,
      passed: false,
    })
    this.insectsSpawned++
  }

  update(_time: number, dt: number) {
    const targetCount = this.phase === 'lhs' ? this.lhs : this.rhs

    if (this.phase === 'lhs' || this.phase === 'rhs') {
      this.spawnTimer += dt

      if (this.insectsSpawned < targetCount && this.spawnTimer >= 0.6) {
        this.spawnTimer = 0
        const dir = (this.phase === 'rhs' && this.op === 'MINUS') ? -1 : 1
        this.spawnInsect(dir)
      }

      // Move insects
      for (const insect of this.insects) {
        insect.x += insect.speed * insect.direction * dt
        if (!insect.passed) {
          if ((insect.direction === 1 && insect.x > GAME_WIDTH + 50) ||
              (insect.direction === -1 && insect.x < -50)) {
            insect.passed = true
            this.insectsPassed++
          }
        }
      }

      // Transition phases
      if (this.insectsPassed >= targetCount && this.insectsSpawned >= targetCount) {
        if (this.phase === 'lhs') {
          this.phase = 'rhs'
          this.insectsSpawned = 0
          this.insectsPassed = 0
          this.spawnTimer = 0
          this.insects = []
        } else {
          this.phaseDelay += dt
          if (this.phaseDelay > 0.5) {
            this.setupAnswerPhase()
          }
        }
      }
    }

    for (const card of this.answerCards) {
      if (card.selected) card.animTime += dt
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

    // Draw equation display
    this.drawEquation(gs)

    // Draw insects
    for (const insect of this.insects) {
      if (insect.passed) continue
      const img = this.insectImages.get(insect.type)
      ctx.save()
      const x = insect.x * gs
      const y = insect.y * gs
      const size = 120 * insect.scale * gs
      ctx.translate(x, y)
      if (insect.direction === -1) ctx.scale(-1, 1)
      if (imgOk(img)) {
        ctx.drawImage(img!, -size / 2, -size / 2, size, size)
      } else {
        // Fallback insect: colored circle with antennae
        const r = size * 0.42
        const colors: Record<string, string> = {
          ant: '#333', bee: '#FFD700', beetle: '#1565C0', bf: '#E91E63',
          bf2: '#9C27B0', cockroach: '#4E342E', ladybug: '#F44336',
          moth: '#78909C', sb: '#66BB6A', spider: '#5D4037',
        }
        const col = colors[insect.type] ?? '#888'
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fillStyle = col
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'
        ctx.lineWidth = 2 * gs
        ctx.stroke()
        // Eyes
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#333'
        ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }

    // Draw answer cards
    if (this.phase === 'answering') {
      for (const card of this.answerCards) {
        this.drawCard(card, gs)
      }
    }

    ctx.restore()
  }

  drawEquation(gs: number) {
    const { ctx } = this
    // C++ GameBoard: contentSize = Size(1116, 453)
    // Positioned at (GameSize.width/2, 36 + 338 + 50) = y=424 from bottom, anchor MIDDLE_BOTTOM
    // In web coords (top=0): board bottom at y = GAME_HEIGHT - 424 = 1376
    // Board center: 1376 - 453/2 = 1376 - 226.5 = 1149.5
    const boardW = 1116
    const boardH = 453
    const boardCX = GAME_WIDTH / 2
    const boardBottomY = GAME_HEIGHT - 424
    const boardCY = boardBottomY - boardH / 2

    // Draw board background image (or fallback rectangle)
    ctx.fillStyle = 'rgba(50, 40, 30, 0.85)'
    ctx.beginPath()
    ctx.roundRect((boardCX - boardW / 2) * gs, (boardCY - boardH / 2) * gs, boardW * gs, boardH * gs, 20 * gs)
    ctx.fill()

    // C++ defaultFontSize: 270, defaultFontColor: Color4B(216, 209, 183, 255) = #D8D1B7
    // C++ labels positioned at y = CS.height/2 - 25 from center, using ANCHOR_MIDDLE_LEFT
    ctx.fillStyle = '#D8D1B7'
    ctx.font = `bold ${180 * gs}px TodoSchoolV2, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const opSymbol = this.op === 'PLUS' ? '+' : '-'
    const lhsShown = this.phase !== 'lhs' || this.insectsSpawned > 0
    const rhsShown = this.phase === 'rhs' || this.phase === 'answering'

    let text = ''
    if (lhsShown) text += this.lhs
    text += ` ${opSymbol} `
    if (rhsShown) text += this.rhs
    text += ' = ?'

    ctx.fillText(text, boardCX * gs, (boardCY - 15) * gs)
  }

  drawCard(card: AnswerCard, gs: number) {
    const { ctx } = this
    const x = card.x * gs
    const y = card.y * gs
    const w = card.width * gs
    const h = card.height * gs

    ctx.save()
    if (card.correct === true) ctx.globalAlpha = Math.max(1 - card.animTime, 0.3)

    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'
    ctx.shadowBlur = 6 * gs
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 14 * gs)
    ctx.fill()
    ctx.shadowColor = 'transparent'

    if (card.correct !== null) {
      ctx.strokeStyle = card.correct ? '#4CAF50' : '#F44336'
      ctx.lineWidth = 4 * gs
      ctx.stroke()
    }

    // C++ Card size: 218 x 338, titleFontSize: 220, titleFontColor: Color4B(161, 90, 50, 255)
    // Scale font to card: 220 * (218/cardNativeWidth) ~ proportional
    // C++ label positioned at FrontFace center + Vec2(0, -10)
    ctx.fillStyle = '#A15A32'
    ctx.font = `bold ${160 * gs}px TodoSchoolV2, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(card.value), x, y + 5 * gs)

    ctx.restore()
  }
}
