import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const GW = GAME_WIDTH   // 2560
const GH = GAME_HEIGHT  // 1800
const ASSET = assetUrl('/assets/games/sentencebridge')

// ─── Keyboard layout ───
const LETTERS_LOWER = "abcdefghijklmnopqrstuvwxyz '!?,."
const LETTERS_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ '!?,."
const BLOCK_PER_LINE = 16  // 32 chars / 2 rows (26 letters + 6 symbols)
const BLOCK_SPC_X = 154
const BLOCK_SPC_Y = 240
// Keyboard origin in gameNode coords: (0, -GH/2), ANCHOR_MIDDLE_BOTTOM
// startX in gameNode local = -(BLOCK_PER_LINE * BLOCK_SPC_X) / 2 + BLOCK_SPC_X / 2
const KB_START_X_LOCAL = -(BLOCK_PER_LINE * BLOCK_SPC_X) / 2 + BLOCK_SPC_X / 2 // -1155
// Row Y in blockMainNode local: row0(top)=360, row1(bottom)=120
// blockMainNode position in gameNode = (0, -GH/2)
// absolute gameNode Y: -GH/2 + localY
// Canvas Y = GH/2 - gameNodeY = GH/2 - (-GH/2 + localY) = GH - localY

// Capslock button: (-1020, 580) in blockMainNode local
const CAPS_X = GW / 2 + (-1020) // = 260
const CAPS_Y = GH - 580         // = 1220

// ─── Bridge ───
const BRIDGE_BODY_Y_COCOS = 40  // in gameNode coords
// Canvas: bridge center Y = GH/2 - 40 = 860
const BRIDGE_CENTER_Y = GH / 2 - BRIDGE_BODY_Y_COCOS
// Piece origin: NodeSentence is at Bridge local Y=0, which is gameNode Y=0 → Canvas Y=GH/2
const PIECE_ORIGIN_Y = GH / 2  // = 900

// ─── Text ───
const FONT_NAME = 'Andika'
const FONT_SIZE = 140
const TEXT_COLOR = 'rgb(245,246,211)'
const TEXT_UPPER_COLOR = 'rgb(255,204,23)'

// ─── Slot offsets (Cocos local, relative to sentence piece center) ───
const TEXT_OFFSET_Y = 20  // Cocos -20 → Canvas +20 (below center)
const SLOT_OFFSET_Y = 30  // Cocos -30 → Canvas +30
const MULTILINE_TOP = -108   // Cocos +108 → Canvas -108 (upward)
const MULTILINE_BOTTOM = 100 // Cocos -100 → Canvas +100 (downward)

// Slot BG Y offsets (relative to bridge body center in Cocos)
// single: 40 → same as bridge center
// top: 40+125=165 → Canvas offset = -(165-40)=-125 (upward from bridge center)
// bottom: 40-188=-148 → Canvas offset = -(-148-40)=+188 (downward from bridge center)

// ─── Block drag ───
const DRAG_THRESHOLD = 200
const BLOCK_SNAP_DUR = 0.1  // seconds

// ─── Speaker ───
const SPEAKER_SHOWN_Y = GH / 2 - 600  // Cocos (0, 600) → Canvas 300
const SPEAKER_HIDDEN_Y = GH / 2 - 1200 // Cocos (0, 1200) → Canvas -300

// ─── Car ───
const CAR_BOUNCE_H = 5
const CAR_BOUNCE_DUR = 0.1
const CAR_BOUNCE_DELAY = 0.3
const CAR_MOVE_DUR = 5

// ─── Types ───
interface SentencePiece {
  text: string
  isSlot: boolean
  slotIndex: number       // index into problem.slots, or -1
  multilineY: number      // 0=single, -1=top, 1=bottom
  isSymbol: boolean
  isUppercase: boolean
  width: number
  x: number               // left edge X on bridge (game coords)
  y: number               // Y offset for multiline
  solved: boolean
  slotChar: string        // the actual answer character
  bgFadeAlpha: number     // for fade animation
  effectAlpha: number     // selection effect alpha
  showEffect: boolean
}

interface Problem {
  sentence: string
  sound: string
  uppercase: boolean
  hasAlphabet: boolean
  slots: number[]
  multiLinePos: number
  pieces: SentencePiece[]
  remainingSlots: number[]  // copy of slots, shrinks as solved
}

interface Block {
  letter: string
  homeX: number; homeY: number
  x: number; y: number
  isDragging: boolean
  isAlpha: boolean
  alpha: number
  snapAnim: { startX: number; startY: number; endX: number; endY: number; t: number; dur: number } | null
}

interface CarHeart {
  x: number; y: number
  vx: number; vy: number
  jumpH: number
  t: number
  alpha: number
  imgIdx: number
}

interface Particle {
  x: number; y: number
  vx: number; vy: number
  alpha: number
  size: number
  color: string
}

export class SentenceBridgeEngine extends BaseEngine {
  level = 1
  data: any = null
  problems: Problem[] = []
  currentProblemIdx = 0
  touchEnabled = false
  blockMoving = false

  // Keyboard
  blocks: Block[] = []
  capsOn = false
  capsVisible = false
  capsBlinkTimer = 0
  capsBlinkDuration = 0

  // Dragging
  dragBlock: Block | null = null
  dragOffsetX = 0
  dragOffsetY = 0

  // Bridge
  bridgeScrollX = 0     // game coords offset for scrolling bridges
  bridgeScrollTarget = 0
  bridgeScrolling = false
  bridgeScrollTimer = 0
  bridgeScrollDur = 2
  bridgeScrollStartX = 0
  bridgeWidth = GW      // each bridge = screen width

  // Car
  carX = 0
  carTargetX = 0
  carMoving = false
  carMoveTimer = 0
  carMoveDur = CAR_MOVE_DUR
  carStartX = 0
  carBounceTimer = 0
  carImgIdx = 0
  carHearts: CarHeart[] = []
  carHeartTimer = 0
  carSweatPhase = 0
  showSweat = true

  // Speaker
  speakerY = SPEAKER_HIDDEN_Y
  speakerTargetY = SPEAKER_HIDDEN_Y
  speakerAnimTimer = 0
  speakerAnimDur = 0.5
  speakerAnimStartY = SPEAKER_HIDDEN_Y
  speakerPlaying = false
  speakerPlayTimer = 0
  speakerPlayDuration = 0

  // Answer animation
  answerAnim: { blockIdx: number; startX: number; startY: number; endX: number; endY: number; t: number; pieceIdx: number } | null = null
  answerFadeTimer = 0

