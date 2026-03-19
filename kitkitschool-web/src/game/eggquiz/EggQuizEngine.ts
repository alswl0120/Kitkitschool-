import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

// ─── Asset Paths ───────────────────────────────────────────────────
const A = assetUrl('/assets/games/eggquiz')
const PARTS = `${A}/parts`
const IMAGES = `${A}/images`
const SOUNDS = `${A}/sounds`
const SHARED = `${SOUNDS}/shared`

// ─── Coordinate Helpers ────────────────────────────────────────────
// Cocos2d uses Y=0 at bottom; canvas uses Y=0 at top.
// cocosY → canvasY = GAME_HEIGHT - cocosY
const GW = GAME_WIDTH   // 2560
const GH = GAME_HEIGHT  // 1800
function cy(cocosY: number) { return GH - cocosY }

// ─── C++ Layout Constants (exact port) ─────────────────────────────
const DEFAULT_FONT = 'Aileron-Regular, sans-serif'
const CURLY_FONT = 'TodoMainCurly, sans-serif'
const TEXT_COLOR = '#464646'   // Color4B(70,70,70,255)

// Button configs from EggQuizButton.cpp
const BTN = {
  number: { w: 438, h: 458, depth: 40, border: 10 },
  image:  { w: 562, h: 446, depth: 40, border: 10 },
  word:   { w: 562, h: 446, depth: 40, border: 40 },
  sentence: { w: 1948, h: 180, depth: 30, border: 20 },
  paragraph: { w: 918, h: 268, depth: 30, border: 10 },
} as const

// Answer view rects (Cocos coords) — converted in drawing code
const ANSWER_DEFAULT = { x: 320, y: 80, w: 1920, h: 680 }
const ANSWER_PARAGRAPH = { x: 1310, y: 335, w: 1080, h: 926 }
const ANSWER_SENTENCE = { x: 305, y: 100, w: 1950, h: 600 }

// Math answer positions
const MATH_CHOOSE4_Y_COCOS = 380
const MATH_CHOOSE4_BTN = { w: 438, h: 458, space: 60 }

// ─── Types ─────────────────────────────────────────────────────────

type Category = 'L' | 'M'

interface LitProblem {
  kind: 'literacy'
  type: string          // soundonly_word, word_word, image_word, etc.
  audio?: string        // audio filename
  displayText?: string  // word or sentence text
  image?: string        // image filename
  images?: string[]     // for imageseq_image (image filenames)
  questionText?: string // additional question
  sentenceSeq1?: string // for imageseq_sentence (first sentence)
  sentenceSeq3?: string // for imageseq_sentence (third sentence)
  answer: string
  choices: string[]
  choiceType: 'word' | 'sentence' | 'image' | 'paragraph'
}

interface MathProblem {
  kind: 'math'
  type: string
  templatename: string
  options: string[]     // questionoption1-4
  answer: string
  answerRange?: { min: number; max: number }
  answerOption: string
  choices?: string[]
  // Computed at runtime:
  generatedAnswer?: number
  generatedChoices?: number[]
  displayMode?: string  // 'choose4' | 'numberpad'
  questionContent?: MathQuestionContent
}

interface MathQuestionContent {
  mode: string   // 'counting', 'missing', 'expression', 'soundonly', 'recognize', 'bigger', 'word_problem', etc.
  text?: string
  audio?: string
  items?: { x: number; y: number; type: string }[]  // for counting views
  numbers?: number[]       // for missing number
  blankIndex?: number      // for missing number
  expression?: string      // for expression display
  a?: number; b?: number; op?: string  // for expression
}

type Problem = LitProblem | MathProblem

interface AnswerBtn {
  x: number; y: number; w: number; h: number
  text: string
  image?: HTMLImageElement
  isCorrect: boolean
  state: 'normal' | 'pressed' | 'disabled'
  useFormat1b: boolean   // true for sentence/paragraph buttons
  labelScale: number
}

interface NumpadState {
  x: number; y: number; w: number; h: number
  typedValue: string
  answer: string
  buttons: { x: number; y: number; w: number; h: number; label: string; pressed: boolean }[]
}

type PopupType = 'none' | 'pass' | 'fail'

// ─── Utility Functions ─────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function parseRange(s: string): { min: number; max: number } | null {
  if (!s || !s.includes('~')) return null
  const [a, b] = s.split('~').map(Number)
  return { min: a, max: b }
}

// ─── Main Engine Class ─────────────────────────────────────────────

export class EggQuizEngine extends BaseEngine {
  // Config
  category: Category
  levelName: string
  level: number

  // State
  problems: Problem[] = []
  currentProblemIndex = 0
  answerResults: boolean[] = []
  touchEnabled = false
  answered = false

  // Answer buttons
  answerButtons: AnswerBtn[] = []
  numpad: NumpadState | null = null

  // Page turn
  pageTurnProgress = 0
  pageTurning = false
  prevPageSnapshot: HTMLCanvasElement | null = null

  // Popup
  popupState: PopupType = 'none'
  popupTimer = 0

  // Progress
  onProgressChange?: (current: number, max: number) => void

  // Audio for current question
  questionAudio: HTMLAudioElement | null = null

  // Speaker button hit area
  speakerBtn: { x: number; y: number; w: number; h: number; pressed: boolean } | null = null

  // ─── Images ───
  imgBg: HTMLImageElement
  imgPage: HTMLImageElement
  imgQBox: HTMLImageElement
  imgF1aN: HTMLImageElement  // format1a normal
  imgF1aA: HTMLImageElement  // format1a active
  imgF1bN: HTMLImageElement  // format1b normal
  imgF1bA: HTMLImageElement  // format1b active
  imgSpeakerN: HTMLImageElement
  imgSpeakerA: HTMLImageElement
  imgPicFrame: HTMLImageElement
  imgArrow: HTMLImageElement

  // Math images
  imgAcorn: HTMLImageElement
  imgTally: HTMLImageElement[] = []
  imgTenframe: HTMLImageElement
  imgDotYellow: HTMLImageElement
  imgDotBlue: HTMLImageElement
  imgDotEmpty: HTMLImageElement
  imgEmptyLarge: HTMLImageElement
  imgCalcBg: HTMLImageElement
  imgCalcBtnN: HTMLImageElement
  imgCalcBtnA: HTMLImageElement
  imgCalcEnterN: HTMLImageElement
  imgCalcEnterA: HTMLImageElement
  imgCalcBack: HTMLImageElement
  imgMinus: HTMLImageElement
  img10SetOutline: HTMLImageElement

  // Popup images
  imgPopupBg: HTMLImageElement
  imgPopupCheck: HTMLImageElement
  imgPopupCheckA: HTMLImageElement
  imgPopupBack: HTMLImageElement
  imgPopupBackA: HTMLImageElement
  imgEgg: HTMLImageElement | null = null
  imgBird: HTMLImageElement | null = null
  imgFail: HTMLImageElement | null = null
  imgRibbonBack: HTMLImageElement
  imgRibbonFront: HTMLImageElement
  imgGlow: HTMLImageElement

  // Progress bar images (C++: ProgressIndicator with forEgg=true)
  imgProgPass: HTMLImageElement
  imgProgFail: HTMLImageElement
  imgProgCurrent: HTMLImageElement
  imgProgNotyet: HTMLImageElement

  // Confetti
  confetti: { x: number; y: number; vx: number; vy: number; r: number; vr: number; type: number; alpha: number }[] = []
  imgConfetti: HTMLImageElement[] = []

  // Dynamic question images (loaded per-question)
  questionImages: HTMLImageElement[] = []

  // ─── Sounds ───
  sfxPageTurn: HTMLAudioElement
  sfxPass: HTMLAudioElement
  sfxFail: HTMLAudioElement
  sfxWrong: HTMLAudioElement
  sfxTouch: HTMLAudioElement

