import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/comprehensiontest')

interface CompQuestion {
  passage: string
  questionText: string
  choices: string[]
  correctIndex: number
}

interface ChoiceButton {
  x: number
  y: number
  w: number
  h: number
  text: string
  state: 'normal' | 'selected' | 'correct' | 'wrong'
  shakeTime: number
  bounceAnim: number
}

interface JsonQuestion {
  question: string
  choices: string[]
  answer: number
}

interface JsonLevelData {
  passage: string
  questions: JsonQuestion[]
}

async function loadQuestionsFromJson(level: number): Promise<CompQuestion[]> {
  try {
    const resp = await fetch('/data/games/comprehensiontest.json')
    const data = await resp.json()
    const levelData: JsonLevelData | undefined = data.levels[String(level)]
    if (!levelData) return []

    return levelData.questions.map(q => ({
      passage: levelData.passage,
      questionText: q.question,
      choices: q.choices,
      correctIndex: q.answer,
    }))
  } catch {
    return []
  }
}

export class ComprehensionTestEngine extends BaseEngine {
  level: number
  questions: CompQuestion[] = []
  currentQuestion = 0
  choiceButtons: ChoiceButton[] = []
  showResult: 'correct' | 'wrong' | null = null
  resultTimer = 0
  totalQuestions = 5
  solvedCount = 0
  transitioning = false

  bgImage: HTMLImageElement
  papersTopImage: HTMLImageElement
  papersBottomImage: HTMLImageElement
  choiceNormalImage: HTMLImageElement
  choiceCorrectImage: HTMLImageElement
  choiceWrongImage: HTMLImageElement

  sfxCorrect: HTMLAudioElement
  sfxWrong: HTMLAudioElement
  sfxPageTurn: HTMLAudioElement

