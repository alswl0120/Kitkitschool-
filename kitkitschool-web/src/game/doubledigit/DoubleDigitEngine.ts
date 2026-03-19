import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

// C++: DoubleDigitScene uses gameSize = Size(2560, 1800) for game scaling
// C++: defaultGameSize = Size(2048, 1440) defined but gameSize = Size(2560, 1800) used in init

interface Problem {
  lhs: string
  op: string
  rhs: string
  answer: string
}

export class DoubleDigitEngine extends BaseEngine {
  level: number
  problems: Problem[] = []
  currentProblem = 0
  totalProblems = 5
  solvedCount = 0

  // C++: Single answerString, compared as string against problem answer
  answerString = ''
  expectedAnswer = ''

  showResult: 'correct' | 'wrong' | null = null
  resultTimer = 0

  // C++: notepad size 1228x1612
  readonly NOTE_W = 1228
  readonly NOTE_H = 1612

  // C++ AnswerPad: uses counting_image_numberpad_bg.png
  // C++ panelSize = Size(286, 174), grid 4x3, buttons are button_inactive/button_active
  readonly BTN_W = 286
  readonly BTN_H = 174
  readonly BTN_GAP = 10

  bgImage: HTMLImageElement
  sfxCorrect: HTMLAudioElement
  sfxWrong: HTMLAudioElement
  sfxTouch: HTMLAudioElement
  sfxPageTurn: HTMLAudioElement

  // Images
  answerPadBgImage: HTMLImageElement
  notePadBgImage: HTMLImageElement
  notePadTopImage: HTMLImageElement
  notePadBindingImage: HTMLImageElement
  btnInactive: HTMLImageElement
  btnActive: HTMLImageElement

  // Page turn animation state
  pageTurnProgress = 0
  pageTurnActive = false

