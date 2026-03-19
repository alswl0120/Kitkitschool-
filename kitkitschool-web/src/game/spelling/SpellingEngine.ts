import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/spelling')

interface WordEntry {
  word: string
  image: string
}

// Fallback words if JSON data fails to load
const FALLBACK_WORDS: Record<number, WordEntry[]> = {
  1: [
    { word: 'cat', image: 'spelling_cat.png' },
    { word: 'dog', image: 'spelling_dog.png' },
    { word: 'sun', image: 'spelling_sun.png' },
    { word: 'hat', image: 'spelling_hat.png' },
    { word: 'pig', image: 'spelling_pig.png' },
  ],
}

// Cache for loaded JSON data
let _loadedLevelWords: Record<number, WordEntry[]> | null = null
let _loadingPromise: Promise<Record<number, WordEntry[]>> | null = null

function loadLevelWords(): Promise<Record<number, WordEntry[]>> {
  if (_loadedLevelWords) return Promise.resolve(_loadedLevelWords)
  if (_loadingPromise) return _loadingPromise

  _loadingPromise = fetch('/data/games/spelling.json')
    .then(r => r.json())
    .then(data => {
      const result: Record<number, WordEntry[]> = {}
      const levels = data.levels || {}
      for (const [levelStr, levelData] of Object.entries(levels)) {
        const levelNum = Number(levelStr)
        const words = (levelData as { words: string[] }).words || []
        result[levelNum] = words.map(w => ({
          word: w,
          image: `spelling_${w}.png`,
        }))
      }
      _loadedLevelWords = result
      return result
    })
    .catch(() => {
      _loadedLevelWords = FALLBACK_WORDS
      return FALLBACK_WORDS
    })

  return _loadingPromise
}

// C++ BallSize: Large for word length <= 4, Small for >= 5
type BallSize = 'Large' | 'Small'

function ballSizeForWord(word: string): BallSize {
  return word.length <= 4 ? 'Large' : 'Small'
}

// C++ BallSlot::defaultSize (the slot hole on the GameBoard)
function slotSizeFor(bs: BallSize): number {
  return bs === 'Large' ? 278 : 192
}

// C++ AnswerBall passive size (sitting on platform)
function passiveBallSizeFor(_bs: BallSize): number {
  return 228  // always 228x228 for passive
}

// C++ AnswerBall active size (when dragging)
function activeBallSizeFor(bs: BallSize): number {
  return bs === 'Large' ? 260 : 228
}

// C++ CorrectBall size (shown in slot when filled)
function correctBallSizeFor(bs: BallSize): number {
  return bs === 'Large' ? 258 : 180
}

// C++ font sizes from DummyBall.cpp
function ballFontSize(bs: BallSize, kind: 'correct' | 'active' | 'passive'): number {
  if (bs === 'Small') {
    return kind === 'correct' ? 160 : 200
  }
  // Large
  if (kind === 'correct' || kind === 'active') return 250
  return 200 // passive
}

// C++ consonants and vowels for distractor generation
const VOWELS = 'aeiou'
const CONSONANTS = 'bcdfghjklmnpqrstvwxyz'

function generateDistractors(word: string, consonantCount: number, vowelCount: number): string[] {
  const wordLetters = new Set(word.split(''))
  const auxC = CONSONANTS.split('').filter(c => !wordLetters.has(c))
  const auxV = VOWELS.split('').filter(v => !wordLetters.has(v))
  const distractors: string[] = []

  // Shuffle and pick consonant distractors
  const shuffledC = [...auxC]
  for (let i = shuffledC.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffledC[i], shuffledC[j]] = [shuffledC[j], shuffledC[i]]
  }
  for (let i = 0; i < consonantCount && i < shuffledC.length; i++) {
    distractors.push(shuffledC[i])
  }

  // Shuffle and pick vowel distractors
  const shuffledV = [...auxV]
  for (let i = shuffledV.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffledV[i], shuffledV[j]] = [shuffledV[j], shuffledV[i]]
  }
  for (let i = 0; i < vowelCount && i < shuffledV.length; i++) {
    distractors.push(shuffledV[i])
  }

  return distractors
}

interface AnswerBall {
  letter: string
  x: number       // top-left x in canvas y-down coords
  y: number       // top-left y in canvas y-down coords
  homeX: number
  homeY: number
  size: number    // passive size (width = height, balls are circles)
  activeSize: number
  dragging: boolean
  placed: boolean
  slotIndex: number
  ballSize: BallSize
}

interface Slot {
  cx: number      // center x in canvas y-down coords
  cy: number      // center y in canvas y-down coords
  size: number    // width = height (square)
  letter: string
  filled: boolean
}