  // Page turn animation state (C++ uses PageTurn3D)
  pageTurning = false
  pageTurnProgress = 0

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    // C++ background: ComprehensionTest/Common/_comprehenson_background.png
    this.bgImage = loadImage(`${ASSET_PATH}/common/_comprehenson_background.png`)
    // C++ paper: comprehensive_papers_top.png anchored MIDDLE_BOTTOM at (winSize.width/2, 0)
    this.papersTopImage = loadImage(`${ASSET_PATH}/common/comprehensive_papers_top.png`)
    // C++ paper bottom: comprehensive_papers_bottom.png anchored MIDDLE_BOTTOM at (winSize.width/2, 0)
    this.papersBottomImage = loadImage(`${ASSET_PATH}/common/comprehensive_papers_bottom.png`)
    // C++ answer button images from TextAnswerItem
    // comprehensivequiz_multiple_choice_longtext.png (normal)
    // comprehensivequiz_multiple_choice_longtext_right.png (correct)
    // comprehensivequiz_multiple_choice_longtext_wrong.png (wrong)
    this.choiceNormalImage = loadImage(`${ASSET_PATH}/multiplechoices/comprehension_multiplechoice_normal.png`)
    this.choiceCorrectImage = loadImage(`${ASSET_PATH}/multiplechoices/comprehension_multiplechoice_correct.png`)
    this.choiceWrongImage = loadImage(`${ASSET_PATH}/multiplechoices/comprehension_multiplechoice_wrong.png`)

    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    // C++ wrong sound: ComprehensionTest/MultipleChoices/sounds/card_miss.m4a
    this.sfxWrong = loadAudio(`${ASSET_PATH}/sounds/card_miss.m4a`)
    // C++ pageTurnEffect = "DoubleDigit/Card_Move_Right.m4a"
    this.sfxPageTurn = loadAudio(assetUrl('/assets/games/eggquiz/sounds/card_move_right.m4a'))
  }

  start() {
    super.start()
    this.loadLevel()
  }

  async loadLevel() {
    this.questions = await loadQuestionsFromJson(this.level)
    this.totalQuestions = this.questions.length
    this.currentQuestion = 0
    this.solvedCount = 0
    this.setupQuestion()
  }

  setupQuestion() {
    const q = this.questions[this.currentQuestion]
    if (!q) return

    this.showResult = null
    this.resultTimer = 0
    this.transitioning = false
    this.pageTurning = false
    this.pageTurnProgress = 0
    this.choiceButtons = []

    // C++ TextAnswerItem sizes:
    //   kLongContentSize = Size(2036, 180) for long text
    //   kDeaultContentSize = Size(1196, 180) for short text
    // C++ TextAndTextLayer positions answers at (contentSize.width/2, contentSize.height/2 - 100)
    //   with anchor MIDDLE, items stacked from top using item height
    // For web, we use the long size since passages have text answers
    const numChoices = q.choices.length
    const btnW = 2036
    const btnH = 180
    const gap = 0  // C++ stacks items directly (no gap in TextAndTextLayer)
    const totalH = numChoices * btnH + (numChoices - 1) * gap
    // C++ centers at fixedDeviceSize.height / 2 - 100 (bottom-up) = 1800/2 - 100 = 800
    // In top-down: 1800 - 800 = 1000 center
    const centerY = 1000
    const startY = centerY - totalH / 2
    const centerX = GAME_WIDTH / 2

    for (let i = 0; i < numChoices; i++) {
      this.choiceButtons.push({
        x: centerX,
        y: startY + i * (btnH + gap) + btnH / 2,
        w: btnW,
        h: btnH,
        text: q.choices[i],
        state: 'normal',
        shakeTime: 0,
        bounceAnim: 0,
      })
    }

    // C++ uses _progressBar->setCurrent(_currentProblem + 1)
    this.onProgressChange?.(this.currentQuestion + 1, this.totalQuestions)
  }

  onPointerDown(x: number, y: number) {
    // C++ behavior: wrong answers stay in wrong state, don't advance.
    // User must find the correct answer. Block input only during transitions.
    if (this.transitioning) return

    const q = this.questions[this.currentQuestion]
    if (!q) return

    for (let i = 0; i < this.choiceButtons.length; i++) {
      const btn = this.choiceButtons[i]
      // C++ TextAnswerItem: already Right or Wrong state items are ignored on click
      if (btn.state === 'correct' || btn.state === 'wrong') continue

      const halfW = btn.w / 2
      const halfH = btn.h / 2
      if (x >= btn.x - halfW && x <= btn.x + halfW && y >= btn.y - halfH && y <= btn.y + halfH) {
        if (i === q.correctIndex) {
          // C++ TextAndTextLayer: isCorrect -> solve -> setState(Right) -> isSolved -> onSolve
          btn.state = 'correct'
          this.showResult = 'correct'
          this.solvedCount++
          playSound(this.sfxCorrect)
          this.transitioning = true
          setTimeout(() => {
            this.advanceQuestion()
          }, 1200)
        } else {
          // C++ TextAnswerItem: setState(Wrong) plays card_miss sound
          // Wrong answers stay in Wrong state - user must find the right one
          btn.state = 'wrong'
          btn.shakeTime = 0.4
          playSound(this.sfxWrong)
          // Do NOT set this.showResult = 'wrong' globally - only this button shows wrong
          // Do NOT reset - C++ keeps wrong state permanently until question is solved
        }
        break
      }
    }
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  advanceQuestion() {
    if (this.currentQuestion < this.questions.length - 1) {
      // C++ page turn: pageTurnEffect sound, PageTurn3D animation (1.5s delay)
      playSound(this.sfxPageTurn)
      this.pageTurning = true
      this.pageTurnProgress = 0
      this.currentQuestion++
      setTimeout(() => {
        this.setupQuestion()
      }, 800)
    } else {
      // C++ shows CompletePopup on completion
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  update(_time: number, dt: number) {
    for (const btn of this.choiceButtons) {
      if (btn.shakeTime > 0) {
        btn.shakeTime = Math.max(0, btn.shakeTime - dt)
      }
      if (btn.state === 'correct') {
        btn.bounceAnim = Math.min(btn.bounceAnim + dt * 3, 1)
      }
    }
    if (this.showResult) {
      this.resultTimer += dt
    }
    if (this.pageTurning) {
      this.pageTurnProgress = Math.min(this.pageTurnProgress + dt / 0.8, 1)
      if (this.pageTurnProgress >= 1) {
        this.pageTurning = false
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

    // C++: paperBottom is drawn first, anchored MIDDLE_BOTTOM at (winSize.width/2, 0)
    if (imgOk(this.papersBottomImage)) {
      const pbw = this.papersBottomImage.width
      const pbh = this.papersBottomImage.height
      const pbScale = GAME_WIDTH / pbw
      ctx.drawImage(
        this.papersBottomImage,
        0,
        (GAME_HEIGHT - pbh * pbScale) * gs,
        GAME_WIDTH * gs,
        pbh * pbScale * gs
      )
    }

    // C++: papersTop is part of the page grid, anchored MIDDLE_BOTTOM at (winSize.width/2, 0)
    if (imgOk(this.papersTopImage)) {
      const ptw = this.papersTopImage.width
      const pth = this.papersTopImage.height
      const ptScale = GAME_WIDTH / ptw
      ctx.drawImage(
        this.papersTopImage,
        0,
        (GAME_HEIGHT - pth * ptScale) * gs,
        GAME_WIDTH * gs,
        pth * ptScale * gs
      )
    }

    const q = this.questions[this.currentQuestion]
    if (q) {
      this.drawPassageArea(q, gs)
      this.drawChoices(gs)
    }

    // Subtle correct overlay
    if (this.showResult === 'correct' && this.resultTimer > 0.3) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.12)'
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)
    }

    // Page turn visual effect
    if (this.pageTurning && this.pageTurnProgress < 1) {
      ctx.save()
      const alpha = 1 - this.pageTurnProgress
      ctx.globalAlpha = alpha * 0.3
      ctx.fillStyle = '#D4C5A9'
      const curtainX = GAME_WIDTH * gs * (1 - this.pageTurnProgress)
      ctx.fillRect(curtainX, 0, GAME_WIDTH * gs - curtainX, GAME_HEIGHT * gs)
      ctx.restore()
    }

    ctx.restore()
  }

  drawPassageArea(q: CompQuestion, gs: number) {
    const { ctx } = this

    // C++ question title area:
    // drawQuestionTitle uses comprehention_question_highlight.png at (200, height-300)
    // Question text: Aileron-Regular, 65pt, Color4B(56, 56, 56, 255) = #383838
    // C++ MultipleChoicesScene::createFixedResources places questionLabel at
    //   (gameNode.width/2, gameNode.height - 450) with anchor MIDDLE
    // In top-down: 450 from top

    // Question highlight / direction area at top
    // C++ drawQuestionTitle at y = parentNode.height - 300 (bottom-up) = 300 from top (top-down)
    const directionY = 230
    ctx.fillStyle = '#383838'
    ctx.font = `${50 * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Select the correct answer.', GAME_WIDTH / 2 * gs, directionY * gs)

    // Passage text - displayed as the question context
    // C++ questionLabel at (width/2, height-450) -> top-down: 450 from top
    const passageY = 420
    ctx.fillStyle = '#383838'
    ctx.font = `${65 * gs}px TodoMainCurly, serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const maxW = 1800 * gs
    const passageLines = this.wrapText(q.passage, maxW, gs, 65)
    for (let i = 0; i < passageLines.length; i++) {
      ctx.fillText(passageLines[i], GAME_WIDTH / 2 * gs, (passageY + i * 80) * gs)
    }

    // Question text below passage
    const questionStartY = passageY + passageLines.length * 80 + 60
    ctx.fillStyle = '#383838'
    ctx.font = `bold ${65 * gs}px TodoMainCurly, sans-serif`
    const questionLines = this.wrapText(q.questionText, maxW, gs, 65)
    for (let i = 0; i < questionLines.length; i++) {
      ctx.fillText(questionLines[i], GAME_WIDTH / 2 * gs, (questionStartY + i * 80) * gs)
    }
  }

  wrapText(text: string, maxWidth: number, gs: number, fontSize: number): string[] {
    const { ctx } = this
    ctx.font = `${fontSize * gs}px TodoMainCurly, sans-serif`
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

  drawChoices(gs: number) {
    const { ctx } = this
    // C++ letter labels: kLetterArray = ["A", "B", "C", "D", "E", "F", "G"]
    const letterLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

    for (let i = 0; i < this.choiceButtons.length; i++) {
      const btn = this.choiceButtons[i]
      ctx.save()

      let bx = btn.x * gs
      const by = btn.y * gs
      const halfW = (btn.w / 2) * gs
      const halfH = (btn.h / 2) * gs

      // Shake animation for wrong answers
      if (btn.shakeTime > 0) {
        const shake = Math.sin(btn.shakeTime * 40) * 10 * gs * (btn.shakeTime / 0.4)
        bx += shake
      }

      // Bounce for correct
      let yOffset = 0
      if (btn.state === 'correct') {
        yOffset = -Math.sin(btn.bounceAnim * Math.PI) * 15 * gs
      }

      // Draw choice background using C++ image assets or fallback
      // C++ uses different sprites for normal/right/wrong states
      let useImage: HTMLImageElement | null = null
      if (btn.state === 'correct' && imgOk(this.choiceCorrectImage)) {
        useImage = this.choiceCorrectImage
      } else if (btn.state === 'wrong' && imgOk(this.choiceWrongImage)) {
        useImage = this.choiceWrongImage
      } else if (imgOk(this.choiceNormalImage)) {
        useImage = this.choiceNormalImage
      }

      if (useImage) {
        ctx.drawImage(useImage, bx - halfW, by - halfH + yOffset, halfW * 2, halfH * 2)
      } else {
        // Fallback rounded rect
        const bgColor = btn.state === 'correct' ? '#C8E6C9'
          : btn.state === 'wrong' ? '#FFCDD2'
          : '#FFFFFF'
        ctx.fillStyle = bgColor
        ctx.shadowColor = 'rgba(0,0,0,0.12)'
        ctx.shadowBlur = 8 * gs
        ctx.beginPath()
        ctx.roundRect(bx - halfW, by - halfH + yOffset, halfW * 2, halfH * 2, 16 * gs)
        ctx.fill()
        ctx.shadowColor = 'transparent'

        const borderColor = btn.state === 'correct' ? '#4CAF50'
          : btn.state === 'wrong' ? '#F44336'
          : '#B0BEC5'
        ctx.strokeStyle = borderColor
        ctx.lineWidth = 3 * gs
        ctx.stroke()
      }

      // Choice letter (A, B, C...)
      // C++ colors: kNormalLetterColor = Color4B(7, 171, 24, 255) = green
      //             kWrongLetterColor = Color4B(148, 148, 148, 255) = gray
      //             When correct: letter is hidden, checkSprite shown instead
      const letter = letterLabels[i]
      if (btn.state === 'correct') {
        // C++ shows checkSprite (comprehensivequiz_correct_check.png) at position 50
        // We draw a green checkmark instead
        ctx.fillStyle = '#FFFFFF'
        ctx.font = `bold ${70 * gs}px sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText('\u2713', bx - halfW + 50 * gs, by + yOffset)
      } else if (btn.state === 'wrong') {
        // C++ wrongLetterLabel: kWrongLetterColor = #949494
        ctx.fillStyle = '#949494'
        ctx.font = `bold ${70 * gs}px TodoSchoolV2, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(letter, bx - halfW + 50 * gs, by + yOffset)
      } else {
        // C++ normalLetterLabel: kNormalLetterColor = Color4B(7, 171, 24, 255) = #07AB18
        ctx.fillStyle = '#07AB18'
        ctx.font = `bold ${70 * gs}px TodoSchoolV2, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(letter, bx - halfW + 50 * gs, by + yOffset)
      }

      // Choice text - C++ font: TodoSchoolV2, size 50
      // C++ colors: kNormalAnswerColor = #383838, kRightAnswerColor = #FFFFFF, kWrongAnswerColor = #949494
      if (btn.state === 'correct') {
        ctx.fillStyle = '#FFFFFF'
      } else if (btn.state === 'wrong') {
        ctx.fillStyle = '#949494'
      } else {
        ctx.fillStyle = '#383838'
      }
      ctx.font = `${50 * gs}px TodoSchoolV2, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'

      // C++ text position: 150 from left edge
      const textMaxW = (btn.w - 200) * gs
      const choiceText = btn.text
      if (ctx.measureText(choiceText).width > textMaxW) {
        ctx.font = `${38 * gs}px TodoSchoolV2, sans-serif`
      }
      ctx.fillText(choiceText, bx - halfW + 150 * gs, by + yOffset)

      ctx.restore()
    }
  }
}