  // Completion
  bridgeCompleteTimer = -1
  bridgeCompletePhase = 0

  // Particles
  particles: Particle[] = []

  // Images
  imgSky!: HTMLImageElement
  imgBridgeBody!: HTMLImageElement
  imgPillarLeft!: HTMLImageElement
  imgPillarRight!: HTMLImageElement
  imgRail!: HTMLImageElement
  imgBlockGeneral!: HTMLImageElement
  imgBlockShadow!: HTMLImageElement
  imgBlockEtc!: HTMLImageElement
  imgBlockEtcShadow!: HTMLImageElement
  imgSlotBg1!: HTMLImageElement
  imgSlotBg2Top!: HTMLImageElement
  imgSlotBg2Bottom!: HTMLImageElement
  imgSlotNormal!: HTMLImageElement
  imgSlotEffect!: HTMLImageElement
  imgSlotEtc!: HTMLImageElement
  imgSlotEtcEffect!: HTMLImageElement
  imgCapitalMark!: HTMLImageElement
  imgSpeakerNormal!: HTMLImageElement
  imgSpeakerPlaying!: HTMLImageElement
  imgCapsBtnSmall!: HTMLImageElement
  imgCapsBtnCapital!: HTMLImageElement
  imgCars: HTMLImageElement[] = []
  imgHearts: HTMLImageElement[] = []
  imgSweat: HTMLImageElement[] = []

  // Sounds
  sfxClick!: HTMLAudioElement
  sfxRight!: HTMLAudioElement
  sfxWrong!: HTMLAudioElement
  sfxCapslock!: HTMLAudioElement
  sfxSuccess!: HTMLAudioElement
  sfxCarDrive!: HTMLAudioElement
  sfxCarDriveGone!: HTMLAudioElement
  voiceAudio: HTMLAudioElement | null = null

