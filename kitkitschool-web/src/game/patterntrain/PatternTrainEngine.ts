import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const GW = GAME_WIDTH   // 2560
const GH = GAME_HEIGHT  // 1800

// ── Enums (C++ PatternTrainProblemBank) ──
const enum Shape { FIGURE = 0, NUMBERALPHABET = 1, SIZE = 2 }
const enum Blank { LAST = 0, RANDOM = 1, ALL = 2 }
const enum Choice { AB = 0, ABC = 1, UNLIMITEDABC = 2 }

// ── Constants (from C++) ──
const SNAP_RADIUS = 150
const RAIL_Y_COCOS = 645       // Cocos Y for rail
const RAIL_Y = GH - RAIL_Y_COCOS  // Canvas Y = 1155
const CONNECTOR_MARGIN = 47
const TRAIN_SPEED = 2500
const SLOT_HEIGHT_LOCAL = 330   // slot Y inside freightCar (Cocos local)
const SLOT_LEFT_MARGIN = 226
const SLOT_GAP = 13
const SLOT_W = 234
const SLOT_H = 238
const BOX_SIZE = 264
const ANSWER_Y_COCOS = 300     // Cocos Y for answer boxes
const ANSWER_Y = GH - ANSWER_Y_COCOS // Canvas Y = 1500
const BOX_MARGIN = 50

// ── Image paths ──
const IMG_BASE = assetUrl('/assets/games/patterntrain/')
const SND_BASE = assetUrl('/assets/games/patterntrain/sounds/')

// ── Pattern data arrays (C++ ProblemBank) ──
const patternSequence1 = ['A-A', 'A-B']
const patternSequence2 = ['A-A-B', 'A-B-B', 'A-B-C']
const patternSequence3 = ['A-A-B', 'A-B-B', 'A-B-C']
const patternSequence4 = ['A-A-B', 'A-B-B', 'A-B-C', 'A-B']
const patternSequence5 = ['A-A-B', 'A-B-B', 'A-B-C', 'A-B']

const patternFigure = [
  'train_pattern_block_shape_1', 'train_pattern_block_shape_2',
  'train_pattern_block_shape_3', 'train_pattern_block_shape_4',
  'train_pattern_block_shape_5', 'train_pattern_block_shape_6',
]

const patternNumber1 = ['train_pattern_block_1_1', 'train_pattern_block_1_2']
const patternNumber2 = ['train_pattern_block_2_1', 'train_pattern_block_2_2']
const patternNumber3 = ['train_pattern_block_3_1', 'train_pattern_block_3_2']
const patternAlphabetA = ['train_pattern_block_a_1', 'train_pattern_block_a_2']
const patternAlphabetB = ['train_pattern_block_b_1', 'train_pattern_block_b_2']
const patternAlphabetC = ['train_pattern_block_c_1', 'train_pattern_block_c_2']
const patternSize = [
  'train_pattern_block_sl_shape1_large', 'train_pattern_block_sl_shape2_large',
  'train_pattern_block_sl_shape3_large', 'train_pattern_block_sl_shape4_large',
  'train_pattern_block_sl_shape5_large', 'train_pattern_block_sl_shape6_large',
]

// ── Utility ──
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// ── Problem Generation ──
interface LevelConfig {
  patterns: string[]    // 5 pattern strings like "A-B-C"
  shape: Shape
  blank: Blank
  choice: Choice
}

function generateLevel(level: number): LevelConfig {
  let patterns: string[] = []
  let shape: Shape, blank: Blank, choice: Choice

  switch (level) {
    case 1:
      patterns.push('A-A')
      patterns.push('A-B')
      for (let i = 2; i < 5; i++) patterns.push(pick(patternSequence1))
      shape = Shape.FIGURE; blank = Blank.LAST; choice = Choice.AB
      break
    case 2:
      for (let i = 0; i < 5; i++) patterns.push(pick(patternSequence2))
      shape = Shape.FIGURE; blank = Blank.LAST; choice = Choice.ABC
      break
    case 3:
      for (let i = 0; i < 5; i++) patterns.push(pick(patternSequence3))
      shape = Shape.FIGURE; blank = Blank.RANDOM; choice = Choice.ABC
      break
    case 4:
      for (let i = 0; i < 5; i++) patterns.push(pick(patternSequence4))
      shape = Shape.SIZE; blank = Blank.ALL; choice = Choice.UNLIMITEDABC
      break
    case 5:
    default:
      for (let i = 0; i < 5; i++) patterns.push(pick(patternSequence5))
      shape = Shape.NUMBERALPHABET; blank = Blank.ALL; choice = Choice.UNLIMITEDABC
      break
  }
  return { patterns, shape, blank, choice }
}

