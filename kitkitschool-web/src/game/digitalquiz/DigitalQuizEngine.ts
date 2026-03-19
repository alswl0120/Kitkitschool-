import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

// DigitalQuiz: Pre/post assessment quiz with various question types

interface Question {
  question: string
  choices: string[]
  answer: number
  type: 'math' | 'reading' | 'vocabulary'
}

export const LEVEL_DATA: Record<number, Question[]> = {
  1: [
    { question: '1 + 1 = ?', choices: ['1', '2', '3', '4'], answer: 1, type: 'math' },
    { question: '2 + 2 = ?', choices: ['3', '4', '5', '6'], answer: 1, type: 'math' },
    { question: '3 - 1 = ?', choices: ['1', '2', '3', '4'], answer: 1, type: 'math' },
    { question: 'Which is the letter A?', choices: ['B', 'A', 'C', 'D'], answer: 1, type: 'reading' },
    { question: '5 - 3 = ?', choices: ['1', '2', '3', '4'], answer: 1, type: 'math' },
  ],
  2: [
    { question: '4 + 3 = ?', choices: ['6', '7', '8', '9'], answer: 1, type: 'math' },
    { question: '8 - 5 = ?', choices: ['2', '3', '4', '5'], answer: 1, type: 'math' },
    { question: 'Which word is "cat"?', choices: ['dog', 'cat', 'bat', 'rat'], answer: 1, type: 'reading' },
    { question: '6 + 4 = ?', choices: ['9', '10', '11', '12'], answer: 1, type: 'math' },
    { question: '9 - 7 = ?', choices: ['1', '2', '3', '4'], answer: 1, type: 'math' },
  ],
  3: [
    { question: '12 + 5 = ?', choices: ['16', '17', '18', '19'], answer: 1, type: 'math' },
    { question: '15 - 8 = ?', choices: ['6', '7', '8', '9'], answer: 1, type: 'math' },
    { question: 'Opposite of "hot"?', choices: ['warm', 'cold', 'cool', 'nice'], answer: 1, type: 'vocabulary' },
    { question: '20 - 11 = ?', choices: ['8', '9', '10', '11'], answer: 1, type: 'math' },
    { question: '7 + 9 = ?', choices: ['15', '16', '17', '18'], answer: 1, type: 'math' },
  ],
  4: [
    { question: '25 + 18 = ?', choices: ['42', '43', '44', '45'], answer: 1, type: 'math' },
    { question: '50 - 23 = ?', choices: ['26', '27', '28', '29'], answer: 1, type: 'math' },
    { question: 'Synonym of "big"?', choices: ['tiny', 'large', 'small', 'thin'], answer: 1, type: 'vocabulary' },
    { question: '3 x 4 = ?', choices: ['10', '12', '14', '16'], answer: 1, type: 'math' },
    { question: '36 + 47 = ?', choices: ['82', '83', '84', '85'], answer: 1, type: 'math' },
  ],
  5: [
    { question: '6 x 7 = ?', choices: ['40', '42', '44', '48'], answer: 1, type: 'math' },
    { question: '81 / 9 = ?', choices: ['7', '8', '9', '10'], answer: 2, type: 'math' },
    { question: 'Past tense of "run"?', choices: ['runned', 'ran', 'running', 'runs'], answer: 1, type: 'vocabulary' },
    { question: '100 - 45 = ?', choices: ['54', '55', '56', '57'], answer: 1, type: 'math' },
    { question: '8 x 9 = ?', choices: ['70', '72', '74', '76'], answer: 1, type: 'math' },
  ],
  6: [
    { question: '125 + 89 = ?', choices: ['213', '214', '215', '216'], answer: 1, type: 'math' },
    { question: '200 - 76 = ?', choices: ['123', '124', '125', '126'], answer: 1, type: 'math' },
    { question: 'A noun is a...', choices: ['action', 'person/place/thing', 'description', 'connector'], answer: 1, type: 'reading' },
    { question: '12 x 11 = ?', choices: ['130', '132', '134', '136'], answer: 1, type: 'math' },
    { question: '256 - 128 = ?', choices: ['126', '128', '130', '132'], answer: 1, type: 'math' },
  ],
  7: [
    { question: '15 x 12 = ?', choices: ['170', '175', '180', '185'], answer: 2, type: 'math' },
    { question: '1000 - 437 = ?', choices: ['562', '563', '564', '565'], answer: 1, type: 'math' },
    { question: 'Which is a verb?', choices: ['happy', 'run', 'blue', 'fast'], answer: 1, type: 'reading' },
    { question: '144 / 12 = ?', choices: ['10', '11', '12', '13'], answer: 2, type: 'math' },
    { question: '23 x 15 = ?', choices: ['335', '340', '345', '350'], answer: 2, type: 'math' },
  ],
  8: [
    { question: '3/4 + 1/4 = ?', choices: ['1/2', '1', '3/4', '2'], answer: 1, type: 'math' },
    { question: '2.5 + 3.7 = ?', choices: ['5.2', '6.2', '6.3', '7.2'], answer: 1, type: 'math' },
    { question: 'An adjective describes a...', choices: ['verb', 'noun', 'sentence', 'paragraph'], answer: 1, type: 'reading' },
    { question: '500 x 3 = ?', choices: ['1200', '1500', '1800', '2000'], answer: 1, type: 'math' },
    { question: '7.5 - 2.3 = ?', choices: ['4.2', '5.2', '5.3', '6.2'], answer: 1, type: 'math' },
  ],
  9: [
    { question: '45% of 200 = ?', choices: ['80', '85', '90', '95'], answer: 2, type: 'math' },
    { question: '3² + 4² = ?', choices: ['20', '24', '25', '30'], answer: 2, type: 'math' },
    { question: 'A metaphor is...', choices: ['a comparison using like', 'a direct comparison', 'exaggeration', 'repetition'], answer: 1, type: 'reading' },
    { question: '√144 = ?', choices: ['10', '11', '12', '14'], answer: 2, type: 'math' },
    { question: '1/3 of 90 = ?', choices: ['25', '30', '35', '40'], answer: 1, type: 'math' },
  ],
  10: [
    { question: '15² = ?', choices: ['215', '220', '225', '230'], answer: 2, type: 'math' },
    { question: '1000 / 25 = ?', choices: ['35', '40', '45', '50'], answer: 1, type: 'math' },
    { question: 'Which is an adverb?', choices: ['quick', 'quickly', 'quicker', 'quickest'], answer: 1, type: 'reading' },
    { question: '2/3 + 1/6 = ?', choices: ['3/6', '5/6', '1', '4/6'], answer: 1, type: 'math' },
    { question: '0.75 x 100 = ?', choices: ['7.5', '70', '75', '750'], answer: 2, type: 'math' },
  ],
}

