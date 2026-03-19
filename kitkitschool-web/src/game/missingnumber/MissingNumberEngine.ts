/**
 * MissingNumberEngine — Complete rewrite based on C++ source code.
 *
 * C++ sources analyzed:
 *   - MissingNumberScene.cpp (691 lines) — scene layout, card events, problem flow
 *   - Egg.cpp (529 lines) — egg container, question slots, digit rendering, explosion
 *   - MissingNumberNumberCard.cpp (101 lines) — draggable number card
 *
 * Key changes from previous version:
 *   1. DRAG-AND-DROP interaction (was click-to-answer)
 *   2. Correct egg root Y position (820 Cocos → canvas 980 bottom)
 *   3. Two-slot question system for 2-digit answers
 *   4. Variable-width digit rendering from sprite sheet
 *   5. Proper NumberCard assets (card_forsingledigit/forthreedigit)
 *   6. Retry counting with auto-reveal after 5 wrong attempts
 *   7. Explosion animation on last egg when solved
 *
 * Coordinate system:
 *   Cocos2d-x (Y-up) → Canvas (Y-down): canvasY = 1800 - cocosY
 *   Game design resolution: 2560×1800 (FIXED_HEIGHT)
 */

import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET = assetUrl('/assets/games/missingnumber')

/* ══════════════════════════════════════════════════════
   Digit sprite sheet — VARIABLE width per digit
   From Egg.cpp RESOURCE_NUM_POSITION[]
   ══════════════════════════════════════════════════════ */

const DIGIT_RECTS: { x: number; w: number }[] = [
  { x: 0,   w: 99 },   // 0
  { x: 99,  w: 48 },   // 1
  { x: 147, w: 95 },   // 2
  { x: 242, w: 82 },   // 3
  { x: 324, w: 91 },   // 4
  { x: 415, w: 80 },   // 5
  { x: 495, w: 85 },   // 6
  { x: 580, w: 79 },   // 7
  { x: 659, w: 90 },   // 8
  { x: 749, w: 79 },   // 9
]
const DIGIT_SPRITE_H = 112

/** Compute total pixel width for a number string using variable-width digits */
function digitsTotalWidth(numStr: string): number {
  let w = 0
  for (let i = 0; i < numStr.length; i++) {
    const d = numStr.charCodeAt(i) - 48
    if (d >= 0 && d <= 9) w += DIGIT_RECTS[d].w
  }
  return w
}

/* ══════════════════════════════════════════════════════
   Layout constants from C++ source
   ══════════════════════════════════════════════════════ */

// Egg container (Egg.cpp:44-46)
const CONTAINER_W = 464   // nestShadow width
const CONTAINER_H = 480   // explicit in C++

// Egg image dimensions (PNG)
const EGG_W = 340
const EGG_H = 432

// Scene positions (MissingNumberScene.cpp:276,362) — Cocos Y-up
const EGG_ROOT_BOTTOM_COCOS = 820    // mEggRoot setPosition Y, ANCHOR_MIDDLE_BOTTOM
const CARD_ROOT_BOTTOM_COCOS = 50    // mNumberCardRoot setPosition Y, ANCHOR_MIDDLE_BOTTOM

// Canvas Y-down conversions
const EGG_ROOT_BOTTOM_CANVAS = GAME_HEIGHT - EGG_ROOT_BOTTOM_COCOS  // 980
const CARD_ROOT_BOTTOM_CANVAS = GAME_HEIGHT - CARD_ROOT_BOTTOM_COCOS // 1750

// Egg center Y in canvas coordinates
// mEggRoot (inner) at (width/2, height=480), ANCHOR_MIDDLE_TOP → egg center at 480 - EGG_H/2 = 264 from bottom
const EGG_CENTER_CANVAS = EGG_ROOT_BOTTOM_CANVAS - (CONTAINER_H - EGG_H / 2) // 980 - 264 = 716

// Nest positions in canvas (from C++ Egg.cpp local coords → world)
// nestShadow: Y=-50, ANCHOR_MIDDLE_BOTTOM → bottom at Cocos 770, center at 838 → canvas 962
const NEST_SHADOW_CY_CANVAS = GAME_HEIGHT - (EGG_ROOT_BOTTOM_COCOS - 50 + 68) // 962
// nestBack & nest front: Y=0, ANCHOR_MIDDLE_BOTTOM → center at 90 from bottom → Cocos 910 → canvas 890
const NEST_CY_CANVAS = GAME_HEIGHT - (EGG_ROOT_BOTTOM_COCOS + 90)  // 890

// Nest dimensions (PNG)
const NEST_W = 420
const NEST_H = 180
const NEST_SHADOW_W = 464
const NEST_SHADOW_H = 136

// Card slot dimensions (PNG)
const CARD_SLOT_W = 214
const CARD_SLOT_H = 292
const CARD_SLOT_3D_W = 412
const CARD_SLOT_3D_H = 292

// Number card dimensions (PNG)
const CARD_SINGLE_W = 244
const CARD_SINGLE_H = 336
const CARD_3D_W = 478
const CARD_3D_H = 336

// Question mark dimensions (PNG)
const QMARK_W = 70
const QMARK_H = 117

// Card text: OpenSans-Bold.ttf 167px, color (85,55,52) — C++ MissingNumberNumberCard.cpp:48
const CARD_FONT_SIZE = 167
const CARD_TEXT_COLOR = 'rgb(85, 55, 52)'

// Two-digit slot overlap (Egg.cpp:160): width + width/2 - 17
const SLOT_OVERLAP = 17

// Collision offset for question slots (Egg.cpp:320)
const COLLISION_OFFSET = 20

// Lamp dimensions (PNG)
const LAMP_W = 145
const LAMP_H = 50
const LIGHT1_W = 1218
const LIGHT1_H = 706
const LIGHT2_W = 758
const LIGHT2_H = 620
const LIGHT3_W = 44
const LIGHT3_H = 44

// Bird & cloud dimensions (PNG)
const BIRD_W = 266
const BIRD_H = 272
const CLOUD_W = 72
const CLOUD_H = 66

// Egg split parts (PNG)
const EGG_TOP_W = 304
const EGG_TOP_H = 154
const EGG_BOTTOM_W = 340
const EGG_BOTTOM_H = 340
const CRACK_W = 340
const CRACK_H = 432

// Drag scale (MissingNumberScene.cpp:382)
const DRAG_SCALE = 0.85
// Dummy card opacity (MissingNumberScene.cpp:302)
const DUMMY_OPACITY = 0.7
// Answered card scale in slot (Egg.cpp:150,191)
const SLOT_CARD_SCALE = 0.85

// Retry threshold for auto-reveal (MissingNumberScene.cpp:469)
const MAX_RETRIES = 5

// Card gap for multi-digit suggest (MissingNumberScene.cpp:349)
const SUGGEST_GAP = 100

