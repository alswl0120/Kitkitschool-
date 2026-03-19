import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/wordmachine')
const POPUP_PATH = assetUrl('/assets/common/completepopup')

// C++ consonant/vowel pools
const VOWELS_SET = new Set(['a', 'e', 'i', 'o', 'u'])
const CONSONANT_POOL = 'bcdfghjklmnpqrstvwxyz'.split('')
const VOWEL_POOL = 'aeiou'.split('')

// Bounce-out easing (matches C++ EaseBounceOut)
function easeBounceOut(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t
  if (t < 2 / 2.75) { const u = t - 1.5 / 2.75; return 7.5625 * u * u + 0.75 }
  if (t < 2.5 / 2.75) { const u = t - 2.25 / 2.75; return 7.5625 * u * u + 0.9375 }
  const u = t - 2.625 / 2.75; return 7.5625 * u * u + 0.984375
}

// C++ EaseOut (quadratic)
function easeOut(t: number): number {
  return t * (2 - t)
}

interface ProblemData {
  problem: number
  type: string
  word: string
  goodImage: string | null
  badImage: string | null
  sound: string | null
}

interface WorksheetData {
  worksheet: number
  problems: ProblemData[]
}

interface LevelData {
  level: number
  worksheets: WorksheetData[]
}

// C++ LetterWheel physics model
interface SlotColumn {
  pool: string[]
  currentOffset: number
  targetLetter: string
  targetIndex: number
  velocity: number
  acceleration: number
  initVelocity: number
  slowdownTimer: number
  slowdownStarted: boolean
  stopping: boolean
  stopped: boolean
  stoppedLetter: string
  bounceAnim: number
  lastTickIdx: number  // for tick sound
}

// C++ image card
interface ImageCard {
  image: HTMLImageElement
  isGood: boolean
  centerX: number
  startY: number
  currentY: number
  targetY: number
  animTime: number
  animDelay: number     // C++: random 0-0.2s delay per card
  shakeOffset: number
  shakeTimer: number
  exitAnim: number      // 0 = not exiting, >0 = flying out
  scaleAnim: number     // for correct card scale-up
  exitDone: boolean
}

type Phase = 'idle' | 'spinning' | 'postStop' | 'imageSelect' | 'correct' | 'wrong'

export class WordMachineEngine extends BaseEngine {
  level: number
  levelData: LevelData | null = null
  currentWorksheet = 0
  currentProblem = 0
  totalProblems = 0
  solvedCount = 0

  targetWord = ''
  columns: SlotColumn[] = []

  phase: Phase = 'idle'
  postStopTimer = 0
  resultTimer = 0
  celebrateTimer = 0
  spinningTime = 0
  numSpinningWheels = 0

  leftCard: ImageCard | null = null
  rightCard: ImageCard | null = null

  // === C++ Assets ===
  bgImage: HTMLImageElement
  slotWheelBg: HTMLImageElement     // wm_4letters_slotwheel_2.png
  frameLeft: HTMLImageElement       // wm_oneslot_frame_left.png
  frameMid: HTMLImageElement        // wm_oneslot_frame.png
  frameRight: HTMLImageElement      // wm_oneslot_frame_right.png
  slotFrame: HTMLImageElement       // wm_slot_frame.png
  startBtn1: HTMLImageElement       // wm_button_1.png (normal)
  startBtn2: HTMLImageElement       // wm_button_2.png (pressed)
  cardFrame: HTMLImageElement       // wm_word_frame.png
  cardFrame2: HTMLImageElement      // wm_word_frame_2.png
  cardClip: HTMLImageElement        // wm_wordslot_card.png

  // Completion popup assets
  popupGlow: HTMLImageElement
  popupRotLeft: HTMLImageElement
  popupRotRight: HTMLImageElement
  popupStarMedal: HTMLImageElement
  popupSparkle: HTMLImageElement

  // Sound effects
  sfxTick: HTMLAudioElement         // c3.m4a (wheel tick during spin)
  sfxStop: HTMLAudioElement         // c1.m4a (wheel lands)
  sfxButton: HTMLAudioElement       // button.m4a
  sfxBoing: HTMLAudioElement        // boing1.m4a (wrong answer)
  sfxStar: HTMLAudioElement         // UI_Star_Collected effect
  sfxCorrect: HTMLAudioElement

  startBtnPressed = false

  onProgressChange?: (current: number, max: number) => void

  // C++ layout constants
  readonly COL_HEIGHT = 700
  readonly LETTER_HEIGHT = 350
  readonly LETTER_FONT = 270
  readonly CARD_W = 692
  readonly CARD_H = 564
  // C++ perspective skew factor
  readonly SKEW = 0.6

