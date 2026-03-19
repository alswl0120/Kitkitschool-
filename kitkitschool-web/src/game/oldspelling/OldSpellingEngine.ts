import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

// OldSpelling: physics-based spelling game matching C++ SpellingScene
// In C++, this game has no levels - it uses a hardcoded work list
// Letters fall/bounce with physics and player DRAGS them to answer slots
//
// Key C++ parameters:
//   physicsSpeed = 3, physicsUpdateRate = 0.1
//   BallSlot::defaultSize = 288x288
//   BallBase fontSize = 200
//   PhysicsMaterial(.1f, 0.f, .5f) -> density=0.1, restitution=0, friction=0.5
//   linearDamping = 0.5
//   ImageCard (692x550) at (GS.w/2, GS.h*3/4) anchor MIDDLE
//   AnswerPad at (GS.w/2, GS.h*2/4) anchor MIDDLE
//   BallBound: edge box of gameSize + 200 (100 thickness each side)

// Sizes
const SLOT_SIZE = 288
const BALL_FONT_SIZE = 200
const IMAGE_CARD_W = 692
const IMAGE_CARD_H = 550

// Physics (C++ values)
const PHYSICS_SPEED = 3
// C++ cocos2d default gravity = -980 (y-up). In canvas y-down, gravity is positive (downward).
// With physicsSpeed=3, effective gravity = 980 * 3 = 2940 pixels/sec^2
const GRAVITY = 980 * PHYSICS_SPEED
const LINEAR_DAMPING = 0.5
const RESTITUTION = 0.0  // PhysicsMaterial restitution = 0 (no bounce)
const FRICTION = 0.5

interface FallingLetter {
  letter: string
  x: number       // center x in canvas y-down game coords
  y: number       // center y in canvas y-down game coords
  vx: number
  vy: number      // positive = downward in canvas
  radius: number  // half of ball size
  collected: boolean
  angle: number
  angularVel: number
  isDummy: boolean
  dragging: boolean
}

// C++ hardcoded work list from SpellingScene::prepareCurrentWork()
const WORK_LIST = ['bun', 'bug', 'mug', 'jug', 'hut']

export class OldSpellingEngine extends BaseEngine {
  level: number
  words: string[] = []
  currentWordIndex = 0
  currentWord = ''

  fallingLetters: FallingLetter[] = []
  preFilledSlots: boolean[] = []
  slotFilled: boolean[] = []

  draggingLetter: FallingLetter | null = null
  dragOffsetX = 0
  dragOffsetY = 0

  solvedCount = 0
  totalProblems = 5

  bgImage: HTMLImageElement
  sfxCorrect: HTMLAudioElement
  sfxPop: HTMLAudioElement
  sfxWrong: HTMLAudioElement
  sfxCardDeath: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.words = [...WORK_LIST]
    this.totalProblems = this.words.length