  // Progress
  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.loadAssets()
  }

  loadAssets() {
    // Images
    this.imgSky = loadImage(`${ASSET}/sky.png`)
    this.imgBridgeBody = loadImage(`${ASSET}/bridge-image-body.png`)
    this.imgPillarLeft = loadImage(`${ASSET}/bridge-image-pillar-left.png`)
    this.imgPillarRight = loadImage(`${ASSET}/bridge-image-pillar-right.png`)
    this.imgRail = loadImage(`${ASSET}/bridge-image-rail.png`)
    this.imgBlockGeneral = loadImage(`${ASSET}/block-general.png`)
    this.imgBlockShadow = loadImage(`${ASSET}/block-general-shadow.png`)
    this.imgBlockEtc = loadImage(`${ASSET}/blocks-etc.png`)
    this.imgBlockEtcShadow = loadImage(`${ASSET}/blocks-etc-shadow.png`)
    this.imgSlotBg1 = loadImage(`${ASSET}/slot-1-row-general-bg.png`)
    this.imgSlotBg2Top = loadImage(`${ASSET}/slot-2-row-above-common-bg.png`)
    this.imgSlotBg2Bottom = loadImage(`${ASSET}/slot-2-row-bottom-common-bg.png`)
    this.imgSlotNormal = loadImage(`${ASSET}/slot-common-general-normal.png`)
    this.imgSlotEffect = loadImage(`${ASSET}/slot-common-general-selected-effect.png`)
    this.imgSlotEtc = loadImage(`${ASSET}/slot-etc-normal.png`)
    this.imgSlotEtcEffect = loadImage(`${ASSET}/slot-common-etc-selected-effect.png`)
    this.imgCapitalMark = loadImage(`${ASSET}/capital-mark.png`)
    this.imgSpeakerNormal = loadImage(`${ASSET}/button-speaker-normal.png`)
    this.imgSpeakerPlaying = loadImage(`${ASSET}/button-speaker-playing.png`)
    this.imgCapsBtnSmall = loadImage(`${ASSET}/button-small.png`)
    this.imgCapsBtnCapital = loadImage(`${ASSET}/button-capital.png`)

    for (let i = 1; i <= 7; i++) {
      this.imgCars.push(loadImage(`${ASSET}/car-${String(i).padStart(2, '0')}.png`))
    }
    for (let i = 1; i <= 3; i++) {
      this.imgHearts.push(loadImage(`${ASSET}/car-heart-${String(i).padStart(2, '0')}.png`))
    }
    this.imgSweat.push(loadImage(`${ASSET}/car-sweat-01.png`))
    this.imgSweat.push(loadImage(`${ASSET}/car-sweat-02.png`))

    // Sounds
    this.sfxClick = loadAudio(`${ASSET}/sounds/matrix_clickblock.m4a`)
    this.sfxRight = loadAudio(`${ASSET}/sounds/right.m4a`)
    this.sfxWrong = loadAudio(`${ASSET}/sounds/matrix_wrongmove.m4a`)
    this.sfxCapslock = loadAudio(`${ASSET}/sounds/sfx_wood_slideout.m4a`)
    this.sfxSuccess = loadAudio(`${ASSET}/sounds/success.m4a`)
    this.sfxCarDrive = loadAudio(`${ASSET}/sounds/cardrive.m4a`)
    this.sfxCarDriveGone = loadAudio(`${ASSET}/sounds/cardrive_gone.m4a`)
  }

  start() {
    super.start()
    this.loadData()
  }

  async loadData() {
    try {
      const res = await fetch('/data/games/sentencebridge.json')
      this.data = await res.json()
    } catch {
      return
    }

    const levelData = this.data.levels[String(this.level)]
    if (!levelData) return

    // Pick random worksheet
    const wsKeys = Object.keys(levelData.worksheets)
    const wsKey = wsKeys[Math.floor(Math.random() * wsKeys.length)]
    const problems = levelData.worksheets[wsKey]

    this.problems = problems.map((p: any) => this.buildProblem(p))
    this.currentProblemIdx = 0

    // Build keyboard
    this.buildBlocks()

    // Init car
    this.carImgIdx = Math.floor(Math.random() * 7)
    // C++: car starts at (-bridgeWidth/2 + carWidth/2 + 120) in bridge center coords
    // In my coords (bridge left edge = 0): carWidth/2 + 120
    const carImg = this.imgCars[this.carImgIdx]
    const carW = imgOk(carImg) ? carImg.naturalWidth : 250
    this.carX = carW / 2 + 120
    this.carBounceTimer = 0
    this.showSweat = true

    // Show first problem
    this.showProblem(0)
    this.touchEnabled = true

    // Progress
    this.onProgressChange?.(1, this.problems.length)

    // Auto-play speaker after 0.5s
    this.scheduleSpeaker(0.5)
  }

  buildProblem(p: any): Problem {
    const prob: Problem = {
      sentence: p.sentence,
      sound: p.sound,
      uppercase: p.uppercase,
      hasAlphabet: p.hasAlphabet,
      slots: [...p.slots],
      multiLinePos: p.multiLinePos,
      pieces: [],
      remainingSlots: [...p.slots],
    }
    this.parsePieces(prob)
    return prob
  }

  parsePieces(prob: Problem) {
    const { sentence, slots, multiLinePos } = prob
    const pieces: SentencePiece[] = []

    let startPos = -1
    let multilineY = 0

    for (let i = 0; i <= sentence.length; i++) {
      const isSlotChar = slots.includes(i)
      const isEnd = i === sentence.length

      if (multiLinePos > -1) {
        if (i <= multiLinePos) multilineY = -1
        else multilineY = 1
      }

      if (isSlotChar || isEnd || (i === multiLinePos && !isSlotChar)) {
        // Flush text piece
        if (startPos >= 0 && startPos < i) {
          let text = sentence.substring(startPos, i)
          // C++ padding: single space → 3 spaces
          if (text === ' ') text = '   '
          else if (text.length === 2) {
            if (text[0] === ' ') text = '  ' + text
            else if (text[1] === ' ') text = text + '  '
          }

          const mlY = multiLinePos > -1 ? (startPos < multiLinePos ? -1 : 1) : 0
          pieces.push({
            text,
            isSlot: false,
            slotIndex: -1,
            multilineY: mlY,
            isSymbol: false,
            isUppercase: false,
            width: 0,  // measured later
            x: 0,
            y: 0,
            solved: false,
            slotChar: '',
            bgFadeAlpha: 1,
            effectAlpha: 0,
            showEffect: false,
          })
        }
        startPos = -1

        if (isSlotChar) {
          const ch = sentence[i]
          const slotIdx = slots.indexOf(i)
          const isAlpha = /[a-zA-Z]/.test(ch)

          if (multiLinePos > -1) {
            multilineY = i < multiLinePos ? -1 : 1
          }

          pieces.push({
            text: ch,
            isSlot: true,
            slotIndex: slotIdx,
            multilineY,
            isSymbol: !isAlpha,
            isUppercase: /[A-Z]/.test(ch),
            width: 0,
            x: 0,
            y: 0,
            solved: false,
            slotChar: ch,
            bgFadeAlpha: 1,
            effectAlpha: 0,
            showEffect: false,
          })
        } else if (i === multiLinePos && !isEnd) {
          startPos = i
        }
      } else if (startPos < 0) {
        startPos = i
      }
    }

    // Measure widths
    this.measurePieces(pieces)

    // Calculate X positions (centered on bridge)
    this.layoutPieces(pieces)

    prob.pieces = pieces
  }

  measurePieces(pieces: SentencePiece[]) {
    const ctx = this.ctx
    ctx.save()
    ctx.font = `${FONT_SIZE}px ${FONT_NAME}, sans-serif`

    for (const p of pieces) {
      if (p.isSlot) {
        // Use slot bg image width
        const bgImg = p.multilineY === -1 ? this.imgSlotBg2Top
          : p.multilineY === 1 ? this.imgSlotBg2Bottom
          : this.imgSlotBg1
        p.width = imgOk(bgImg) ? bgImg.naturalWidth : 180
      } else {
        const m = ctx.measureText(p.text)
        p.width = m.width
      }
    }
    ctx.restore()
  }

  layoutPieces(pieces: SentencePiece[]) {
    // Calculate total width per line (for multiline)
    let totalW1 = 0, totalW2 = 0
    for (const p of pieces) {
      if (p.multilineY <= 0) totalW1 += p.width
      else totalW2 += p.width
    }
    const totalW = Math.max(totalW1, totalW2)

    // Position from left, centered on bridge
    let posX1 = this.bridgeWidth / 2 - totalW / 2
    let posX2 = this.bridgeWidth / 2 - totalW / 2

    for (const p of pieces) {
      if (p.multilineY <= 0) {
        p.x = posX1
        posX1 += p.width
      } else {
        p.x = posX2
        posX2 += p.width
      }

      // Y offset for multiline
      if (p.multilineY === -1) p.y = MULTILINE_TOP
      else if (p.multilineY === 1) p.y = MULTILINE_BOTTOM
      else p.y = 0
    }
  }

  buildBlocks() {
    this.blocks = []
    const letters = this.capsOn ? LETTERS_UPPER : LETTERS_LOWER

    for (let i = 0; i < letters.length; i++) {
      const col = i % BLOCK_PER_LINE
      const row = Math.floor(i / BLOCK_PER_LINE)
      // row 0 = top, row 1 = bottom
      // In blockMainNode local: x = startX + col * 154, y = 240/2 + (1-row) * 240
      const localX = KB_START_X_LOCAL + col * BLOCK_SPC_X
      const localY_cocos = BLOCK_SPC_Y / 2 + (1 - row) * BLOCK_SPC_Y

      // Convert to canvas game coords
      // blockMainNode pos in gameNode = (0, -GH/2)
      // absolute gameNode = (localX, -GH/2 + localY_cocos)
      // canvas = (GW/2 + localX, GH/2 - (-GH/2 + localY_cocos)) = (GW/2 + localX, GH - localY_cocos)
      const cx = GW / 2 + localX
      const cy = GH - localY_cocos

      const ch = letters[i]
      const isAlpha = /[a-zA-Z]/.test(ch)

      this.blocks.push({
        letter: ch,
        homeX: cx,
        homeY: cy,
        x: cx,
        y: cy,
        isDragging: false,
        isAlpha,
        alpha: 1,
        snapAnim: null,
      })
    }
  }

  showProblem(idx: number) {
    const prob = this.problems[idx]
    // Update block visibility based on hasAlphabet
    for (const b of this.blocks) {
      b.alpha = (!prob.hasAlphabet && b.isAlpha) ? 0.15 : 1
    }
    // Capslock
    this.capsVisible = prob.uppercase
    if (this.capsOn) this.toggleCaps()  // reset to lowercase
    // Blink capslock
    if (this.capsVisible) {
      const dur = this.getDuration(prob.sound)
      this.capsBlinkTimer = dur + 0.5
      this.capsBlinkDuration = 4  // 4 × 0.5s scale cycles
    }
    // Progress
    this.onProgressChange?.(idx + 1, this.problems.length)
  }

  getDuration(soundFile: string): number {
    if (this.data?.durations?.[soundFile]) return this.data.durations[soundFile]
    return 2.5
  }

  toggleCaps() {
    this.capsOn = !this.capsOn
    const letters = this.capsOn ? LETTERS_UPPER : LETTERS_LOWER
    for (let i = 0; i < this.blocks.length && i < letters.length; i++) {
      this.blocks[i].letter = letters[i]
    }
  }

  scheduleSpeaker(delay: number) {
    const prob = this.problems[this.currentProblemIdx]
    if (!prob) return

    const dur = this.getDuration(prob.sound)

    // Show speaker button
    this.speakerTargetY = SPEAKER_SHOWN_Y
    this.speakerAnimTimer = 0
    this.speakerAnimDur = 0.5
    this.speakerAnimStartY = this.speakerY

    // Schedule play
    this.speakerPlaying = true
    this.speakerPlayTimer = -delay  // negative = delay before play
    this.speakerPlayDuration = dur
  }

  playSentenceAudio() {
    const prob = this.problems[this.currentProblemIdx]
    if (!prob) return
    if (this.voiceAudio) {
      this.voiceAudio.pause()
      this.voiceAudio.currentTime = 0
    }
    this.voiceAudio = loadAudio(`${ASSET}/sounds/${prob.sound}`)
    playSound(this.voiceAudio, 0.8)
  }

  // ─── Pointer handlers ───

  onPointerDown(x: number, y: number) {
    if (!this.touchEnabled || this.blockMoving) return

    // Check speaker button
    const speakerImg = this.speakerPlaying ? this.imgSpeakerPlaying : this.imgSpeakerNormal
    if (imgOk(speakerImg)) {
      const sw = speakerImg.naturalWidth
      const sh = speakerImg.naturalHeight
      const sx = GW / 2 - sw / 2
      const sy = this.speakerY - sh / 2
      if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh && !this.speakerPlaying) {
        this.speakerPlaying = true
        this.speakerPlayTimer = 0
        this.speakerPlayDuration = this.getDuration(this.problems[this.currentProblemIdx]?.sound || '')
        this.playSentenceAudio()
        return
      }
    }

    // Check capslock button
    if (this.capsVisible) {
      const capsImg = this.capsOn ? this.imgCapsBtnCapital : this.imgCapsBtnSmall
      if (imgOk(capsImg)) {
        const cw = capsImg.naturalWidth
        const ch = capsImg.naturalHeight
        if (x >= CAPS_X - cw / 2 && x <= CAPS_X + cw / 2 &&
            y >= CAPS_Y - ch / 2 && y <= CAPS_Y + ch / 2) {
          this.toggleCaps()
          playSound(this.sfxCapslock)
          return
        }
      }
    }

    // Check blocks
    for (const b of this.blocks) {
      if (b.alpha < 0.9) continue
      if (b.snapAnim) continue
      const img = b.isAlpha ? this.imgBlockGeneral : this.imgBlockEtc
      if (!imgOk(img)) continue
      const bw = img.naturalWidth
      const bh = img.naturalHeight
      if (x >= b.x - bw / 2 && x <= b.x + bw / 2 &&
          y >= b.y - bh / 2 && y <= b.y + bh / 2) {
        b.isDragging = true
        this.dragBlock = b
        this.dragOffsetX = x - b.x
        this.dragOffsetY = y - b.y
        this.blockMoving = true
        playSound(this.sfxClick)
        // Apply drag offset (C++: -10, +10 Cocos → -10, -10 Canvas)
        b.x += -10
        b.y += -10
        return
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.dragBlock) return
    const b = this.dragBlock
    b.x = x - this.dragOffsetX
    b.y = y - this.dragOffsetY

    // Check slot highlights
    const prob = this.problems[this.currentProblemIdx]
    if (!prob) return

    for (const piece of prob.pieces) {
      if (!piece.isSlot || piece.solved) {
        piece.showEffect = false
        continue
      }
      // Check if block letter type matches slot type
      const blockIsSymbol = !(/[a-zA-Z]/.test(b.letter))
      if (piece.isSymbol !== blockIsSymbol) {
        piece.showEffect = false
        continue
      }
      // Check if pointer is over the slot
      const slotX = this.currentProblemIdx * this.bridgeWidth + this.bridgeScrollX + piece.x + piece.width / 2
      const slotY = PIECE_ORIGIN_Y + piece.y + SLOT_OFFSET_Y
      const slotImg = piece.isSymbol ? this.imgSlotEtc : this.imgSlotNormal
      const sw = imgOk(slotImg) ? slotImg.naturalWidth : 100
      const sh = imgOk(slotImg) ? slotImg.naturalHeight : 100
      if (x >= slotX - sw / 2 && x <= slotX + sw / 2 &&
          y >= slotY - sh / 2 && y <= slotY + sh / 2) {
        piece.showEffect = true
      } else {
        piece.showEffect = false
      }
    }
  }

  onPointerUp(x: number, y: number) {
    if (!this.dragBlock) return
    const b = this.dragBlock
    b.isDragging = false
    this.dragBlock = null
    this.blockMoving = false

    // Check drag distance from home
    const dist = Math.sqrt((b.x - b.homeX) ** 2 + (b.y - b.homeY) ** 2)

    const prob = this.problems[this.currentProblemIdx]

    // Hide all effects
    if (prob) {
      for (const p of prob.pieces) p.showEffect = false
    }

    if (dist >= DRAG_THRESHOLD && prob) {
      // Check if over a matching slot
      const foundIdx = this.findMatchingSlot(b, prob)
      if (foundIdx >= 0) {
        // Correct!
        this.onCorrectAnswer(b, foundIdx, prob)
        return
      } else {
        // Wrong
        playSound(this.sfxWrong)
      }
    }

    // Return block to home
    this.snapBlockHome(b)
  }

  findMatchingSlot(block: Block, prob: Problem): number {
    for (let i = 0; i < prob.pieces.length; i++) {
      const piece = prob.pieces[i]
      if (!piece.isSlot || piece.solved) continue

      const blockIsSymbol = !(/[a-zA-Z]/.test(block.letter))
      if (piece.isSymbol !== blockIsSymbol) continue

      // Hit test
      const slotX = this.currentProblemIdx * this.bridgeWidth + this.bridgeScrollX + piece.x + piece.width / 2
      const slotY = PIECE_ORIGIN_Y + piece.y + SLOT_OFFSET_Y
      const slotImg = piece.isSymbol ? this.imgSlotEtc : this.imgSlotNormal
      const sw = imgOk(slotImg) ? slotImg.naturalWidth : 100
      const sh = imgOk(slotImg) ? slotImg.naturalHeight : 100
      const bx = block.x, by = block.y
      if (bx >= slotX - sw / 2 && bx <= slotX + sw / 2 &&
          by >= slotY - sh / 2 && by <= slotY + sh / 2) {
        // Check letter match
        if (piece.slotChar === block.letter) {
          return i
        }
      }
    }
    return -1
  }

  onCorrectAnswer(block: Block, pieceIdx: number, prob: Problem) {
    this.touchEnabled = false
    playSound(this.sfxRight)

    const piece = prob.pieces[pieceIdx]

    // Spawn particles at block position
    this.spawnParticles(block.x, block.y)

    // Animate block to slot position
    const targetX = this.currentProblemIdx * this.bridgeWidth + this.bridgeScrollX + piece.x + piece.width / 2
    const targetY = PIECE_ORIGIN_Y + piece.y + SLOT_OFFSET_Y

    this.answerAnim = {
      blockIdx: this.blocks.indexOf(block),
      startX: block.x,
      startY: block.y,
      endX: targetX,
      endY: targetY,
      t: 0,
      pieceIdx,
    }
    this.answerFadeTimer = 0
  }

  snapBlockHome(block: Block) {
    block.snapAnim = {
      startX: block.x, startY: block.y,
      endX: block.homeX, endY: block.homeY,
      t: 0, dur: BLOCK_SNAP_DUR,
    }
  }

  spawnParticles(px: number, py: number) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 100 + Math.random() * 200
      this.particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        size: 4 + Math.random() * 8,
        color: `hsl(${40 + Math.random() * 20}, 100%, ${60 + Math.random() * 20}%)`,
      })
    }
  }

  onBridgeComplete() {
    this.touchEnabled = false
    this.bridgeCompletePhase = 0
    this.bridgeCompleteTimer = 0

    // Hide speaker
    this.speakerTargetY = SPEAKER_HIDDEN_Y
    this.speakerAnimTimer = 0
    this.speakerAnimDur = 0.5
    this.speakerAnimStartY = this.speakerY

    // Play sentence audio one last time
    setTimeout(() => this.playSentenceAudio(), 500)

    // Start car moving
    const isLast = this.currentProblemIdx >= this.problems.length - 1
    const targetBridgeIdx = isLast ? this.currentProblemIdx + 2 : this.currentProblemIdx + 1
    // C++: target at bridge[targetIdx] getCarPos() = (-bw/2 + cw/2 + 120) in bridge center coords
    // In my coords: targetBridgeIdx * bridgeWidth + carWidth/2 + 120
    const carImg2 = this.imgCars[this.carImgIdx]
    const carW2 = imgOk(carImg2) ? carImg2.naturalWidth : 250
    this.carTargetX = this.bridgeWidth * targetBridgeIdx + carW2 / 2 + 120
    this.carStartX = this.carX
    this.carMoving = true
    this.carMoveTimer = 0
    this.carMoveDur = CAR_MOVE_DUR
    this.showSweat = false
    this.carHearts = []
    this.carHeartTimer = 0

    playSound(isLast ? this.sfxCarDriveGone : this.sfxCarDrive)

    this.bridgeCompletePhase = 1  // waiting for car
  }

  // ─── Update ───

  update(time: number, dt: number) {
    // Block snap animations
    for (const b of this.blocks) {
      if (b.snapAnim) {
        b.snapAnim.t += dt
        const t = Math.min(b.snapAnim.t / b.snapAnim.dur, 1)
        b.x = b.snapAnim.startX + (b.snapAnim.endX - b.snapAnim.startX) * t
        b.y = b.snapAnim.startY + (b.snapAnim.endY - b.snapAnim.startY) * t
        if (t >= 1) {
          b.x = b.snapAnim.endX
          b.y = b.snapAnim.endY
          b.snapAnim = null
        }
      }
    }

    // Answer animation
    if (this.answerAnim) {
      this.answerAnim.t += dt
      const t = Math.min(this.answerAnim.t / BLOCK_SNAP_DUR, 1)
      const block = this.blocks[this.answerAnim.blockIdx]
      if (block) {
        block.x = this.answerAnim.startX + (this.answerAnim.endX - this.answerAnim.startX) * t
        block.y = this.answerAnim.startY + (this.answerAnim.endY - this.answerAnim.startY) * t
      }

      // Start bg fade after block arrives
      if (t >= 1 && this.answerFadeTimer === 0) {
        this.answerFadeTimer = 0.001  // trigger
      }
    }

    // Answer fade
    if (this.answerFadeTimer > 0 && this.answerAnim) {
      this.answerFadeTimer += dt
      const prob = this.problems[this.currentProblemIdx]
      if (prob) {
        const piece = prob.pieces[this.answerAnim.pieceIdx]
        if (piece) {
          piece.bgFadeAlpha = Math.max(0, 1 - this.answerFadeTimer / 0.5)
        }
      }

      if (this.answerFadeTimer >= 0.5) {
        // Complete answer
        const prob = this.problems[this.currentProblemIdx]
        const block = this.blocks[this.answerAnim.blockIdx]
        const piece = prob?.pieces[this.answerAnim.pieceIdx]

        if (block) {
          block.x = block.homeX
          block.y = block.homeY
        }

        if (piece) {
          piece.solved = true
          // Remove from remainingSlots
          if (prob) {
            const slotCharIdx = prob.slots[piece.slotIndex]
            prob.remainingSlots = prob.remainingSlots.filter(s => s !== slotCharIdx)
          }
        }

        // Reset capslock
        if (this.capsOn) this.toggleCaps()

        this.answerAnim = null
        this.answerFadeTimer = 0
        this.particles = []

        // Check if all solved
        if (prob && prob.remainingSlots.length === 0) {
          this.onBridgeComplete()
        } else {
          this.touchEnabled = true
        }
      }
    }

    // Speaker animation
    if (this.speakerY !== this.speakerTargetY) {
      this.speakerAnimTimer += dt
      const t = Math.min(this.speakerAnimTimer / this.speakerAnimDur, 1)
      // EaseBackInOut approximation
      const ease = t < 0.5
        ? 2 * t * t * (2.7 * t - 1.7)
        : 1 + 2 * (t - 1) * (t - 1) * (2.7 * (t - 1) + 1.7)
      this.speakerY = this.speakerAnimStartY + (this.speakerTargetY - this.speakerAnimStartY) * Math.max(0, Math.min(1, ease))
      if (t >= 1) this.speakerY = this.speakerTargetY
    }

    // Speaker play timer
    if (this.speakerPlaying) {
      this.speakerPlayTimer += dt
      if (this.speakerPlayTimer >= 0 && this.speakerPlayTimer < dt + 0.01) {
        // Just became positive → play audio
        this.playSentenceAudio()
      }
      if (this.speakerPlayTimer >= this.speakerPlayDuration) {
        this.speakerPlaying = false
      }
    }

    // Capslock blink
    if (this.capsBlinkTimer > 0) {
      this.capsBlinkTimer -= dt
    }
    if (this.capsBlinkDuration > 0) {
      this.capsBlinkDuration -= dt
      if (this.capsBlinkDuration <= 0) this.capsBlinkDuration = 0
    }

    // Car bounce
    this.carBounceTimer += dt
    this.carSweatPhase += dt

    // Car moving
    if (this.carMoving) {
      this.carMoveTimer += dt
      const t = Math.min(this.carMoveTimer / this.carMoveDur, 1)
      // EaseInOut (power 2)
      const ease = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
      this.carX = this.carStartX + (this.carTargetX - this.carStartX) * ease

      // Spawn hearts
      this.carHeartTimer += dt
      if (this.carHeartTimer >= 0.08 + Math.random() * 0.12) {
        this.carHeartTimer = 0
        this.spawnHeart()
      }

      if (t >= 1) {
        this.carMoving = false
        this.carHearts = []
        this.showSweat = true

        // Phase 1 complete → move to next problem
        if (this.bridgeCompletePhase === 1) {
          this.bridgeCompletePhase = 2
          this.bridgeCompleteTimer = 0

          if (this.currentProblemIdx < this.problems.length - 1) {
            playSound(this.sfxSuccess)
            this.currentProblemIdx++
            this.showProblem(this.currentProblemIdx)

            // Scroll to next bridge
            this.bridgeScrollTarget = -this.bridgeWidth * this.currentProblemIdx
            this.bridgeScrollStartX = this.bridgeScrollX
            this.bridgeScrolling = true
            this.bridgeScrollTimer = 0
            this.bridgeScrollDur = 2
          } else {
            // All done!
            this.gameState = 'complete'
            this.onComplete?.()
          }
        }
      }
    }

    // Bridge scrolling
    if (this.bridgeScrolling) {
      this.bridgeScrollTimer += dt
      const t = Math.min(this.bridgeScrollTimer / this.bridgeScrollDur, 1)
      const ease = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
      this.bridgeScrollX = this.bridgeScrollStartX + (this.bridgeScrollTarget - this.bridgeScrollStartX) * ease
      if (t >= 1) {
        this.bridgeScrollX = this.bridgeScrollTarget
        this.bridgeScrolling = false

        // After scroll, show speaker + auto play
        this.scheduleSpeaker(0.5)

        // Blink capslock
        const prob = this.problems[this.currentProblemIdx]
        if (prob && this.capsVisible) {
          const dur = this.getDuration(prob.sound)
          this.capsBlinkTimer = dur + 0.5
          this.capsBlinkDuration = 4
        }

        this.touchEnabled = true
      }
    }

    // Hearts update
    for (const h of this.carHearts) {
      h.t += dt
      h.alpha = Math.max(0, 1 - Math.max(0, h.t - 0.5) / 0.5)
    }
    this.carHearts = this.carHearts.filter(h => h.alpha > 0)

    // Particles update
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.alpha -= dt * 2
    }
    this.particles = this.particles.filter(p => p.alpha > 0)

    // Slot effect pulsing
    const prob = this.problems[this.currentProblemIdx]
    if (prob) {
      for (const piece of prob.pieces) {
        if (piece.showEffect) {
          // Pulse between 200/255 and 255/255
          piece.effectAlpha = 0.78 + 0.22 * Math.sin(time * 10)
        } else {
          piece.effectAlpha = Math.max(0, piece.effectAlpha - dt * 5)
        }
      }
    }
  }

  spawnHeart() {
    const carImg = this.imgCars[this.carImgIdx]
    if (!imgOk(carImg)) return
    const cw = carImg.naturalWidth
    const ch = carImg.naturalHeight

    // Car position in game coords (on bridge, scrolled)
    const carDrawX = this.carX + this.bridgeScrollX
    const carTopY = BRIDGE_CENTER_Y - (imgOk(this.imgBridgeBody) ? this.imgBridgeBody.naturalHeight / 2 : 246) + 20 - ch

    this.carHearts.push({
      x: carDrawX + (-20 + Math.random() * 40),
      y: carTopY + (-20 + Math.random() * 40),
      vx: -(20 + Math.random() * 80),
      vy: -(30 + Math.random() * 50),
      jumpH: 30 + Math.random() * 50,
      t: 0,
      alpha: 1,
      imgIdx: Math.floor(Math.random() * 3),
    })
  }

  // ─── Draw ───

  draw() {
    const ctx = this.ctx
    const w = this.canvas.width / (window.devicePixelRatio || 1)
    const h = this.canvas.height / (window.devicePixelRatio || 1)

    ctx.clearRect(0, 0, w, h)
    ctx.save()

    // Apply game scale and center
    const scale = this.gameScale
    const offsetX = (w - GW * scale) / 2
    const offsetY = (h - GH * scale) / 2
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    // Background
    this.drawBackgroundImage(this.imgSky, GW, GH)

    // Draw bridge bodies + pillars + sentence pieces (behind car)
    this.drawBridges()

    // Draw car (on bridge surface, behind rails)
    this.drawCar()

    // Draw rails (in front of car)
    this.drawRails()

    // Draw keyboard
    this.drawKeyboard()

    // Draw speaker button
    this.drawSpeaker()

    // Draw dragging block on top
    if (this.dragBlock) {
      this.drawBlock(this.dragBlock, true)
    }

    // Draw answer animation block on top
    if (this.answerAnim) {
      const block = this.blocks[this.answerAnim.blockIdx]
      if (block) this.drawBlock(block, true)
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Hearts
    for (const h of this.carHearts) {
      const img = this.imgHearts[h.imgIdx]
      if (!imgOk(img)) continue
      ctx.globalAlpha = h.alpha
      // Simple arc motion
      const jumpY = -Math.sin(h.t * Math.PI) * h.jumpH
      ctx.drawImage(img,
        h.x + h.vx * h.t - img.naturalWidth / 2,
        h.y + h.vy * h.t + jumpY - img.naturalHeight / 2,
        img.naturalWidth, img.naturalHeight)
    }
    ctx.globalAlpha = 1

    ctx.restore()
  }

  drawRails() {
    const ctx = this.ctx
    const bridgeBodyH = imgOk(this.imgBridgeBody) ? this.imgBridgeBody.naturalHeight : 492

    if (imgOk(this.imgRail)) {
      const railW = this.imgRail.naturalWidth
      const railH = this.imgRail.naturalHeight
      // Cocos: rail at (x, bridgeY + bridgeH/2 - 32), ANCHOR_BOTTOM_LEFT
      // bridgeY in gameNode = 40, bridgeH/2 = ~246
      // Cocos rail Y = 40 + 246 - 32 = 254 → Canvas Y = GH/2 - 254 = 646
      const railBottomY = GH / 2 - (BRIDGE_BODY_Y_COCOS + bridgeBodyH / 2 - 32)
      const railTopY = railBottomY - railH

      const startX = -this.bridgeWidth / 2 + this.bridgeScrollX
      const endX = this.bridgeWidth / 2 + (this.problems.length - 1) * this.bridgeWidth + this.bridgeScrollX
      for (let rx = startX; rx < endX; rx += railW) {
        ctx.drawImage(this.imgRail, rx, railTopY, railW, railH)
      }
    }
  }

  drawBridges() {
    for (let i = 0; i < this.problems.length; i++) {
      const bx = i * this.bridgeWidth + this.bridgeScrollX
      this.drawBridge(i, bx)
    }
  }

  drawBridge(idx: number, baseX: number) {
    const ctx = this.ctx
    const prob = this.problems[idx]
    const bodyH = imgOk(this.imgBridgeBody) ? this.imgBridgeBody.naturalHeight : 492

    // Bridge body (stretched to bridgeWidth)
    if (imgOk(this.imgBridgeBody)) {
      ctx.drawImage(this.imgBridgeBody,
        baseX, BRIDGE_CENTER_Y - bodyH / 2,
        this.bridgeWidth, bodyH)
    }

    // Left pillar
    if (imgOk(this.imgPillarLeft)) {
      const pw = this.imgPillarLeft.naturalWidth
      const ph = this.imgPillarLeft.naturalHeight
      // Cocos: ANCHOR_MIDDLE_TOP at (-winW/2, 40 - bodyH/2)
      // Canvas: pillar top at bridgeCenterY + bodyH/2 (bottom of bridge)
      const pillarTopY = BRIDGE_CENTER_Y + bodyH / 2
      ctx.drawImage(this.imgPillarLeft,
        baseX - pw / 2, pillarTopY,
        pw, ph)
    }

    // Right pillar (only on last bridge)
    if (idx === this.problems.length - 1 && imgOk(this.imgPillarRight)) {
      const pw = this.imgPillarRight.naturalWidth
      const ph = this.imgPillarRight.naturalHeight
      const pillarTopY = BRIDGE_CENTER_Y + bodyH / 2
      ctx.drawImage(this.imgPillarRight,
        baseX + this.bridgeWidth - pw / 2, pillarTopY,
        pw, ph)
    }

    // Draw sentence pieces
    for (const piece of prob.pieces) {
      this.drawPiece(piece, baseX)
    }
  }

  drawPiece(piece: SentencePiece, bridgeX: number) {
    const ctx = this.ctx
    const cx = bridgeX + piece.x + piece.width / 2
    const cy = PIECE_ORIGIN_Y + piece.y  // NodeSentence at Bridge local Y=0 → Canvas GH/2

    if (piece.isSlot) {
      if (piece.solved) {
        // Draw the letter in place (same as text piece)
        ctx.font = `${FONT_SIZE}px ${FONT_NAME}, sans-serif`
        ctx.fillStyle = TEXT_COLOR
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(piece.slotChar, cx, cy + TEXT_OFFSET_Y)
        return
      }

      // Slot background
      const bgImg = piece.multilineY === -1 ? this.imgSlotBg2Top
        : piece.multilineY === 1 ? this.imgSlotBg2Bottom
        : this.imgSlotBg1
      if (imgOk(bgImg) && piece.bgFadeAlpha > 0) {
        ctx.globalAlpha = piece.bgFadeAlpha
        // BG position offsets (Cocos local relative to bridge body)
        let bgOffsetY = 0
        if (piece.multilineY === -1) bgOffsetY = -(125)  // Cocos +125 → Canvas -125
        else if (piece.multilineY === 1) bgOffsetY = 188   // Cocos -188 → Canvas +188
        const bgY = BRIDGE_CENTER_Y + bgOffsetY
        ctx.drawImage(bgImg, cx - bgImg.naturalWidth / 2, bgY - bgImg.naturalHeight / 2,
          bgImg.naturalWidth, bgImg.naturalHeight)
        ctx.globalAlpha = 1
      }

      // Capital mark
      if (piece.isUppercase && imgOk(this.imgCapitalMark)) {
        ctx.drawImage(this.imgCapitalMark,
          cx - this.imgCapitalMark.naturalWidth / 2,
          cy + SLOT_OFFSET_Y - this.imgCapitalMark.naturalHeight / 2,
          this.imgCapitalMark.naturalWidth, this.imgCapitalMark.naturalHeight)
      }

      // Slot sprite
      const slotImg = piece.isSymbol ? this.imgSlotEtc : this.imgSlotNormal
      if (imgOk(slotImg)) {
        ctx.drawImage(slotImg,
          cx - slotImg.naturalWidth / 2,
          cy + SLOT_OFFSET_Y - slotImg.naturalHeight / 2,
          slotImg.naturalWidth, slotImg.naturalHeight)
      }

      // Selection effect
      if (piece.effectAlpha > 0) {
        const effImg = piece.isSymbol ? this.imgSlotEtcEffect : this.imgSlotEffect
        if (imgOk(effImg)) {
          ctx.globalAlpha = piece.effectAlpha
          ctx.drawImage(effImg,
            cx - effImg.naturalWidth / 2,
            cy + SLOT_OFFSET_Y - effImg.naturalHeight / 2,
            effImg.naturalWidth, effImg.naturalHeight)
          ctx.globalAlpha = 1
        }
      }
    } else {
      // Regular text
      ctx.font = `${FONT_SIZE}px ${FONT_NAME}, sans-serif`
      ctx.fillStyle = TEXT_COLOR
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(piece.text, cx, cy + TEXT_OFFSET_Y)
    }
  }

  drawCar() {
    const ctx = this.ctx
    const carImg = this.imgCars[this.carImgIdx]
    if (!imgOk(carImg)) return

    const cw = carImg.naturalWidth
    const ch = carImg.naturalHeight
    const bodyH = imgOk(this.imgBridgeBody) ? this.imgBridgeBody.naturalHeight : 492

    // Car X in game coords (relative to first bridge)
    const drawX = this.carX + this.bridgeScrollX

    // Car Y: on top of bridge deck
    // Cocos: ANCHOR_MIDDLE_BOTTOM at (posX, -20) in bridge node, bridge at Y=40
    // bridgeTopY_cocos = 40 + bodyH/2
    // car bottomY_cocos = bridgeTopY - 20 (yes, -20 in the C++ code - slightly below bridge top)
    // Canvas: bridgeTopY = BRIDGE_CENTER_Y - bodyH/2
    // car bottom = bridgeTopY + 20 (Canvas: below is +)
    const carBottomY = BRIDGE_CENTER_Y - bodyH / 2 + 20
    const carTopY = carBottomY - ch

    // Bounce
    const bounceCycle = CAR_BOUNCE_DUR + CAR_BOUNCE_DELAY
    const bouncePhase = this.carBounceTimer % bounceCycle
    let bounceY = 0
    if (bouncePhase < CAR_BOUNCE_DUR) {
      const t = bouncePhase / CAR_BOUNCE_DUR
      bounceY = -Math.sin(t * Math.PI) * CAR_BOUNCE_H
    }

    ctx.drawImage(carImg, drawX - cw / 2, carTopY + bounceY, cw, ch)

    // Sweat
    if (this.showSweat && !this.carMoving) {
      for (let si = 0; si < 2; si++) {
        const swImg = this.imgSweat[si]
        if (!imgOk(swImg)) continue

        const phase = this.carSweatPhase + si * 0.3
        const cycle = 2  // 1s move + 1s pause
        const t = phase % cycle
        let sx = drawX + cw / 2 - (si === 1 ? 30 : 0)
        let sy = carTopY + (si === 0 ? 90 : 50)
        let alpha = 0

        if (t < 1) {
          // Moving phase
          sx += (si === 0 ? 28 : 20) * (t)
          sy += (si === 1 ? 20 * t : 0)
          if (t < 0.1) alpha = t / 0.1
          else if (t < 0.8) alpha = 1
          else alpha = 1 - (t - 0.8) / 0.2
        }

        if (alpha > 0) {
          ctx.globalAlpha = alpha
          ctx.drawImage(swImg, sx, sy, swImg.naturalWidth, swImg.naturalHeight)
          ctx.globalAlpha = 1
        }
      }
    }
  }

  drawKeyboard() {
    const ctx = this.ctx

    // Draw capslock button
    if (this.capsVisible) {
      const capsImg = this.capsOn ? this.imgCapsBtnCapital : this.imgCapsBtnSmall
      if (imgOk(capsImg)) {
        let capScale = 1
        // Blink animation
        if (this.capsBlinkDuration > 0 && this.capsBlinkTimer <= 0) {
          const blinkPhase = (4 - this.capsBlinkDuration) % 1
          if (blinkPhase < 0.5) {
            capScale = 1 + 0.5 * Math.sin(blinkPhase / 0.5 * Math.PI)
          } else {
            capScale = 1 + 0.5 * Math.sin((1 - blinkPhase) / 0.5 * Math.PI)
          }
        }

        const cw = capsImg.naturalWidth * capScale
        const ch = capsImg.naturalHeight * capScale
        ctx.drawImage(capsImg,
          CAPS_X - cw / 2, CAPS_Y - ch / 2,
          cw, ch)
      }
    }

    // Draw blocks (skip dragging block, drawn on top)
    for (const b of this.blocks) {
      if (b.isDragging || (this.answerAnim && this.blocks[this.answerAnim.blockIdx] === b)) continue
      this.drawBlock(b, false)
    }
  }

  drawBlock(block: Block, isOnTop: boolean) {
    const ctx = this.ctx
    const isAlpha = block.isAlpha
    const shadowImg = isAlpha ? this.imgBlockShadow : this.imgBlockEtcShadow
    const blockImg = isAlpha ? this.imgBlockGeneral : this.imgBlockEtc

    ctx.globalAlpha = block.alpha

    // Shadow
    if (imgOk(shadowImg)) {
      ctx.globalAlpha = block.alpha * 0.2
      ctx.drawImage(shadowImg,
        block.x - shadowImg.naturalWidth / 2,
        block.y - shadowImg.naturalHeight / 2,
        shadowImg.naturalWidth, shadowImg.naturalHeight)
    }

    // Block
    if (imgOk(blockImg)) {
      ctx.globalAlpha = block.alpha
      ctx.drawImage(blockImg,
        block.x - blockImg.naturalWidth / 2,
        block.y - blockImg.naturalHeight / 2,
        blockImg.naturalWidth, blockImg.naturalHeight)
    }

    // Letter
    ctx.globalAlpha = block.alpha
    const isUpper = /[A-Z]/.test(block.letter)
    ctx.fillStyle = isUpper ? TEXT_UPPER_COLOR : TEXT_COLOR
    ctx.font = `${FONT_SIZE}px ${FONT_NAME}, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let scaleX = 1
    if (isUpper) scaleX = 0.8
    if (block.letter.length > 1) scaleX = 0.75

    ctx.save()
    ctx.translate(block.x, block.y - 25)  // Cocos offset +25 → Canvas -25
    ctx.scale(scaleX, 1)

    // Display character (space → show nothing visible)
    const displayChar = block.letter === ' ' ? '' : block.letter
    ctx.fillText(displayChar, 0, 0)
    ctx.restore()

    ctx.globalAlpha = 1
  }

  drawSpeaker() {
    const ctx = this.ctx
    const img = this.speakerPlaying ? this.imgSpeakerPlaying : this.imgSpeakerNormal
    if (!imgOk(img)) return
    if (this.speakerY < -200) return  // fully hidden

    ctx.drawImage(img,
      GW / 2 - img.naturalWidth / 2,
      this.speakerY - img.naturalHeight / 2,
      img.naturalWidth, img.naturalHeight)
  }
}