  getSlotFactor(): number {
    const n = this.columns.length
    if (n <= 4) return 1.0
    if (n === 5) return 0.9
    return 0.8
  }
  getSlotWidth(): number { return 545 * this.getSlotFactor() }
  getColWidth(): number { return 400 * this.getSlotFactor() }
  getColGap(): number { return this.getSlotWidth() - this.getColWidth() }
  getMachineY(): number { return GAME_HEIGHT / 2 - 300 - this.COL_HEIGHT / 2 }

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    // Load C++ assets
    this.bgImage = loadImage(`${ASSET_PATH}/wm_bg.png`)
    this.slotWheelBg = loadImage(`${ASSET_PATH}/wm_4letters_slotwheel_2.png`)
    this.frameLeft = loadImage(`${ASSET_PATH}/wm_oneslot_frame_left.png`)
    this.frameMid = loadImage(`${ASSET_PATH}/wm_oneslot_frame.png`)
    this.frameRight = loadImage(`${ASSET_PATH}/wm_oneslot_frame_right.png`)
    this.slotFrame = loadImage(`${ASSET_PATH}/wm_slot_frame.png`)
    this.startBtn1 = loadImage(`${ASSET_PATH}/wm_button_1.png`)
    this.startBtn2 = loadImage(`${ASSET_PATH}/wm_button_2.png`)
    this.cardFrame = loadImage(`${ASSET_PATH}/wm_word_frame.png`)
    this.cardFrame2 = loadImage(`${ASSET_PATH}/wm_word_frame_2.png`)
    this.cardClip = loadImage(`${ASSET_PATH}/wm_wordslot_card.png`)

    // Completion popup
    this.popupGlow = loadImage(`${POPUP_PATH}/game_effect_glow.png`)
    this.popupRotLeft = loadImage(`${POPUP_PATH}/game_effect_rotatingleft.png`)
    this.popupRotRight = loadImage(`${POPUP_PATH}/game_effect_rotatingright.png`)
    this.popupStarMedal = loadImage(`${POPUP_PATH}/game_effect_starmedal.png`)
    this.popupSparkle = loadImage(`${POPUP_PATH}/game_effect_sparkle_1.png`)