// C++ GameBoard: contentSize = 1327x1316
const GAMEBOARD_W = 1327
const GAMEBOARD_H = 1316

// C++ WordImage: contentSize = 1111x820
const WORDIMAGE_W = 1111
const WORDIMAGE_H = 820

// C++ Platform: contentSize = 2502x230
const PLATFORM_W = 2502
const PLATFORM_H = 230

export class SpellingEngine extends BaseEngine {
  level: number
  words: WordEntry[]
  currentWordIndex = 0
  currentWord = ''
  currentBallSize: BallSize = 'Large'
  letterBalls: AnswerBall[] = []
  slots: Slot[] = []
  wordImage: HTMLImageElement | null = null
  draggingBall: AnswerBall | null = null
  dragOffsetX = 0
  dragOffsetY = 0
  solvedCount = 0
  totalProblems = 5
  showResult: 'correct' | null = null
  resultTimer = 0
  successAnimActive = false
  successAnimTimer = 0

  // GameBoard top-left in canvas y-down coordinates
  gbLeft = 0
  gbTop = 0

  bgImage: HTMLImageElement
  platformImage: HTMLImageElement
  frameImage: HTMLImageElement
  frameHoleImage: HTMLImageElement
  crystalBlue: HTMLImageElement
  crystalYellow: HTMLImageElement
  platformHoleImage: HTMLImageElement

  sfxCorrect: HTMLAudioElement
  sfxPlace: HTMLAudioElement
  sfxWrong: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.words = []
    this.totalProblems = 5