  constructor(canvas: HTMLCanvasElement, level: number, category: Category = 'L') {
    super(canvas)
    this.level = level
    this.category = category
    this.levelName = `PostTest_${level}`

    // Load images
    this.imgBg = loadImage(`${PARTS}/pretest_layout_bg.jpg`)
    this.imgPage = loadImage(`${PARTS}/pretest_layout_page.png`)
    this.imgQBox = loadImage(`${PARTS}/pretest_questionbox.png`)
    this.imgF1aN = loadImage(`${PARTS}/pretest_english_format1a_answer_normal.png`)
    this.imgF1aA = loadImage(`${PARTS}/pretest_english_format1a_answer_active.png`)
    this.imgF1bN = loadImage(`${PARTS}/pretest_english_format1b_answer_normal.png`)
    this.imgF1bA = loadImage(`${PARTS}/pretest_english_format1b_answer_active.png`)
    this.imgSpeakerN = loadImage(`${PARTS}/pretest_speaker_normal.png`)
    this.imgSpeakerA = loadImage(`${PARTS}/pretest_speaker_active.png`)
    this.imgPicFrame = loadImage(`${PARTS}/pretest_picture_withoutbg.png`)
    this.imgArrow = loadImage(`${PARTS}/pretest_english_arrow.png`)

    // Math images
    this.imgAcorn = loadImage(`${PARTS}/pretest_math_acorn.png`)
    for (let i = 1; i <= 5; i++) this.imgTally.push(loadImage(`${PARTS}/pretest_math_tally_${i}.png`))
    this.imgTenframe = loadImage(`${PARTS}/pretest_math_tenframe.png`)
    this.imgDotYellow = loadImage(`${PARTS}/pretest_math_dot_yellow.png`)
    this.imgDotBlue = loadImage(`${PARTS}/pretest_math_dot_blue.png`)
    this.imgDotEmpty = loadImage(`${PARTS}/pretest_math_dot_yellow_empty.png`)
    this.imgEmptyLarge = loadImage(`${PARTS}/pretest_math_emptyanswer_dotted_large.png`)
    this.imgCalcBg = loadImage(`${PARTS}/pretest_math_calculator_bg.png`)
    this.imgCalcBtnN = loadImage(`${PARTS}/pretest_math_calculator_button_normal.png`)
    this.imgCalcBtnA = loadImage(`${PARTS}/pretest_math_calculator_button_active.png`)
    this.imgCalcEnterN = loadImage(`${PARTS}/pretest_math_calculator_button_enter_normal.png`)
    this.imgCalcEnterA = loadImage(`${PARTS}/pretest_math_calculator_button_enter_active.png`)
    this.imgCalcBack = loadImage(`${PARTS}/pretest_math_calculator_back.png`)
    this.imgMinus = loadImage(`${PARTS}/pretest_math_symbol_minus.png`)
    this.img10SetOutline = loadImage(`${PARTS}/pretest_math_10set_outline.png`)

    // Progress bar images (C++: EggQuiz/Progress/)
    const PROG = assetUrl('/assets/games/eggquiz/progress')
    this.imgProgPass = loadImage(`${PROG}/pretest_progress_level_pass.png`)
    this.imgProgFail = loadImage(`${PROG}/pretest_progress_level_fail.png`)
    this.imgProgCurrent = loadImage(`${PROG}/pretest_progress_level_current.png`)
    this.imgProgNotyet = loadImage(`${PROG}/pretest_progress_level_notyet.png`)

    // Popup images
    this.imgPopupBg = loadImage(`${PARTS}/popup_window_bg.png`)
    this.imgPopupCheck = loadImage(`${PARTS}/popup_window_check_normal.png`)
    this.imgPopupCheckA = loadImage(`${PARTS}/popup_window_check_active.png`)
    this.imgPopupBack = loadImage(`${PARTS}/pretest_button_back_normal.png`)
    this.imgPopupBackA = loadImage(`${PARTS}/pretest_button_back_active.png`)
    this.imgRibbonBack = loadImage(`${PARTS}/popup_window_ribbon_back.png`)
    this.imgRibbonFront = loadImage(`${PARTS}/popup_window_ribbon_front.png`)
    this.imgGlow = loadImage(`${PARTS}/popup_window_glow_toleft.png`)
    for (let i = 1; i <= 8; i++) this.imgConfetti.push(loadImage(`${PARTS}/popup_effect_confetti_${i}.png`))

    // Load level-specific popup images
    const subj = category === 'L' ? 'english' : 'math'
    this.imgEgg = loadImage(`${PARTS}/popup_egg_${subj}_${level}.png`)
    if (category === 'L') {
      this.imgBird = loadImage(`${PARTS}/popup_english${level}_window_bird.png`)
      this.imgFail = loadImage(`${PARTS}/pretest_fail_english${level}.png`)
    } else {
      this.imgBird = loadImage(`${PARTS}/popup_math${level}_window_reptile.png`)
      this.imgFail = loadImage(`${PARTS}/pretest_fail_math${level}.png`)
    }

    // Sounds
    this.sfxPageTurn = loadAudio(`${SHARED}/sfx_pageturn.m4a`)
    this.sfxPass = loadAudio(`${SHARED}/sfx_pass.m4a`)
    this.sfxFail = loadAudio(`${SHARED}/sfx_fail.m4a`)
    this.sfxWrong = loadAudio(`${SHARED}/sfx_wrong.m4a`)
    this.sfxTouch = loadAudio(`${SHARED}/sfx_touch.m4a`)
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  start() {
    super.start()
    this.loadLevelData()
  }

  async loadLevelData() {
    try {
      const file = this.category === 'L' ? 'eggquiz_literacy' : 'eggquiz_math'
      const resp = await fetch(`/data/games/${file}.json`)
      const data = await resp.json()

      const levelData = data.levels[this.levelName]
      if (!levelData) {
        console.warn(`Level ${this.levelName} not found, trying fallback`)
        this.problems = this.generateFallbackProblems()
        this.startQuiz()
        return
      }

      // Pick a random worksheet
      const wsKeys = Object.keys(levelData.worksheets)
      const wsKey = wsKeys[randInt(0, wsKeys.length - 1)]
      const ws = levelData.worksheets[wsKey]

      // Parse sequence to get problem order
      const seqIds = this.parseSequence(ws.sequence, ws.problems)

      // Build problem list
      this.problems = []
      for (const pid of seqIds) {
        const pd = ws.problems[pid]
        if (!pd) continue

        if (this.category === 'L') {
          this.problems.push(this.buildLitProblem(pd))
        } else {
          this.problems.push(this.buildMathProblem(pd))
        }
      }

      if (this.problems.length === 0) {
        this.problems = this.generateFallbackProblems()
      }
    } catch (e) {
      console.error('Failed to load level data:', e)
      this.problems = this.generateFallbackProblems()
    }

    this.startQuiz()
  }

  parseSequence(seqStr: string, problems: Record<string, unknown>): string[] {
    const parts = seqStr.split(',').map(s => s.trim()).filter(Boolean)
    const result: string[] = []
    for (const part of parts) {
      if (part.includes('~')) {
        // Range: pick one randomly
        const [a, b] = part.split('~').map(s => s.trim())
        const aNum = parseInt(a)
        const bNum = parseInt(b)
        // Find all IDs in range that exist
        const candidates: string[] = []
        for (let id = aNum; id <= bNum; id++) {
          if (problems[String(id)]) candidates.push(String(id))
        }
        if (candidates.length > 0) {
          result.push(candidates[randInt(0, candidates.length - 1)])
        }
      } else {
        result.push(part)
      }
    }
    return result
  }

  buildLitProblem(pd: Record<string, string | string[]>): LitProblem {
    const type = pd.type as string
    const choices = (pd.choices as string[]) || []
    const answer = pd.answer as string

    // Determine choiceType from type name
    let choiceType: LitProblem['choiceType'] = 'word'
    if (type.endsWith('_sentence') || type === 'ordering_sentence') choiceType = 'sentence'
    else if (type.endsWith('_image') || type === 'soundonly_image' || type === 'imageseq_image') choiceType = 'image'
    else if (type === 'paragraph_sentence') choiceType = 'sentence'

    const p: LitProblem = {
      kind: 'literacy',
      type,
      answer,
      choices,
      choiceType,
    }

    // Map audio/display/image based on type
    if (pd.audio) p.audio = pd.audio as string
    if (pd.questionoption4 && (pd.questionoption4 as string).endsWith('.m4a')) p.audio = pd.questionoption4 as string
    if (pd.displayText) p.displayText = pd.displayText as string
    if (pd.templatename && !(pd.templatename as string).endsWith('.m4a')) {
      if ((pd.templatename as string).endsWith('.png')) {
        p.image = pd.templatename as string
      } else if (pd.templatename) {
        p.displayText = pd.templatename as string
      }
    }
    if (pd.sentenceText) p.displayText = pd.sentenceText as string
    if (pd.paragraphText) p.displayText = pd.paragraphText as string
    if (pd.image) p.image = pd.image as string
    // For image_word / image_sentence: image may be in questionoption1
    if (!p.image && pd.questionoption1 && (pd.questionoption1 as string).endsWith('.png')) {
      p.image = pd.questionoption1 as string
    }
    if (pd.questionText) p.questionText = pd.questionText as string

    // For image sequence (imageseq_image has .png references)
    if (type === 'imageseq_image') {
      const imgs: string[] = []
      if (pd.image1 && (pd.image1 as string).endsWith('.png')) imgs.push(pd.image1 as string)
      if (pd.image3 && (pd.image3 as string).endsWith('.png')) imgs.push(pd.image3 as string)
      if (imgs.length > 0) p.images = imgs
    }

    // For sentence sequence (imageseq_sentence has text)
    if (type === 'imageseq_sentence') {
      if (pd.sentenceSeq1) p.sentenceSeq1 = pd.sentenceSeq1 as string
      if (pd.sentenceSeq3) p.sentenceSeq3 = pd.sentenceSeq3 as string
    }

    return p
  }

  buildMathProblem(pd: Record<string, unknown>): MathProblem {
    const type = pd.type as string
    const p: MathProblem = {
      kind: 'math',
      type,
      templatename: (pd.templatename as string) || '',
      options: [
        (pd.questionoption1 as string) || '',
        (pd.questionoption2 as string) || '',
        (pd.questionoption3 as string) || '',
        (pd.questionoption4 as string) || '',
      ],
      answer: (pd.answer as string) || '',
      answerRange: pd.answerRange as { min: number; max: number } | undefined,
      answerOption: (pd.answeroption1 as string) || '',
    }

    // Generate the actual math content
    this.generateMathContent(p)
    return p
  }

  generateMathContent(p: MathProblem) {
    const range = p.answerRange || parseRange(p.answer)
    const ans = range ? randInt(range.min, range.max) : (parseInt(p.answer) || 0)
    p.generatedAnswer = ans

    switch (p.type) {
      case 'single_digit_numbers':
      case '2digit_numbers':
      case '3digit_numbers': {
        // Counting: show objects, pick the count
        p.displayMode = 'choose4'

        // Pre-generate item positions for counting view
        const viewW = 1890, viewH = 760
        const viewX = GW / 2 - viewW / 2
        const viewY = cy(1060) - viewH / 2
        const acornW = 80, acornH = 100
        const aX = viewX + 100, aY = viewY + 120
        const aW = viewW - 200, aH = viewH - 160
        const items: { x: number; y: number; type: string }[] = []
        if (ans <= 9) {
          for (let i = 0; i < ans; i++) {
            let best = { x: aX + aW / 2, y: aY + aH / 2, minDist: 0 }
            for (let trial = 0; trial < 15; trial++) {
              const px = aX + randInt(acornW, aW - acornW)
              const py = aY + randInt(acornH, aH - acornH)
              let minDist = Infinity
              for (const pos of items) {
                minDist = Math.min(minDist, Math.hypot(px - pos.x, py - pos.y))
              }
              if (minDist > best.minDist) best = { x: px, y: py, minDist }
            }
            items.push({ x: best.x, y: best.y, type: 'acorn' })
          }
        }
        p.questionContent = { mode: 'counting', text: 'How many?', items }

        // Generate distractors
        const min = p.type === 'single_digit_numbers' ? 1 : p.type === '2digit_numbers' ? 10 : 100
        const max = p.type === 'single_digit_numbers' ? 9 : p.type === '2digit_numbers' ? 20 : 200
        p.generatedChoices = this.makeSeqChoices(ans, min, max)
        break
      }

      case 'recognize_number':
      case 'number_identification': {
        p.displayMode = 'choose4'
        p.questionContent = { mode: 'recognize', text: String(ans) }
        const max2 = ans <= 9 ? 9 : ans <= 20 ? 20 : ans <= 50 ? 50 : 100
        p.generatedChoices = this.makeSeqChoices(ans, 1, max2)
        break
      }

      case 'missing_number_drag': {
        // Missing number in sequence
        p.displayMode = 'choose4'
        const interval = parseInt(p.options[0]) || 1
        const blankCount = parseInt(p.options[1]) || 3
        const startOpt = p.answerOption ? parseInt(p.answerOption) : 0
        const ascending = p.options[2] !== 'descending'

        let start: number
        if (startOpt > 0) {
          start = randInt(range?.min || 1, range?.max || 50)
          start = Math.floor(start / startOpt) * startOpt
        } else {
          start = ans - interval * randInt(0, 3)
        }

        const seq: (number | null)[] = []
        const blankIdx = ascending ? randInt(0, blankCount - 1) : randInt(0, blankCount - 1)
        for (let i = 0; i < blankCount + 1; i++) {
          const val = ascending ? start + i * interval : start - i * interval
          seq.push(i === blankIdx ? null : val)
        }
        const missingVal = ascending ? start + blankIdx * interval : start - blankIdx * interval
        p.generatedAnswer = missingVal

        p.questionContent = {
          mode: 'missing',
          numbers: seq.map(v => v ?? -999),
          blankIndex: blankIdx,
        }
        const rng = range || { min: 1, max: 50 }
        p.generatedChoices = this.makeSeqChoices(missingVal, rng.min, rng.max)
        break
      }

      case 'operations_with_objects':
      case 'operations_drag': {
        // Parse expression template like "1~9+1~9=?"
        const tmpl = p.templatename || p.options[0] || ''
        const parsed = this.parseExprTemplate(tmpl, p.options[1] || '')
        if (parsed) {
          p.generatedAnswer = parsed.answer
          p.questionContent = {
            mode: p.type === 'operations_drag' && p.options[2] === 'vertical' ? 'expressionVertical' : 'expression',
            a: parsed.a, b: parsed.b, op: parsed.op,
            expression: `${parsed.a} ${parsed.op} ${parsed.b} = ?`,
          }
          if (p.type === 'operations_drag') {
            p.displayMode = 'choose4'
            p.generatedChoices = this.makeSeqChoices(parsed.answer, Math.max(0, parsed.answer - 5), parsed.answer + 5)
          } else {
            p.displayMode = 'choose4'
            p.generatedChoices = this.makeSeqChoices(parsed.answer, Math.max(0, parsed.answer - 3), parsed.answer + 3)
          }
        }
        break
      }

      case 'operations_without_objects': {
        // Multiplication
        const tmpl = p.templatename || p.options[0] || ''
        const parsed = this.parseExprTemplate(tmpl, '')
        if (parsed) {
          p.generatedAnswer = parsed.answer
          p.displayMode = 'choose4'
          p.questionContent = {
            mode: 'expression',
            a: parsed.a, b: parsed.b, op: parsed.op,
            expression: `${parsed.a} ${parsed.op} ${parsed.b} = ?`,
          }
          p.generatedChoices = this.makeSeqChoices(parsed.answer, Math.max(0, parsed.answer - 5), parsed.answer + 5)
        }
        break
      }

      case 'bigger_and_smaller': {
        const which = p.templatename // 'bigger' or 'smaller'
        const displayType = p.options[0] // 'image' or 'number'
        const a = randInt(range?.min || 1, range?.max || 10)
        let b: number
        do { b = randInt(range?.min || 1, range?.max || 10) } while (b === a)
        const correct = which === 'bigger' ? Math.max(a, b) : Math.min(a, b)
        p.generatedAnswer = correct
        p.displayMode = 'choose4'
        p.questionContent = {
          mode: 'bigger',
          text: which === 'bigger' ? 'Which is bigger?' : 'Which is smaller?',
          audio: p.options[3] || undefined,
        }
        p.generatedChoices = [a, b]
        break
      }

      case 'biggest_and_smallest': {
        const which = p.templatename // 'biggest' or 'smallest'
        const nums: number[] = []
        while (nums.length < 4) {
          const n = randInt(range?.min || 1, range?.max || 50)
          if (!nums.includes(n)) nums.push(n)
        }
        const correct = which === 'biggest' ? Math.max(...nums) : Math.min(...nums)
        p.generatedAnswer = correct
        p.displayMode = 'choose4'
        p.questionContent = {
          mode: 'biggest',
          text: which === 'biggest' ? 'Which is the biggest?' : 'Which is the smallest?',
        }
        p.generatedChoices = shuffle(nums)
        break
      }

      case 'compare_number_magnitudes': {
        // Ordering - simplified to choose4 for now
        const ascending = p.templatename === 'ascending'
        const nums: number[] = []
        const gap = p.answerOption ? parseInt(p.answerOption) : 0
        while (nums.length < 4) {
          const n = gap > 0
            ? (range?.min || 1) + gap * nums.length
            : randInt(range?.min || 1, range?.max || 50)
          if (!nums.includes(n)) nums.push(n)
        }
        nums.sort((a2, b2) => ascending ? a2 - b2 : b2 - a2)
        p.generatedAnswer = nums[0]
        p.displayMode = 'choose4'
        p.questionContent = {
          mode: 'ordering',
          text: ascending ? 'Order: smallest to largest' : 'Order: largest to smallest',
          numbers: nums,
        }
        p.generatedChoices = shuffle(nums)
        break
      }

      case 'use_magnitude_symbols': {
        // Compare with >, <, = symbols — simplified
        const rng1 = parseRange(p.templatename)
        const rng2 = parseRange(p.options[0])
        const a3 = rng1 ? randInt(rng1.min, rng1.max) : parseInt(p.templatename) || 5
        const b3 = rng2 ? randInt(rng2.min, rng2.max) : parseInt(p.options[0]) || 5
        const sym = a3 > b3 ? '>' : a3 < b3 ? '<' : '='
        p.generatedAnswer = sym === '>' ? 0 : sym === '<' ? 1 : 2
        p.displayMode = 'choose4'
        p.questionContent = {
          mode: 'magnitude',
          text: `${a3} ___ ${b3}`,
        }
        p.generatedChoices = undefined
        p.choices = ['>', '<', '=']
        break
      }

      case 'shapes': {
        const questionType = p.templatename // 'which' or 'what'
        const questionText = p.options[0] || ''
        const answerShape = p.answer
        const shapeChoices = p.answerOption ? p.answerOption.split(',').map(s => s.trim()) : []
        p.generatedAnswer = 0
        p.displayMode = 'choose4'
        p.questionContent = {
          mode: 'shapes',
          text: questionText || (questionType === 'which' ? `Which is a ${answerShape}?` : 'What is this shape?'),
        }
        if (shapeChoices.length > 0) {
          p.choices = shuffle(shapeChoices)
          const correctIdx = p.choices.indexOf(answerShape)
          p.generatedAnswer = correctIdx >= 0 ? correctIdx : 0
        }
        break
      }

      case 'word_problem': {
        const text = p.templatename || ''
        const audioFile = p.options[0] || ''
        p.displayMode = 'choose4'
        p.questionContent = {
          mode: 'word_problem',
          text: text,
          audio: audioFile,
        }
        p.generatedChoices = this.makeSeqChoices(ans, Math.max(0, ans - 3), ans + 3)
        break
      }

      default: {
        // Fallback
        p.displayMode = 'choose4'
        p.questionContent = { mode: 'text', text: `${p.type}: ${p.answer}` }
        p.generatedChoices = this.makeSeqChoices(ans, Math.max(0, ans - 3), ans + 3)
      }
    }
  }

  parseExprTemplate(tmpl: string, regrouping: string): { a: number; b: number; op: string; answer: number } | null {
    // Parse templates like "1~9+1~9=?", "10-1~9=?", "2, 3, 4, 5x1~9=?"
    const cleanTmpl = tmpl.replace(/=\?$/, '').replace(/=\?/, '')
    let op = '+'
    let parts: string[] = []

    if (cleanTmpl.includes('+')) { op = '+'; parts = cleanTmpl.split('+') }
    else if (cleanTmpl.includes('-')) { op = '-'; parts = cleanTmpl.split('-') }
    else if (cleanTmpl.includes('x') || cleanTmpl.includes('X')) {
      op = '\u00d7'
      parts = cleanTmpl.split(/[xX]/)
    }

    if (parts.length !== 2) return null

    const pickFromPart = (part: string): number => {
      part = part.trim()
      // Check for comma-separated list: "2, 3, 4, 5"
      if (part.includes(',')) {
        const nums = part.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        return nums[randInt(0, nums.length - 1)]
      }
      // Check for range: "1~9"
      const r = parseRange(part)
      if (r) return randInt(r.min, r.max)
      return parseInt(part) || 0
    }

    let a = pickFromPart(parts[0])
    let b = pickFromPart(parts[1])

    // Handle regrouping constraints
    if (op === '+' && regrouping === 'regroupingtrue') {
      // Force carry: ones digits sum >= 10
      while ((a % 10 + b % 10) < 10) { b = pickFromPart(parts[1]) }
    }
    if (op === '-' && regrouping === 'regroupingtrue') {
      // Force borrow: ones digit of a < ones digit of b
      if (a < b) [a, b] = [b, a]
      while ((a % 10) >= (b % 10)) { a = pickFromPart(parts[0]); if (a < b) [a, b] = [b, a] }
    }
    if (op === '-' && a < b) [a, b] = [b, a]

    let answer: number
    if (op === '+') answer = a + b
    else if (op === '-') answer = a - b
    else answer = a * b

    return { a, b, op, answer }
  }

  makeSeqChoices(answer: number, min: number, max: number): number[] {
    // C++ makeSeq: 4 sequential numbers containing the answer
    const choices: number[] = [answer]
    const offset = randInt(0, 3)
    for (let i = 0; i < 4; i++) {
      const val = answer - offset + i
      if (val !== answer && val >= min && val <= max) choices.push(val)
    }
    // Fill to 4 if needed
    let attempts = 0
    while (choices.length < 4 && attempts < 50) {
      const v = randInt(Math.max(0, min), max)
      if (!choices.includes(v)) choices.push(v)
      attempts++
    }
    return shuffle(choices.slice(0, 4))
  }

  generateFallbackProblems(): Problem[] {
    const problems: Problem[] = []
    for (let i = 0; i < 5; i++) {
      const a = randInt(1, 10)
      const b = randInt(1, 10)
      const answer = a + b
      const choices = this.makeSeqChoices(answer, 1, 20)
      problems.push({
        kind: 'math',
        type: 'operations_drag',
        templatename: '',
        options: ['', '', '', ''],
        answer: String(answer),
        answerOption: '',
        generatedAnswer: answer,
        generatedChoices: choices,
        displayMode: 'choose4',
        questionContent: { mode: 'expression', expression: `${a} + ${b} = ?`, a, b, op: '+' },
      })
    }
    return problems
  }

  // ═══════════════════════════════════════════════════════════════
  // QUIZ START & PROBLEM SETUP
  // ═══════════════════════════════════════════════════════════════

  startQuiz() {
    this.currentProblemIndex = 0
    this.answerResults = new Array(this.problems.length).fill(false)
    this.onProgressChange?.(1, this.problems.length)
    this.setupProblem()
  }

  setupProblem() {
    this.answered = false
    this.touchEnabled = true
    this.answerButtons = []
    this.numpad = null
    this.speakerBtn = null
    this.questionImages = []
    this.questionAudio = null
    this.pageTurning = false
    this.pageTurnProgress = 0

    const problem = this.problems[this.currentProblemIndex]
    if (!problem) return

    if (problem.kind === 'literacy') {
      this.setupLitProblem(problem)
    } else {
      this.setupMathProblem(problem)
    }

    this.onProgressChange?.(this.currentProblemIndex + 1, this.problems.length)
  }

  // ═══════════════════════════════════════════════════════════════
  // LITERACY PROBLEM SETUP
  // ═══════════════════════════════════════════════════════════════

  setupLitProblem(p: LitProblem) {
    // Load audio if present
    if (p.audio) {
      this.questionAudio = loadAudio(`${SOUNDS}/${p.audio}`)
      // Auto-play after 0.7s (C++ behavior)
      setTimeout(() => {
        if (this.questionAudio) playSound(this.questionAudio)
      }, 700)
    }

    // Load question image if present
    if (p.image) {
      this.questionImages = [loadImage(`${IMAGES}/${p.image}`)]
    }
    if (p.images) {
      this.questionImages = p.images.map(f => loadImage(`${IMAGES}/${f}`))
    }

    // Setup speaker button for audio questions
    if (p.audio) {
      const isSoundOnly = p.type.startsWith('soundonly')
      this.speakerBtn = {
        x: isSoundOnly ? GW / 2 : 350,
        y: isSoundOnly ? cy(1000) : cy(1060) - 100,
        w: isSoundOnly ? 400 : 150,
        h: isSoundOnly ? 400 : 150,
        pressed: false,
      }
    }

    // Setup answer buttons
    const shuffledOrder = shuffle([0, 1, 2].slice(0, p.choices.length))
    const correctIdx = p.choices.indexOf(p.answer)

    // Determine button layout based on choice type
    const isHorizontal = p.choiceType === 'word' || p.choiceType === 'image'
    const useF1b = p.choiceType === 'sentence' || p.choiceType === 'paragraph'

    let viewRect = ANSWER_DEFAULT
    if (p.type === 'paragraph_sentence') viewRect = ANSWER_PARAGRAPH
    else if (useF1b && p.type !== 'paragraph_sentence') viewRect = ANSWER_SENTENCE

    const btnCfg = p.choiceType === 'sentence' ? BTN.sentence
      : p.choiceType === 'paragraph' ? BTN.paragraph
      : p.choiceType === 'image' ? BTN.image
      : BTN.word

    // Convert viewRect from Cocos to canvas
    const vxCenter = viewRect.x + viewRect.w / 2
    const vyCenter = cy(viewRect.y + viewRect.h / 2)

    for (let i = 0; i < shuffledOrder.length; i++) {
      const origIdx = shuffledOrder[i]
      let bx: number, by: number

      if (isHorizontal) {
        // Horizontal layout: evenly spaced
        const dist = (viewRect.w - btnCfg.w) / 2
        bx = vxCenter + dist * (i - (shuffledOrder.length - 1) / 2)
        by = vyCenter
      } else {
        // Vertical layout: stacked
        const dist = (viewRect.h - btnCfg.h) / 2
        bx = vxCenter
        by = vyCenter + dist * (i - (shuffledOrder.length - 1) / 2)
      }

      const btn: AnswerBtn = {
        x: bx, y: by,
        w: btnCfg.w, h: btnCfg.h,
        text: p.choices[origIdx],
        isCorrect: origIdx === correctIdx,
        state: 'normal',
        useFormat1b: useF1b,
        labelScale: 1,
      }

      // Load image for image choices
      if (p.choiceType === 'image' && p.choices[origIdx].endsWith('.png')) {
        btn.image = loadImage(`${IMAGES}/${p.choices[origIdx]}`)
        btn.text = ''
      }

      this.answerButtons.push(btn)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MATH PROBLEM SETUP
  // ═══════════════════════════════════════════════════════════════

  setupMathProblem(p: MathProblem) {
    // Load audio for word problems or counting
    if (p.questionContent?.audio) {
      this.questionAudio = loadAudio(`${SOUNDS}/${p.questionContent.audio}`)
      setTimeout(() => {
        if (this.questionAudio) playSound(this.questionAudio)
      }, 700)
      this.speakerBtn = {
        x: GW / 2, y: cy(1000),
        w: 400, h: 400, pressed: false,
      }
    }

    // Setup answer buttons
    if (p.displayMode === 'choose4') {
      const choices = p.choices || (p.generatedChoices || []).map(String)
      const answer = p.choices
        ? (p.generatedAnswer !== undefined ? p.choices[p.generatedAnswer] : p.answer)
        : String(p.generatedAnswer ?? p.answer)

      const shuffled = p.type === 'use_magnitude_symbols'
        ? choices  // Don't shuffle >, <, = symbols
        : shuffle(choices.map(String))

      const btnW = MATH_CHOOSE4_BTN.w
      const btnH = MATH_CHOOSE4_BTN.h
      const space = MATH_CHOOSE4_BTN.space
      const totalW = btnW * shuffled.length + space * (shuffled.length - 1)
      const startX = GW / 2 - totalW / 2 + btnW / 2
      const btnY = cy(MATH_CHOOSE4_Y_COCOS)

      for (let i = 0; i < shuffled.length; i++) {
        this.answerButtons.push({
          x: startX + i * (btnW + space),
          y: btnY,
          w: btnW, h: btnH,
          text: shuffled[i],
          isCorrect: shuffled[i] === String(answer),
          state: 'normal',
          useFormat1b: false,
          labelScale: 1,
        })
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════

  onPointerDown(x: number, y: number) {
    // Handle popup clicks
    if (this.popupState !== 'none') {
      this.handlePopupClick(x, y)
      return
    }

    if (!this.touchEnabled || this.answered) return

    // Speaker button
    if (this.speakerBtn) {
      const s = this.speakerBtn
      if (x >= s.x - s.w / 2 && x <= s.x + s.w / 2 && y >= s.y - s.h / 2 && y <= s.y + s.h / 2) {
        s.pressed = true
        if (this.questionAudio) playSound(this.questionAudio)
        setTimeout(() => { if (this.speakerBtn) this.speakerBtn.pressed = false }, 300)
        return
      }
    }

    // Numpad buttons
    if (this.numpad) {
      for (const btn of this.numpad.buttons) {
        if (x >= btn.x - btn.w / 2 && x <= btn.x + btn.w / 2 &&
          y >= btn.y - btn.h / 2 && y <= btn.y + btn.h / 2) {
          btn.pressed = true
          playSound(this.sfxTouch)
          setTimeout(() => { btn.pressed = false }, 150)

          if (btn.label === 'back') {
            this.numpad!.typedValue = this.numpad!.typedValue.slice(0, -1)
          } else if (btn.label === 'enter') {
            // Check answer
            this.handleNumpadAnswer()
          } else if (this.numpad!.typedValue.length < 4) {
            this.numpad!.typedValue += btn.label
          }
          return
        }
      }
      return
    }

    // Answer buttons
    for (const btn of this.answerButtons) {
      if (btn.state !== 'normal') continue
      if (x >= btn.x - btn.w / 2 && x <= btn.x + btn.w / 2 &&
        y >= btn.y - btn.h / 2 && y <= btn.y + btn.h / 2) {
        this.handleAnswer(btn)
        return
      }
    }
  }

  onPointerMove(_x: number, _y: number) { }
  onPointerUp(_x: number, _y: number) { }

  handleAnswer(btn: AnswerBtn) {
    this.answered = true
    this.touchEnabled = false
    btn.state = 'pressed'

    // Disable all other buttons
    for (const b of this.answerButtons) {
      if (b !== btn) b.state = 'disabled'
    }

    if (btn.isCorrect) {
      this.answerResults[this.currentProblemIndex] = true
      playSound(this.sfxTouch)
    } else {
      this.answerResults[this.currentProblemIndex] = false
      playSound(this.sfxWrong)
    }

    // C++ onSolve: advance after delay with page turn
    setTimeout(() => this.onSolve(), 800)
  }

  handleNumpadAnswer() {
    if (!this.numpad || !this.numpad.typedValue) return
    this.answered = true
    this.touchEnabled = false

    const correct = this.numpad.typedValue === this.numpad.answer
    this.answerResults[this.currentProblemIndex] = correct

    if (correct) {
      playSound(this.sfxTouch)
    } else {
      playSound(this.sfxWrong)
    }

    setTimeout(() => this.onSolve(), 800)
  }

  onSolve() {
    this.currentProblemIndex++

    if (this.currentProblemIndex >= this.problems.length) {
      // All problems done — check pass/fail
      this.onQuizComplete()
    } else {
      // Page turn animation
      playSound(this.sfxPageTurn)
      this.pageTurning = true
      this.pageTurnProgress = 0

      // C++: touch re-enabled after 0.85s (0.1 + delay/2 where delay=1.5)
      setTimeout(() => {
        this.setupProblem()
      }, 850)
    }
  }

  onQuizComplete() {
    const numCorrect = this.answerResults.filter(Boolean).length
    const threshold = Math.floor(this.problems.length * 0.8)
    const passed = numCorrect >= threshold

    if (passed) {
      this.popupState = 'pass'
      playSound(this.sfxPass)
      // Generate confetti
      this.confetti = []
      for (let i = 0; i < 60; i++) {
        this.confetti.push({
          x: GW / 2 + randInt(-400, 400),
          y: randInt(-200, 200),
          vx: randInt(-300, 300),
          vy: randInt(-600, -200),
          r: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 10,
          type: randInt(0, 7),
          alpha: 1,
        })
      }
    } else {
      this.popupState = 'fail'
      playSound(this.sfxFail)
    }
    this.popupTimer = 0
  }

  handlePopupClick(x: number, y: number) {
    // Check button at bottom center
    const btnY = cy(480)
    const btnW = 300
    const btnH = 120
    if (x >= GW / 2 - btnW / 2 && x <= GW / 2 + btnW / 2 &&
      y >= btnY - btnH / 2 && y <= btnY + btnH / 2) {
      this.popupState = 'none'
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════

  update(_time: number, dt: number) {
    // Page turn animation
    if (this.pageTurning) {
      this.pageTurnProgress = Math.min(this.pageTurnProgress + dt / 1.5, 1)
      if (this.pageTurnProgress >= 1) this.pageTurning = false
    }

    // Popup timer
    if (this.popupState !== 'none') {
      this.popupTimer += dt

      // Update confetti physics
      for (const c of this.confetti) {
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.vy += 600 * dt  // gravity
        c.r += c.vr * dt
        if (c.y > GH + 100) c.alpha = 0
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAW
  // ═══════════════════════════════════════════════════════════════

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Background
    this.drawBackgroundImage(this.imgBg, w, h)

    const offsetX = (w - GW * this.gameScale) / 2
    const offsetY = (h - GH * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Paper page background (C++: ANCHOR_MIDDLE_BOTTOM at center)
    this.drawImg(this.imgPage, GW / 2, GH, GW, 0, 'mb')

    // Page turn overlay
    if (this.pageTurning && this.pageTurnProgress < 1) {
      ctx.save()
      ctx.globalAlpha = (1 - this.pageTurnProgress) * 0.4
      ctx.fillStyle = '#E8DCC8'
      const foldX = GW * (1 - this.pageTurnProgress) * gs
      ctx.fillRect(foldX, 0, GW * gs - foldX, GH * gs)
      ctx.restore()
    }

    // Draw current problem
    const problem = this.problems[this.currentProblemIndex]
    if (problem && !this.pageTurning) {
      if (problem.kind === 'literacy') {
        this.drawLitQuestion(problem, gs)
      } else {
        this.drawMathQuestion(problem, gs)
      }
      this.drawAnswerButtons(gs)
      this.drawSpeakerButton(gs)
    }

    // Popup overlay
    if (this.popupState !== 'none') {
      this.drawPopup(gs)
    }

    ctx.restore()

    // Progress bar drawn OUTSIDE game transform (C++: scene-level, not gameNode)
    this.drawProgressBar(w, h)
  }

  // ─── Image Drawing Helper ────────────────────────────────────
  drawImg(img: HTMLImageElement, cx: number, cy2: number, w: number, h: number, anchor = 'cc') {
    if (!imgOk(img)) return
    const gs = this.gameScale
    const iw = w || img.width
    const ih = h || img.height
    const scale = w ? w / img.width : h ? h / img.height : 1
    const dw = img.width * scale * gs
    const dh = img.height * scale * gs

    let dx: number, dy: number
    if (anchor === 'cc') { dx = cx * gs - dw / 2; dy = cy2 * gs - dh / 2 }
    else if (anchor === 'mb') { dx = cx * gs - dw / 2; dy = cy2 * gs - dh }
    else if (anchor === 'tl') { dx = cx * gs; dy = cy2 * gs }
    else { dx = cx * gs - dw / 2; dy = cy2 * gs - dh / 2 }

    this.ctx.drawImage(img, dx, dy, dw, dh)
  }

  // ─── Scale9 Drawing ──────────────────────────────────────────
  drawScale9(img: HTMLImageElement, x: number, y: number, w: number, h: number, inset = 30) {
    if (!imgOk(img)) return
    const gs = this.gameScale
    const sw = img.width, sh = img.height
    const si = inset  // source inset in pixels
    // Scale target inset proportionally
    const ti = si * gs

    const dx = x * gs, dy = y * gs, dw = w * gs, dh = h * gs

    // 9 slices: corners, edges, center
    const { ctx } = this
    // Top-left
    ctx.drawImage(img, 0, 0, si, si, dx, dy, ti, ti)
    // Top-right
    ctx.drawImage(img, sw - si, 0, si, si, dx + dw - ti, dy, ti, ti)
    // Bottom-left
    ctx.drawImage(img, 0, sh - si, si, si, dx, dy + dh - ti, ti, ti)
    // Bottom-right
    ctx.drawImage(img, sw - si, sh - si, si, si, dx + dw - ti, dy + dh - ti, ti, ti)
    // Top edge
    ctx.drawImage(img, si, 0, sw - 2 * si, si, dx + ti, dy, dw - 2 * ti, ti)
    // Bottom edge
    ctx.drawImage(img, si, sh - si, sw - 2 * si, si, dx + ti, dy + dh - ti, dw - 2 * ti, ti)
    // Left edge
    ctx.drawImage(img, 0, si, si, sh - 2 * si, dx, dy + ti, ti, dh - 2 * ti)
    // Right edge
    ctx.drawImage(img, sw - si, si, si, sh - 2 * si, dx + dw - ti, dy + ti, ti, dh - 2 * ti)
    // Center
    ctx.drawImage(img, si, si, sw - 2 * si, sh - 2 * si, dx + ti, dy + ti, dw - 2 * ti, dh - 2 * ti)
  }

  // ═══════════════════════════════════════════════════════════════
  // LITERACY QUESTION DRAWING
  // ═══════════════════════════════════════════════════════════════

  drawLitQuestion(p: LitProblem, gs: number) {
    const { ctx } = this
    const type = p.type

    if (type.startsWith('soundonly')) {
      // Sound-only: just speaker button (already handled)
      return
    }

    if (type === 'word_word' || type === 'image_word') {
      // WORD / IMAGE question at center
      const hasAudio = !!p.audio
      const boxW = hasAudio ? 1890 : 1340
      const boxH = 508
      const boxX = GW / 2 - boxW / 2
      const boxY = cy(1060) - boxH / 2  // center at cocos y=1060

      this.drawScale9(this.imgQBox, boxX, boxY, boxW, boxH)

      if (p.image && imgOk(this.questionImages[0])) {
        // Draw image inside frame
        const img = this.questionImages[0]
        const frameW = 472, frameH = 332
        const imgX = GW / 2, imgY = cy(1060)

        if (imgOk(this.imgPicFrame)) {
          this.drawImg(this.imgPicFrame, imgX, imgY, frameW, 0)
        }

        // Draw actual image inside frame (with padding)
        const pad = 20
        ctx.drawImage(img,
          (imgX - frameW / 2 + pad) * gs,
          (imgY - frameH / 2 + pad) * gs,
          (frameW - 2 * pad) * gs,
          (frameH - 2 * pad) * gs
        )
      } else if (p.displayText) {
        // Draw text inside box
        ctx.fillStyle = TEXT_COLOR
        const fontSize = p.displayText.length > 10 ? 72 : 100
        ctx.font = `${fontSize * gs}px ${DEFAULT_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // Handle phonics notation: "r+a" -> show as "ra" or with cards
        const text = p.displayText.includes('+') ? p.displayText.replace(/\+/g, '') : p.displayText
        ctx.fillText(text, GW / 2 * gs, cy(1060) * gs)
      }
      return
    }

    if (type.startsWith('sentence') || type === 'image_sentence' || type === 'soundonly_sentence') {
      // SENTENCE question
      const hasAudio = !!p.audio
      const boxW = hasAudio ? 1890 : 1890
      const boxH = hasAudio ? 408 : 508
      const boxX = GW / 2 - boxW / 2
      const boxY = cy(806) - boxH  // ANCHOR_MIDDLE_BOTTOM at cocos y=806

      this.drawScale9(this.imgQBox, boxX, boxY, boxW, boxH)

      if (p.image && imgOk(this.questionImages[0])) {
        const img = this.questionImages[0]
        const frameW = 472, frameH = 332
        ctx.drawImage(img,
          (GW / 2 - frameW / 2 + 20) * gs,
          (boxY + boxH / 2 - frameH / 2 + 20) * gs,
          (frameW - 40) * gs, (frameH - 40) * gs)
      }

      if (p.displayText) {
        ctx.fillStyle = TEXT_COLOR
        const maxW = (boxW - 100) * gs
        let fontSize = 56
        ctx.font = `${fontSize * gs}px ${DEFAULT_FONT}`
        // Auto-shrink
        while (ctx.measureText(p.displayText).width > maxW && fontSize > 28) {
          fontSize -= 4
          ctx.font = `${fontSize * gs}px ${DEFAULT_FONT}`
        }
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        this.drawWrappedText(p.displayText, GW / 2 * gs, (boxY + boxH / 2) * gs, maxW, fontSize * gs * 1.3)
      }
      return
    }

    if (type === 'paragraph_sentence' || type === 'listeningcomp_sentence' || type === 'listeningcom_image') {
      // PARAGRAPH question (left side)
      const boxW = 1040
      const boxH = p.audio ? 926 : 1226
      const boxX = 262
      const boxY = cy(185) - boxH  // BOTTOM_LEFT anchor at cocos y=185

      this.drawScale9(this.imgQBox, boxX, boxY, boxW, boxH)

      const pad = 30
      const maxW = (boxW - 2 * pad) * gs
      let textY = (boxY + pad) * gs

      // Question text at top (bold)
      if (p.questionText) {
        ctx.fillStyle = '#333333'
        ctx.font = `bold ${40 * gs}px ${DEFAULT_FONT}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const qLines = this.wrapText(p.questionText, maxW)
        for (const line of qLines) {
          ctx.fillText(line, (boxX + pad) * gs, textY)
          textY += 44 * gs
        }
        textY += 20 * gs  // gap after question
      }

      // Paragraph passage text below question
      if (p.displayText) {
        ctx.fillStyle = TEXT_COLOR
        const fontSize = 32
        ctx.font = `${fontSize * gs}px ${DEFAULT_FONT}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const maxTextH = (boxY + boxH - pad) * gs - textY  // clip to box
        const lines = this.wrapText(p.displayText, maxW)
        const lineH = fontSize * gs * 1.4
        for (const line of lines) {
          if (textY + lineH > (boxY + boxH - pad) * gs) break  // don't overflow box
          ctx.fillText(line, (boxX + pad) * gs, textY)
          textY += lineH
        }
      }
      return
    }

    if (type === 'imageseq_image') {
      // Image sequence: image1, ?, image3 with arrows
      const imgW = 472, imgH = 332
      const spacing = 622
      const centerX = GW / 2
      const centerY = cy(750 + imgH / 2 + 30)

      // Positions: left=image1, center=?, right=image3
      const positions = [centerX - spacing, centerX, centerX + spacing]
      const imgList = [this.questionImages[0], null, this.questionImages[1]]

      for (let i = 0; i < 3; i++) {
        const ix = positions[i]
        if (imgOk(this.imgPicFrame)) {
          this.drawImg(this.imgPicFrame, ix, centerY, imgW, 0)
        }
        if (imgOk(imgList[i])) {
          ctx.drawImage(imgList[i]!,
            (ix - imgW / 2 + 20) * gs, (centerY - imgH / 2 + 20) * gs,
            (imgW - 40) * gs, (imgH - 40) * gs)
        } else if (i === 1) {
          // Center slot: draw "?" for the missing image
          ctx.fillStyle = '#999'
          ctx.font = `bold ${120 * gs}px ${DEFAULT_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('?', ix * gs, centerY * gs)
        }
        // Arrow between images
        if (i < 2 && imgOk(this.imgArrow)) {
          this.drawImg(this.imgArrow, ix + spacing / 2, centerY, 60, 0)
        }
      }
      return
    }

    if (type === 'imageseq_sentence') {
      // Sentence sequence: sentence1, ?, sentence3
      // Display as three boxes with text
      const boxW = 700, boxH = 300
      const spacing = 50
      const totalW = 3 * boxW + 2 * spacing
      const startX = (GW - totalW) / 2
      const centerY = cy(800)

      const sentences = [p.sentenceSeq1 || '', '?', p.sentenceSeq3 || '']

      for (let i = 0; i < 3; i++) {
        const bx = startX + i * (boxW + spacing)
        const by = centerY - boxH / 2

        this.drawScale9(this.imgQBox, bx, by, boxW, boxH)

        ctx.fillStyle = i === 1 ? '#999' : TEXT_COLOR
        const fontSize = i === 1 ? 100 : 32
        ctx.font = `${i === 1 ? 'bold ' : ''}${fontSize * gs}px ${DEFAULT_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        if (i === 1) {
          ctx.fillText('?', (bx + boxW / 2) * gs, (by + boxH / 2) * gs)
        } else {
          const maxW2 = (boxW - 40) * gs
          this.drawWrappedText(sentences[i], (bx + boxW / 2) * gs, (by + boxH / 2) * gs, maxW2, fontSize * gs * 1.3)
        }

        // Arrow between boxes
        if (i < 2 && imgOk(this.imgArrow)) {
          this.drawImg(this.imgArrow, bx + boxW + spacing / 2, centerY, 40, 0)
        }
      }
      return
    }

    // Default: show display text if available
    if (p.displayText) {
      const boxW = 1340, boxH = 508
      const boxX = GW / 2 - boxW / 2
      const boxY = cy(1060) - boxH / 2

      this.drawScale9(this.imgQBox, boxX, boxY, boxW, boxH)

      ctx.fillStyle = TEXT_COLOR
      ctx.font = `${72 * gs}px ${DEFAULT_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.displayText, GW / 2 * gs, cy(1060) * gs)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MATH QUESTION DRAWING
  // ═══════════════════════════════════════════════════════════════

  drawMathQuestion(p: MathProblem, gs: number) {
    const { ctx } = this
    const qc = p.questionContent
    if (!qc) return

    switch (qc.mode) {
      case 'counting': {
        // Draw counting view with objects
        const viewW = 1890, viewH = 760
        const viewX = GW / 2 - viewW / 2
        const viewY = cy(1060) - viewH / 2

        this.drawScale9(this.imgQBox, viewX, viewY, viewW, viewH)

        // Draw "How many?" text
        ctx.fillStyle = TEXT_COLOR
        ctx.font = `${60 * gs}px ${DEFAULT_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText('How many?', GW / 2 * gs, (viewY + 20) * gs)

        // Draw objects (acorns/tally/10-sets based on answer range)
        const count = p.generatedAnswer || 1
        if (count <= 9 && imgOk(this.imgAcorn) && qc.items && qc.items.length > 0) {
          // Acorns at pre-computed positions
          const acornW = 80
          for (const pos of qc.items) {
            this.drawImg(this.imgAcorn, pos.x, pos.y, acornW, 0)
          }
        } else if (count <= 20) {
          // Tally marks
          const sections = Math.ceil(count / 5)
          const sectionW = 486
          const totalW2 = sectionW * sections + 120 * (sections - 1)
          const startX = GW / 2 - totalW2 / 2 + sectionW / 2
          const tallyY = viewY + viewH / 2 + 40

          for (let s = 0; s < sections; s++) {
            const tallyCount = Math.min(5, count - s * 5)
            const tallyIdx = tallyCount - 1
            if (tallyIdx >= 0 && tallyIdx < this.imgTally.length && imgOk(this.imgTally[tallyIdx])) {
              this.drawImg(this.imgTally[tallyIdx], startX + s * (sectionW + 120), tallyY, sectionW * 0.8, 0)
            }
          }
        } else {
          // Large numbers: show number text
          ctx.fillStyle = TEXT_COLOR
          ctx.font = `bold ${120 * gs}px ${DEFAULT_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          // Show groups of dots
          const tensGroups = Math.floor(count / 10)
          const ones = count % 10
          const groupText = tensGroups > 0 ? `${tensGroups} tens ${ones > 0 ? `${ones} ones` : ''}` : `${count}`
          ctx.fillText(groupText, GW / 2 * gs, (viewY + viewH / 2 + 40) * gs)
        }
        break
      }

      case 'missing': {
        // Missing number view
        const numbers = qc.numbers || []
        const blankIdx = qc.blankIndex ?? 0
        const btnW2 = 434, btnH2 = 566, space = 64
        const totalW2 = btnW2 * numbers.length + space * (numbers.length - 1)
        const startX = GW / 2 - totalW2 / 2 + btnW2 / 2
        const boxY = cy(1060)

        for (let i = 0; i < numbers.length; i++) {
          const bx = startX + i * (btnW2 + space)

          if (i === blankIdx) {
            // Empty slot with dotted border
            if (imgOk(this.imgEmptyLarge)) {
              this.drawImg(this.imgEmptyLarge, bx, boxY, btnW2, 0)
            } else {
              ctx.strokeStyle = '#999'
              ctx.lineWidth = 3 * gs
              ctx.setLineDash([10 * gs, 5 * gs])
              ctx.strokeRect((bx - btnW2 / 2) * gs, (boxY - btnH2 / 2) * gs, btnW2 * gs, btnH2 * gs)
              ctx.setLineDash([])
            }
            ctx.fillStyle = '#999'
            ctx.font = `${120 * gs}px ${DEFAULT_FONT}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('?', bx * gs, boxY * gs)
          } else {
            // Number box
            ctx.fillStyle = '#FFFDE7'
            ctx.strokeStyle = '#E0C068'
            ctx.lineWidth = 3 * gs
            const r = 16 * gs
            ctx.beginPath()
            ctx.roundRect((bx - btnW2 / 2) * gs, (boxY - btnH2 / 2) * gs, btnW2 * gs, btnH2 * gs, r)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = TEXT_COLOR
            ctx.font = `${120 * gs}px ${DEFAULT_FONT}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(numbers[i]), bx * gs, boxY * gs)
          }
        }
        break
      }

      case 'expression':
      case 'expressionVertical': {
        const viewW = 1890, viewH = 760
        const viewX = GW / 2 - viewW / 2
        const viewY = cy(1060) - viewH / 2

        this.drawScale9(this.imgQBox, viewX, viewY, viewW, viewH)

        if (qc.mode === 'expressionVertical') {
          // Vertical expression layout
          const a2 = qc.a || 0, b2 = qc.b || 0, op2 = qc.op || '+'
          const fontSize = 120
          ctx.fillStyle = TEXT_COLOR
          ctx.font = `${fontSize * gs}px ${DEFAULT_FONT}`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'

          const numX = GW / 2 + 100
          const topY = viewY + viewH / 3
          const botY = viewY + viewH / 3 + fontSize * gs * 1.2 / gs

          ctx.fillText(String(a2), numX * gs, topY * gs)
          // Op symbol
          ctx.textAlign = 'left'
          ctx.fillText(op2 === '-' ? '\u2212' : op2, (numX - 200) * gs, botY * gs)
          ctx.textAlign = 'right'
          ctx.fillText(String(b2), numX * gs, botY * gs)

          // Horizontal line
          const lineY = botY + fontSize / 2 + 20
          ctx.strokeStyle = TEXT_COLOR
          ctx.lineWidth = 6 * gs
          ctx.beginPath()
          ctx.moveTo((numX - 250) * gs, lineY * gs)
          ctx.lineTo((numX + 50) * gs, lineY * gs)
          ctx.stroke()

          // Answer placeholder
          ctx.fillStyle = '#999'
          ctx.textAlign = 'center'
          ctx.fillText('?', (numX - 50) * gs, (lineY + fontSize / 2 + 40) * gs)
        } else {
          // Horizontal expression
          const expr = qc.expression || `${qc.a} ${qc.op} ${qc.b} = ?`
          ctx.fillStyle = TEXT_COLOR
          ctx.font = `${100 * gs}px ${DEFAULT_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(expr, GW / 2 * gs, (viewY + viewH / 2) * gs)
        }
        break
      }

      case 'recognize':
      case 'soundonly': {
        // Show the number to recognize
        if (qc.text) {
          const boxW = 1340, boxH = 508
          const boxX = GW / 2 - boxW / 2
          const boxY2 = cy(1060) - boxH / 2

          this.drawScale9(this.imgQBox, boxX, boxY2, boxW, boxH)

          ctx.fillStyle = TEXT_COLOR
          ctx.font = `bold ${160 * gs}px ${DEFAULT_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(qc.text, GW / 2 * gs, cy(1060) * gs)
        }
        break
      }

      case 'bigger':
      case 'biggest':
      case 'ordering':
      case 'magnitude':
      case 'shapes':
      case 'word_problem': {
        // Text-based questions — show in question box
        const text = qc.text || ''
        const boxW = 1890, boxH = 508
        const boxX = GW / 2 - boxW / 2
        const boxY2 = cy(1060) - boxH / 2

        this.drawScale9(this.imgQBox, boxX, boxY2, boxW, boxH)

        ctx.fillStyle = TEXT_COLOR
        let fontSize = 56
        ctx.font = `${fontSize * gs}px ${DEFAULT_FONT}`
        const maxW = (boxW - 100) * gs
        while (ctx.measureText(text).width > maxW && fontSize > 24) {
          fontSize -= 4
          ctx.font = `${fontSize * gs}px ${DEFAULT_FONT}`
        }
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        this.drawWrappedText(text, GW / 2 * gs, cy(1060) * gs, maxW, fontSize * gs * 1.4)
        break
      }

      default: {
        // Fallback: show type and answer
        ctx.fillStyle = TEXT_COLOR
        ctx.font = `${60 * gs}px ${DEFAULT_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${p.type}`, GW / 2 * gs, cy(1060) * gs)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ANSWER BUTTONS DRAWING
  // ═══════════════════════════════════════════════════════════════

  drawAnswerButtons(gs: number) {
    const { ctx } = this

    for (const btn of this.answerButtons) {
      ctx.save()

      const bx = btn.x * gs
      const by = btn.y * gs
      const bw = btn.w * gs
      const bh = btn.h * gs
      const depth = (btn.useFormat1b ? 30 : 40) * gs

      // Choose image based on state and format
      let bgImg: HTMLImageElement
      if (btn.state === 'pressed') {
        bgImg = btn.useFormat1b ? this.imgF1bA : this.imgF1aA
      } else {
        bgImg = btn.useFormat1b ? this.imgF1bN : this.imgF1aN
      }

      // Draw button background with Scale9
      if (imgOk(bgImg)) {
        this.drawScale9(bgImg, btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h, 40)
      } else {
        // Fallback: simple rounded rectangle
        ctx.fillStyle = btn.state === 'pressed' ? '#E8E8E8' : '#FFFFFF'
        ctx.strokeStyle = '#CCCCCC'
        ctx.lineWidth = 3 * gs
        ctx.beginPath()
        ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 16 * gs)
        ctx.fill()
        ctx.stroke()
      }

      // Draw disabled overlay
      if (btn.state === 'disabled') {
        ctx.globalAlpha = 0.5
      }

      // Draw answer content
      if (imgOk(btn.image)) {
        // Image answer
        const pad = (btn.useFormat1b ? 20 : 10) * gs
        const imgW = bw - 2 * pad
        const imgH = bh - 2 * pad - depth
        ctx.drawImage(btn.image, bx - imgW / 2, by - imgH / 2 - depth / 4, imgW, imgH)
      } else if (btn.text) {
        // Text answer
        // Button label color: dark on light buttons for visibility
        ctx.fillStyle = TEXT_COLOR

        // Font size based on button type
        let fontSize: number
        if (btn.useFormat1b) {
          fontSize = btn.text.length > 40 ? 28 : btn.text.length > 20 ? 36 : 44
        } else {
          fontSize = /^-?\d+$/.test(btn.text) ? 100 : (btn.text.length > 5 ? 56 : 72)
        }

        ctx.font = `${fontSize * gs}px ${DEFAULT_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // C++ button center offset: center at (btnSize.height - depth)/2 + depth from bottom
        const labelY = by + depth / 4

        // Auto-shrink if too wide
        const innerW = bw - (btn.useFormat1b ? 40 : 20) * gs
        const measured = ctx.measureText(btn.text)
        if (measured.width > innerW) {
          const scale = innerW / measured.width
          ctx.font = `${Math.floor(fontSize * scale) * gs}px ${DEFAULT_FONT}`
        }

        if (btn.useFormat1b) {
          // Multi-line for sentences
          this.drawWrappedText(btn.text, bx, labelY, innerW, fontSize * gs * 1.2)
        } else {
          ctx.fillText(btn.text, bx, labelY)
        }
      }

      ctx.restore()
    }
  }

  // ─── Speaker Button ──────────────────────────────────────────
  drawSpeakerButton(gs: number) {
    if (!this.speakerBtn) return
    const s = this.speakerBtn
    const img = s.pressed ? this.imgSpeakerA : this.imgSpeakerN
    if (imgOk(img)) {
      this.drawImg(img, s.x, s.y, s.w, 0)
    } else {
      // Fallback speaker icon
      const { ctx } = this
      ctx.fillStyle = s.pressed ? '#E0E0E0' : '#FFFFFF'
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 3 * gs
      ctx.beginPath()
      ctx.arc(s.x * gs, s.y * gs, s.w / 2 * gs, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#666'
      ctx.font = `${40 * gs}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('\ud83d\udd0a', s.x * gs, s.y * gs)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PROGRESS BAR (in-engine, top center)
  // ═══════════════════════════════════════════════════════════════

  drawProgressBar(canvasW: number, canvasH: number) {
    // C++ ProgressIndicator: scene-level (NOT inside gameNode)
    // dotSize=46×48 (positioning), sprites render at natural 50×50 image size
    // dotMargin=10, position=Vec2(winSize.width/2, winSize.height - contentHeight)
    // Anchor: ANCHOR_MIDDLE
    //
    // C++ design resolution: 2560×1800 (FIXED_HEIGHT)
    // winSize.height = 1800 always, winSize.width = device-dependent
    // In our canvas: winSize ≈ canvas pixel size
    //
    // Scale: winSize maps to canvas pixels. The ratio is canvasH / 1800.
    const { ctx } = this
    const total = this.problems.length
    if (total === 0) return

    // C++ constants
    const dotW = 46        // positioning width
    const dotH = 48        // positioning height
    const dotMargin = 10   // gap between dots
    const imgSize = 50     // actual sprite render size (50×50 PNG)

    // Scene-level scale: canvas pixels per design unit
    // C++ uses FIXED_HEIGHT so height=1800 is the reference
    const sceneScale = canvasH / 1800

    // Total bar dimensions (for centering)
    const totalBarW = total * dotW + (total - 1) * dotMargin  // in design units

    // Bar center position (C++: Vec2(winSize.width/2, winSize.height - contentHeight))
    // winSize.width/2 → canvasW/2 in pixels
    // winSize.height - dotH = 1800 - 48 = 1752 (Cocos Y, bottom-up)
    // In top-down: 1800 - 1752 = 48 design units from top
    const barCXpx = canvasW / 2
    const barCYpx = 48 * sceneScale  // 48 design units from top

    // Starting X (left edge of first dot's positioning cell)
    const startXpx = barCXpx - (totalBarW / 2) * sceneScale

    for (let i = 0; i < total; i++) {
      // C++: b->setPosition(i*(dotMargin+dotW)+0.5*dotW, 0.5*dotH)
      const cxPx = startXpx + (i * (dotMargin + dotW) + dotW / 2) * sceneScale
      const cyPx = barCYpx

      // Select image based on status (C++: 'o'=pass, 'x'=fail, 'c'=current, '-'=notyet)
      let img: HTMLImageElement
      if (i < this.currentProblemIndex) {
        img = this.answerResults[i] ? this.imgProgPass : this.imgProgFail
      } else if (i === this.currentProblemIndex) {
        img = this.imgProgCurrent
      } else {
        img = this.imgProgNotyet
      }

      // Draw at natural sprite size (50×50 design units, like C++ Sprite::create)
      if (imgOk(img)) {
        const dw = imgSize * sceneScale
        const dh = imgSize * sceneScale
        ctx.drawImage(img, cxPx - dw / 2, cyPx - dh / 2, dw, dh)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // POPUP
  // ═══════════════════════════════════════════════════════════════

  drawPopup(gs: number) {
    const { ctx } = this

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, GW * gs, GH * gs)

    // Popup background
    if (imgOk(this.imgPopupBg)) {
      this.drawImg(this.imgPopupBg, GW / 2, GH / 2, 0, GH * 0.8)
    }

    if (this.popupState === 'pass') {
      // Glow effect (rotating)
      if (imgOk(this.imgGlow)) {
        ctx.save()
        ctx.translate(GW / 2 * gs, GH / 2 * gs - 100 * gs)
        ctx.rotate(Math.sin(this.popupTimer * 2) * 0.5)
        ctx.globalAlpha = 0.6
        const glowSize = 800
        ctx.drawImage(this.imgGlow, -glowSize / 2 * gs, -glowSize / 2 * gs, glowSize * gs, glowSize * gs)
        ctx.restore()
      }

      // Ribbon back
      if (imgOk(this.imgRibbonBack)) {
        this.drawImg(this.imgRibbonBack, GW / 2, GH / 2 - 200, 800, 0)
      }

      // Egg or Bird image
      const charImg = imgOk(this.imgBird) ? this.imgBird : this.imgEgg
      if (imgOk(charImg)) {
        this.drawImg(charImg, GW / 2, GH / 2 - 50, 0, 500)
      }

      // Ribbon front
      if (imgOk(this.imgRibbonFront)) {
        this.drawImg(this.imgRibbonFront, GW / 2, GH / 2 - 200, 800, 0)
      }

      // Draw confetti
      for (const c of this.confetti) {
        if (c.alpha <= 0) continue
        const ci = this.imgConfetti[c.type]
        if (!imgOk(ci)) continue
        ctx.save()
        ctx.globalAlpha = c.alpha
        ctx.translate(c.x * gs, c.y * gs)
        ctx.rotate(c.r)
        const cs = 40 * gs
        ctx.drawImage(ci, -cs / 2, -cs / 2, cs, cs)
        ctx.restore()
      }

      // "Congratulations!" text
      ctx.fillStyle = '#FFD700'
      ctx.font = `bold ${80 * gs}px ${CURLY_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = '#8B6914'
      ctx.lineWidth = 3 * gs
      const textY = GH / 2 + 240
      ctx.strokeText('Congratulations!', GW / 2 * gs, textY * gs)
      ctx.fillText('Congratulations!', GW / 2 * gs, textY * gs)

      // Score
      const numCorrect = this.answerResults.filter(Boolean).length
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `${48 * gs}px ${DEFAULT_FONT}`
      ctx.fillText(`${numCorrect} / ${this.problems.length} correct`, GW / 2 * gs, (textY + 80) * gs)

      // Check button
      this.drawPopupButton(this.imgPopupCheck, this.imgPopupCheckA, GW / 2, cy(480), gs)
    } else if (this.popupState === 'fail') {
      // Fail image
      if (imgOk(this.imgFail)) {
        this.drawImg(this.imgFail, GW / 2, GH / 2 - 100, 0, 500)
      }

      // Failure text
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `${56 * gs}px ${DEFAULT_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('You are not ready.', GW / 2 * gs, (GH / 2 + 200) * gs)
      ctx.font = `${44 * gs}px ${DEFAULT_FONT}`
      ctx.fillText('Practice more and try again later.', GW / 2 * gs, (GH / 2 + 270) * gs)

      // Score
      const numCorrect = this.answerResults.filter(Boolean).length
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `${48 * gs}px ${DEFAULT_FONT}`
      ctx.fillText(`${numCorrect} / ${this.problems.length} correct`, GW / 2 * gs, (GH / 2 + 340) * gs)

      // Back button
      this.drawPopupButton(this.imgPopupBack, this.imgPopupBackA, GW / 2, cy(480), gs)
    }
  }

  drawPopupButton(normalImg: HTMLImageElement, activeImg: HTMLImageElement, x: number, y: number, gs: number) {
    const img = normalImg
    if (imgOk(img)) {
      this.drawImg(img, x, y, 300, 0)
    } else {
      // Fallback button
      const { ctx } = this
      ctx.fillStyle = '#4CAF50'
      ctx.beginPath()
      ctx.roundRect((x - 150) * gs, (y - 60) * gs, 300 * gs, 120 * gs, 20 * gs)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `bold ${48 * gs}px ${DEFAULT_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('OK', x * gs, y * gs)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TEXT UTILITIES
  // ═══════════════════════════════════════════════════════════════

  wrapText(text: string, maxWidth: number): string[] {
    const { ctx } = this
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  drawWrappedText(text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const { ctx } = this
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)

    const totalHeight = lines.length * lineHeight
    const startY = y - totalHeight / 2 + lineHeight / 2

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, startY + i * lineHeight)
    }
  }
}
