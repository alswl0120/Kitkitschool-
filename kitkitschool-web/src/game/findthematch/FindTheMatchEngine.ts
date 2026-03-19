import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/findthematch')

// C++ constants from MainDepot / Card / GameBoard / PlayerBase / Scene
const CARD_W = 504
const CARD_H = 672
const BOARD_W = 1315
const BOARD_H = 904
// C++ GameBoard positioned at (GameSize.width/2, GameSize.height - 88) with MIDDLE_TOP anchor
const BOARD_CENTER_X = GAME_WIDTH / 2              // 1280
const BOARD_TOP_Y = 88                              // web Y for top of board
// C++ problem slot center in board coords: ((105+605)/2, (146+805-11)/2) = (355, 470)
const PROBLEM_SLOT_BX = (105 + 605) / 2            // 355 in board space
const PROBLEM_SLOT_BY = (146 + 805 - 11) / 2       // 470 in board space
// C++ answer slot center in board coords: ((698+1198)/2, (146+805-11)/2) = (948, 470)
const ANSWER_SLOT_BX = (698 + 1198) / 2            // 948 in board space
// Board-local Y is cocos (bottom-up), so we invert for web Y
const BOARD_LEFT = BOARD_CENTER_X - BOARD_W / 2    // 622.5
// Problem card game-space position
const PROBLEM_X = BOARD_LEFT + PROBLEM_SLOT_BX     // 622.5 + 355 = 977.5
const PROBLEM_Y = BOARD_TOP_Y + (BOARD_H - PROBLEM_SLOT_BY) // 88 + (904-470) = 522
// Answer slot game-space position
const ANSWER_X = BOARD_LEFT + ANSWER_SLOT_BX       // 622.5 + 948 = 1570.5
const ANSWER_Y = BOARD_TOP_Y + (BOARD_H - PROBLEM_SLOT_BY)   // same Y as problem = 522

// C++ PlayerBase at (GameSize.width/2, 77) with MIDDLE_BOTTOM anchor
// PlayerBase contentSize = (gameSize.width, cardSize.height) = (2560, 672)
// Card center Y in cocos = 77 + 672/2 = 413 -> web Y = 1800 - 413 = 1387
const PLAYER_Y = 1387
// C++ MarginX between cards = 92
const CARD_MARGIN = 92

// C++ timing constants
const DURATION_CARD_MOVE = 0.3       // GameBoard actionForPullCardToAnswerSlot
const DURATION_CARD_FLIP = 0.2       // Card actionForFlipToFront/Back
const DURATION_CARD_SHAKE = 0.375    // Card actionForShake
const DURATION_CARD_PAUSE = 0.05     // durationForCardPause
const DURATION_PLAYER_MOVE = 0.12    // PlayerBase actionForPullCardWithSlotIndex
const DEAL_DELAY = 0.2              // delay between dealing each card

interface RawProblemData {
  workSet: number
  work: number
  answer: string
  answerType: string
  choices: string[]
}

interface ProblemData {
  answer: string
  choices: string[]
}

interface RawLevelData {
  level: number
  problems: RawProblemData[]
}

interface LevelData {
  level: number
  problems: ProblemData[]
}

// Card states matching C++ action sequences
type CardState =
  | 'in_deck'           // waiting at deck before deal animation starts
  | 'dealing'           // moving from deck to player slot
  | 'dealt'             // arrived at slot, waiting for flip
  | 'flipping_to_front' // Y-rotation flip animation
  | 'front'             // interactive, face up at slot
  | 'moving_to_answer'  // animating toward answer slot
  | 'at_answer'         // arrived at answer slot (correct or waiting for return)
  | 'returning'         // moving back to slot after incorrect
  | 'shaking'           // shake animation after incorrect return