/* ══════════════════════════════════════════════════════
   Data types
   ══════════════════════════════════════════════════════ */

interface Problem {
  question: string
  sequence: string[]
  answer: string
  choices: string[] | null
  missingIndex: number
}

interface CardState {
  numberString: string
  originX: number   // game coords, center
  originY: number
  currentX: number
  currentY: number
  scale: number
  visible: boolean
  isSmall: boolean  // card_forsingledigit vs card_forthreedigit
}

interface SlotState {
  digit: string       // expected digit
  answered: boolean   // filled correctly
  selected: boolean   // card hovering
  // Absolute game coordinates of the slot (center, in the egg's world space)
  cx: number
  cy: number
  w: number
  h: number
}

interface EggData {
  containerCX: number      // center X of egg container in game coords
  resourceIndex: number    // 0-4 (egg color)
  numberString: string     // the number for this position (or "?" for question)
  isQuestion: boolean
  isLast: boolean
  // Question egg state
  slots: SlotState[]
  numberVisible: boolean   // show number sprites after solved
  questionVisible: boolean // show question slots
}

interface Tween {
  cardIndex: number
  startX: number; startY: number; startScale: number
  targetX: number; targetY: number; targetScale: number
  duration: number
  elapsed: number
  easing: 'linear' | 'easeExpOut' | 'easeBackOut'
  onComplete?: () => void
}

type Phase = 'playing' | 'solved_anim' | 'explosion' | 'transition_out' | 'transition_in'

/* ══════════════════════════════════════════════════════
   Easing functions
   ══════════════════════════════════════════════════════ */