function getShapeVec(shape: Shape): string[] {
  switch (shape) {
    case Shape.FIGURE: {
      const shuffled = shuffle(patternFigure)
      return [shuffled[0], shuffled[1], shuffled[2]]
    }
    case Shape.NUMBERALPHABET: {
      const typeChoice = Math.random() < 0.5 ? 0 : 1
      let ret: string[]
      if (Math.random() < 0.5) {
        // number
        ret = [patternNumber1[typeChoice], patternNumber2[typeChoice], patternNumber3[typeChoice]]
      } else {
        // alphabet
        ret = [patternAlphabetA[typeChoice], patternAlphabetB[typeChoice], patternAlphabetC[typeChoice]]
      }
      return shuffle(ret)
    }
    case Shape.SIZE: {
      const shuffled = shuffle(patternSize)
      const base = shuffled[0]
      const ret = [base, base + '_downscale1', base + '_downscale2']
      return shuffle(ret)
    }
  }
}

// ── Game Object Types ──
interface SlotObj {
  // Position relative to freight car's bottom-left corner (Canvas coords)
  localX: number
  localY: number
  replaceable: boolean
  correctAnswer: string  // "A", "B", "C"
  boxInSlot: BoxObj | null
  hasBox: boolean
}

interface FreightCarObj {
  x: number         // Canvas X of bottom-left
  y: number         // Canvas Y of bottom-left (= RAIL_Y)
  width: number
  height: number
  carType: number   // 2 or 3
  slots: SlotObj[]
  imgKey: string    // 'base2' or 'base3'
}

interface BoxObj {
  x: number
  y: number
  letter: string       // "A", "B", "C"
  shapePath: string    // image file name (without .png)
  shapeType: Shape
  scale: number
  originalX: number
  originalY: number
  enableTouch: boolean
  targetSlot: SlotObj | null
  loading: boolean
  visible: boolean
  duplicated: boolean
  isAnswer: boolean    // true = draggable answer box
  // For SIZE mode
  decoScale: number    // 1.0, 0.7, 0.4
  decoPath: string     // base shape image path (without _downscale suffix)
  zOrder: number
}

// ── Animation Types ──
interface Anim {
  type: string
  startTime: number
  duration: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  done: boolean
}

// ═══════════════════════════════════════════════
// PatternTrainEngine
// ═══════════════════════════════════════════════
export class PatternTrainEngine extends BaseEngine {
  level: number
  levelConfig!: LevelConfig
  currentProblemIndex = 0
  totalProblemCount = 5

  // Objects
  locomotiveX = 0
  locomotiveY = RAIL_Y
  freightCars: FreightCarObj[] = []
  boxes: BoxObj[] = []
  anims: Anim[] = []
  selectedBox: Record<string, string> = {} // A→shapePath, B→shapePath, C→shapePath

  // State
  phase: 'arriving' | 'playing' | 'correct' | 'leaving' | 'waiting' = 'waiting'
  dragging: BoxObj | null = null
  dragOffsetX = 0
  dragOffsetY = 0
  trainTotalWidth = 0
  freightCarPositions: number[] = []  // cumulative widths
  locomotiveArriveX = 0
  currentTime = 0
  inputEnabled = false

  // Reserved boxes for level 4,5
  reservedA: BoxObj[] = []
  reservedB: BoxObj[] = []
  reservedC: BoxObj[] = []
  reservedBoxWork = false
  reservedLetter = ''
  reservedNewBoxPos = { x: 0, y: 0 }

  // Tutorial
  tutorialBox: BoxObj | null = null

  // Images
  images: Record<string, HTMLImageElement> = {}
  // Sounds
  sounds: Record<string, HTMLAudioElement> = {}