    // Sound effects
    this.sfxTick = loadAudio(`${ASSET_PATH}/c3.m4a`)
    this.sfxStop = loadAudio(`${ASSET_PATH}/c1.m4a`)
    this.sfxButton = loadAudio(`${ASSET_PATH}/button.m4a`)
    this.sfxBoing = loadAudio(`${ASSET_PATH}/boing1.m4a`)
    this.sfxStar = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
  }

  async loadLevel() {
    try {
      const resp = await fetch('/data/games/wordmachine.json')
      const data = await resp.json()
      this.levelData = data.levels.find((l: LevelData) => l.level === this.level) || null
    } catch {
      this.levelData = null
    }

    if (!this.levelData) {
      const fallbackWords = ['cat', 'dog', 'sun', 'hat', 'pig', 'bed', 'bug']
      const problems: ProblemData[] = fallbackWords.map((w, i) => ({
        problem: i + 1, type: 'LEGIT', word: w,
        goodImage: null, badImage: null, sound: null,
      }))
      this.levelData = {
        level: this.level,
        worksheets: [{ worksheet: 1, problems }],
      }
    }

    this.totalProblems = this.levelData.worksheets.reduce(
      (sum, ws) => sum + ws.problems.length, 0
    )
    this.solvedCount = 0
    this.currentWorksheet = 0
    this.currentProblem = 0
    this.setupProblem()
  }

  setupProblem() {
    if (!this.levelData) return
    const ws = this.levelData.worksheets[this.currentWorksheet]
    if (!ws) return
    const prob = ws.problems[this.currentProblem]
    if (!prob) return

    this.targetWord = prob.word.toLowerCase()
    this.phase = 'idle'
    this.postStopTimer = 0
    this.resultTimer = 0
    this.celebrateTimer = 0
    this.numSpinningWheels = 0
    this.leftCard = null
    this.rightCard = null
    this.startBtnPressed = false

    // Build columns with C/V pools
    this.columns = []
    for (let i = 0; i < this.targetWord.length; i++) {
      const letter = this.targetWord[i]
      const isVowel = VOWELS_SET.has(letter)
      const pool = isVowel ? [...VOWEL_POOL] : [...CONSONANT_POOL]
      const targetIndex = pool.indexOf(letter)

      this.columns.push({
        pool,
        currentOffset: Math.random() * pool.length,
        targetLetter: letter,
        targetIndex: targetIndex >= 0 ? targetIndex : 0,
        velocity: 0,
        acceleration: 0,
        initVelocity: 0,
        slowdownTimer: 0,
        slowdownStarted: false,
        stopping: false,
        stopped: false,
        stoppedLetter: '',
        bounceAnim: 0,
        lastTickIdx: -1,
      })
    }

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  start() {
    super.start()
    this.loadLevel()
  }

  // === C++ Game Flow ===

  onStartClicked() {
    if (this.phase !== 'idle') return
    this.phase = 'spinning'
    this.spinningTime = 0
    playSound(this.sfxButton)

    const n = this.columns.length
    this.numSpinningWheels = n

    for (let i = 0; i < n; i++) {
      const col = this.columns[i]
      const isEven = i % 2 === 0
      if (n <= 4) {
        col.initVelocity = isEven
          ? 15.7 + Math.random() * 2.2
          : 11.4 + Math.random() * 2.2
      } else {
        col.initVelocity = isEven
          ? 17.1 + Math.random() * 2.9
          : 11.4 + Math.random() * 2.9
      }
      col.velocity = col.initVelocity
      col.acceleration = 0
      col.stopped = false
      col.stopping = false
      col.slowdownStarted = false
      col.stoppedLetter = ''
      col.bounceAnim = 0
      col.lastTickIdx = -1
    }

    let totalDelay = 0
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        totalDelay += n <= 4 ? (0.3 + Math.random() * 0.2) : 0.3
      } else {
        totalDelay += n <= 4 ? 0.2 : 0.1
      }
      this.columns[i].slowdownTimer = totalDelay
    }
  }

  onWheelStopped(_wheelIndex: number) {
    // C++: play stop "clunk" sound
    playSound(this.sfxStop)

    this.numSpinningWheels--
    if (this.numSpinningWheels <= 0) {
      this.phase = 'postStop'
      this.postStopTimer = 0
    }
  }

  showImageCards() {
    if (!this.levelData) return
    const ws = this.levelData.worksheets[this.currentWorksheet]
    const prob = ws?.problems[this.currentProblem]

    if (!prob?.goodImage || !prob?.badImage) {
      this.phase = 'correct'
      playSound(this.sfxStar)
      this.solvedCount++
      this.celebrateTimer = 0
      this.resultTimer = 0
      setTimeout(() => this.advanceProblem(), 1200)
      return
    }

    const goodImg = loadImage(
      prob.goodImage.startsWith('images/')
        ? `${ASSET_PATH}/${prob.goodImage}`
        : `${ASSET_PATH}/images/${prob.goodImage}`
    )
    const badImg = loadImage(
      prob.badImage.startsWith('images/')
        ? `${ASSET_PATH}/${prob.badImage}`
        : `${ASSET_PATH}/images/${prob.badImage}`
    )

    const goodIsLeft = Math.random() < 0.5
    // C++ positions: ±750 from center, Y at _gameSize.height/2 - 500
    const cardTargetY = GAME_HEIGHT / 2 + 500
    const offScreenY = GAME_HEIGHT + this.CARD_H

    this.leftCard = {
      image: goodIsLeft ? goodImg : badImg,
      isGood: goodIsLeft,
      centerX: GAME_WIDTH / 2 - 750,
      startY: offScreenY, currentY: offScreenY,
      targetY: cardTargetY,
      animTime: 0,
      animDelay: Math.random() * 0.2,  // C++: random delay
      shakeOffset: 0, shakeTimer: 0,
      exitAnim: 0, scaleAnim: 0, exitDone: false,
    }
    this.rightCard = {
      image: goodIsLeft ? badImg : goodImg,
      isGood: !goodIsLeft,
      centerX: GAME_WIDTH / 2 + 750,
      startY: offScreenY, currentY: offScreenY,
      targetY: cardTargetY,
      animTime: 0,
      animDelay: Math.random() * 0.2,
      shakeOffset: 0, shakeTimer: 0,
      exitAnim: 0, scaleAnim: 0, exitDone: false,
    }

    this.phase = 'imageSelect'
  }

  onCardClicked(isGood: boolean) {
    if (isGood) {
      this.phase = 'correct'
      playSound(this.sfxStar)
      this.solvedCount++
      this.celebrateTimer = 0
      this.resultTimer = 0

      // C++: correct card scales up, then both exit after delay
      for (const card of [this.leftCard, this.rightCard]) {
        if (card && card.isGood) card.scaleAnim = 0.001 // start scale-up
        if (card && !card.isGood) card.exitAnim = 0.001 // wrong exits immediately
      }

      // C++: after 1.5s delay, correct card exits too
      setTimeout(() => {
        for (const card of [this.leftCard, this.rightCard]) {
          if (card && card.isGood && !card.exitDone) card.exitAnim = 0.001
        }
      }, 1500)

      setTimeout(() => this.advanceProblem(), 2000)
    } else {
      // C++: wrong answer → boing sound + shake
      playSound(this.sfxBoing)
      for (const card of [this.leftCard, this.rightCard]) {
        if (card && !card.isGood) card.shakeTimer = 0.2
      }
    }
  }

  advanceProblem() {
    if (!this.levelData) return
    const ws = this.levelData.worksheets[this.currentWorksheet]

    if (this.currentProblem < ws.problems.length - 1) {
      this.currentProblem++
      this.setupProblem()
    } else if (this.currentWorksheet < this.levelData.worksheets.length - 1) {
      this.currentWorksheet++
      this.currentProblem = 0
      this.setupProblem()
    } else {
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  // === Input ===

  onPointerDown(x: number, y: number) {
    if (this.phase === 'idle') {
      // C++: START button at center, Y = _gameSize.height/2 - 500
      const btnSize = 591 * 0.6 // scaled button
      const btnX = GAME_WIDTH / 2
      const btnY = GAME_HEIGHT / 2 + 500
      const hw = btnSize / 2, hh = btnSize / 2
      if (x >= btnX - hw && x <= btnX + hw && y >= btnY - hh && y <= btnY + hh) {
        this.startBtnPressed = true
        this.onStartClicked()
      }
    }

    if (this.phase === 'imageSelect') {
      for (const card of [this.leftCard, this.rightCard]) {
        if (card && !card.exitDone && this.isPointInCard(x, y, card)) {
          this.onCardClicked(card.isGood)
          break
        }
      }
    }
  }

  isPointInCard(px: number, py: number, card: ImageCard): boolean {
    return px >= card.centerX - this.CARD_W / 2 && px <= card.centerX + this.CARD_W / 2 &&
           py >= card.currentY - this.CARD_H / 2 && py <= card.currentY + this.CARD_H / 2
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  // === Update ===

  update(_time: number, dt: number) {
    this.spinningTime += dt

    if (this.phase === 'spinning') {
      this.updateWheelPhysics(dt)
    }

    if (this.phase === 'postStop') {
      this.postStopTimer += dt
      if (this.postStopTimer >= 0.7) {
        this.showImageCards()
      }
    }

    if (this.phase === 'correct') {
      this.celebrateTimer += dt
      this.resultTimer += dt
    }

    // Stopped wheel bounce
    for (const col of this.columns) {
      if (col.stopped) {
        col.bounceAnim = Math.min(col.bounceAnim + dt * 4, 1)
      }
    }

    // Animate image cards
    for (const card of [this.leftCard, this.rightCard]) {
      if (card) this.updateCardAnim(card, dt)
    }
  }

  updateWheelPhysics(dt: number) {
    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i]
      if (col.stopped) continue

      // Slowdown timer countdown
      if (!col.slowdownStarted && col.slowdownTimer > 0) {
        col.slowdownTimer -= dt
        if (col.slowdownTimer <= 0) {
          col.slowdownStarted = true
          col.acceleration = -col.initVelocity * 0.2
        }
      }

      col.velocity += col.acceleration * dt

      // Velocity floor
      if (col.slowdownStarted && !col.stopping) {
        col.velocity = Math.max(col.velocity, col.initVelocity / 2)
      }

      // Target letter check → hard stop
      if (col.slowdownStarted && !col.stopping) {
        const poolLen = col.pool.length
        const currentIdx = ((Math.floor(col.currentOffset) % poolLen) + poolLen) % poolLen
        if (currentIdx === col.targetIndex) {
          col.stopping = true
          col.acceleration = -col.velocity * 5.0
        }
      }

      // C++: tick sound when new letter scrolls into view
      const poolLen = col.pool.length
      const currentIdx = ((Math.floor(col.currentOffset) % poolLen) + poolLen) % poolLen
      if (currentIdx !== col.lastTickIdx) {
        col.lastTickIdx = currentIdx
        // Only play tick on last few wheels for audio clarity (C++ playTick)
        if (i >= this.columns.length - 3) {
          playSound(this.sfxTick, 0.15)
        }
      }

      col.currentOffset += col.velocity * dt

      // Full stop check
      if (col.stopping && col.velocity <= 0.5) {
        col.velocity = 0
        col.stopped = true
        col.stoppedLetter = col.targetLetter
        col.bounceAnim = 0
        const revolutions = Math.floor(col.currentOffset / poolLen)
        col.currentOffset = revolutions * poolLen + col.targetIndex
        this.onWheelStopped(i)
      }
    }
  }

  updateCardAnim(card: ImageCard, dt: number) {
    // Delay before entrance
    if (card.animDelay > 0) {
      card.animDelay -= dt
      return
    }

    // C++: bounce-up entrance (EaseBounceOut, 0.5s)
    if (card.animTime < 0.5 && card.exitAnim === 0) {
      card.animTime += dt
      const t = Math.min(card.animTime / 0.5, 1)
      const eased = easeBounceOut(t)
      card.currentY = card.startY + (card.targetY - card.startY) * eased
    }

    // C++: correct card scale-up (1.0 → 1.1 in 0.3s)
    if (card.scaleAnim > 0 && card.scaleAnim < 1) {
      card.scaleAnim = Math.min(card.scaleAnim + dt / 0.3, 1)
    }

    // C++: exit animation (EaseIn MoveBy upward, 0.3s)
    if (card.exitAnim > 0 && !card.exitDone) {
      card.exitAnim += dt
      const t = Math.min(card.exitAnim / 0.3, 1)
      const eased = t * t // EaseIn quadratic
      card.currentY = card.targetY - eased * (this.CARD_H + 200)
      if (t >= 1) card.exitDone = true
    }

    // C++: shake animation (wrong answer: -30, +60, -30 pixels)
    if (card.shakeTimer > 0) {
      card.shakeTimer -= dt
      const totalDur = 0.2
      const elapsed = totalDur - card.shakeTimer
      if (elapsed < 0.05) {
        // Move left 30px (EaseOut)
        const t = elapsed / 0.05
        card.shakeOffset = -30 * easeOut(t)
      } else if (elapsed < 0.15) {
        // Move right 60px (EaseInOut)
        const t = (elapsed - 0.05) / 0.1
        card.shakeOffset = -30 + 60 * (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t))
      } else {
        // Move left 30px (EaseIn)
        const t = (elapsed - 0.15) / 0.05
        card.shakeOffset = 30 - 30 * (t * t)
      }
      if (card.shakeTimer <= 0) {
        card.shakeOffset = 0
        card.shakeTimer = 0
      }
    }
  }

  // === Draw ===

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Background
    if (this.bgImage.complete && this.bgImage.naturalWidth > 0) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      const grad = ctx.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, '#1a1a2e')
      grad.addColorStop(1, '#16213e')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw spelled word above machine
    this.drawSpelledWord(gs)

    // Draw slot machine (wheel backgrounds → letters → frame overlays)
    // Clip wheel contents to the frame overlay area so nothing overflows
    ctx.save()
    this.clipSlotFrameArea(gs)
    this.drawSlotWheelBackgrounds(gs)
    this.drawSlotLetters(gs)
    ctx.restore()
    // Frame overlays drawn OUTSIDE clip so they render fully
    this.drawSlotFrameOverlays(gs)

    // Phase-specific UI
    if (this.phase === 'idle') {
      this.drawStartButton(gs)
    }

    if (this.phase === 'imageSelect' || this.phase === 'correct') {
      this.drawImageCards(gs)
    }

    if (this.phase === 'correct') {
      this.drawCelebration(gs)
    }

    ctx.restore()
  }

  drawSpelledWord(gs: number) {
    const { ctx } = this
    const machineY = this.getMachineY()
    const y = (machineY - 60) * gs

    ctx.fillStyle = '#FFD54F'
    ctx.font = `bold ${60 * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const display = this.columns.map(col =>
      col.stopped ? col.stoppedLetter.toUpperCase() : '_'
    ).join('  ')

    ctx.fillText(display, GAME_WIDTH / 2 * gs, y)
  }

  /** C++ START button using wm_button_1/2.png images */
  drawStartButton(gs: number) {
    const { ctx } = this
    const btnImg = this.startBtnPressed ? this.startBtn2 : this.startBtn1
    const btnSize = 591 * 0.6 // C++ button scale
    const btnX = GAME_WIDTH / 2
    const btnY = GAME_HEIGHT / 2 + 500
    const pulse = Math.sin(this.spinningTime * 3) * 0.03 + 1.0

    if (btnImg.complete && btnImg.naturalWidth > 0) {
      ctx.save()
      ctx.translate(btnX * gs, btnY * gs)
      ctx.scale(pulse, pulse)
      ctx.drawImage(btnImg, -btnSize / 2 * gs, -btnSize / 2 * gs, btnSize * gs, btnSize * gs)
      ctx.restore()
    } else {
      // Fallback drawn button
      const bw = 400 * gs, bh = 120 * gs
      ctx.fillStyle = '#FF5252'
      ctx.beginPath()
      ctx.roundRect((btnX - 200) * gs, (btnY - 60) * gs, bw, bh, 20 * gs)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${50 * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('START', btnX * gs, btnY * gs)
    }
  }

  /** Clip region matching the frame overlay bounds so wheel contents don't overflow */
  clipSlotFrameArea(gs: number) {
    const { ctx } = this
    const colW = this.getColWidth()
    const colGap = this.getColGap()
    const machineY = this.getMachineY()
    const totalWidth = this.columns.length * colW + (this.columns.length - 1) * colGap
    const startX = (GAME_WIDTH - totalWidth) / 2
    const factor = this.getSlotFactor()
    const frameH = 816 * factor  // matches frame overlay height
    const cy = machineY + this.COL_HEIGHT / 2
    const clipTop = cy - frameH / 2
    const clipLeft = startX - 50  // extra horizontal margin
    const clipWidth = totalWidth + 100

    ctx.beginPath()
    ctx.rect(clipLeft * gs, clipTop * gs, clipWidth * gs, frameH * gs)
    ctx.clip()
  }

  /** Draw C++ slot wheel backgrounds (wm_4letters_slotwheel_2.png per column) */
  drawSlotWheelBackgrounds(gs: number) {
    const { ctx } = this
    const slotW = this.getSlotWidth()
    const colW = this.getColWidth()
    const colGap = this.getColGap()
    const machineY = this.getMachineY()
    const totalWidth = this.columns.length * colW + (this.columns.length - 1) * colGap
    const startX = (GAME_WIDTH - totalWidth) / 2

    for (let i = 0; i < this.columns.length; i++) {
      const cx = startX + i * (colW + colGap) + colW / 2

      if (this.slotWheelBg.complete && this.slotWheelBg.naturalWidth > 0) {
        const imgW = slotW * gs
        const imgH = this.COL_HEIGHT * 1.1 * gs
        ctx.drawImage(this.slotWheelBg,
          cx * gs - imgW / 2, machineY * gs - 10 * gs,
          imgW, imgH)
      } else {
        // Fallback dark rect
        ctx.fillStyle = '#1a1a3e'
        ctx.beginPath()
        ctx.roundRect(
          (cx - colW / 2) * gs, machineY * gs,
          colW * gs, this.COL_HEIGHT * gs, 10 * gs)
        ctx.fill()
      }
    }
  }

  /** Draw letters inside slot columns with C++ perspective scaling */
  drawSlotLetters(gs: number) {
    const { ctx } = this
    const colW = this.getColWidth()
    const colGap = this.getColGap()
    const machineY = this.getMachineY()
    const totalWidth = this.columns.length * colW + (this.columns.length - 1) * colGap
    const startX = (GAME_WIDTH - totalWidth) / 2
    const slotW = this.getSlotWidth()

    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i]
      const cx = startX + i * (colW + colGap) + colW / 2
      const cy = machineY + this.COL_HEIGHT / 2

      // Clip to column area
      ctx.save()
      ctx.beginPath()
      ctx.rect(
        (cx - slotW / 2) * gs, machineY * gs,
        slotW * gs, this.COL_HEIGHT * gs)
      ctx.clip()

      if (col.stopped) {
        // Stopped: gold letter with bounce
        const bounce = Math.sin(col.bounceAnim * Math.PI) * 15 * gs
        ctx.fillStyle = '#FFD740'
        ctx.font = `bold ${this.LETTER_FONT * gs}px OpenSans, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(col.stoppedLetter.toUpperCase(), cx * gs, cy * gs - bounce)
      } else if (this.phase === 'idle') {
        // Idle: gray letter (static)
        const poolLen = col.pool.length
        const idx = ((Math.floor(col.currentOffset) % poolLen) + poolLen) % poolLen
        ctx.fillStyle = 'rgba(200,200,200,0.4)'
        ctx.font = `bold ${this.LETTER_FONT * gs}px OpenSans, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(col.pool[idx].toUpperCase(), cx * gs, cy * gs)
      } else {
        // Spinning: C++ perspective distortion
        const poolLen = col.pool.length
        const offset = col.currentOffset

        for (let j = -2; j <= 2; j++) {
          const rawIdx = Math.floor(offset) + j
          const actualIdx = ((rawIdx % poolLen) + poolLen) % poolLen
          const letter = col.pool[actualIdx]
          const frac = offset - Math.floor(offset)
          const distFromCenter = j - frac

          // C++ perspective: scale = skew + (1-skew)*ratio
          const ratio = 1 - Math.abs(distFromCenter) / 2
          const perspectiveScale = this.SKEW + (1 - this.SKEW) * Math.max(0, ratio)
          const alpha = Math.max(0, 1 - Math.abs(distFromCenter) * 0.5)

          const ly = cy + distFromCenter * this.LETTER_HEIGHT

          ctx.save()
          ctx.globalAlpha = alpha
          ctx.translate(cx * gs, ly * gs)
          ctx.scale(perspectiveScale, perspectiveScale)
          ctx.fillStyle = '#222'
          ctx.font = `bold ${this.LETTER_FONT * gs}px OpenSans, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(letter.toUpperCase(), 0, 0)
          ctx.restore()
        }
      }

      ctx.restore()
    }
  }

  /** Draw C++ frame overlays (wm_oneslot_frame_left/mid/right.png) */
  drawSlotFrameOverlays(gs: number) {
    const { ctx } = this
    const slotW = this.getSlotWidth()
    const colW = this.getColWidth()
    const colGap = this.getColGap()
    const machineY = this.getMachineY()
    const totalWidth = this.columns.length * colW + (this.columns.length - 1) * colGap
    const startX = (GAME_WIDTH - totalWidth) / 2
    const frameH = 816 // C++ frame image height

    for (let i = 0; i < this.columns.length; i++) {
      const cx = startX + i * (colW + colGap) + colW / 2
      const frameImg = i === 0 ? this.frameLeft
        : i === this.columns.length - 1 ? this.frameRight
        : this.frameMid
      const fw = (i === 0 || i === this.columns.length - 1) ? 551 : 545

      if (frameImg.complete && frameImg.naturalWidth > 0) {
        const dw = fw * this.getSlotFactor() * gs
        const dh = frameH * this.getSlotFactor() * gs
        const dy = (machineY + this.COL_HEIGHT / 2) * gs - dh / 2
        ctx.drawImage(frameImg, cx * gs - dw / 2, dy, dw, dh)
      }
    }

    // C++ decorative lights on top of frame
    const frameTop = machineY * gs - 15 * gs
    const lightColors = ['#FF5252', '#FFD740', '#69F0AE', '#40C4FF']
    const machineLeft = (startX - 40) * gs
    const machineW = (totalWidth + 80) * gs
    for (let i = 0; i < 12; i++) {
      const lx = machineLeft + 30 * gs + i * ((machineW - 60 * gs) / 11)
      const flicker = Math.sin(this.spinningTime * 5 + i * 1.2) > 0
      ctx.fillStyle = flicker ? lightColors[i % lightColors.length] : '#333'
      ctx.beginPath()
      ctx.arc(lx, frameTop, 6 * gs, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** C++ image card panels using wm_word_frame.png assets */
  drawImageCards(gs: number) {
    const { ctx } = this

    const drawCard = (card: ImageCard) => {
      if (card.exitDone) return // fully exited

      const scale = card.scaleAnim > 0 ? 1 + 0.1 * Math.min(card.scaleAnim, 1) : 1.0
      const x = (card.centerX + card.shakeOffset) * gs
      const y = card.currentY * gs
      const w = this.CARD_W * gs * scale
      const h = this.CARD_H * gs * scale

      ctx.save()
      ctx.translate(x, y)
      ctx.scale(scale, scale)

      // Draw card frame background (wm_word_frame_2.png)
      if (this.cardFrame2.complete && this.cardFrame2.naturalWidth > 0) {
        ctx.drawImage(this.cardFrame2, -this.CARD_W / 2 * gs, -this.CARD_H / 2 * gs,
          this.CARD_W * gs, this.CARD_H * gs)
      } else {
        ctx.fillStyle = '#fff'
        ctx.shadowColor = 'rgba(0,0,0,0.3)'
        ctx.shadowBlur = 12 * gs
        ctx.beginPath()
        ctx.roundRect(-w / 2, -h / 2, w, h, 16 * gs)
        ctx.fill()
        ctx.shadowColor = 'transparent'
      }

      // Draw card image
      if (card.image.complete && card.image.naturalWidth > 0) {
        const pad = 24 * gs
        const imgW = this.CARD_W * gs - pad * 2
        const imgH = this.CARD_H * gs - pad * 2
        const ratio = card.image.naturalWidth / card.image.naturalHeight
        let dw: number, dh: number
        if (ratio > imgW / imgH) { dw = imgW; dh = imgW / ratio }
        else { dh = imgH; dw = imgH * ratio }
        ctx.drawImage(card.image, -dw / 2, -dh / 2, dw, dh)
      } else {
        ctx.fillStyle = '#eee'
        const pad = 24 * gs
        ctx.fillRect(-this.CARD_W / 2 * gs + pad, -this.CARD_H / 2 * gs + pad,
          this.CARD_W * gs - pad * 2, this.CARD_H * gs - pad * 2)
      }

      // Draw decorative frame overlay (wm_word_frame.png)
      if (this.cardFrame.complete && this.cardFrame.naturalWidth > 0) {
        ctx.drawImage(this.cardFrame, -this.CARD_W / 2 * gs, -this.CARD_H / 2 * gs,
          this.CARD_W * gs, this.CARD_H * gs)
      }

      // Correct card green border
      if (card.isGood && this.phase === 'correct') {
        ctx.strokeStyle = '#4CAF50'
        ctx.lineWidth = 4 * gs
        ctx.beginPath()
        ctx.roundRect(-this.CARD_W / 2 * gs, -this.CARD_H / 2 * gs,
          this.CARD_W * gs, this.CARD_H * gs, 16 * gs)
        ctx.stroke()
      }

      ctx.restore()
    }

    if (this.leftCard) drawCard(this.leftCard)
    if (this.rightCard) drawCard(this.rightCard)

    // Instruction text
    if (this.phase === 'imageSelect') {
      ctx.fillStyle = '#FFD54F'
      ctx.font = `bold ${44 * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Choose the correct picture!', GAME_WIDTH / 2 * gs, (GAME_HEIGHT - 100) * gs)
    }
  }

  /** C++ CompletePopup: glow, rotating rings, star medal, sparkles */
  drawCelebration(gs: number) {
    const { ctx } = this
    const cx = GAME_WIDTH / 2 * gs
    const cy = GAME_HEIGHT / 2 * gs

    // Glow background
    if (this.popupGlow.complete && this.popupGlow.naturalWidth > 0) {
      const glowSize = 800 * gs
      ctx.globalAlpha = 0.6
      ctx.drawImage(this.popupGlow, cx - glowSize / 2, cy - glowSize / 2, glowSize, glowSize)
      ctx.globalAlpha = 1
    }

    // Rotating rings
    const ringSize = 500 * gs
    if (this.popupRotLeft.complete && this.popupRotLeft.naturalWidth > 0) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-this.celebrateTimer * Math.PI / 3) // C++: -30° per 0.5s
      ctx.drawImage(this.popupRotLeft, -ringSize / 2, -ringSize / 2, ringSize, ringSize)
      ctx.restore()
    }
    if (this.popupRotRight.complete && this.popupRotRight.naturalWidth > 0) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(this.celebrateTimer * Math.PI / 3) // C++: +30° per 0.5s
      ctx.drawImage(this.popupRotRight, -ringSize / 2, -ringSize / 2, ringSize, ringSize)
      ctx.restore()
    }

    // Star medal
    if (this.popupStarMedal.complete && this.popupStarMedal.naturalWidth > 0) {
      const medalSize = 300 * gs
      ctx.drawImage(this.popupStarMedal, cx - medalSize / 2, cy - medalSize / 2, medalSize, medalSize)
    }

    // Sparkles (3 positions, blinking)
    if (this.popupSparkle.complete && this.popupSparkle.naturalWidth > 0) {
      const sparklePositions = [
        { dx: -230, dy: -130 },
        { dx: -150, dy: -190 },
        { dx: 130, dy: 30 },
      ]
      for (let i = 0; i < sparklePositions.length; i++) {
        const { dx, dy } = sparklePositions[i]
        const blinkT = (this.celebrateTimer * 3.33 + i * 0.3) % 1 // 0.3s cycle
        const sparkleScale = Math.sin(blinkT * Math.PI) // 0→1→0
        if (sparkleScale > 0.05) {
          const s = 50 * gs * sparkleScale
          ctx.drawImage(this.popupSparkle,
            cx + dx * gs - s / 2, cy + dy * gs - s / 2, s, s)
        }
      }
    }

    // "Correct!" text
    ctx.fillStyle = '#FFD740'
    ctx.font = `bold ${80 * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const bounce = Math.sin(this.celebrateTimer * 4) * 0.05 + 1.0
    ctx.save()
    ctx.translate(cx, (GAME_HEIGHT / 2 + 250) * gs)
    ctx.scale(bounce, bounce)
    ctx.fillText('Correct!', 0, 0)
    ctx.restore()
  }
}