    this.bgImage = loadImage(assetUrl('/assets/games/spelling/spelling_background.jpg'))
    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxPop = loadAudio(assetUrl('/assets/games/spelling/sounds/card_hit.0.m4a'))
    this.sfxWrong = loadAudio(assetUrl('/assets/games/spelling/sounds/card_miss.m4a'))
    this.sfxCardDeath = loadAudio(assetUrl('/assets/games/spelling/sounds/card_birth.m4a'))
  }

  start() {
    super.start()
    this.currentWordIndex = 0
    this.setupWord()
  }

  /** Convert cocos2d Y (y-up) to canvas Y (y-down) */
  cocosY(y: number): number {
    return GAME_HEIGHT - y
  }

  /**
   * Get slot center in canvas y-down coordinates.
   * C++ AnswerPad at (GS.w/2, GS.h*2/4) anchor MIDDLE.
   * AnswerPad CS = (GameSize.width, SlotSize.height) = (2560, 288).
   * Slot local position (anchor MIDDLE):
   *   X = SlotSize.width * (I - (wordLen-1)/2) + CS.width/2
   *   Y = CS.height/2 = 288/2 = 144
   * World cocos2d position:
   *   X = pad.x - pad.w/2 + localX = (GS.w/2 - GS.w/2) + localX = localX
   *   Y = pad.y - pad.h/2 + localY = (GS.h/2 - 288/2) + 144 = GS.h/2
   * So slot center cocos2d Y = GS.h/2 = 900 always.
   * Canvas Y = GAME_HEIGHT - 900 = 900.
   */
  getSlotCenter(i: number): { x: number; y: number } {
    const wordLen = this.currentWord.length
    const ratioX = i - (wordLen - 1) / 2
    const x = SLOT_SIZE * ratioX + GAME_WIDTH / 2
    const y = this.cocosY(GAME_HEIGHT / 2)  // = GAME_HEIGHT - 900 = 900
    return { x, y }
  }

  setupWord() {
    if (this.currentWordIndex >= this.words.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    this.currentWord = this.words[this.currentWordIndex].toLowerCase()
    this.fallingLetters = []
    this.draggingLetter = null

    const letters = this.currentWord.split('')

    // C++ pre-fill logic: BallRatio = random(0.20, 0.60)
    const ballRatio = 0.2 + Math.random() * 0.4
    this.preFilledSlots = []
    this.slotFilled = []
    const ballLetters: { letter: string; slotIndex: number }[] = []
    let remainSlots = letters.length
    let remainBalls = Math.ceil(remainSlots * ballRatio)

    for (let i = 0; i < letters.length; i++) {
      const makeBall = Math.random() < (remainBalls / remainSlots)
      remainSlots--
      if (makeBall) {
        remainBalls--
        this.preFilledSlots.push(false)
        this.slotFilled.push(false)
        ballLetters.push({ letter: letters[i], slotIndex: i })
      } else {
        this.preFilledSlots.push(true)
        this.slotFilled.push(true)
      }
    }

    const ballRadius = SLOT_SIZE / 2

    // C++ answer balls start at slot positions (in cocos2d coords)
    // with initial velocity (0, 10) in cocos2d (upward).
    // In canvas y-down, initial vy = -10 (upward).
    for (const bl of ballLetters) {
      const slotPos = this.getSlotCenter(bl.slotIndex)
      this.fallingLetters.push({
        letter: bl.letter,
        x: slotPos.x,
        y: slotPos.y,
        vx: 0,
        vy: -10,  // cocos2d (0, 10) -> canvas (0, -10) = slightly upward
        radius: ballRadius,
        collected: false,
        angle: 0,
        angularVel: 0,
        isDummy: false,
        dragging: false,
      })
    }

    // C++ 6 random dummy balls: letter = random('a','z'), position = random in GameSize
    for (let i = 0; i < 6; i++) {
      const ch = String.fromCharCode(97 + Math.floor(Math.random() * 26))
      // C++ position in cocos2d: random(0, GS.w), random(0, GS.h)
      // Canvas: x is same, y = GAME_HEIGHT - cocosY
      const cocosX = Math.random() * GAME_WIDTH
      const cocosYPos = Math.random() * GAME_HEIGHT
      this.fallingLetters.push({
        letter: ch,
        x: cocosX,
        y: this.cocosY(cocosYPos),
        vx: 0,
        vy: -10,
        radius: ballRadius,
        collected: false,
        angle: 0,
        angularVel: 0,
        isDummy: true,
        dragging: false,
      })
    }

    this.onProgressChange?.(this.currentWordIndex + 1, this.totalProblems)
  }

  onPointerDown(x: number, y: number) {
    // C++ uses TargetDragBody - find ball under pointer (circle hit test)
    for (let i = this.fallingLetters.length - 1; i >= 0; i--) {
      const fl = this.fallingLetters[i]
      if (fl.collected || fl.dragging) continue
      const dist = Math.sqrt((x - fl.x) ** 2 + (y - fl.y) ** 2)
      if (dist <= fl.radius) {
        fl.dragging = true
        this.draggingLetter = fl
        this.dragOffsetX = x - fl.x
        this.dragOffsetY = y - fl.y
        return
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.draggingLetter) return
    const fl = this.draggingLetter

    // Move ball to follow pointer
    fl.x = x - this.dragOffsetX
    fl.y = y - this.dragOffsetY
    fl.vx = 0
    fl.vy = 0

    // C++ tryToCatchBall called on every drag event
    this.tryToCatchBall(fl)
  }

  onPointerUp(_x: number, _y: number) {
    if (!this.draggingLetter) return
    this.draggingLetter.dragging = false
    this.draggingLetter = null
    // Ball resumes physics on release
  }

  /**
   * C++ AnswerPad::tryToCatchBall
   * Score = max(0, (sumR - dist) / sumR) >= 0.80
   * Ball class must match slot class
   */
  tryToCatchBall(ball: FallingLetter) {
    if (ball.collected) return

    let bestSlotIndex = -1
    let bestScore = -Infinity

    for (let i = 0; i < this.currentWord.length; i++) {
      if (ball.letter !== this.currentWord[i]) continue
      if (this.slotFilled[i]) continue

      const slotPos = this.getSlotCenter(i)
      const slotR = SLOT_SIZE / 2
      const dist = Math.sqrt((ball.x - slotPos.x) ** 2 + (ball.y - slotPos.y) ** 2)
      const sumR = ball.radius + slotR
      const score = Math.max(0, (sumR - dist) / sumR)

      if (score >= 0.80 && score > bestScore) {
        bestScore = score
        bestSlotIndex = i
      }
    }

    if (bestSlotIndex >= 0) {
      this.slotFilled[bestSlotIndex] = true
      ball.collected = true
      ball.dragging = false
      if (this.draggingLetter === ball) {
        this.draggingLetter = null
      }
      playSound(this.sfxPop)

      // Check completion
      if (this.slotFilled.every(f => f)) {
        this.solvedCount++
        playSound(this.sfxCorrect)
        setTimeout(() => {
          this.currentWordIndex++
          this.setupWord()
        }, 1000)
      }
    }
  }

  update(_time: number, dt: number) {
    // C++ BallBound: edge box at center of GameSize, box = GameSize + 200
    // Inner edges: left=0, right=GAME_WIDTH, top=0, bottom=GAME_HEIGHT
    const floorY = GAME_HEIGHT
    const ceilingY = 0
    const leftWall = 0
    const rightWall = GAME_WIDTH

    for (const fl of this.fallingLetters) {
      if (fl.collected || fl.dragging) continue

      // Apply gravity (downward in canvas y-down)
      fl.vy += GRAVITY * dt

      // Apply linear damping: cocos2d does velocity *= 1 / (1 + dt * damping)
      const dampFactor = 1 / (1 + dt * LINEAR_DAMPING)
      fl.vx *= dampFactor
      fl.vy *= dampFactor

      fl.x += fl.vx * dt
      fl.y += fl.vy * dt
      fl.angle += fl.angularVel * dt

      // Floor collision (restitution = 0, no bounce)
      if (fl.y + fl.radius > floorY) {
        fl.y = floorY - fl.radius
        fl.vy = -fl.vy * RESTITUTION
        fl.vx *= (1 - FRICTION)
        fl.angularVel *= 0.5
      }

      // Ceiling collision
      if (fl.y - fl.radius < ceilingY) {
        fl.y = ceilingY + fl.radius
        fl.vy = -fl.vy * RESTITUTION
      }

      // Wall collisions (restitution = 0)
      if (fl.x - fl.radius < leftWall) {
        fl.x = leftWall + fl.radius
        fl.vx = -fl.vx * RESTITUTION
      }
      if (fl.x + fl.radius > rightWall) {
        fl.x = rightWall - fl.radius
        fl.vx = -fl.vx * RESTITUTION
      }
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    if (imgOk(this.bgImage)) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      ctx.fillStyle = '#E0F7FA'
      ctx.fillRect(0, 0, w, h)
    }

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // --- ImageCard ---
    // C++ at (GS.w/2, GS.h*3/4) anchor MIDDLE in cocos2d
    // Canvas center: x = GS.w/2 = 1280, y = cocosY(GS.h*3/4) = cocosY(1350) = 450
    const imgCX = GAME_WIDTH / 2
    const imgCY = this.cocosY(GAME_HEIGHT * 3 / 4)  // 450
    ctx.fillStyle = '#FF6B35'
    ctx.font = `bold ${60 * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.currentWord.toUpperCase(), imgCX * gs, imgCY * gs)

    // --- Answer slots ---
    for (let i = 0; i < this.currentWord.length; i++) {
      const slotPos = this.getSlotCenter(i)
      const cx = slotPos.x * gs
      const cy = slotPos.y * gs
      const r = SLOT_SIZE / 2 * gs

      // Slot background circle
      ctx.fillStyle = 'rgba(200, 180, 160, 0.4)'
      ctx.strokeStyle = '#8D6E63'
      ctx.lineWidth = 3 * gs
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      if (this.slotFilled[i]) {
        // Filled slot: draw ball with letter
        const gradient = ctx.createRadialGradient(cx, cy - 10 * gs, 5 * gs, cx, cy, r - 4 * gs)
        gradient.addColorStop(0, '#FFE082')
        gradient.addColorStop(1, '#FFB300')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cx, cy, r - 4 * gs, 0, Math.PI * 2)
        ctx.fill()

        const scaledFs = (BALL_FONT_SIZE / SLOT_SIZE) * SLOT_SIZE
        ctx.fillStyle = '#5D4037'
        ctx.font = `bold ${scaledFs * gs}px TodoMainCurly, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(this.currentWord[i].toUpperCase(), cx, cy)
      } else {
        // Empty slot hint
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.font = `bold ${(BALL_FONT_SIZE * 0.8) * gs}px TodoMainCurly, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('_', cx, cy)
      }
    }

    // --- Falling letters ---
    for (const fl of this.fallingLetters) {
      if (fl.collected) continue

      const cx = fl.x * gs
      const cy = fl.y * gs
      const r = fl.radius * gs

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(fl.angle)

      // Ball background gradient
      const gradient = ctx.createRadialGradient(0, -10 * gs, 5 * gs, 0, 0, r)
      gradient.addColorStop(0, '#FFE082')
      gradient.addColorStop(1, '#FFB300')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#F57F17'
      ctx.lineWidth = 2 * gs
      ctx.stroke()

      // Letter
      const scaledFs = (BALL_FONT_SIZE / SLOT_SIZE) * (fl.radius * 2)
      ctx.fillStyle = '#5D4037'
      ctx.font = `bold ${scaledFs * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(fl.letter.toUpperCase(), 0, 0)

      ctx.restore()
    }

    ctx.restore()
  }
}