    this.bgImage = loadImage(`${ASSET_PATH}/spelling_background.jpg`)
    this.platformImage = loadImage(`${ASSET_PATH}/spelling_platform.png`)
    this.frameImage = loadImage(`${ASSET_PATH}/spelling_frame.png`)
    this.frameHoleImage = loadImage(`${ASSET_PATH}/spelling_frame_hole.png`)
    this.crystalBlue = loadImage(`${ASSET_PATH}/spelling_crystalball_blue_large.png`)
    this.crystalYellow = loadImage(`${ASSET_PATH}/spelling_crystalball_yellow.png`)
    this.platformHoleImage = loadImage(`${ASSET_PATH}/spelling_platform_hole.png`)

    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxPlace = loadAudio(`${ASSET_PATH}/sounds/card_hit.0.m4a`)
    this.sfxWrong = loadAudio(`${ASSET_PATH}/sounds/card_miss.m4a`)
  }

  start() {
    super.start()
    loadLevelWords().then(levelWords => {
      this.words = [...(levelWords[this.level] || levelWords[1] || FALLBACK_WORDS[1])]
      this.totalProblems = this.words.length
      this.setupWord()
    })
  }

  /**
   * Convert cocos2d position (y-up, origin bottom-left) to canvas (y-down, origin top-left).
   * Only flips Y: canvasY = GAME_HEIGHT - cocosY
   */
  cocosY(y: number): number {
    return GAME_HEIGHT - y
  }

  setupWord() {
    if (this.currentWordIndex >= this.words.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    const entry = this.words[this.currentWordIndex]
    this.currentWord = entry.word.toLowerCase()
    this.currentBallSize = ballSizeForWord(this.currentWord)
    this.wordImage = loadImage(`${ASSET_PATH}/wordimages/${entry.image}`)
    this.showResult = null
    this.resultTimer = 0
    this.successAnimActive = false
    this.successAnimTimer = 0
    this.draggingBall = null

    const bs = this.currentBallSize
    const ss = slotSizeFor(bs)
    const pbs = passiveBallSizeFor(bs)

    // --- GameBoard position ---
    // C++: anchor MIDDLE_TOP at (GameSize.width/2, GameSize.height - 80)
    // Cocos2d MIDDLE_TOP: position point is at (center-x, top-y) of the node.
    // In cocos2d (y-up): top of GameBoard at Y = 1720
    // GameBoard bottom in cocos2d: 1720 - 1316 = 404
    // In canvas (y-down): top of GameBoard at cocosY(1720) = 80
    this.gbLeft = GAME_WIDTH / 2 - GAMEBOARD_W / 2  // 616.5
    this.gbTop = this.cocosY(GAME_HEIGHT - 80)       // cocosY(1720) = 80

    // --- Slot positions inside GameBoard ---
    // C++ slot anchor MIDDLE at position (X, 220) in GameBoard local coords (y-up from GB bottom-left)
    // X = SlotSpaceW * (I - (wordLen-1)/2) + CS.width/2
    // SlotSpaceW = slotSize + 18
    const slotSpaceW = ss + 18

    this.slots = []
    for (let i = 0; i < this.currentWord.length; i++) {
      const ratioX = i - (this.currentWord.length - 1) / 2
      // Local cocos2d coords inside GameBoard
      const localX = slotSpaceW * ratioX + GAMEBOARD_W / 2
      const localY = 220  // from bottom of GameBoard in cocos2d

      // Convert to canvas game coords
      // GameBoard bottom in cocos2d = 404, so slot cocos2d Y = 404 + 220 = 624
      // Canvas: top = 80, local from top = GAMEBOARD_H - localY = 1316 - 220 = 1096
      const cx = this.gbLeft + localX
      const cy = this.gbTop + (GAMEBOARD_H - localY)

      this.slots.push({
        cx,
        cy,
        size: ss,
        letter: this.currentWord[i],
        filled: false,
      })
    }

    // --- Generate choice letters ---
    const correctLetters = this.currentWord.split('')
    const consonantDistractors = this.currentWord.length <= 4 ? 2 : 1
    const vowelDistractors = 1
    const distractors = generateDistractors(this.currentWord, consonantDistractors, vowelDistractors)

    const allLetters = [...correctLetters, ...distractors]
    // Shuffle
    for (let i = allLetters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[allLetters[i], allLetters[j]] = [allLetters[j], allLetters[i]]
    }

    // --- Ball positions on Platform ---
    // C++ Platform at (GameSize.width/2, 0), anchor MIDDLE_BOTTOM
    // Platform bottom in cocos2d: Y = 0, top: Y = 230
    // In canvas (y-down): platform bottom at cocosY(0) = 1800, top at cocosY(230) = 1570
    //
    // Ball local position inside platform:
    // BallSpaceH = passiveBallSize + 40
    // X = BallSpaceH * (I - (size-1)/2) + CS.width/2  (CS.width = PLATFORM_W = 2502)
    // Y = 150 + passiveBallSize/2  (from platform bottom in cocos2d)
    const ballSpaceH = pbs + 40
    const platformLeftX = GAME_WIDTH / 2 - PLATFORM_W / 2

    this.letterBalls = allLetters.map((letter, i) => {
      const ratioX = i - (allLetters.length - 1) / 2
      const localCX = ballSpaceH * ratioX + PLATFORM_W / 2
      const localCY_cocos = 150 + pbs / 2  // center Y from platform bottom (cocos2d)

      // Convert to canvas game coords
      // Platform bottom in cocos2d = 0, so ball center cocos2d Y = localCY_cocos
      // Canvas: ball center Y = cocosY(localCY_cocos) = GAME_HEIGHT - localCY_cocos
      const cx = platformLeftX + localCX
      const cy = this.cocosY(localCY_cocos)

      const topLeftX = cx - pbs / 2
      const topLeftY = cy - pbs / 2

      return {
        letter,
        x: topLeftX,
        y: topLeftY,
        homeX: topLeftX,
        homeY: topLeftY,
        size: pbs,
        activeSize: activeBallSizeFor(bs),
        dragging: false,
        placed: false,
        slotIndex: -1,
        ballSize: bs,
      }
    })

    this.onProgressChange?.(this.currentWordIndex + 1, this.totalProblems)
  }

  onPointerDown(x: number, y: number) {
    if (this.showResult || this.successAnimActive) return

    // Check if clicking a ball (reverse order for top-most)
    for (let i = this.letterBalls.length - 1; i >= 0; i--) {
      const ball = this.letterBalls[i]
      if (ball.placed) continue
      const cx = ball.x + ball.size / 2
      const cy = ball.y + ball.size / 2
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= ball.size / 2) {
        ball.dragging = true
        this.draggingBall = ball
        this.dragOffsetX = x - ball.x
        this.dragOffsetY = y - ball.y
        return
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.draggingBall) return
    const ball = this.draggingBall
    ball.x = x - this.dragOffsetX
    ball.y = y - this.dragOffsetY

    // C++ OnDrag: check for slot overlap during drag (continuous snapping)
    this.trySnapBallToSlot(ball)
  }

  onPointerUp(_x: number, _y: number) {
    if (!this.draggingBall) return
    const ball = this.draggingBall
    ball.dragging = false
    this.draggingBall = null

    // If not placed during drag, return to home
    if (!ball.placed) {
      ball.x = ball.homeX
      ball.y = ball.homeY
    }
  }

  trySnapBallToSlot(ball: AnswerBall) {
    // C++ scoring: intersection area / max(ballArea, slotArea) >= 0.70
    // Ball text must match slot text
    let bestSlot: Slot | null = null
    let bestSlotIndex = -1
    let bestScore = -Infinity

    const ballArea = ball.size * ball.size
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]
      if (slot.filled) continue
      if (ball.letter !== slot.letter) continue

      // Ball rect
      const bx1 = ball.x, by1 = ball.y
      const bx2 = ball.x + ball.size, by2 = ball.y + ball.size
      // Slot rect
      const sx1 = slot.cx - slot.size / 2, sy1 = slot.cy - slot.size / 2
      const sx2 = slot.cx + slot.size / 2, sy2 = slot.cy + slot.size / 2

      const ix1 = Math.max(bx1, sx1), iy1 = Math.max(by1, sy1)
      const ix2 = Math.min(bx2, sx2), iy2 = Math.min(by2, sy2)
      if (ix2 <= ix1 || iy2 <= iy1) continue

      const capArea = (ix2 - ix1) * (iy2 - iy1)
      const slotArea = slot.size * slot.size
      const score = Math.max(capArea / ballArea, capArea / slotArea)

      if (score >= 0.70 && score > bestScore) {
        bestScore = score
        bestSlot = slot
        bestSlotIndex = i
      }
    }

    if (bestSlot) {
      bestSlot.filled = true
      ball.placed = true
      ball.slotIndex = bestSlotIndex
      ball.dragging = false
      this.draggingBall = null
      // Center ball in slot
      ball.x = bestSlot.cx - ball.size / 2
      ball.y = bestSlot.cy - ball.size / 2
      playSound(this.sfxPlace)

      // C++: when all slots filled, it's automatically correct (only matching letters snap)
      if (this.slots.every(s => s.filled)) {
        this.handleCorrectAnswer()
      }
    }
  }

  handleCorrectAnswer() {
    this.showResult = 'correct'
    this.successAnimActive = true
    this.successAnimTimer = 0
    playSound(this.sfxCorrect)
    this.solvedCount++

    // C++ flow: closingWordSound (0.5s delay + sound + 0.5s) + closingGameBoard (0.8s delay + 0.4s anim)
    setTimeout(() => {
      this.currentWordIndex++
      this.setupWord()
    }, 2000)
  }

  update(_time: number, dt: number) {
    if (this.successAnimActive) {
      this.successAnimTimer += dt
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

    // --- Draw GameBoard frame ---
    if (imgOk(this.frameImage)) {
      ctx.drawImage(this.frameImage,
        this.gbLeft * gs, this.gbTop * gs,
        GAMEBOARD_W * gs, GAMEBOARD_H * gs)
    }

    // --- Draw word image inside GameBoard ---
    // C++ WordImage: anchor TOP_LEFT at (110, CS.height - 80) inside GameBoard
    // In cocos2d local, TOP_LEFT anchor means the top-left of the sprite is at the position.
    // Cocos2d (y-up): top of word image at localY = GAMEBOARD_H - 80 = 1236
    //   bottom at localY = 1236 - WORDIMAGE_H = 416
    // Canvas (y-down from gbTop): word image top at gbTop + (GAMEBOARD_H - 1236) = gbTop + 80
    {
      const wiLeft = this.gbLeft + 110
      const wiTop = this.gbTop + 80
      if (imgOk(this.wordImage)) {
        ctx.drawImage(this.wordImage,
          wiLeft * gs, wiTop * gs,
          WORDIMAGE_W * gs, WORDIMAGE_H * gs)
      } else {
        // No image available (missing asset) — show the word as large text
        const wiCx = (wiLeft + WORDIMAGE_W / 2) * gs
        const wiCy = (wiTop + WORDIMAGE_H / 2) * gs
        ctx.fillStyle = '#F5E6C8'
        ctx.beginPath()
        ctx.roundRect(wiLeft * gs, wiTop * gs, WORDIMAGE_W * gs, WORDIMAGE_H * gs, 12 * gs)
        ctx.fill()
        const wordFontSize = Math.min(180, (WORDIMAGE_W * 0.85) / Math.max(this.currentWord.length, 1) * 1.8)
        ctx.fillStyle = '#4F3D18'
        ctx.font = `bold ${wordFontSize * gs}px TodoMainCurly, serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(this.currentWord, wiCx, wiCy)
      }
    }

    // --- Draw slot holes ---
    for (const slot of this.slots) {
      const sx = (slot.cx - slot.size / 2) * gs
      const sy = (slot.cy - slot.size / 2) * gs
      const sw = slot.size * gs
      const sh = slot.size * gs

      if (imgOk(this.frameHoleImage)) {
        ctx.drawImage(this.frameHoleImage, sx, sy, sw, sh)
      } else {
        ctx.fillStyle = 'rgba(200,180,160,0.5)'
        ctx.strokeStyle = '#8D6E63'
        ctx.lineWidth = 2 * gs
        ctx.beginPath()
        ctx.roundRect(sx, sy, sw, sh, 12 * gs)
        ctx.fill()
        ctx.stroke()
      }
    }

    // --- Draw filled slots (CorrectBall = yellow) ---
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]
      if (!slot.filled) continue
      const ball = this.letterBalls.find(b => b.placed && b.slotIndex === i)
      if (!ball) continue

      const cbs = correctBallSizeFor(ball.ballSize)
      const cx = slot.cx * gs
      const cy = slot.cy * gs
      const r = cbs / 2 * gs

      if (imgOk(this.crystalYellow)) {
        ctx.drawImage(this.crystalYellow, cx - r, cy - r, r * 2, r * 2)
      } else {
        ctx.fillStyle = '#FFB300'
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // C++ text color for CorrectAnswer = (128, 63, 25), with 10px downward offset
      const fs = ballFontSize(ball.ballSize, 'correct')
      const scaledFs = (fs / 228) * cbs
      ctx.fillStyle = 'rgb(128, 63, 25)'
      ctx.font = `bold ${scaledFs * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ball.letter.toUpperCase(), cx, cy + (10 / 228) * cbs * gs)
    }

    // --- Draw Platform ---
    const platformLeft = (GAME_WIDTH / 2 - PLATFORM_W / 2) * gs
    const platformTop = this.cocosY(PLATFORM_H) * gs  // cocosY(230) = 1570
    if (imgOk(this.platformImage)) {
      ctx.drawImage(this.platformImage,
        platformLeft, platformTop,
        PLATFORM_W * gs, PLATFORM_H * gs)
    } else {
      ctx.fillStyle = 'rgba(141,110,99,0.4)'
      ctx.beginPath()
      ctx.roundRect(platformLeft, platformTop, PLATFORM_W * gs, PLATFORM_H * gs, 10 * gs)
      ctx.fill()
    }

    // --- Draw non-dragging balls on platform ---
    for (const ball of this.letterBalls) {
      if (ball.placed || ball === this.draggingBall) continue
      this.drawPassiveBall(ball, gs)
    }

    // --- Draw dragging ball (on top, with active size) ---
    if (this.draggingBall && !this.draggingBall.placed) {
      this.drawActiveBall(this.draggingBall, gs)
    }

    // --- Result overlay ---
    if (this.showResult === 'correct') {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.3)'
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${80 * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Correct!', GAME_WIDTH / 2 * gs, GAME_HEIGHT / 2 * gs)
    }

    ctx.restore()
  }

  drawPassiveBall(ball: AnswerBall, gs: number) {
    const { ctx } = this
    const cx = (ball.x + ball.size / 2) * gs
    const cy = (ball.y + ball.size / 2) * gs
    const r = ball.size / 2 * gs

    if (imgOk(this.crystalBlue)) {
      ctx.drawImage(this.crystalBlue, cx - r, cy - r, r * 2, r * 2)
    } else {
      ctx.fillStyle = '#64B5F6'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // C++ text color for PassiveAnswer = (0, 73, 107)
    const fs = ballFontSize(ball.ballSize, 'passive')
    const scaledFs = (fs / 228) * ball.size
    ctx.fillStyle = 'rgb(0, 73, 107)'
    ctx.font = `bold ${scaledFs * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ball.letter.toUpperCase(), cx, cy + (10 / 228) * ball.size * gs)
  }

  drawActiveBall(ball: AnswerBall, gs: number) {
    const { ctx } = this
    const as = ball.activeSize
    // Center the active ball on the ball's current center
    const cx = (ball.x + ball.size / 2) * gs
    const cy = (ball.y + ball.size / 2) * gs
    const r = as / 2 * gs

    if (imgOk(this.crystalBlue)) {
      ctx.drawImage(this.crystalBlue, cx - r, cy - r, r * 2, r * 2)
    } else {
      ctx.fillStyle = '#42A5F5'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // C++ text color for ActiveAnswer = (0, 73, 107)
    const fs = ballFontSize(ball.ballSize, 'active')
    const scaledFs = (fs / 228) * as
    ctx.fillStyle = 'rgb(0, 73, 107)'
    ctx.font = `bold ${scaledFs * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ball.letter.toUpperCase(), cx, cy + (10 / 228) * as * gs)
  }
}