  // Scratch pad strokes
  strokes: { x: number; y: number }[][] = []
  currentStroke: { x: number; y: number }[] | null = null
  isDrawing = false

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(assetUrl('/assets/games/doubledigit/multidigit_background.png'))
    this.answerPadBgImage = loadImage(assetUrl('/assets/games/counting/counting_image_numberpad_bg.png'))
    this.notePadBgImage = loadImage(assetUrl('/assets/games/doubledigit/multidigit_notepad.png'))
    this.notePadTopImage = loadImage(assetUrl('/assets/games/doubledigit/multidigit_toppage.png'))
    this.notePadBindingImage = loadImage(assetUrl('/assets/games/doubledigit/multidigit_binding.png'))
    this.btnInactive = loadImage(assetUrl('/assets/games/doubledigit/button_inactive.png'))
    this.btnActive = loadImage(assetUrl('/assets/games/doubledigit/button_active.png'))
    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxWrong = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxTouch = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxPageTurn = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
  }

  start() {
    super.start()
    this.loadLevel()
  }

  async loadLevel() {
    try {
      const resp = await fetch('/data/games/doubledigit.json')
      const data = await resp.json()
      const config = data.levels[String(this.level)]
      if (config) {
        this.generateProblemsFromConfig(config)
      } else {
        this.generateFallbackProblems()
      }
    } catch {
      this.generateFallbackProblems()
    }
    this.totalProblems = this.problems.length
    this.setupProblem()
  }

  // C++: DoubleDigit_ProblemBank generates 5 problems per level with specific constraints
  // We replicate the per-level logic as closely as possible
  generateProblemsFromConfig(config: { type: string; digits1: number; digits2: number; maxNum: number }) {
    this.problems = []

    for (let i = 0; i < 5; i++) {
      let num1: number, num2: number, op: string, answer: number
      const isAdd = config.type === 'addition' || (config.type === 'mixed' && i % 2 === 0)

      if (isAdd) {
        // C++ addition generation
        const maxA = Math.pow(10, config.digits1) - 1
        const minA = Math.pow(10, config.digits1 - 1)
        num1 = this.randInt(minA, Math.min(maxA, config.maxNum - 1))
        const maxB = Math.min(Math.pow(10, config.digits2) - 1, config.maxNum - num1)
        num2 = this.randInt(1, Math.max(1, maxB))
        op = '+'
        answer = num1 + num2
      } else {
        // C++ subtraction generation
        const maxA = Math.pow(10, config.digits1) - 1
        const minA = Math.pow(10, config.digits1 - 1)
        num1 = this.randInt(minA + 1, Math.min(maxA, config.maxNum))
        const maxB = Math.min(Math.pow(10, config.digits2) - 1, num1 - 1)
        num2 = this.randInt(1, Math.max(1, maxB))
        op = '-'
        answer = num1 - num2
      }

      this.problems.push({
        lhs: String(num1),
        op,
        rhs: String(num2),
        answer: String(answer),
      })
    }
  }

  generateFallbackProblems() {
    this.problems = []
    for (let i = 0; i < 5; i++) {
      const a = this.randInt(10, 50)
      const b = this.randInt(1, 9)
      this.problems.push({
        lhs: String(a),
        op: '+',
        rhs: String(b),
        answer: String(a + b),
      })
    }
  }

  randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  setupProblem() {
    if (this.currentProblem >= this.problems.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    const prob = this.problems[this.currentProblem]
    this.expectedAnswer = prob.answer
    this.answerString = ''
    this.showResult = null
    this.resultTimer = 0
    this.strokes = []
    this.currentStroke = null
    this.isDrawing = false
    this.pageTurnActive = false
    this.pageTurnProgress = 0

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  // C++: AnswerPad at (winSize.width*0.25, winSize.height*0.5)
  // uses counting_image_numberpad_bg.png as background
  // panelSize = Size(286, 174), grid 4x3
  // Buttons: i from -2 to 9
  //   i>=1: numbers, positions from panelPos formula
  //   i=0: zero at panelPos(row=3, col=1) -- center bottom
  //   i=-1: clear (backspace) at panelPos(row=3, col=0) -- left bottom
  //   i=-2: enter at panelPos(row=3, col=2) -- right bottom
  // panelPos(row,col): x = col*(btnW+gap) + btnW/2 + panelAreaMargin
  //                    y = (gap+btnH)*(rowCount-row-1) + btnH/2 + panelAreaMargin
  getNumPadButtons(): { label: string; x: number; y: number; w: number; h: number; tag: number }[] {
    const buttons: { label: string; x: number; y: number; w: number; h: number; tag: number }[] = []
    const btnW = this.BTN_W
    const btnH = this.BTN_H
    const gap = this.BTN_GAP
    const colCount = 3
    const rowCount = 4

    // C++: answerPad centered at (GAME_WIDTH*0.25, GAME_HEIGHT*0.5)
    // answerPadBg size determines content area. Use image natural size or estimate.
    // The pad bg is the counting_image_numberpad_bg.png - approximately 958x1362
    const padW = 958
    const padH = 1362
    const padCenterX = GAME_WIDTH * 0.25
    const padCenterY = GAME_HEIGHT * 0.5
    const padLeft = padCenterX - padW / 2
    const padTop = padCenterY - padH / 2

    // C++: panelAreaSize = Size(btnW*3 + gap*2, btnH*4 + gap*3)
    const panelAreaW = btnW * colCount + gap * (colCount - 1)
    const panelAreaMargin = (padW - panelAreaW) / 2

    // C++ panelPos(row, col):
    // x = col * (btnW + gap) + btnW/2 + panelAreaMargin  (from pad left)
    // y = (gap + btnH) * (rowCount - row - 1) + btnH/2 + panelAreaMargin  (from pad bottom, cocos)
    // Convert to screen: screenY = padTop + padH - cocosY

    const panelPos = (row: number, col: number) => {
      const localX = col * (btnW + gap) + btnW / 2 + panelAreaMargin
      const localY_cocos = (gap + btnH) * (rowCount - row - 1) + btnH / 2 + panelAreaMargin
      return {
        x: padLeft + localX,
        y: padTop + padH - localY_cocos,
      }
    }

    // Numbers 1-9 using C++ formula: btnPos = panelPos((9-i)/3, 3-(9-i)%3-1)
    for (let i = 1; i <= 9; i++) {
      const row = Math.floor((9 - i) / colCount)
      const col = colCount - ((9 - i) % colCount) - 1
      const pos = panelPos(row, col)
      buttons.push({
        label: String(i), tag: i,
        x: pos.x - btnW / 2, y: pos.y - btnH / 2,
        w: btnW, h: btnH,
      })
    }

    // i=0: zero at panelPos(rowCount-1, 1)
    {
      const pos = panelPos(rowCount - 1, 1)
      buttons.push({
        label: '0', tag: 0,
        x: pos.x - btnW / 2, y: pos.y - btnH / 2,
        w: btnW, h: btnH,
      })
    }

    // i=-1: clear/backspace at panelPos(rowCount-1, 0)
    {
      const pos = panelPos(rowCount - 1, 0)
      buttons.push({
        label: '\u232B', tag: -1,
        x: pos.x - btnW / 2, y: pos.y - btnH / 2,
        w: btnW, h: btnH,
      })
    }

    // i=-2: enter at panelPos(rowCount-1, 2)
    {
      const pos = panelPos(rowCount - 1, 2)
      buttons.push({
        label: '\u21B5', tag: -2,
        x: pos.x - btnW / 2, y: pos.y - btnH / 2,
        w: btnW, h: btnH,
      })
    }

    return buttons
  }

  // C++ notepad area for scratch drawing
  getNotepadRect() {
    const noteX = GAME_WIDTH * 0.75 - this.NOTE_W / 2
    const noteY = GAME_HEIGHT * 0.5 - this.NOTE_H / 2
    // C++ sketchAreaRect(50, 150, 1128, 1230) relative to notepad
    return {
      x: noteX + 50,
      y: noteY + this.NOTE_H - 150 - 1230,  // convert cocos Y
      w: 1128,
      h: 1230,
    }
  }

  onPointerDown(x: number, y: number) {
    if (this.showResult) return
    if (this.pageTurnActive) return

    // Check number pad buttons first
    const buttons = this.getNumPadButtons()
    for (const btn of buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.handleButtonPress(btn.tag)
        return
      }
    }

    // Check if touch is in scratch pad area (notepad)
    const noteRect = this.getNotepadRect()
    if (x >= noteRect.x && x <= noteRect.x + noteRect.w &&
        y >= noteRect.y && y <= noteRect.y + noteRect.h) {
      this.isDrawing = true
      this.currentStroke = [{ x, y }]
    }
  }

  handleButtonPress(tag: number) {
    if (tag === -2) {
      // Enter: C++ handleAnswerEntered
      this.checkAnswer()
    } else if (tag === -1) {
      // Clear/Backspace: C++ removes last character
      if (this.answerString.length > 0) {
        this.answerString = this.answerString.slice(0, -1)
      }
    } else {
      // Number digit: C++ max 4 chars (answerString.size() <= 4)
      if (this.answerString.length <= 4) {
        this.answerString += String(tag)
      }
    }
  }

  checkAnswer() {
    if (!this.answerString) return
    // C++: string comparison: problems[numSolved]["answer"].asString().compare(answer)
    if (this.answerString === this.expectedAnswer) {
      this.showResult = 'correct'
      this.solvedCount++
      playSound(this.sfxCorrect)
      // C++: scheduleOnce(onSolved, 0.2), then showAnswer, then showComplete(0.8)
      // then turningPageAnimation (1.5s page turn + delay)
      setTimeout(() => {
        this.pageTurnActive = true
        this.pageTurnProgress = 0
        // After page turn duration
        setTimeout(() => {
          this.pageTurnActive = false
          this.currentProblem++
          this.setupProblem()
        }, 1500)
      }, 1000)
    } else {
      // C++: plays missEffect, clears answerString, refreshes label
      this.showResult = 'wrong'
      playSound(this.sfxWrong)
      setTimeout(() => {
        this.showResult = null
        this.answerString = ''
      }, 800)
    }
  }

  onPointerMove(x: number, y: number) {
    if (this.isDrawing && this.currentStroke) {
      const noteRect = this.getNotepadRect()
      // C++: clamp to sketch area
      const cx = Math.max(noteRect.x, Math.min(noteRect.x + noteRect.w, x))
      const cy = Math.max(noteRect.y, Math.min(noteRect.y + noteRect.h, y))
      this.currentStroke.push({ x: cx, y: cy })
    }
  }

  onPointerUp(_x: number, _y: number) {
    if (this.isDrawing && this.currentStroke && this.currentStroke.length > 1) {
      this.strokes.push(this.currentStroke)
    }
    this.currentStroke = null
    this.isDrawing = false
  }

  update(_time: number, dt: number) {
    if (this.showResult) this.resultTimer += dt
    if (this.pageTurnActive) {
      this.pageTurnProgress = Math.min(this.pageTurnProgress + dt / 1.5, 1)
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // C++: Background is multidigit_background.png
    this.drawBackgroundImage(this.bgImage, w, h)

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    if (this.problems.length === 0) { ctx.restore(); return }
    const prob = this.problems[this.currentProblem]
    if (!prob) { ctx.restore(); return }

    // Draw notepad on right side
    this.drawNotePad(gs)
    // Draw scratch strokes on notepad
    this.drawStrokes(gs)
    // Draw vertical equation on notepad
    this.drawVerticalEquation(prob, gs)
    // Draw answer on notepad if correct
    if (this.showResult === 'correct') {
      this.drawAnswerOnNotePad(prob, gs)
    }

    // Draw answer pad background on left side
    this.drawAnswerPadBg(gs)
    // Draw answer label on pad
    this.drawAnswerLabel(gs)
    // Draw number pad buttons
    this.drawNumPad(gs)

    // Result overlay
    if (this.showResult) {
      ctx.fillStyle = this.showResult === 'correct'
        ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)'
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)
    }

    ctx.restore()
  }

  drawNotePad(gs: number) {
    const { ctx } = this
    // C++: notePad at (winSize.width*0.75, winSize.height*0.5), size 1228x1612
    const noteX = GAME_WIDTH * 0.75 - this.NOTE_W / 2
    const noteY = GAME_HEIGHT * 0.5 - this.NOTE_H / 2

    if (imgOk(this.notePadBgImage)) {
      ctx.drawImage(this.notePadBgImage, noteX * gs, noteY * gs, this.NOTE_W * gs, this.NOTE_H * gs)
    }
    if (imgOk(this.notePadTopImage)) {
      ctx.drawImage(this.notePadTopImage, noteX * gs, noteY * gs, this.NOTE_W * gs, this.NOTE_H * gs)
    }
    if (imgOk(this.notePadBindingImage)) {
      ctx.drawImage(this.notePadBindingImage, noteX * gs, noteY * gs, this.NOTE_W * gs, this.NOTE_H * gs)
    }
  }

  drawStrokes(gs: number) {
    const { ctx } = this
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3 * gs
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const stroke of this.strokes) {
      if (stroke.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x * gs, stroke[0].y * gs)
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * gs, stroke[i].y * gs)
      }
      ctx.stroke()
    }
    // Current stroke
    if (this.currentStroke && this.currentStroke.length > 1) {
      ctx.beginPath()
      ctx.moveTo(this.currentStroke[0].x * gs, this.currentStroke[0].y * gs)
      for (let i = 1; i < this.currentStroke.length; i++) {
        ctx.lineTo(this.currentStroke[i].x * gs, this.currentStroke[i].y * gs)
      }
      ctx.stroke()
    }
  }

  drawVerticalEquation(prob: Problem, gs: number) {
    const { ctx } = this
    // C++: equation drawn on notePageProblemView (same size as notepad)
    // viewWidth = noteSize.width = 1228, viewHeight = noteSize.height = 1612
    // C++ fontSize = 186, charSize = (fontSize*0.7, fontSize) = (130.2, 186)
    // Colors: Color4B(45, 110, 166, 255)
    // C++ font: TodoSchoolV2.ttf
    const noteX = GAME_WIDTH * 0.75 - this.NOTE_W / 2
    const noteY = GAME_HEIGHT * 0.5 - this.NOTE_H / 2

    const fontSize = 186
    const charW = fontSize * 0.7  // 130.2
    const labelColor = 'rgb(45, 110, 166)'

    // C++: rightX = viewWidth/2 = 614
    let rightX = this.NOTE_W / 2
    if (prob.lhs.length >= 4 || prob.rhs.length >= 4) rightX += fontSize

    // Convert notepad-local coords to game coords
    const toGameX = (localX: number) => noteX + localX
    // C++ cocos Y: viewHeight - 400 for top number, viewHeight - 600 for bottom
    // In screen Y (0=top): noteY + (noteH - cocosLocalY) would be wrong...
    // Actually in cocos, label position y=viewHeight-400 means 400px from top
    // Since we're drawing top-down, screenLocalY = 400 from notepad top
    const lhsY = 400
    const rhsY = 600

    ctx.font = `bold ${fontSize * gs}px sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = labelColor

    // Draw lhs (top number), right-aligned, digit by digit
    {
      let x = rightX
      for (let i = prob.lhs.length - 1; i >= 0; i--) {
        ctx.fillText(prob.lhs[i], toGameX(x) * gs, (noteY + lhsY) * gs)
        x -= charW
      }
    }

    // Draw rhs (bottom number), right-aligned
    let minX = rightX
    {
      let x = rightX
      for (let i = prob.rhs.length - 1; i >= 0; i--) {
        ctx.fillText(prob.rhs[i], toGameX(x) * gs, (noteY + rhsY) * gs)
        x -= charW
      }
      minX = Math.min(minX, x)
    }

    // Draw operator at left of rhs line
    const opPosX = minX
    ctx.textAlign = 'right'
    ctx.fillText(prob.op, toGameX(opPosX) * gs, (noteY + rhsY) * gs)

    // Draw underline: C++ lineWidth = rightX - opPosX + opLabel.width + 40
    // lineX = opPosX - opLabel.width - 20
    const opLabelW = charW  // approximate width of operator
    const lineWidth = (rightX - opPosX) + opLabelW + 40
    const lineX = opPosX - opLabelW - 20
    const lineY = 700  // C++: viewHeight - 700 -> 700 from top

    ctx.strokeStyle = labelColor
    ctx.lineWidth = 4 * gs
    ctx.beginPath()
    ctx.moveTo(toGameX(lineX) * gs, (noteY + lineY) * gs)
    ctx.lineTo(toGameX(lineX + lineWidth) * gs, (noteY + lineY) * gs)
    ctx.stroke()
  }

  drawAnswerOnNotePad(prob: Problem, gs: number) {
    const { ctx } = this
    // C++: showAnswer draws at viewHeight - 840 -> 840 from top
    const noteX = GAME_WIDTH * 0.75 - this.NOTE_W / 2
    const noteY = GAME_HEIGHT * 0.5 - this.NOTE_H / 2
    const fontSize = 186
    const charW = fontSize * 0.7
    const labelColor = 'rgb(45, 110, 166)'

    let rightX = this.NOTE_W / 2
    if (prob.lhs.length >= 4 || prob.rhs.length >= 4) rightX += fontSize

    const ansY = 840

    ctx.font = `bold ${fontSize * gs}px sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = labelColor

    let x = rightX
    for (let i = prob.answer.length - 1; i >= 0; i--) {
      ctx.fillText(prob.answer[i], (noteX + x) * gs, (noteY + ansY) * gs)
      x -= charW
    }
  }

  drawAnswerPadBg(gs: number) {
    const { ctx } = this
    // C++: answerPad at (winSize.width*0.25, winSize.height*0.5)
    if (imgOk(this.answerPadBgImage)) {
      const padW = this.answerPadBgImage.naturalWidth || 958
      const padH = this.answerPadBgImage.naturalHeight || 1362
      const padX = GAME_WIDTH * 0.25 - padW / 2
      const padY = GAME_HEIGHT * 0.5 - padH / 2
      ctx.drawImage(this.answerPadBgImage, padX * gs, padY * gs, padW * gs, padH * gs)
    }
  }

  drawAnswerLabel(gs: number) {
    const { ctx } = this
    // C++: answerLabel drawn on answerPad, font size 300, Color4B(242, 245, 240, 255)
    // answerLabelPos near top of pad
    const padCenterX = GAME_WIDTH * 0.25
    const padCenterY = GAME_HEIGHT * 0.5

    // C++ answerLabelPos calculation:
    // padH = answerPadBg height, panelArea calculation gives labelPos near top
    // Approximate: label is about 1/4 from top of pad
    const padH = imgOk(this.answerPadBgImage) ? (this.answerPadBgImage.naturalHeight || 1362) : 1362
    const labelY = padCenterY - padH * 0.25

    ctx.fillStyle = 'rgb(242, 245, 240)'
    ctx.font = `bold ${150 * gs}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      this.answerString || '',
      padCenterX * gs, labelY * gs
    )
  }

  drawNumPad(gs: number) {
    const { ctx } = this
    const buttons = this.getNumPadButtons()

    for (const btn of buttons) {
      const bx = btn.x * gs
      const by = btn.y * gs
      const bw = btn.w * gs
      const bh = btn.h * gs

      // C++: button_inactive.png as background
      if (imgOk(this.btnInactive)) {
        ctx.drawImage(this.btnInactive, bx, by, bw, bh)
      } else {
        ctx.fillStyle = '#F5F0EB'
        ctx.beginPath()
        ctx.roundRect(bx, by, bw, bh, 14 * gs)
        ctx.fill()
        ctx.strokeStyle = '#D7CFC7'
        ctx.lineWidth = 2 * gs
        ctx.stroke()
      }

      // Button text - C++: font size 160, color (110, 85, 67) for numbers
      const isSpecial = btn.tag < 0
      ctx.fillStyle = isSpecial ? 'rgb(110, 85, 67)' : 'rgb(110, 85, 67)'
      ctx.font = `bold ${(isSpecial ? 72 : 100) * gs}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(btn.label, bx + bw / 2, by + bh / 2)
    }
  }
}