function easeExpOut(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

function easeBackOut(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/* ══════════════════════════════════════════════════════
   Engine
   ══════════════════════════════════════════════════════ */

export class MissingNumberEngine extends BaseEngine {
  level: number
  problems: Problem[] = []
  currentProblem = 0
  totalProblems = 0

  phase: Phase = 'playing'
  phaseTimer = 0

  // Egg data for current problem
  eggs: EggData[] = []
  // Card states
  cards: CardState[] = []
  // Tweens for card animations
  tweens: Tween[] = []

  // Drag state
  dragCardIndex = -1
  dragOffsetX = 0
  dragOffsetY = 0
  dragStartX = 0
  dragStartY = 0
  dragDistance = 0
  dummyVisible = false

  // Retry counter (MissingNumberScene.cpp:469)
  retryCount = 0

  // Explosion animation state (only for last egg)
  explosionTimer = -1
  explosionEggIndex = -1
  explosionSoundPlayed = false

  // Transition animation
  transitionTimer = 0
  transitionEggOffsetX = 0
  transitionCardOffsetY = 0

  // Solved celebration timer
  solvedTimer = 0
  jumpOffsets: number[] = []  // per-egg jump offset Y

  /* ── Image assets ────────────────────────────── */
  bgImage: HTMLImageElement
  eggLampImage: HTMLImageElement
  lampLight1: HTMLImageElement
  lampLight2: HTMLImageElement
  lampLight3: HTMLImageElement
  nestImage: HTMLImageElement
  nestBackImage: HTMLImageElement
  nestShadowImage: HTMLImageElement
  eggImages: HTMLImageElement[] = []
  eggTopImages: HTMLImageElement[] = []
  eggBottomImages: HTMLImageElement[] = []
  crackImages: HTMLImageElement[] = []
  numberSprite: HTMLImageElement
  questionMarkNormal: HTMLImageElement
  questionMarkSelected: HTMLImageElement
  cardSlotEmpty: HTMLImageElement
  cardSlotEmpty3D: HTMLImageElement
  cardSlotSelected: HTMLImageElement
  cardSlotSelected3D: HTMLImageElement
  cardSingle: HTMLImageElement
  card3D: HTMLImageElement
  birdImage: HTMLImageElement
  cloudImage: HTMLImageElement

  /* ── Sound assets ────────────────────────────── */
  sfxClick: HTMLAudioElement
  sfxCorrect: HTMLAudioElement
  sfxWrong: HTMLAudioElement
  sfxMangoDrop: HTMLAudioElement
  sfxJumpDoll: HTMLAudioElement[] = []
  sfxJumpFlag: HTMLAudioElement[] = []
  jumpAudioType = 0  // 0=doll, 1=flag (randomized per solve)
  jumpSoundsPlayed: boolean[] = []  // track which egg sounds already played

  /* ── Callbacks ───────────────────────────────── */
  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    // Background & lamp
    this.bgImage = loadImage(`${ASSET}/back_image.png`)
    this.eggLampImage = loadImage(`${ASSET}/egg-lamp.png`)
    this.lampLight1 = loadImage(`${ASSET}/lamp_light_01.png`)
    this.lampLight2 = loadImage(`${ASSET}/lamp_light_02.png`)
    this.lampLight3 = loadImage(`${ASSET}/lamp_light_03.png`)

    // Nest layers
    this.nestImage = loadImage(`${ASSET}/nest.png`)
    this.nestBackImage = loadImage(`${ASSET}/nest_back.png`)
    this.nestShadowImage = loadImage(`${ASSET}/nest_shadow.png`)

    // Egg assets (5 color variants)
    for (let i = 1; i <= 5; i++) {
      const pad = String(i).padStart(2, '0')
      this.eggImages.push(loadImage(`${ASSET}/egg_${pad}.png`))
      this.eggTopImages.push(loadImage(`${ASSET}/egg_${pad}_top.png`))
      this.eggBottomImages.push(loadImage(`${ASSET}/egg_${pad}_bottom.png`))
    }
    for (let i = 1; i <= 4; i++) {
      this.crackImages.push(loadImage(`${ASSET}/crack_${String(i).padStart(2, '0')}.png`))
    }

    // Number sprite sheet
    this.numberSprite = loadImage(`${ASSET}/egg_number_image.png`)

    // Question mark
    this.questionMarkNormal = loadImage(`${ASSET}/card-slot-question-mark_normal.png`)
    this.questionMarkSelected = loadImage(`${ASSET}/card-slot-question-mark_selected.png`)

    // Card slots
    this.cardSlotEmpty = loadImage(`${ASSET}/card-slot_empty.png`)
    this.cardSlotEmpty3D = loadImage(`${ASSET}/card-slot_empty_forthreedigit.png`)
    this.cardSlotSelected = loadImage(`${ASSET}/card-slot_selected.png`)
    this.cardSlotSelected3D = loadImage(`${ASSET}/card-slot_selected_forthreedigit.png`)

    // Number cards (draggable)
    this.cardSingle = loadImage(`${ASSET}/card_forsingledigit.png`)
    this.card3D = loadImage(`${ASSET}/card_forthreedigit.png`)

    // Bird & cloud for explosion
    this.birdImage = loadImage(`${ASSET}/animal_bird.png`)
    this.cloudImage = loadImage(`${ASSET}/cloud.png`)

    // Sounds
    this.sfxClick = loadAudio(assetUrl('/assets/games/findthematch/sounds/card_hit.0.m4a'))
    this.sfxCorrect = loadAudio(assetUrl('/assets/games/findthematch/sounds/card_hit.3.m4a'))
    this.sfxWrong = loadAudio(assetUrl('/assets/games/findthematch/sounds/card_miss.m4a'))
    this.sfxMangoDrop = loadAudio(`${ASSET}/sounds/mango_drop.m4a`)
    for (let i = 1; i <= 5; i++) {
      this.sfxJumpDoll.push(loadAudio(`${ASSET}/sounds/pattern_doll_${i}.m4a`))
      this.sfxJumpFlag.push(loadAudio(`${ASSET}/sounds/pattern_flag_${i}.m4a`))
    }
  }

  /* ════════════════════════════════════════════════
     Lifecycle
     ════════════════════════════════════════════════ */

  start() {
    super.start()
    this.loadLevel()
  }

  async loadLevel() {
    try {
      const resp = await fetch('/data/games/missingnumber.json')
      const data = await resp.json()
      const levelData = data.levels[String(this.level)]
      if (levelData && levelData.length > 0) {
        const ws = levelData[Math.floor(Math.random() * levelData.length)]
        this.problems = ws
      } else {
        this.problems = this.fallbackProblems()
      }
    } catch {
      this.problems = this.fallbackProblems()
    }

    this.totalProblems = this.problems.length
    this.currentProblem = 0
    this.setupProblem()
    this.onProgressChange?.(1, this.totalProblems)
  }

  private fallbackProblems(): Problem[] {
    return [{ question: '1, 2, 3, ?', sequence: ['1', '2', '3', '?'], answer: '4', choices: null, missingIndex: 3 }]
  }

  /* ════════════════════════════════════════════════
     Problem setup
     ════════════════════════════════════════════════ */

  private setupProblem() {
    this.phase = 'playing'
    this.retryCount = 0
    this.tweens = []
    this.dragCardIndex = -1
    this.dummyVisible = false
    this.explosionTimer = -1
    this.explosionEggIndex = -1
    this.explosionSoundPlayed = false
    this.solvedTimer = 0
    this.jumpOffsets = []

    const p = this.problems[this.currentProblem]
    if (!p) return

    // ── Egg setup ──
    // Random shuffle of egg color indices (C++ MissingNumberScene.cpp:248-254)
    const resourceIndices = [0, 1, 2, 3, 4]
    for (let i = resourceIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[resourceIndices[i], resourceIndices[j]] = [resourceIndices[j], resourceIndices[i]]
    }

    const count = p.sequence.length
    // Total width of all egg containers (no gap, containers are edge-to-edge)
    const totalW = count * CONTAINER_W
    const startX = (GAME_WIDTH - totalW) / 2

    this.eggs = []
    for (let i = 0; i < count; i++) {
      const val = p.sequence[i].trim()
      const cx = startX + (i + 0.5) * CONTAINER_W  // center X of container
      const isQuestion = val === '?'
      const isLast = i === count - 1

      const egg: EggData = {
        containerCX: cx,
        resourceIndex: resourceIndices[i % 5],
        numberString: isQuestion ? p.answer : val,
        isQuestion,
        isLast,
        slots: [],
        numberVisible: !isQuestion,  // non-question eggs always show number
        questionVisible: isQuestion,
      }

      // Setup question slots
      if (isQuestion) {
        this.setupSlots(egg, p.answer, cx)
      }

      this.eggs.push(egg)
    }

    this.jumpOffsets = new Array(count).fill(0)

    // ── Card setup ──
    this.setupCards(p)
  }

  /** Setup question slots for a question egg */
  private setupSlots(egg: EggData, answer: string, containerCX: number) {
    const ansLen = answer.length

    if (ansLen === 2) {
      // Two slots, each card-slot_empty, overlap by SLOT_OVERLAP
      // Egg.cpp:136-176
      // mQuestion0 at (slotW/2, slotH/2)
      // mQuestion1 at (slotW + slotW/2 - 17, slotH/2)
      // questionRoot contentSize = (slotW*2-17, slotH)
      const rootW = CARD_SLOT_W * 2 - SLOT_OVERLAP  // 411
      const rootH = CARD_SLOT_H                      // 292

      // questionRoot positioned at mEggRoot contentSize/2 = egg center
      // In canvas: EGG_CENTER_CANVAS (716)

      // Slot 0 center (in questionRoot local): (CARD_SLOT_W/2, CARD_SLOT_H/2)
      // Slot 1 center: (CARD_SLOT_W + CARD_SLOT_W/2 - 17, CARD_SLOT_H/2)
      // questionRoot center X = containerCX (since it's centered on egg)

      const rootLeftX = containerCX - rootW / 2
      const rootTopY = EGG_CENTER_CANVAS - rootH / 2

      egg.slots.push({
        digit: answer.charAt(0),
        answered: false,
        selected: false,
        cx: rootLeftX + CARD_SLOT_W / 2,
        cy: rootTopY + CARD_SLOT_H / 2,
        w: CARD_SLOT_W,
        h: CARD_SLOT_H,
      })
      egg.slots.push({
        digit: answer.charAt(1),
        answered: false,
        selected: false,
        cx: rootLeftX + CARD_SLOT_W + CARD_SLOT_W / 2 - SLOT_OVERLAP,
        cy: rootTopY + CARD_SLOT_H / 2,
        w: CARD_SLOT_W,
        h: CARD_SLOT_H,
      })
    } else {
      // Single slot
      // 1-digit: card-slot_empty (214×292)
      // 3-digit: card-slot_empty_forThreeDigit (412×292)
      const slotW = ansLen === 1 ? CARD_SLOT_W : CARD_SLOT_3D_W
      const slotH = ansLen === 1 ? CARD_SLOT_H : CARD_SLOT_3D_H

      egg.slots.push({
        digit: answer,
        answered: false,
        selected: false,
        cx: containerCX,
        cy: EGG_CENTER_CANVAS,
        w: slotW,
        h: slotH,
      })
    }
  }

  /** Setup draggable number cards */
  private setupCards(p: Problem) {
    const isNA = !p.choices || p.choices.length === 0
    const choices = isNA ? ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] : p.choices!
    const isSmall = isNA  // NA → single-digit cards, suggest → possibly multi-digit

    const cardW = isSmall ? CARD_SINGLE_W : CARD_3D_W
    const cardH = isSmall ? CARD_SINGLE_H : CARD_3D_H

    // Calculate total width (no gap for NA, 100px gap for suggest)
    const gap = isNA ? 0 : SUGGEST_GAP
    const totalW = choices.length * cardW + (choices.length - 1) * gap

    // Center horizontally, positioned from mNumberCardRoot bottom = Canvas 1750
    const cardCY = CARD_ROOT_BOTTOM_CANVAS - cardH / 2  // 1750 - 168 = 1582
    const startX = (GAME_WIDTH - totalW) / 2

    this.cards = []
    for (let i = 0; i < choices.length; i++) {
      const cx = startX + cardW / 2 + i * (cardW + gap)
      this.cards.push({
        numberString: choices[i].trim(),
        originX: cx,
        originY: cardCY,
        currentX: cx,
        currentY: cardCY,
        scale: 1,
        visible: true,
        isSmall,
      })
    }
  }

  /* ════════════════════════════════════════════════
     Interaction — Drag and Drop
     ════════════════════════════════════════════════ */

  onPointerDown(x: number, y: number) {
    if (this.phase !== 'playing') return
    if (this.dragCardIndex >= 0) return  // already dragging

    // Hit test cards (reverse order for z-order)
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const card = this.cards[i]
      if (!card.visible) continue

      const cw = (card.isSmall ? CARD_SINGLE_W : CARD_3D_W) * card.scale
      const ch = (card.isSmall ? CARD_SINGLE_H : CARD_3D_H) * card.scale
      const left = card.currentX - cw / 2
      const top = card.currentY - ch / 2

      if (x >= left && x <= left + cw && y >= top && y <= top + ch) {
        // Start dragging
        this.dragCardIndex = i
        this.dragOffsetX = x - card.currentX
        this.dragOffsetY = y - card.currentY
        this.dragStartX = x
        this.dragStartY = y
        this.dragDistance = 0
        this.dummyVisible = true
        card.scale = DRAG_SCALE

        try { playSound(this.sfxClick) } catch { /* */ }
        return
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (this.dragCardIndex < 0) return

    const card = this.cards[this.dragCardIndex]
    card.currentX = x - this.dragOffsetX
    card.currentY = y - this.dragOffsetY

    // Track total drag distance
    this.dragDistance = Math.hypot(x - this.dragStartX, y - this.dragStartY)

    // Check collision with question slots and highlight
    this.updateSlotHighlights(card)
  }

  onPointerUp(_x: number, _y: number) {
    if (this.dragCardIndex < 0) return

    const cardIdx = this.dragCardIndex
    const card = this.cards[cardIdx]
    this.dragCardIndex = -1

    // Clear all slot highlights
    for (const egg of this.eggs) {
      for (const slot of egg.slots) {
        slot.selected = false
      }
    }

    // TAP detection: if user barely moved, treat as tap-to-place
    const TAP_THRESHOLD = 30
    const isTap = this.dragDistance < TAP_THRESHOLD

    if (isTap) {
      // ── TAP MODE: auto-animate card to the matching slot ──
      this.handleTapPlace(cardIdx, card)
      return
    }

    // ── DRAG MODE: check collision with question slots ──
    const result = this.findSlotCollision(card)

    if (result) {
      const { egg, slotIndex } = result
      const slot = egg.slots[slotIndex]

      if (card.numberString === slot.digit) {
        this.handleCorrectPlace(cardIdx, card, egg, slotIndex)
      } else {
        this.handleWrongPlace(cardIdx, card, egg)
      }
    } else {
      // ── Released on empty space ──
      this.handleReturnCard(cardIdx, card)
    }
  }

  /** Handle tap-to-place: user clicked a card without dragging */
  private handleTapPlace(cardIdx: number, card: CardState) {
    // Find the first unfilled slot that matches this card
    for (const egg of this.eggs) {
      if (!egg.isQuestion) continue

      // Try to find a matching unfilled slot
      let targetSlotIndex = -1
      for (let i = 0; i < egg.slots.length; i++) {
        if (!egg.slots[i].answered && egg.slots[i].digit === card.numberString) {
          targetSlotIndex = i
          break
        }
      }

      if (targetSlotIndex >= 0) {
        // ── CORRECT: animate card flying to the slot ──
        const slot = egg.slots[targetSlotIndex]

        // Animate card to the slot position
        this.tweens.push({
          cardIndex: cardIdx,
          startX: card.currentX, startY: card.currentY, startScale: card.scale,
          targetX: slot.cx, targetY: slot.cy, targetScale: SLOT_CARD_SCALE,
          duration: 0.3,
          elapsed: 0,
          easing: 'easeExpOut',
          onComplete: () => {
            slot.answered = true
            card.visible = false
            this.dummyVisible = false
            try { playSound(this.sfxCorrect) } catch { /* */ }

            // Check if puzzle is solved
            if (this.checkSolved()) {
              this.onSolved()
            }
          }
        })
        return
      }

      // ── WRONG: find any unfilled slot to try, animate to it and bounce back ──
      let anySlotIndex = -1
      for (let i = 0; i < egg.slots.length; i++) {
        if (!egg.slots[i].answered) { anySlotIndex = i; break }
      }

      if (anySlotIndex >= 0) {
        const slot = egg.slots[anySlotIndex]
        // Count retry for 2-digit if no slot answered yet
        if (egg.slots.length === 2 && !egg.slots.some(s => s.answered)) {
          this.retryCount++
        }

        // Animate card flying to slot, then bouncing back
        this.tweens.push({
          cardIndex: cardIdx,
          startX: card.currentX, startY: card.currentY, startScale: card.scale,
          targetX: slot.cx, targetY: slot.cy, targetScale: SLOT_CARD_SCALE,
          duration: 0.25,
          elapsed: 0,
          easing: 'easeExpOut',
          onComplete: () => {
            try { playSound(this.sfxWrong) } catch { /* */ }
            // Bounce back to origin
            this.tweens.push({
              cardIndex: cardIdx,
              startX: card.currentX, startY: card.currentY, startScale: card.scale,
              targetX: card.originX, targetY: card.originY, targetScale: 1,
              duration: 0.2,
              elapsed: 0,
              easing: 'easeBackOut',
              onComplete: () => {
                this.dummyVisible = false
                this.handleAutoReveal()
              }
            })
          }
        })
        return
      }
    }

    // No question egg / no slots available: just return card
    this.handleReturnCard(cardIdx, card)
  }

  /** Handle correct placement (drag or tap) */
  private handleCorrectPlace(cardIdx: number, card: CardState, egg: EggData, slotIndex: number) {
    const slot = egg.slots[slotIndex]
    slot.answered = true
    try { playSound(this.sfxCorrect) } catch { /* */ }

    // Animate card to slot then hide
    this.tweens.push({
      cardIndex: cardIdx,
      startX: card.currentX, startY: card.currentY, startScale: card.scale,
      targetX: slot.cx, targetY: slot.cy, targetScale: SLOT_CARD_SCALE,
      duration: 0.2,
      elapsed: 0,
      easing: 'easeBackOut',
      onComplete: () => {
        card.visible = false
        this.dummyVisible = false

        // Check if puzzle is solved
        if (this.checkSolved()) {
          this.onSolved()
        }
      }
    })
  }

  /** Handle wrong placement (drag mode) */
  private handleWrongPlace(cardIdx: number, card: CardState, egg: EggData) {
    // Only count retry for 2-digit eggs that don't have any correct answer yet
    if (egg.slots.length === 2 && !egg.slots.some(s => s.answered)) {
      this.retryCount++
    }

    try { playSound(this.sfxWrong) } catch { /* */ }

    // Animate back
    this.tweens.push({
      cardIndex: cardIdx,
      startX: card.currentX, startY: card.currentY, startScale: card.scale,
      targetX: card.originX, targetY: card.originY, targetScale: 1,
      duration: 0.18,
      elapsed: 0,
      easing: 'easeExpOut',
      onComplete: () => {
        this.dummyVisible = false
        this.handleAutoReveal()
      }
    })
  }

  /** Handle returning card to origin (no collision) */
  private handleReturnCard(cardIdx: number, card: CardState) {
    const dist = Math.hypot(card.currentX - card.originX, card.currentY - card.originY)
    if (dist > 100) {
      try { playSound(this.sfxWrong) } catch { /* */ }
    }

    this.tweens.push({
      cardIndex: cardIdx,
      startX: card.currentX, startY: card.currentY, startScale: card.scale,
      targetX: card.originX, targetY: card.originY, targetScale: 1,
      duration: 0.18,
      elapsed: 0,
      easing: 'easeExpOut',
      onComplete: () => { this.dummyVisible = false }
    })
  }

  /** Auto-reveal ones digit after MAX_RETRIES (C++ line 469) */
  private handleAutoReveal() {
    if (this.retryCount >= MAX_RETRIES) {
      for (const e of this.eggs) {
        if (e.isQuestion && e.slots.length >= 2 && !e.slots[1].answered) {
          e.slots[1].answered = true
          this.retryCount = 0
          // Remove the card for this digit
          for (const c of this.cards) {
            if (c.numberString === e.slots[1].digit && c.visible) {
              c.visible = false
              break
            }
          }
          break
        }
      }
    }
  }

  /** Update slot highlight states based on card position */
  private updateSlotHighlights(card: CardState) {
    for (const egg of this.eggs) {
      if (!egg.isQuestion) continue

      const collisionIdx = this.checkCollisionWithSlots(egg, card)
      for (let i = 0; i < egg.slots.length; i++) {
        egg.slots[i].selected = (i === collisionIdx)
      }
      break  // only one question egg
    }
  }

  /** Check collision between card and egg's question slots.
   *  Returns slot index (0 or 1) or -1. Matches C++ Egg::checkCollisionWithQuestion */
  private checkCollisionWithSlots(egg: EggData, card: CardState): number {
    const cw = (card.isSmall ? CARD_SINGLE_W : CARD_3D_W) * card.scale
    const ch = (card.isSmall ? CARD_SINGLE_H : CARD_3D_H) * card.scale
    const cardRect = {
      left: card.currentX - cw / 2,
      top: card.currentY - ch / 2,
      right: card.currentX + cw / 2,
      bottom: card.currentY + ch / 2,
    }

    let result = -1

    for (let i = 0; i < egg.slots.length; i++) {
      const slot = egg.slots[i]
      if (slot.answered) continue  // already filled

      // Slot rect with OFFSET inset (C++ Egg.cpp:320)
      const slotRect = {
        left: slot.cx - slot.w / 2 + COLLISION_OFFSET,
        top: slot.cy - slot.h / 2 + COLLISION_OFFSET,
        right: slot.cx + slot.w / 2 - COLLISION_OFFSET,
        bottom: slot.cy + slot.h / 2 - COLLISION_OFFSET,
      }

      // Rect intersection
      if (cardRect.left < slotRect.right && cardRect.right > slotRect.left &&
          cardRect.top < slotRect.bottom && cardRect.bottom > slotRect.top) {
        if (result >= 0) {
          // Both slots collide → pick closer center (C++ Egg.cpp:343-349)
          const dist0 = Math.hypot(
            cardRect.left + cw / 2 - egg.slots[0].cx,
            cardRect.top + ch / 2 - egg.slots[0].cy
          )
          const dist1 = Math.hypot(
            cardRect.left + cw / 2 - egg.slots[1].cx,
            cardRect.top + ch / 2 - egg.slots[1].cy
          )
          return dist0 <= dist1 ? 0 : 1
        }
        result = i
      }
    }

    return result
  }

  /** Find which slot the card is colliding with */
  private findSlotCollision(card: CardState): { egg: EggData; slotIndex: number } | null {
    for (const egg of this.eggs) {
      if (!egg.isQuestion) continue
      const idx = this.checkCollisionWithSlots(egg, card)
      if (idx >= 0) return { egg, slotIndex: idx }
    }
    return null
  }

  /** Check if all question slots are answered */
  private checkSolved(): boolean {
    for (const egg of this.eggs) {
      if (!egg.isQuestion) continue
      return egg.slots.every(s => s.answered)
    }
    return false
  }

  /* ════════════════════════════════════════════════
     Solved sequence
     ════════════════════════════════════════════════ */

  private onSolved() {
    this.phase = 'solved_anim'
    this.solvedTimer = 0

    // Show number strings on all eggs (C++ MissingNumberScene.cpp:506-508)
    for (const egg of this.eggs) {
      egg.numberVisible = true
      egg.questionVisible = false
    }

    // Randomize jump sound type: 0=doll, 1=flag (C++ MissingNumberScene.cpp:569)
    this.jumpAudioType = Math.random() < 0.5 ? 0 : 1
    this.jumpSoundsPlayed = new Array(this.eggs.length).fill(false)

    // Update progress bar
    this.onProgressChange?.(this.currentProblem + 1, this.totalProblems)
  }

  private advanceProblem() {
    this.currentProblem++
    if (this.currentProblem >= this.totalProblems) {
      this.onProgressChange?.(this.totalProblems, this.totalProblems)
      this.gameState = 'complete'
      this.onComplete?.()
    } else {
      this.onProgressChange?.(this.currentProblem + 1, this.totalProblems)
      this.phase = 'transition_out'
      this.transitionTimer = 0
      this.transitionEggOffsetX = 0
      this.transitionCardOffsetY = 0
    }
  }

  /* ════════════════════════════════════════════════
     Update
     ════════════════════════════════════════════════ */

  update(_time: number, dt: number) {
    // Process tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]
      tw.elapsed += dt
      let t = Math.min(1, tw.elapsed / tw.duration)

      // Apply easing
      let et: number
      switch (tw.easing) {
        case 'easeExpOut': et = easeExpOut(t); break
        case 'easeBackOut': et = easeBackOut(t); break
        default: et = t
      }

      const card = this.cards[tw.cardIndex]
      if (card) {
        card.currentX = tw.startX + (tw.targetX - tw.startX) * et
        card.currentY = tw.startY + (tw.targetY - tw.startY) * et
        card.scale = tw.startScale + (tw.targetScale - tw.startScale) * et
      }

      if (t >= 1) {
        if (card) {
          card.currentX = tw.targetX
          card.currentY = tw.targetY
          card.scale = tw.targetScale
        }
        tw.onComplete?.()
        this.tweens.splice(i, 1)
      }
    }

    // Phase-specific updates
    switch (this.phase) {
      case 'solved_anim': {
        this.solvedTimer += dt

        // C++ timing: ANIMATION_START_OFFSET=1.0 + i*0.2, JumpBy(0.1, 50)
        // We use 0.5s offset for snappier web feel
        const JUMP_OFFSET = 0.5
        const JUMP_INTERVAL = 0.2
        const JUMP_DURATION = 0.1
        const JUMP_HEIGHT = 50

        for (let i = 0; i < this.eggs.length; i++) {
          const startTime = JUMP_OFFSET + i * JUMP_INTERVAL
          const jumpT = this.solvedTimer - startTime
          if (jumpT >= 0 && jumpT < JUMP_DURATION) {
            // Parabolic bounce (like Cocos2d JumpBy)
            const t = jumpT / JUMP_DURATION
            this.jumpOffsets[i] = -JUMP_HEIGHT * Math.sin(t * Math.PI)

            // Play jump sound once per egg (C++: Pattern_Doll_N or Pattern_Flag_N)
            if (!this.jumpSoundsPlayed[i]) {
              this.jumpSoundsPlayed[i] = true
              const sfxArr = this.jumpAudioType === 0 ? this.sfxJumpDoll : this.sfxJumpFlag
              const sfxIdx = Math.min(i, sfxArr.length - 1)
              try { playSound(sfxArr[sfxIdx]) } catch { /* */ }
            }
          } else {
            this.jumpOffsets[i] = 0
          }
        }

        // After last egg jump completes + small buffer
        const lastJumpEnd = JUMP_OFFSET + (this.eggs.length - 1) * JUMP_INTERVAL + JUMP_DURATION
        if (this.solvedTimer >= lastJumpEnd + 0.1) {
          // Start explosion on last egg
          const lastEggIdx = this.eggs.length - 1
          if (this.eggs[lastEggIdx]?.isLast) {
            this.phase = 'explosion'
            this.explosionTimer = 0
            this.explosionEggIndex = lastEggIdx
          } else {
            this.advanceProblem()
          }
        }
        break
      }

      case 'explosion': {
        this.explosionTimer += dt
        // Play Mango_Drop when bird appears (t=0.3, C++ MissingNumberScene.cpp:504)
        if (this.explosionTimer >= 0.3 && !this.explosionSoundPlayed) {
          this.explosionSoundPlayed = true
          try { playSound(this.sfxMangoDrop) } catch { /* */ }
        }
        // C++ timing: 0.3s delay + 0.5s spawn + 0.2s wait = 1.0s, then 0.5s pause
        if (this.explosionTimer >= 1.5) {
          this.advanceProblem()
        }
        break
      }

      case 'transition_out': {
        this.transitionTimer += dt
        const dur = 0.3
        const t = Math.min(1, this.transitionTimer / dur)
        // Eggs slide right, cards slide down
        this.transitionEggOffsetX = GAME_WIDTH * t
        this.transitionCardOffsetY = 900 * t

        if (t >= 1) {
          this.setupProblem()
          this.phase = 'transition_in'
          this.transitionTimer = 0
          this.transitionEggOffsetX = -GAME_WIDTH
          this.transitionCardOffsetY = 900
        }
        break
      }

      case 'transition_in': {
        this.transitionTimer += dt
        const dur = 0.3
        const t = Math.min(1, this.transitionTimer / dur)
        // Eggs slide in from left, cards slide up
        this.transitionEggOffsetX = -GAME_WIDTH * (1 - t)
        this.transitionCardOffsetY = 900 * (1 - t)

        if (t >= 1) {
          this.transitionEggOffsetX = 0
          this.transitionCardOffsetY = 0
          this.phase = 'playing'
        }
        break
      }
    }
  }

  /* ════════════════════════════════════════════════
     Drawing
     ════════════════════════════════════════════════ */

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Background
    if (imgOk(this.bgImage) && this.bgImage.naturalWidth > 0) {
      this.drawBackgroundImage(this.bgImage, w, h)
    } else {
      ctx.fillStyle = '#3E2723'
      ctx.fillRect(0, 0, w, h)
    }

    // Game coordinate space
    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Lamp glow (behind eggs)
    this.drawLamp(gs)

    // Eggs with transition offset
    ctx.save()
    ctx.translate(this.transitionEggOffsetX * gs, 0)
    this.drawEggs(gs)
    ctx.restore()

    // Cards with transition offset
    ctx.save()
    ctx.translate(0, this.transitionCardOffsetY * gs)
    this.drawCards(gs)
    ctx.restore()

    ctx.restore()
  }

  /* ── Lamp glow ── */
  private drawLamp(gs: number) {
    const { ctx } = this
    // Find question egg X for lamp position
    let lampX = GAME_WIDTH / 2
    for (const egg of this.eggs) {
      if (egg.isQuestion) {
        lampX = egg.containerCX + this.transitionEggOffsetX
        break
      }
    }

    // Light cones (additive blending)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'

    if (imgOk(this.lampLight2)) {
      ctx.globalAlpha = 0.3
      ctx.drawImage(this.lampLight2,
        (lampX - LIGHT2_W / 2) * gs, 0,
        LIGHT2_W * gs, LIGHT2_H * gs)
    }
    if (imgOk(this.lampLight1)) {
      ctx.globalAlpha = 0.5
      ctx.drawImage(this.lampLight1,
        (lampX - LIGHT1_W / 2) * gs, 0,
        LIGHT1_W * gs, LIGHT1_H * gs)
    }
    ctx.restore()

    // Lamp fixture (normal blending)
    if (imgOk(this.eggLampImage)) {
      ctx.drawImage(this.eggLampImage,
        (lampX - LAMP_W / 2) * gs, 0,
        LAMP_W * gs, LAMP_H * gs)
    }

    // Bulb highlight
    if (imgOk(this.lampLight3)) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(this.lampLight3,
        (lampX - LIGHT3_W / 2) * gs, (LAMP_H / 2 - LIGHT3_H / 2) * gs,
        LIGHT3_W * gs, LIGHT3_H * gs)
      ctx.restore()
    }
  }

  /* ── All eggs with nests ── */
  private drawEggs(gs: number) {
    const { ctx } = this
    const p = this.problems[this.currentProblem]
    if (!p) return

    // Pass 1: Nest shadows (behind everything)
    for (const egg of this.eggs) {
      this.drawImageCentered(this.nestShadowImage, egg.containerCX, NEST_SHADOW_CY_CANVAS, NEST_SHADOW_W, NEST_SHADOW_H, gs, 0.6)
    }

    // Pass 2: Nest backs
    for (const egg of this.eggs) {
      this.drawImageCentered(this.nestBackImage, egg.containerCX, NEST_CY_CANVAS, NEST_W, NEST_H, gs)
    }

    // Pass 3: Eggs with numbers/question slots
    for (let i = 0; i < this.eggs.length; i++) {
      const egg = this.eggs[i]
      const jumpY = this.jumpOffsets[i] || 0

      if (egg.isQuestion) {
        this.drawQuestionEgg(egg, jumpY, gs)
      } else {
        this.drawNormalEgg(egg, jumpY, gs)
      }
    }

    // Pass 4: Nest fronts (overlap egg bottoms)
    for (const egg of this.eggs) {
      this.drawImageCentered(this.nestImage, egg.containerCX, NEST_CY_CANVAS, NEST_W, NEST_H, gs)
    }
  }

  /** Draw a normal egg with number on it */
  private drawNormalEgg(egg: EggData, jumpY: number, gs: number) {
    const cx = egg.containerCX
    const cy = EGG_CENTER_CANVAS + jumpY

    // Explosion animation on last egg (can be a normal egg!)
    if (this.phase === 'explosion' && this.explosionEggIndex === this.eggs.indexOf(egg)) {
      this.drawExplosion(egg, cx, cy, gs)
      return
    }

    const img = this.eggImages[egg.resourceIndex]
    if (imgOk(img)) {
      this.drawImageCentered(img, cx, cy, EGG_W, EGG_H, gs)
    }

    // Draw number on egg (variable-width digits from sprite sheet)
    if (egg.numberVisible) {
      this.drawDigitsOnEgg(cx, cy, egg.numberString, gs)
    }
  }

  /** Draw the question egg (with slots, explosion, etc.) */
  private drawQuestionEgg(egg: EggData, jumpY: number, gs: number) {
    const { ctx } = this
    const cx = egg.containerCX
    const cy = EGG_CENTER_CANVAS + jumpY

    // Explosion animation
    if (this.phase === 'explosion' && this.explosionEggIndex === this.eggs.indexOf(egg)) {
      this.drawExplosion(egg, cx, cy, gs)
      return
    }

    // Draw egg image
    const eggImg = this.eggImages[egg.resourceIndex]
    if (imgOk(eggImg)) {
      this.drawImageCentered(eggImg, cx, cy, EGG_W, EGG_H, gs)
    }

    // Draw number or question slots
    if (egg.numberVisible && !egg.questionVisible) {
      // After solved: show number
      this.drawDigitsOnEgg(cx, cy, egg.numberString, gs)
    } else if (egg.questionVisible) {
      // Show question slots
      for (let i = 0; i < egg.slots.length; i++) {
        const slot = egg.slots[i]
        this.drawSlot(slot, egg, i, gs)
      }
    }
  }

  /** Draw a single question slot */
  private drawSlot(slot: SlotState, egg: EggData, _slotIndex: number, gs: number) {
    const { ctx } = this
    const ansLen = egg.numberString.length
    const is3D = ansLen >= 3 && egg.slots.length === 1

    // Choose slot image based on selection state
    let slotImg: HTMLImageElement
    if (slot.selected) {
      slotImg = is3D ? this.cardSlotSelected3D : this.cardSlotSelected
    } else {
      slotImg = is3D ? this.cardSlotEmpty3D : this.cardSlotEmpty
    }

    // Draw slot frame
    if (imgOk(slotImg)) {
      this.drawImageCentered(slotImg, slot.cx, slot.cy, slot.w, slot.h, gs)
    }

    if (slot.answered) {
      // Draw answered number card inside slot (scaled 0.85)
      const cardIsSmall = slot.digit.length === 1
      const cardImg = cardIsSmall ? this.cardSingle : this.card3D
      const cardW = (cardIsSmall ? CARD_SINGLE_W : CARD_3D_W) * SLOT_CARD_SCALE
      const cardH = (cardIsSmall ? CARD_SINGLE_H : CARD_3D_H) * SLOT_CARD_SCALE

      if (imgOk(cardImg)) {
        this.drawImageCentered(cardImg, slot.cx, slot.cy, cardW, cardH, gs)
      }

      // Draw digit text on the answered card
      ctx.save()
      const fontSize = CARD_FONT_SIZE * SLOT_CARD_SCALE * gs
      ctx.font = `bold ${fontSize}px TodoSchoolV2, 'Arial Rounded MT Bold', sans-serif`
      ctx.fillStyle = CARD_TEXT_COLOR
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(slot.digit, slot.cx * gs, slot.cy * gs)
      ctx.restore()
    } else {
      // Draw question mark(s)
      const qImg = slot.selected ? this.questionMarkSelected : this.questionMarkNormal
      if (imgOk(qImg)) {
        const digitCount = slot.digit.length
        if (digitCount === 1 || egg.slots.length === 2) {
          // Single question mark per slot
          this.drawImageCentered(qImg, slot.cx, slot.cy, QMARK_W, QMARK_H, gs)
        } else {
          // Multiple question marks for multi-digit single slot
          const qGap = 8
          const totalQW = digitCount * QMARK_W + (digitCount - 1) * qGap
          const startX = slot.cx - totalQW / 2 + QMARK_W / 2
          for (let q = 0; q < digitCount; q++) {
            this.drawImageCentered(qImg, startX + q * (QMARK_W + qGap), slot.cy, QMARK_W, QMARK_H, gs)
          }
        }
      }
    }
  }

  /** Draw explosion animation for the last egg (C++ Egg::startExplosionAnimation) */
  private drawExplosion(egg: EggData, cx: number, cy: number, gs: number) {
    const { ctx } = this
    const t = this.explosionTimer
    const colorIdx = egg.resourceIndex

    // Phase 1 (0-0.3s): egg visible, preparing
    if (t < 0.3) {
      // Draw full egg + number
      const eggImg = this.eggImages[colorIdx]
      if (imgOk(eggImg)) {
        this.drawImageCentered(eggImg, cx, cy, EGG_W, EGG_H, gs)
      }
      this.drawDigitsOnEgg(cx, cy, egg.numberString, gs)
      return
    }

    // Phase 2 (0.3s+): egg splits, bird appears
    const splitT = t - 0.3

    // Bottom half stays
    const botImg = this.eggBottomImages[colorIdx]
    if (imgOk(botImg)) {
      // bottom half at ANCHOR_MIDDLE_BOTTOM, position at eggRoot center X, Y=0 (bottom of egg bounds)
      const botCY = cy + (EGG_H - EGG_BOTTOM_H) / 2
      this.drawImageCentered(botImg, cx, botCY, EGG_BOTTOM_W, EGG_BOTTOM_H, gs)
    }

    // Bird (ANCHOR_MIDDLE_BOTTOM at (center, 230), scale 0.85)
    // C++: ScaleBy(0.5, 1.15) → 0.85 * 1.15 = 0.9775 final scale
    // Appears at t=0.3, grows over 0.5s
    if (splitT > 0 && imgOk(this.birdImage)) {
      const birdT = Math.min(1, splitT / 0.5)
      const birdScale = 0.85 * (1 + birdT * 0.15)  // 0.85 → 0.9775
      const bw = BIRD_W * birdScale
      const bh = BIRD_H * birdScale
      // Bird ANCHOR_MIDDLE_BOTTOM at (eggCenter, 230 from egg bottom in Cocos local)
      // In canvas: bird bottom at cy + EGG_H/2 - 230 = cy - 14
      const birdBottomY = cy + EGG_H / 2 - 230
      // drawImage needs top-left Y: birdBottom - birdHeight
      const birdTopY = birdBottomY - bh
      ctx.drawImage(this.birdImage,
        (cx - bw / 2) * gs, birdTopY * gs,
        bw * gs, bh * gs)
    }

    // Top half flies up + fades out (Spawn: MoveBy(0.3, 0,400) + FadeOut(0.5))
    const topImg = this.eggTopImages[colorIdx]
    if (imgOk(topImg) && splitT < 0.8) {
      const moveT = Math.min(1, splitT / 0.3)
      const fadeT = Math.min(1, splitT / 0.5)
      const topCY = cy - (EGG_H - EGG_TOP_H) / 2 - moveT * 400
      ctx.save()
      ctx.globalAlpha = 1 - fadeT
      this.drawImageCentered(topImg, cx, topCY, EGG_TOP_W, EGG_TOP_H, gs)
      ctx.restore()
    }

    // Clouds scatter (appear at 0.3s with the bird)
    if (splitT > 0 && imgOk(this.cloudImage) && splitT < 0.6) {
      const cloudT = Math.min(1, splitT / 0.3)
      const cloudFade = 1 - cloudT
      const cloudBaseCY = cy - 100  // cloud_0 at eggCenter + 100 (Cocos up) → canvas -100

      ctx.save()
      ctx.globalAlpha = cloudFade
      // Cloud 0: MoveBy(260, 80) Cocos → canvas (+260, -80)
      this.drawImageCentered(this.cloudImage, cx + 260 * cloudT, cloudBaseCY - 80 * cloudT, CLOUD_W, CLOUD_H, gs)
      // Cloud 1: MoveBy(280, -140) Cocos → canvas (+280, +140)
      this.drawImageCentered(this.cloudImage, cx + 280 * cloudT, cloudBaseCY + 140 * cloudT, CLOUD_W, CLOUD_H, gs)
      // Cloud 2: MoveBy(-260, -80) Cocos → canvas (-260, +80)
      this.drawImageCentered(this.cloudImage, cx - 260 * cloudT, cloudBaseCY + 80 * cloudT, CLOUD_W, CLOUD_H, gs)
      ctx.restore()
    }

    // Draw number on bottom half
    this.drawDigitsOnEgg(cx, cy, egg.numberString, gs)
  }

  /* ── Draggable cards ── */
  private drawCards(gs: number) {
    const { ctx } = this

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      if (!card.visible) continue

      // If this card is being dragged, draw dummy at original position first
      if (i === this.dragCardIndex && this.dummyVisible) {
        this.drawSingleCard(card.numberString, card.originX, card.originY, 1, card.isSmall, DUMMY_OPACITY, gs)
      }

      // Draw the card (possibly at drag position)
      const isDragging = i === this.dragCardIndex
      this.drawSingleCard(card.numberString, card.currentX, card.currentY, card.scale, card.isSmall, 1, gs)
    }
  }

  /** Draw a single number card with background image and text */
  private drawSingleCard(numStr: string, cx: number, cy: number, scale: number, isSmall: boolean, alpha: number, gs: number) {
    const { ctx } = this
    const cardImg = isSmall ? this.cardSingle : this.card3D
    const cardW = (isSmall ? CARD_SINGLE_W : CARD_3D_W) * scale
    const cardH = (isSmall ? CARD_SINGLE_H : CARD_3D_H) * scale

    ctx.save()
    ctx.globalAlpha = alpha

    // Card background
    if (imgOk(cardImg) && cardImg.naturalWidth > 0) {
      ctx.drawImage(cardImg,
        (cx - cardW / 2) * gs, (cy - cardH / 2) * gs,
        cardW * gs, cardH * gs)
    }

    // Card text: OpenSans-Bold.ttf 167px, color (85,55,52)
    const fontSize = CARD_FONT_SIZE * scale * gs
    ctx.font = `bold ${fontSize}px TodoSchoolV2, 'Arial Rounded MT Bold', sans-serif`
    ctx.fillStyle = CARD_TEXT_COLOR
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(numStr, cx * gs, cy * gs)

    ctx.restore()
  }

  /* ── Digit rendering on egg ── */
  private drawDigitsOnEgg(cx: number, cy: number, numStr: string, gs: number) {
    const { ctx } = this
    const sprite = this.numberSprite
    if (!imgOk(sprite) || sprite.naturalWidth === 0) return
    if (!/^\d+$/.test(numStr)) return

    // C++ Egg.cpp:232-250: renders digits at NATURAL sprite sheet size
    // mNumberRoot contentSize = (totalWidth, 112), centered on egg
    // Only scale down if total width exceeds egg width
    const totalW = digitsTotalWidth(numStr)
    if (totalW === 0) return

    const maxW = EGG_W * 0.9  // safety margin
    const scale = totalW > maxW ? maxW / totalW : 1.0

    const scaledH = DIGIT_SPRITE_H * scale
    const scaledTotalW = totalW * scale
    let dx = cx - scaledTotalW / 2

    for (let i = 0; i < numStr.length; i++) {
      const d = numStr.charCodeAt(i) - 48
      if (d < 0 || d > 9) continue
      const rect = DIGIT_RECTS[d]
      const scaledW = rect.w * scale

      ctx.drawImage(sprite,
        rect.x, 0, rect.w, DIGIT_SPRITE_H,       // source
        dx * gs, (cy - scaledH / 2) * gs,          // dest position
        scaledW * gs, scaledH * gs)                 // dest size

      dx += scaledW
    }
  }

  /* ── Helper ── */
  private drawImageCentered(img: HTMLImageElement, cx: number, cy: number, w: number, h: number, gs: number, alpha?: number) {
    if (!imgOk(img) || img.naturalWidth === 0) return
    if (alpha !== undefined) {
      this.ctx.save()
      this.ctx.globalAlpha = alpha
    }
    this.ctx.drawImage(img,
      (cx - w / 2) * gs, (cy - h / 2) * gs,
      w * gs, h * gs)
    if (alpha !== undefined) {
      this.ctx.restore()
    }
  }
}