interface Card {
  x: number
  y: number
  slotX: number   // home position in player base
  slotY: number
  width: number
  height: number
  image: HTMLImageElement
  imagePath: string
  state: CardState
  flipProgress: number    // 0 = back, 1 = front
  animTime: number        // general purpose animation timer
  moveStartX: number
  moveStartY: number
  moveTargetX: number
  moveTargetY: number
  moveDuration: number
  moveElapsed: number
  shakeTime: number
  correct: boolean | null
  removed: boolean
  zOrder: number
  birthSoundPlayed: boolean
  deathSoundPlayed: boolean
}

export class FindTheMatchEngine extends BaseEngine {
  level: number
  levelData: LevelData | null = null
  currentProblem = 0
  problemCard: Card | null = null
  choiceCards: Card[] = []
  totalProblems = 0
  solvedCount = 0
  bgImage: HTMLImageElement
  boardImage: HTMLImageElement
  cardFrontImg: HTMLImageElement
  cardBackImg: HTMLImageElement
  sfxMiss: HTMLAudioElement
  sfxBirth: HTMLAudioElement
  sfxDeath: HTMLAudioElement
  waitingForNext = false
  touchLocked = false
  dealAnimTime = 0
  zOrderCounter = 0

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(`${ASSET_PATH}/background/picturematching.jpg`)
    this.boardImage = loadImage(`${ASSET_PATH}/gameboard/game_board.png`)
    this.cardFrontImg = loadImage(`${ASSET_PATH}/card/card_front.png`)
    this.cardBackImg = loadImage(`${ASSET_PATH}/card/card_back.png`)
    this.sfxMiss = loadAudio(`${ASSET_PATH}/sounds/card_miss.m4a`)
    this.sfxBirth = loadAudio(`${ASSET_PATH}/sounds/card_birth.m4a`)
    this.sfxDeath = loadAudio(`${ASSET_PATH}/sounds/card_death.m4a`)
  }

  async loadLevel() {
    const resp = await fetch('/data/games/findthematch.json')
    const data = await resp.json()
    const rawLevel: RawLevelData = data.levels.find((l: RawLevelData) => l.level === this.level) || data.levels[0]
    if (!rawLevel) return

    // C++ selects a random workSet (Worksheet) from the level.
    const workSetMap = new Map<number, RawProblemData[]>()
    for (const p of rawLevel.problems) {
      const ws = p.workSet || 1
      if (!workSetMap.has(ws)) workSetMap.set(ws, [])
      workSetMap.get(ws)!.push(p)
    }
    const workSetIds = Array.from(workSetMap.keys())
    const chosenWS = workSetIds[Math.floor(Math.random() * workSetIds.length)]
    const sheetProblems = workSetMap.get(chosenWS)!.sort((a, b) => a.work - b.work)

    this.levelData = {
      level: rawLevel.level,
      problems: sheetProblems.map(p => ({ answer: p.answer, choices: p.choices })),
    }
    this.totalProblems = sheetProblems.length
    this.solvedCount = 0
    this.currentProblem = 0
    this.setupProblem()
  }

  setupProblem() {
    if (!this.levelData) return
    const problem = this.levelData.problems[this.currentProblem]
    if (!problem) return

    this.waitingForNext = false
    this.touchLocked = false
    this.dealAnimTime = 0
    this.zOrderCounter = 0

    // C++ problem card: placed at problem slot, always face-up, no interaction
    this.problemCard = this.makeCard(
      PROBLEM_X, PROBLEM_Y, PROBLEM_X, PROBLEM_Y,
      problem.answer, 'front', 1,
    )

    // C++ does NOT shuffle choices. Choice index IS the CardID. AnswerID matches by image path.
    const choices = problem.choices
    const numChoices = choices.length
    const deckX = GAME_WIDTH + CARD_W  // off-screen right (C++ DeckBase at GameSize.width)
    const deckY = PLAYER_Y

    this.choiceCards = choices.map((c, i) => {
      // C++ slot offset: (CARD_W + CARD_MARGIN) * (Index - (SlotCount-1)/2)
      const offsetX = (CARD_W + CARD_MARGIN) * (i - (numChoices - 1) / 2)
      const slotX = GAME_WIDTH / 2 + offsetX
      return this.makeCard(deckX, deckY, slotX, PLAYER_Y, c, 'in_deck', 0)
    })

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  makeCard(x: number, y: number, slotX: number, slotY: number,
           imagePath: string, state: CardState, flipProgress: number): Card {
    return {
      x, y, slotX, slotY,
      width: CARD_W, height: CARD_H,
      image: loadImage(`${ASSET_PATH}/${imagePath}`),
      imagePath,
      state,
      flipProgress,
      animTime: 0,
      moveStartX: x, moveStartY: y,
      moveTargetX: slotX, moveTargetY: slotY,
      moveDuration: DURATION_PLAYER_MOVE,
      moveElapsed: 0,
      shakeTime: 0,
      correct: null, removed: false,
      zOrder: this.zOrderCounter++,
      birthSoundPlayed: false,
      deathSoundPlayed: false,
    }
  }

  start() {
    super.start()
    this.loadLevel()
  }

  onPointerDown(x: number, y: number) {
    if (this.waitingForNext || this.touchLocked) return

    for (const card of this.choiceCards) {
      if (card.state !== 'front' || card.removed) continue
      const hw = card.width / 2
      const hh = card.height / 2
      if (x >= card.x - hw && x <= card.x + hw && y >= card.y - hh && y <= card.y + hh) {
        this.handleCardClicked(card)
        break
      }
    }
  }

  handleCardClicked(card: Card) {
    const isCorrect = card.imagePath === this.problemCard?.imagePath
    card.correct = isCorrect
    card.zOrder = 100

    // Both correct and incorrect: first move card to answer slot
    card.state = 'moving_to_answer'
    card.moveStartX = card.x
    card.moveStartY = card.y
    card.moveTargetX = ANSWER_X
    card.moveTargetY = ANSWER_Y
    card.moveElapsed = 0
    card.moveDuration = DURATION_CARD_MOVE
    this.touchLocked = true

    if (isCorrect) {
      this.waitingForNext = true
    }
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  update(_time: number, dt: number) {
    this.dealAnimTime += dt
    const numChoices = this.choiceCards.length

    // C++ deal sequence timing (per card i):
    //   t = 0:                   start
    //   dealStart = 0.2 * i:     begin moving card i from deck to slot
    //   dealEnd = dealStart + DURATION_PLAYER_MOVE: card i arrives, play birth sound
    //   After ALL cards arrive, wait flipDelay = 0.2 * (max(4, numChoices) - 1)
    //   Then ALL cards flip simultaneously (each takes DURATION_CARD_FLIP)
    //
    // C++ actually runs per-card sequences in parallel. Card i's sequence:
    //   delay(0.2*i) -> move(0.12) -> playBirth -> delay(0.2*(max4-1)) -> flip(0.2) -> playDeath
    // The "delay after birth" is the same for all cards, so they all flip at different times.
    // Actually looking at the C++ more carefully, each card has its OWN delay:
    //   Actions: delay(0.2*CardID) -> move -> birth -> delay(0.2*(max(4,N)-1)) -> flip -> death
    // So card 0 flips first, then card 1, etc. But the inner delay is the same for all.

    for (let i = 0; i < numChoices; i++) {
      const card = this.choiceCards[i]
      if (card.removed) continue

      const dealStart = DEAL_DELAY * i
      const dealMoveEnd = dealStart + DURATION_PLAYER_MOVE
      const flipDelay = DEAL_DELAY * (Math.max(4, numChoices) - 1)
      const flipStart = dealMoveEnd + flipDelay
      // Each card independently tracks its time in the deal sequence

      if (card.state === 'in_deck') {
        if (this.dealAnimTime >= dealStart) {
          card.state = 'dealing'
          card.moveStartX = card.x
          card.moveStartY = card.y
          card.moveElapsed = this.dealAnimTime - dealStart
        }
      }

      if (card.state === 'dealing') {
        card.moveElapsed += dt
        const t = Math.min(card.moveElapsed / DURATION_PLAYER_MOVE, 1)
        card.x = card.moveStartX + (card.slotX - card.moveStartX) * t
        card.y = card.moveStartY + (card.slotY - card.moveStartY) * t
        if (t >= 1) {
          card.x = card.slotX
          card.y = card.slotY
          if (!card.birthSoundPlayed) {
            playSound(this.sfxBirth)
            card.birthSoundPlayed = true
          }
          card.state = 'dealt'
          card.animTime = 0
        }
      }

      if (card.state === 'dealt') {
        // Wait for flip time
        if (this.dealAnimTime >= flipStart) {
          card.state = 'flipping_to_front'
          card.animTime = this.dealAnimTime - flipStart
        }
      }

      if (card.state === 'flipping_to_front') {
        card.animTime += dt
        const t = Math.min(card.animTime / DURATION_CARD_FLIP, 1)
        // C++ EaseOut with rate 2
        const eased = 1 - Math.pow(1 - t, 2)
        card.flipProgress = eased
        if (t >= 1) {
          card.state = 'front'
          card.flipProgress = 1
          if (!card.deathSoundPlayed) {
            playSound(this.sfxDeath)
            card.deathSoundPlayed = true
          }
        }
      }

      if (card.state === 'moving_to_answer') {
        card.moveElapsed += dt
        const t = Math.min(card.moveElapsed / card.moveDuration, 1)
        card.x = card.moveStartX + (card.moveTargetX - card.moveStartX) * t
        card.y = card.moveStartY + (card.moveTargetY - card.moveStartY) * t

        if (t >= 1) {
          card.x = card.moveTargetX
          card.y = card.moveTargetY
          card.state = 'at_answer'

          if (card.correct === true) {
            // C++ sequence: delay 0.1s -> play hit + update progress -> delay 0.9s -> advance
            setTimeout(() => {
              const hitN = Math.floor(Math.random() * 6)
              const hitSound = loadAudio(`${ASSET_PATH}/sounds/card_hit.${hitN}.m4a`)
              playSound(hitSound)
              this.solvedCount++
              this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)

              setTimeout(() => {
                if (this.currentProblem < this.totalProblems - 1) {
                  this.currentProblem++
                  this.setupProblem()
                } else {
                  this.gameState = 'complete'
                  this.onComplete?.()
                }
              }, 900)
            }, 100)
          } else {
            // C++ sequence: play miss -> pause(0.05s) -> release touch -> move back -> shake
            playSound(this.sfxMiss)
            setTimeout(() => {
              this.touchLocked = false
              card.state = 'returning'
              card.moveStartX = card.x
              card.moveStartY = card.y
              card.moveTargetX = card.slotX
              card.moveTargetY = card.slotY
              card.moveElapsed = 0
              card.moveDuration = DURATION_PLAYER_MOVE
              card.correct = null
            }, DURATION_CARD_PAUSE * 1000)
          }
        }
      }

      if (card.state === 'returning') {
        card.moveElapsed += dt
        const t = Math.min(card.moveElapsed / card.moveDuration, 1)
        card.x = card.moveStartX + (card.moveTargetX - card.moveStartX) * t
        card.y = card.moveStartY + (card.moveTargetY - card.moveStartY) * t
        if (t >= 1) {
          card.x = card.slotX
          card.y = card.slotY
          card.state = 'shaking'
          card.shakeTime = 0
        }
      }

      if (card.state === 'shaking') {
        card.shakeTime += dt
        if (card.shakeTime >= DURATION_CARD_SHAKE) {
          card.state = 'front'
          card.shakeTime = 0
        }
      }
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

    // Draw game board
    if (imgOk(this.boardImage)) {
      const bw = BOARD_W * gs
      const bh = BOARD_H * gs
      const bx = BOARD_CENTER_X * gs - bw / 2
      const by = BOARD_TOP_Y * gs
      ctx.drawImage(this.boardImage, bx, by, bw, bh)
    }

    // Draw problem card
    if (this.problemCard && !this.problemCard.removed) {
      this.drawCard(this.problemCard)
    }

    // Draw choice cards sorted by zOrder
    const sorted = [...this.choiceCards].filter(c => !c.removed)
      .sort((a, b) => a.zOrder - b.zOrder)
    for (const card of sorted) {
      this.drawCard(card)
    }

    ctx.restore()
  }

  drawCard(card: Card) {
    const { ctx } = this
    const gs = this.gameScale
    const x = card.x * gs
    const y = card.y * gs
    const w = CARD_W * gs
    const h = CARD_H * gs

    ctx.save()

    // C++ shake animation: rotate z by +/- 5 degrees
    // Pattern: L, R, L, R, L, Center over 6 equal segments of DURATION_CARD_SHAKE
    if (card.state === 'shaking') {
      const shakeAngle = 5
      const t = Math.min(card.shakeTime / DURATION_CARD_SHAKE, 1)
      const phase = t * 6
      const segment = Math.min(Math.floor(phase), 5)
      const segT = phase - segment
      // Target angles: -5, +5, -5, +5, -5, 0
      const targets = [-shakeAngle, shakeAngle, -shakeAngle, shakeAngle, -shakeAngle, 0]
      // Start angle is the previous target (or 0 for first)
      const startAngle = segment === 0 ? 0 : targets[segment - 1]
      const endAngle = targets[segment]
      const angle = startAngle + (endAngle - startAngle) * segT
      ctx.translate(x, y)
      ctx.rotate(angle * Math.PI / 180)
      ctx.translate(-x, -y)
    }

    // Card flip effect: simulate Y-rotation by scaling X
    // flipProgress 0 = back, 1 = front
    const showFront = card.flipProgress > 0.5
    let flipScaleX: number
    if (showFront) {
      flipScaleX = (card.flipProgress - 0.5) * 2   // 0.5->1 maps to 0->1
    } else {
      flipScaleX = (0.5 - card.flipProgress) * 2   // 0->0.5 maps to 1->0
    }
    // Clamp to avoid zero scale
    flipScaleX = Math.max(flipScaleX, 0.01)

    ctx.translate(x, y)
    ctx.scale(flipScaleX, 1)
    ctx.translate(-x, -y)

    // Draw card background image
    const cardBgImg = showFront ? this.cardFrontImg : this.cardBackImg
    if (imgOk(cardBgImg)) {
      ctx.drawImage(cardBgImg, x - w / 2, y - h / 2, w, h)
    } else {
      // Fallback: white rounded rect
      const radius = 16 * gs
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.15)'
      ctx.shadowBlur = 6 * gs
      ctx.shadowOffsetY = 3 * gs
      ctx.beginPath()
      ctx.roundRect(x - w / 2, y - h / 2, w, h, radius)
      ctx.fill()
      ctx.shadowColor = 'transparent'
    }

    // Draw title image on front face
    if (showFront && imgOk(card.image)) {
      const padding = 20 * gs
      const imgArea = Math.min(w - padding * 2, h - padding * 2)
      const imgRatio = card.image.naturalWidth / card.image.naturalHeight
      let iw: number, ih: number
      if (imgRatio > 1) { iw = imgArea; ih = imgArea / imgRatio }
      else { ih = imgArea; iw = imgArea * imgRatio }
      ctx.drawImage(card.image, x - iw / 2, y - ih / 2, iw, ih)
    }

    // Correct answer green border
    if (card.correct === true) {
      ctx.strokeStyle = '#4CAF50'
      ctx.lineWidth = 4 * gs
      ctx.beginPath()
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 16 * gs)
      ctx.stroke()
    }
    // Incorrect answer red border
    if (card.correct === false) {
      ctx.strokeStyle = '#F44336'
      ctx.lineWidth = 4 * gs
      ctx.beginPath()
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 16 * gs)
      ctx.stroke()
    }

    ctx.restore()
  }
}