  // Callbacks
  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
  }

  start() {
    this.loadAssets()
    this.levelConfig = generateLevel(this.level)
    this.totalProblemCount = this.levelConfig.patterns.length
    super.start()
    this.setProblem()
  }

  loadAssets() {
    // Background
    this.images.bg = loadImage(IMG_BASE + '_train_pattern_bg.png')
    // Locomotive
    this.images.locomotive = loadImage(IMG_BASE + 'train_pattern_front_block.png')
    // FreightCar bodies
    this.images.base2 = loadImage(IMG_BASE + 'train_pattern_base_2blocks.png')
    this.images.base3 = loadImage(IMG_BASE + 'train_pattern_base_3blocks.png')
    // Connector
    this.images.connector = loadImage(IMG_BASE + 'train_pattern_connector.png')
    // Empty slot
    this.images.emptySpot = loadImage(IMG_BASE + 'train_pattern_empty_spot.png')
    // Shadow
    this.images.shadow = loadImage(IMG_BASE + 'train_pattern_shadow.png')
    // Block shape (for SIZE mode bg)
    this.images.blockShape = loadImage(IMG_BASE + 'train_block_shape.png')

    // Load all shape block images
    const allShapes = [
      ...patternFigure,
      'train_pattern_block_1_1', 'train_pattern_block_1_2',
      'train_pattern_block_2_1', 'train_pattern_block_2_2',
      'train_pattern_block_3_1', 'train_pattern_block_3_2',
      'train_pattern_block_a_1', 'train_pattern_block_a_2',
      'train_pattern_block_b_1', 'train_pattern_block_b_2',
      'train_pattern_block_c_1', 'train_pattern_block_c_2',
      ...patternSize,
    ]
    for (const s of allShapes) {
      this.images[s] = loadImage(IMG_BASE + s + '.png')
    }

    // Sounds
    this.sounds.slotIn = loadAudio(SND_BASE + 'blockslotin.m4a')
    this.sounds.touch = loadAudio(SND_BASE + 'blocktouch.m4a')
    this.sounds.miss = loadAudio(SND_BASE + 'blockmiss.m4a')
    this.sounds.combine = loadAudio(SND_BASE + 'traincombine.m4a')
    this.sounds.move = loadAudio(SND_BASE + 'trainmoves.m4a')
    this.sounds.whistle1 = loadAudio(SND_BASE + 'pattern_train_1.m4a')
    this.sounds.whistle2 = loadAudio(SND_BASE + 'pattern_train_2.m4a')
    this.sounds.whistle3 = loadAudio(SND_BASE + 'pattern_train_3.m4a')
    this.sounds.jump = loadAudio(SND_BASE + 'sfx_jump.m4a')
    this.sounds.come = loadAudio(SND_BASE + 'train2.m4a')
  }

  // ── Problem Setup ──
  setProblem() {
    this.onProgressChange?.(this.currentProblemIndex + 1, this.totalProblemCount)

    if (this.currentProblemIndex >= this.totalProblemCount) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    // Clear previous state
    this.freightCars = []
    this.boxes = []
    this.anims = []
    this.freightCarPositions = []
    this.reservedA = []
    this.reservedB = []
    this.reservedC = []
    this.reservedBoxWork = false
    this.tutorialBox = null
    this.dragging = null
    this.inputEnabled = false

    const patternStr = this.levelConfig.patterns[this.currentProblemIndex]
    const pattern = patternStr.split('-')  // e.g. ["A","B","C"]
    const shape = this.levelConfig.shape
    const blank = this.levelConfig.blank
    const choice = this.levelConfig.choice

    // Get shape images for A, B, C
    const shapeVec = getShapeVec(shape)
    this.selectedBox = {}
    if (shapeVec[0]) this.selectedBox['A'] = shapeVec[0]
    if (shapeVec[1]) this.selectedBox['B'] = shapeVec[1]
    if (shapeVec[2]) this.selectedBox['C'] = shapeVec[2]

    // Determine freight car count
    let freightCarCount = 2
    if (this.level > 3 && pattern.length === 2) freightCarCount = 3

    // Build train
    this.buildTrain(pattern, freightCarCount, blank, shape)

    // Animate train arrival
    this.trainCome()

    // Tutorial for level 1, problem 0
    if (this.level === 1 && this.currentProblemIndex === 0) {
      this.setupTutorial(pattern)
    } else {
      // Schedule answer boxes to come after train arrives
      this.scheduleAnswerCome(pattern, choice)
    }
  }

  buildTrain(pattern: string[], freightCarCount: number, blank: Blank, shape: Shape) {
    const locoImg = this.images.locomotive
    const locoW = imgOk(locoImg) ? locoImg.naturalWidth : 455
    const locoH = imgOk(locoImg) ? locoImg.naturalHeight : 446

    this.trainTotalWidth = locoW + CONNECTOR_MARGIN - 5
    this.freightCarPositions = [this.trainTotalWidth]

    for (let i = 0; i < freightCarCount; i++) {
      const carType = pattern.length
      const imgKey = carType === 2 ? 'base2' : 'base3'
      const carImg = this.images[imgKey]
      const carW = imgOk(carImg) ? carImg.naturalWidth : (carType === 2 ? 467 : 706)
      const carH = imgOk(carImg) ? carImg.naturalHeight : 97

      // Create slots
      const slots: SlotObj[] = []
      for (let j = 0; j < pattern.length; j++) {
        slots.push({
          localX: SLOT_LEFT_MARGIN + (SLOT_GAP + SLOT_W) * j,
          localY: SLOT_HEIGHT_LOCAL,
          replaceable: false,
          correctAnswer: '',
          boxInSlot: null,
          hasBox: false,
        })
      }

      const car: FreightCarObj = {
        x: GW + this.trainTotalWidth,  // start off-screen right
        y: RAIL_Y,
        width: carW,
        height: carH,
        carType,
        slots,
        imgKey,
      }
      this.freightCars.push(car)
      this.trainTotalWidth += CONNECTOR_MARGIN + carW
      this.freightCarPositions.push(this.trainTotalWidth)

      // Set up boxes in slots
      const isLastCar = (i === freightCarCount - 1)
      const randomBoxIdx = Math.floor(Math.random() * pattern.length)

      for (let j = 0; j < pattern.length; j++) {
        const letter = pattern[j]
        let setBlank = false
        if (isLastCar) {
          switch (blank) {
            case Blank.ALL: setBlank = true; break
            case Blank.RANDOM: if (j === randomBoxIdx) setBlank = true; break
            case Blank.LAST: if (j === pattern.length - 1) setBlank = true; break
          }
        }
        if (setBlank) {
          slots[j].replaceable = true
          slots[j].correctAnswer = letter
        } else {
          // Create non-answer box in slot
          const box = this.createBox(letter, shape, false)
          box.scale = 0.88
          box.loading = true
          box.targetSlot = slots[j]
          slots[j].boxInSlot = box
          slots[j].hasBox = true
          this.boxes.push(box)
        }
      }
    }

    // Initial locomotive position (off-screen right)
    this.locomotiveX = GW
    this.locomotiveY = RAIL_Y
    this.locomotiveArriveX = GW / 2 - this.trainTotalWidth / 2
  }

  createBox(letter: string, shape: Shape, isAnswer: boolean): BoxObj {
    const shapePath = this.selectedBox[letter] || ''
    let decoScale = 1.0
    let decoPath = shapePath

    if (shape === Shape.SIZE) {
      if (shapePath.includes('_downscale1')) {
        decoScale = 0.7
        decoPath = shapePath.replace('_downscale1', '')
      } else if (shapePath.includes('_downscale2')) {
        decoScale = 0.4
        decoPath = shapePath.replace('_downscale2', '')
      }
      // Load the deco image if not loaded
      if (!this.images[decoPath]) {
        this.images[decoPath] = loadImage(IMG_BASE + decoPath + '.png')
      }
    }

    return {
      x: 0, y: 0,
      letter,
      shapePath,
      shapeType: shape,
      scale: isAnswer ? 1.0 : 0.88,
      originalX: 0, originalY: 0,
      enableTouch: isAnswer,
      targetSlot: null,
      loading: false,
      visible: true,
      duplicated: false,
      isAnswer,
      decoScale,
      decoPath,
      zOrder: isAnswer ? 1 : 0,
    }
  }

  // ── Train Animation ──
  trainCome() {
    this.phase = 'arriving'
    const t = this.currentTime

    // Locomotive arrive
    const moveDistLoco = GW - this.locomotiveArriveX
    const moveTimeLoco = moveDistLoco / TRAIN_SPEED
    this.addAnim('locoArrive', t + 0.5, moveTimeLoco, {
      startX: GW,
      endX: this.locomotiveArriveX,
    })

    // Play train come sound
    this.addAnim('playSound', t + 0.5, 0.01, { sound: 'come' })

    // FreightCars arrive
    for (let i = 0; i < this.freightCars.length; i++) {
      const car = this.freightCars[i]
      const startX = this.freightCarPositions[i] + GW
      const arriveX = this.locomotiveArriveX + this.freightCarPositions[i]
      const moveDist = startX - arriveX
      const moveTime = moveDist / TRAIN_SPEED
      car.x = startX
      this.addAnim('carArrive', t + 0.5, moveTime, {
        carIndex: i,
        startX,
        endX: arriveX,
      })
    }
  }

  scheduleAnswerCome(pattern: string[], choice: Choice) {
    const t = this.currentTime
    // Answers come up after train arrives (~1.3s + stagger)
    this.addAnim('answerCome', t + 1.3, 0.01, { pattern, choice })
  }

  answerCome(pattern: string[], choice: Choice) {
    const letters = choice === Choice.AB ? shuffle(['A', 'B']) : shuffle(['A', 'B', 'C'])

    const boxWidth = BOX_SIZE
    const totalWidth = boxWidth * letters.length + BOX_MARGIN * (letters.length - 1)
    const baseX = GW / 2 - totalWidth / 2 + boxWidth / 2

    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i]
      const targetX = baseX + (boxWidth + BOX_MARGIN) * i
      const targetY = ANSWER_Y

      // Main answer box
      const box = this.createBox(letter, this.levelConfig.shape, true)
      box.x = targetX
      box.y = targetY + 500  // below screen
      box.originalX = targetX
      box.originalY = targetY
      box.visible = true
      this.boxes.push(box)

      // Animate rise
      this.addAnim('boxRise', this.currentTime + 0.1 * i, 0.3, {
        box,
        startY: targetY + 500,
        endY: targetY,
      })

      // For level > 3 (UNLIMITEDABC): create reserve boxes
      if (choice === Choice.UNLIMITEDABC) {
        for (let r = 0; r < 2; r++) {
          const rBox = this.createBox(letter, this.levelConfig.shape, true)
          rBox.x = targetX
          rBox.y = targetY + 500
          rBox.originalX = targetX
          rBox.originalY = targetY
          rBox.visible = false
          this.boxes.push(rBox)
          if (letter === 'A') this.reservedA.push(rBox)
          else if (letter === 'B') this.reservedB.push(rBox)
          else this.reservedC.push(rBox)
        }
      }
    }

    // Enable input shortly after
    this.addAnim('enableInput', this.currentTime + 0.3 * letters.length + 0.1, 0.01, {})
  }

  setupTutorial(pattern: string[]) {
    // For level 1, problem 0: place a tutorial box in the blank slot
    const lastCar = this.freightCars[this.freightCars.length - 1]
    const blankSlot = lastCar.slots.find(s => s.replaceable)
    if (!blankSlot) return

    const tutBox = this.createBox('A', this.levelConfig.shape, true)
    tutBox.scale = 0.88
    tutBox.visible = false
    tutBox.loading = true
    tutBox.targetSlot = blankSlot
    blankSlot.boxInSlot = tutBox
    this.tutorialBox = tutBox
    this.boxes.push(tutBox)

    const t = this.currentTime
    // Make visible after train arrives
    this.addAnim('tutorialShow', t + 0.9, 0.01, {})
    // Jump off after a bit
    this.addAnim('tutorialJump', t + 2.8, 0.5, {})
    // Then bring normal answers
    this.addAnim('answerCome', t + 3.5, 0.01, {
      pattern,
      choice: Choice.AB,
    })
  }

  // ── Animation System ──
  addAnim(type: string, startTime: number, duration: number, data: Record<string, unknown>) {
    this.anims.push({ type, startTime, duration, data, done: false })
  }

  updateAnims(t: number) {
    for (const a of this.anims) {
      if (a.done) continue
      if (t < a.startTime) continue

      const elapsed = t - a.startTime
      const progress = Math.min(elapsed / Math.max(a.duration, 0.001), 1)

      switch (a.type) {
        case 'locoArrive': {
          // EaseOut (power 2)
          const ep = 1 - (1 - progress) * (1 - progress)
          this.locomotiveX = a.data.startX + (a.data.endX - a.data.startX) * ep
          if (progress >= 1) {
            this.locomotiveX = a.data.endX
            a.done = true
            // Check if all cars arrived → switch to playing
            const allDone = this.anims.filter(aa => aa.type === 'carArrive').every(aa => aa.done)
            if (allDone) this.phase = 'playing'
          }
          break
        }
        case 'carArrive': {
          const ep = 1 - (1 - progress) * (1 - progress)
          const car = this.freightCars[a.data.carIndex]
          if (car) {
            car.x = a.data.startX + (a.data.endX - a.data.startX) * ep
          }
          if (progress >= 1) {
            if (car) car.x = a.data.endX
            a.done = true
          }
          break
        }
        case 'playSound': {
          if (!a.done) {
            const snd = this.sounds[a.data.sound as string]
            if (snd) playSound(snd)
            a.done = true
          }
          break
        }
        case 'answerCome': {
          if (!a.done) {
            this.answerCome(a.data.pattern as string[], a.data.choice as Choice)
            a.done = true
          }
          break
        }
        case 'enableInput': {
          if (!a.done) {
            this.inputEnabled = true
            this.phase = 'playing'
            a.done = true
          }
          break
        }
        case 'boxRise': {
          // EaseOut
          const ep = 1 - (1 - progress) * (1 - progress)
          const box = a.data.box as BoxObj
          box.y = a.data.startY + (a.data.endY - a.data.startY) * ep
          if (progress >= 1) {
            box.y = a.data.endY
            a.done = true
          }
          break
        }
        case 'boxMoveTo': {
          const box = a.data.box as BoxObj
          const ep = progress // linear
          box.x = a.data.startX + (a.data.endX - a.data.startX) * ep
          box.y = a.data.startY + (a.data.endY - a.data.startY) * ep
          if (progress >= 1) {
            box.x = a.data.endX
            box.y = a.data.endY
            a.done = true
            if (a.data.onDone) (a.data.onDone as () => void)()
          }
          break
        }
        case 'boxScale': {
          const box = a.data.box as BoxObj
          box.scale = a.data.startScale + (a.data.endScale - a.data.startScale) * progress
          if (progress >= 1) {
            box.scale = a.data.endScale
            a.done = true
          }
          break
        }
        case 'tutorialShow': {
          if (this.tutorialBox) this.tutorialBox.visible = true
          a.done = true
          break
        }
        case 'tutorialJump': {
          if (this.tutorialBox) {
            const box = this.tutorialBox
            if (elapsed === 0 || !a.data._started) {
              a.data._started = true
              // Unload from slot
              if (box.targetSlot) {
                box.targetSlot.boxInSlot = null
                box.targetSlot = null
              }
              box.loading = false
              box.enableTouch = false
              // Get world position from slot (using corrected getSlotWorldPos)
              const lastCar = this.freightCars[this.freightCars.length - 1]
              const blankSlot = lastCar.slots.find(s => s.replaceable)
              if (blankSlot) {
                const wp = this.getSlotWorldPos(lastCar, blankSlot)
                box.x = wp.x
                box.y = wp.y
              }
              a.data.startX = box.x
              a.data.startY = box.y
              playSound(this.sounds.jump)
            }
            // JumpBy animation: dx=-600, dy=+500 (canvas down), height=350
            const jumpProgress = progress
            box.x = a.data.startX + (-600) * jumpProgress
            const jumpArc = -4 * 350 * jumpProgress * (jumpProgress - 1)
            box.y = a.data.startY + 500 * jumpProgress - jumpArc
            if (progress >= 1) {
              box.visible = false
              a.done = true
            }
          } else {
            a.done = true
          }
          break
        }
        case 'slotJump': {
          // JumpBy for a slot's box
          const jumpH = 50
          const jumpArc = -4 * jumpH * progress * (progress - 1)
          a.data.offsetY = -jumpArc  // negative = up in canvas
          if (progress >= 1) {
            a.data.offsetY = 0
            a.done = true
            // Play whistle
            const letter = a.data.letter as string
            if (letter === 'A') playSound(this.sounds.whistle1)
            else if (letter === 'B') playSound(this.sounds.whistle2)
            else playSound(this.sounds.whistle3)
          }
          break
        }
        case 'answerGo': {
          // Move unused answer boxes down
          const box = a.data.box as BoxObj
          const ep = progress * progress // EaseIn
          box.x = a.data.startX + (a.data.endX - a.data.startX) * ep
          box.y = a.data.startY + (a.data.endY - a.data.startY) * ep
          if (progress >= 1) {
            box.visible = false
            a.done = true
          }
          break
        }
        case 'trainGo': {
          // EaseIn locomotive move left
          const ep = progress * progress
          this.locomotiveX = a.data.startX + a.data.dx * ep
          // Also move freight cars (they're "attached")
          for (const car of this.freightCars) {
            car.x = a.data.carStartX[this.freightCars.indexOf(car)] + a.data.dx * ep
          }
          if (progress >= 1) {
            a.done = true
          }
          break
        }
        case 'nextProblem': {
          if (!a.done) {
            a.done = true
            this.currentProblemIndex++
            this.setProblem()
          }
          break
        }
        case 'reserveBoxRise': {
          const box = a.data.box as BoxObj
          const ep = 1 - (1 - progress) * (1 - progress) // EaseOut
          box.y = a.data.startY + (a.data.endY - a.data.startY) * ep
          box.visible = true
          if (progress >= 1) {
            box.y = a.data.endY
            a.done = true
          }
          break
        }
      }
    }

    // Clean up done anims (keep recent for reference)
    this.anims = this.anims.filter(a => !a.done || t - a.startTime < 5)
  }

  // ── Slot World Position ──
  getSlotWorldPos(car: FreightCarObj, slot: SlotObj): { x: number, y: number } {
    // Car anchor is BOTTOM_LEFT → car.x is left edge, car.y is Canvas Y of bottom
    // Slot position (localX, localY) is slot CENTER (ANCHOR_MIDDLE in Cocos).
    // Box is placed at slot local (0,0) = slot's bottom-left corner.
    // So box center = slot center - half slot size.
    // In Canvas Y: subtract Cocos offset but add back half height (bottom-left is higher in canvas)
    return {
      x: car.x + slot.localX - SLOT_W / 2,
      y: car.y - slot.localY + SLOT_H / 2,
    }
  }

  // ── Find Nearest Replaceable Slot ──
  findNearestSlot(bx: number, by: number): { car: FreightCarObj, slot: SlotObj } | null {
    let best: { car: FreightCarObj, slot: SlotObj } | null = null
    let bestDist = Infinity

    for (const car of this.freightCars) {
      for (const slot of car.slots) {
        if (!slot.replaceable) continue
        const wp = this.getSlotWorldPos(car, slot)
        const dx = wp.x - bx
        const dy = wp.y - by
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= SNAP_RADIUS && dist < bestDist) {
          bestDist = dist
          best = { car, slot }
        }
      }
    }
    return best
  }

  // ── Check Answer ──
  checkAnswer() {
    let hasIncorrect = false
    let finished = true
    const wrongLetters: string[] = []

    for (const car of this.freightCars) {
      for (const slot of car.slots) {
        if (!slot.replaceable) continue
        if (!slot.boxInSlot) {
          finished = false
          continue
        }
        if (slot.boxInSlot.letter !== slot.correctAnswer) {
          // Wrong answer
          wrongLetters.push(slot.boxInSlot.letter)
          const box = slot.boxInSlot
          slot.boxInSlot = null
          box.targetSlot = null
          box.loading = false
          box.enableTouch = true
          box.scale = 1.0
          box.zOrder = 1
          // Animate back to original
          this.addAnim('boxMoveTo', this.currentTime, 0.2, {
            box,
            startX: box.x, startY: box.y,
            endX: box.originalX, endY: box.originalY,
          })
          playSound(this.sounds.miss)
          hasIncorrect = true
        }
      }
    }

    if (hasIncorrect) {
      // Generate new answer box if needed (for levels 4,5)
      if (this.reservedBoxWork &&
          !wrongLetters.includes(this.reservedLetter)) {
        this.generateNewAnswerBox()
      }
    } else if (!finished) {
      this.generateNewAnswerBox()
    }

    if (finished && !hasIncorrect) {
      this.onCorrect()
    }
  }

  generateNewAnswerBox() {
    if (!this.reservedBoxWork) return

    let newBox: BoxObj | undefined
    if (this.reservedLetter === 'A' && this.reservedA.length > 0) {
      newBox = this.reservedA.pop()
    } else if (this.reservedLetter === 'B' && this.reservedB.length > 0) {
      newBox = this.reservedB.pop()
    } else if (this.reservedLetter === 'C' && this.reservedC.length > 0) {
      newBox = this.reservedC.pop()
    }

    if (newBox) {
      newBox.originalX = this.reservedNewBoxPos.x
      newBox.originalY = this.reservedNewBoxPos.y
      newBox.x = this.reservedNewBoxPos.x
      this.addAnim('reserveBoxRise', this.currentTime, 0.3, {
        box: newBox,
        startY: this.reservedNewBoxPos.y + 500,
        endY: this.reservedNewBoxPos.y,
      })
    }

    this.reservedBoxWork = false
  }

  // ── Correct Answer Sequence ──
  onCorrect() {
    this.phase = 'correct'
    this.inputEnabled = false

    // 1. answerGo: move unused answer boxes down
    for (const box of this.boxes) {
      if (box.isAnswer && !box.targetSlot && box.visible) {
        this.addAnim('answerGo', this.currentTime, 0.5, {
          box,
          startX: box.x, startY: box.y,
          endX: GW / 2, endY: GH + 500,
        })
      }
    }

    // 2. trainJump: each slot jumps sequentially
    let jumpIdx = 0
    for (const car of this.freightCars) {
      for (const slot of car.slots) {
        this.addAnim('slotJump', this.currentTime + 0.25 * (jumpIdx + 1), 0.5, {
          car,
          slot,
          letter: slot.boxInSlot?.letter || 'A',
          offsetY: 0,
        })
        jumpIdx++
      }
    }

    const totalSlots = jumpIdx
    const delayJump = 0.25 * totalSlots + 0.6
    const delayCombine = 0.1
    const delayGo = 2.0

    // 3. trainGo
    const goStartTime = this.currentTime + delayJump + delayCombine
    playSound(this.sounds.move)
    this.addAnim('playSound', goStartTime, 0.01, { sound: 'move' })
    this.addAnim('trainGo', goStartTime, 1.5, {
      startX: this.locomotiveX,
      dx: -GW,
      carStartX: this.freightCars.map(c => c.x),
    })

    // 4. Next problem
    this.addAnim('nextProblem', goStartTime + delayGo, 0.01, {})
  }

  // ── Pointer Events ──
  onPointerDown(gx: number, gy: number) {
    if (!this.inputEnabled || this.phase !== 'playing') return

    // Find answer box under pointer
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const box = this.boxes[i]
      if (!box.isAnswer || !box.enableTouch || !box.visible) continue

      const halfW = BOX_SIZE * box.scale / 2
      const halfH = BOX_SIZE * box.scale / 2
      if (gx >= box.x - halfW && gx <= box.x + halfW &&
          gy >= box.y - halfH && gy <= box.y + halfH) {
        // Start drag
        this.dragging = box
        box.zOrder = 100
        playSound(this.sounds.touch)

        // If box was in a slot, unload it
        if (box.targetSlot) {
          box.targetSlot.boxInSlot = null
          box.targetSlot = null
          box.loading = false
        }

        // For tutorial level: set original pos to center bottom
        if (this.level === 1 && this.currentProblemIndex === 0) {
          box.originalX = GW / 2
          box.originalY = ANSWER_Y
        }

        return
      }
    }
  }

  onPointerMove(gx: number, gy: number) {
    if (!this.dragging) return
    const box = this.dragging
    box.x = gx
    box.y = gy

    // Check snap proximity
    const nearSlot = this.findNearestSlot(gx, gy)
    if (nearSlot && !nearSlot.slot.boxInSlot) {
      box.scale = 0.88
    } else {
      box.scale = 1.0
    }
  }

  onPointerUp(_gx: number, _gy: number) {
    if (!this.dragging) return
    const box = this.dragging
    this.dragging = null
    box.zOrder = 1

    this.reservedBoxWork = false
    this.reservedLetter = ''

    const nearSlot = this.findNearestSlot(box.x, box.y)
    if (nearSlot && !nearSlot.slot.boxInSlot) {
      // Snap to slot
      const wp = this.getSlotWorldPos(nearSlot.car, nearSlot.slot)
      playSound(this.sounds.slotIn)

      // If level > 3 and not duplicated, prepare reserve
      if (this.level > 3 && !box.duplicated) {
        this.reservedBoxWork = true
        this.reservedLetter = box.letter
        this.reservedNewBoxPos = { x: box.originalX, y: box.originalY }
        box.duplicated = true
      }

      // Animate snap
      this.addAnim('boxMoveTo', this.currentTime, 0.1, {
        box,
        startX: box.x, startY: box.y,
        endX: wp.x, endY: wp.y,
        onDone: () => {
          box.loading = true
          box.targetSlot = nearSlot.slot
          nearSlot.slot.boxInSlot = box
          box.enableTouch = false
          box.scale = 0.88
          this.checkAnswer()
        },
      })
    } else {
      // Return to original position
      box.scale = 1.0
      this.addAnim('boxMoveTo', this.currentTime, 0.2, {
        box,
        startX: box.x, startY: box.y,
        endX: box.originalX, endY: box.originalY,
      })
    }
  }

  // ── Update ──
  update(_time: number, dt: number) {
    this.currentTime += dt
    this.updateAnims(this.currentTime)
  }

  // ── Drawing ──
  draw() {
    const ctx = this.ctx
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const gs = this.gameScale

    // Clear entire canvas first (covers letterbox areas)
    ctx.clearRect(0, 0, w, h)

    // Apply centering offset (must match BaseEngine.toGameCoords)
    const offsetX = (w - GW * gs) / 2
    const offsetY = (h - GH * gs) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(gs, gs)

    // Background inside game transform (like C++ _gameNode)
    // Extend to fill any letterbox areas too
    this.drawBg(w, gs, offsetX, offsetY)

    // Train
    this.drawTrain()

    // Answer boxes (sort by zOrder)
    this.drawAnswerBoxes()

    ctx.restore()
  }

  drawBg(canvasW: number, gs: number, offsetX: number, offsetY: number) {
    const ctx = this.ctx
    const bg = this.images.bg
    // Visible area in game coords
    const visLeft = -offsetX / gs
    const visTop = -offsetY / gs
    const visW = canvasW / gs
    const visH = this.canvas.clientHeight / gs

    // Fill entire visible area with sky color (for letterbox areas)
    ctx.fillStyle = '#87CEEB'
    ctx.fillRect(visLeft, visTop, visW, visH)

    if (imgOk(bg)) {
      // C++ stretches bg to (_gameSize.width, 1800) — height ALWAYS 1800.
      // Match: stretch to visible width × GH so ground line stays at correct Y.
      ctx.drawImage(bg, visLeft, 0, visW, GH)
    }
  }

  drawTrain() {
    const ctx = this.ctx

    // Draw freight cars first (behind locomotive)
    for (let i = this.freightCars.length - 1; i >= 0; i--) {
      this.drawFreightCar(this.freightCars[i])
    }

    // Draw locomotive
    const locoImg = this.images.locomotive
    if (imgOk(locoImg)) {
      // ANCHOR_BOTTOM_LEFT → draw at (x, y - height)
      ctx.drawImage(locoImg, this.locomotiveX, this.locomotiveY - locoImg.naturalHeight)
    }

    // Draw connectors
    const connImg = this.images.connector
    if (imgOk(connImg)) {
      // Connector between loco and first car
      if (this.freightCars.length > 0) {
        const car0 = this.freightCars[0]
        // Connector at left side of car, positioned at (0, 60) from car bottom-left
        // C++ connector anchor BOTTOM_RIGHT at car's body (0, 60)
        ctx.drawImage(connImg,
          car0.x - connImg.naturalWidth,
          car0.y - 60 - connImg.naturalHeight)
      }
      // Connectors between freight cars
      for (let i = 1; i < this.freightCars.length; i++) {
        const car = this.freightCars[i]
        ctx.drawImage(connImg,
          car.x - connImg.naturalWidth,
          car.y - 60 - connImg.naturalHeight)
      }
    }
  }

  drawFreightCar(car: FreightCarObj) {
    const ctx = this.ctx

    // Car body (ANCHOR_BOTTOM_LEFT)
    const carImg = this.images[car.imgKey]
    if (imgOk(carImg)) {
      ctx.drawImage(carImg, car.x, car.y - carImg.naturalHeight)
    }

    // Slots
    for (const slot of car.slots) {
      const wp = this.getSlotWorldPos(car, slot)

      // Draw empty spot if replaceable and no box
      if (slot.replaceable && !slot.boxInSlot) {
        const emptyImg = this.images.emptySpot
        if (imgOk(emptyImg)) {
          ctx.drawImage(emptyImg,
            wp.x - emptyImg.naturalWidth / 2,
            wp.y - emptyImg.naturalHeight / 2)
        }
      }

      // Draw box in slot
      if (slot.boxInSlot && slot.boxInSlot.visible) {
        const box = slot.boxInSlot

        // Check for jump animation offset
        let jumpOffsetY = 0
        for (const a of this.anims) {
          if (a.type === 'slotJump' && a.data.slot === slot && !a.done) {
            jumpOffsetY = a.data.offsetY || 0
          }
        }

        this.drawBoxAt(box, wp.x, wp.y + jumpOffsetY, box.scale)
      }
    }
  }

  drawBoxAt(box: BoxObj, cx: number, cy: number, scale: number) {
    const ctx = this.ctx

    if (box.shapeType === Shape.SIZE) {
      // SIZE mode: draw block_shape bg + overlay
      const bgImg = this.images.blockShape
      if (imgOk(bgImg)) {
        const w = bgImg.naturalWidth * scale
        const h = bgImg.naturalHeight * scale
        ctx.drawImage(bgImg, cx - w / 2, cy - h / 2, w, h)
      }
      // Draw deco overlay
      const decoImg = this.images[box.decoPath]
      if (imgOk(decoImg)) {
        const ds = scale * box.decoScale
        const w = decoImg.naturalWidth * ds
        const h = decoImg.naturalHeight * ds
        ctx.drawImage(decoImg, cx - w / 2, cy - h / 2, w, h)
      }
    } else {
      // FIGURE / NUMBERALPHABET: single image
      const img = this.images[box.shapePath]
      if (imgOk(img)) {
        const w = img.naturalWidth * scale
        const h = img.naturalHeight * scale
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
      }
    }
  }

  drawAnswerBoxes() {
    // Sort by zOrder and draw answer boxes that are not in slots
    const answerBoxes = this.boxes
      .filter(b => b.isAnswer && b.visible && !b.loading)
      .sort((a, b) => a.zOrder - b.zOrder)

    for (const box of answerBoxes) {
      this.drawBoxAt(box, box.x, box.y, box.scale)
    }
  }
}