export class DigitalQuizEngine extends BaseEngine {
  level: number
  questions: Question[] = []
  currentQuestion = 0
  solvedCount = 0
  totalQuestions = 5

  selectedAnswer = -1
  showResult: 'correct' | 'wrong' | null = null
  resultTimer = 0

  // C++ fade transition state
  fadeAlpha = 0
  fading = false

  bgImage: HTMLImageElement
  sfxCorrect: HTMLAudioElement
  sfxWrong: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.questions = LEVEL_DATA[level] || LEVEL_DATA[1]
    this.totalQuestions = this.questions.length

    // C++ uses DigitalQuiz/Background/digitalquiz_background.png
    this.bgImage = loadImage(assetUrl('/assets/games/equationmaker/equationmaker_bg_sky.jpg'))
    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxWrong = loadAudio(assetUrl('/assets/games/eggquiz/sounds/c3.m4a'))
  }

  start() {
    super.start()
    this.currentQuestion = 0
    this.solvedCount = 0
    this.selectedAnswer = -1
    this.showResult = null
    this.onProgressChange?.(1, this.totalQuestions)
  }

  getChoiceRects(): { x: number; y: number; w: number; h: number }[] {
    const q = this.questions[this.currentQuestion]
    if (!q) return []

    const rects: { x: number; y: number; w: number; h: number }[] = []
    // C++ AnswerTextButton Large skin images are ~600x300 area
    // C++ places answer buttons centered in the lower portion of gameSize
    // C++ font size on buttons is 180pt, but we use smaller buttons with 50pt text
    const choiceW = 900
    const choiceH = 160
    const gap = 28
    const totalH = q.choices.length * (choiceH + gap) - gap
    // C++ answer area is roughly in the lower 60% of screen
    const startY = GAME_HEIGHT * 0.35 + (GAME_HEIGHT * 0.55 - totalH) / 2
    const startX = (GAME_WIDTH - choiceW) / 2

    for (let i = 0; i < q.choices.length; i++) {
      rects.push({
        x: startX,
        y: startY + i * (choiceH + gap),
        w: choiceW,
        h: choiceH,
      })
    }
    return rects
  }

  onPointerDown(x: number, y: number) {
    if (this.showResult) return

    const rects = this.getChoiceRects()
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.selectedAnswer = i
        this.checkAnswer(i)
        return
      }
    }
  }

  checkAnswer(index: number) {
    const q = this.questions[this.currentQuestion]
    const isCorrect = index === q.answer

    if (isCorrect) {
      this.showResult = 'correct'
      this.solvedCount++
      playSound(this.sfxCorrect)
    } else {
      this.showResult = 'wrong'
      playSound(this.sfxWrong)
    }

    // C++ flow: handleAnyAnswer -> EaseIn FadeOut .2f -> prepareNextProblem -> beginTheProblem
    // Then EaseIn FadeIn .2f for the new stage. Total transition ~0.4s
    // Using slightly longer delay for web UX feedback
    this.fading = true
    this.fadeAlpha = 0
    setTimeout(() => {
      this.currentQuestion++
      this.selectedAnswer = -1
      this.showResult = null
      this.fading = false
      this.fadeAlpha = 0
      if (this.currentQuestion >= this.totalQuestions) {
        this.gameState = 'complete'
        this.onComplete?.()
      } else {
        this.onProgressChange?.(this.currentQuestion + 1, this.totalQuestions)
      }
    }, 600)
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  update(_time: number, dt: number) {
    if (this.showResult) this.resultTimer += dt
    // C++ fade transition: EaseIn FadeOut over .2f seconds
    if (this.fading) {
      this.fadeAlpha = Math.min(this.fadeAlpha + dt / 0.3, 1)
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Clean assessment background
    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, '#E3F2FD')
    gradient.addColorStop(1, '#BBDEFB')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    const q = this.questions[this.currentQuestion]
    if (!q) { ctx.restore(); return }

    // Question number - C++ default color: Color3B(23, 163, 232) light blue
    ctx.fillStyle = '#17A3E8'
    ctx.font = `bold ${40 * gs}px TodoSchoolV2, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`Question ${this.currentQuestion + 1} of ${this.totalQuestions}`,
      GAME_WIDTH / 2 * gs, 100 * gs)

    // Type badge - C++ default color: Color3B(23, 163, 232)
    const typeColors = { math: '#4CAF50', reading: '#17A3E8', vocabulary: '#FF9800' }
    ctx.fillStyle = typeColors[q.type]
    const badgeW = 200 * gs
    ctx.beginPath()
    ctx.roundRect((GAME_WIDTH / 2 - 100) * gs, 140 * gs, badgeW, 50 * gs, 25 * gs)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${26 * gs}px TodoSchoolV2, Arial`
    ctx.fillText(q.type.toUpperCase(), GAME_WIDTH / 2 * gs, 165 * gs)

    // Question text - C++ font size 90, default color Color3B(23, 163, 232)
    ctx.fillStyle = '#17A3E8'
    ctx.font = `bold ${90 * gs}px TodoSchoolV2, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(q.question, GAME_WIDTH / 2 * gs, 320 * gs)

    // Choice buttons
    const rects = this.getChoiceRects()
    const labels = ['A', 'B', 'C', 'D']

    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      const rx = r.x * gs, ry = r.y * gs, rw = r.w * gs, rh = r.h * gs

      let bgColor = '#fff'
      let borderColor = '#E0E0E0'

      if (this.selectedAnswer === i) {
        if (this.showResult === 'correct') {
          // C++ highlight color: Color3B(252, 105, 134) pink
          bgColor = '#FCE4EC'; borderColor = '#FC6986'
        } else if (this.showResult === 'wrong') {
          bgColor = '#FFCDD2'; borderColor = '#F44336'
        }
      }

      ctx.fillStyle = bgColor
      ctx.shadowColor = 'rgba(0,0,0,0.1)'
      ctx.shadowBlur = 8 * gs
      ctx.beginPath()
      ctx.roundRect(rx, ry, rw, rh, 16 * gs)
      ctx.fill()
      ctx.shadowColor = 'transparent'

      ctx.strokeStyle = borderColor
      ctx.lineWidth = 3 * gs
      ctx.stroke()

      // Label circle - C++ default color: Color3B(23, 163, 232)
      ctx.fillStyle = '#17A3E8'
      ctx.beginPath()
      ctx.arc(rx + 60 * gs, ry + rh / 2, 30 * gs, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${28 * gs}px TodoSchoolV2, Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(labels[i], rx + 60 * gs, ry + rh / 2)

      // Choice text - C++ button title font size: 50
      ctx.fillStyle = '#383838'
      ctx.font = `${50 * gs}px TodoSchoolV2, Arial, sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(q.choices[i], rx + 120 * gs, ry + rh / 2)
    }

    // Score - C++ default color: Color3B(23, 163, 232)
    ctx.fillStyle = '#17A3E8'
    ctx.font = `bold ${32 * gs}px TodoSchoolV2, Arial`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`Score: ${this.solvedCount}/${this.totalQuestions}`,
      (GAME_WIDTH - 80) * gs, 80 * gs)

    // C++ fade transition overlay (EaseIn FadeOut effect)
    if (this.fading && this.fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha * 0.4})`
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)
    }

    ctx.restore()
  }
}
