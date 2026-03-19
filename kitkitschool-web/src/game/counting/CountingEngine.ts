import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/counting')

interface ProblemData {
  problem: number
  stoneCount: number
  tallyCount: number
}

interface WorksheetData {
  worksheet: number
  problems: ProblemData[]
}

interface LevelData {
  level: number
  worksheets: WorksheetData[]
}

// C++: CountingObject has weight (5 for tallies-five, 1 for stones/tallies-one) and value (user-set count)
interface CountingObj {
  x: number
  y: number
  weight: number       // C++: _weight (5 for five-tally, 1 for stone/one-tally)
  value: number        // C++: _value (0 = untouched, >0 = user-touched order)
  type: 'stone' | 'tallyOne' | 'tallyFive'
  variant: number
  countAnim: number
}

export class CountingEngine extends BaseEngine {
  level: number
  levelData: LevelData | null = null
  currentWorksheet = 0
  currentProblem = 0
  objects: CountingObj[] = []
  // C++: totalCount = stoneCount + tallyCount
  answer = 0
  // C++ AnswerPadMulti: digit-based input, auto-submit when filled
  answerDigitCount = 1
  userAnswer = ''
  showResult: 'correct' | 'wrong' | null = null
  resultTimer = 0
  totalProblems = 0
  solvedCount = 0

  // C++: count(objects) vs sum(weights of objects)
  touchedObjects = 0
  touchedValue = 0

  // C++ AnswerPadMulti: pad background size from counting_image_numberpad_bg.png
  // Typical size ~958 x 1362 (measured from C++ layout)
  readonly PAD_BG_W = 958
  readonly PAD_BG_H = 1362

  bgImage: HTMLImageElement
  padBgImage: HTMLImageElement
  stoneImages: HTMLImageElement[] = []
  branchOneImages: HTMLImageElement[] = []
  branchFiveImage: HTMLImageElement

  sfxCorrect: HTMLAudioElement
  sfxMiss: HTMLAudioElement
  sfxTouch: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  // C++ onMiss hint state
  hintLabels: { x: number; y: number; label: number; alpha: number }[] = []
  hintActive = false

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.bgImage = loadImage(`${ASSET_PATH}/counting_image_bg.jpg`)
    this.padBgImage = loadImage(`${ASSET_PATH}/counting_image_numberpad_bg.png`)

    for (let i = 1; i <= 5; i++) {
      this.stoneImages.push(loadImage(`${ASSET_PATH}/stone_0${i}.png`))
    }
    this.branchOneImages = [
      loadImage(`${ASSET_PATH}/branch_one_01.png`),
      loadImage(`${ASSET_PATH}/branch_one_02.png`),
    ]
    this.branchFiveImage = loadImage(`${ASSET_PATH}/branch_five_01.png`)

    this.sfxCorrect = loadAudio(`${ASSET_PATH}/../lettermatching/sounds/play_level_clear.wav`)
    this.sfxMiss = loadAudio(`${ASSET_PATH}/../lettermatching/sounds/play_level_clear.wav`)
    this.sfxTouch = loadAudio(`${ASSET_PATH}/../lettermatching/sounds/play_level_clear.wav`)
  }

  async loadLevel() {
    const resp = await fetch('/data/games/counting.json')
    const data = await resp.json()
    this.levelData = data.levels.find((l: LevelData) => l.level === this.level) || data.levels[0]
    if (!this.levelData) return

    // C++: picks a random worksheet from the level
    const wsIndex = Math.floor(Math.random() * this.levelData.worksheets.length)
    this.currentWorksheet = wsIndex
    const ws = this.levelData.worksheets[wsIndex]
    this.totalProblems = ws.problems.length
    this.solvedCount = 0
    this.currentProblem = 0
    this.setupProblem()
  }

  setupProblem() {
    if (!this.levelData) return
    const ws = this.levelData.worksheets[this.currentWorksheet]
    if (!ws) return
    const prob = ws.problems[this.currentProblem]
    if (!prob) return

    this.userAnswer = ''
    this.showResult = null
    this.resultTimer = 0
    this.hintLabels = []
    this.hintActive = false
    this.objects = []
    this.touchedObjects = 0
    this.touchedValue = 0

    // C++: totalCount = stoneCount + tallyCount (Problem constructor)
    this.answer = prob.stoneCount + prob.tallyCount

    // C++: answerDigitCount = number of digits in totalCount string
    this.answerDigitCount = String(this.answer).length

    // C++: putObjects places tallies first (weight=5 for fives, weight=1 for ones),
    // then stones (weight=1 each)
    this.putObjects(prob.tallyCount, prob.stoneCount)

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  putObjects(tallyCount: number, stoneCount: number) {
    // C++: objectNode size = (gameSize.width/2, gameSize.height-50)
    const areaW = GAME_WIDTH / 2
    const areaH = GAME_HEIGHT - 50

    // --- Place tallies ---
    let talliesToGo = tallyCount
    const tallyVari1 = Math.floor(Math.random() * 2)  // 0 or 1
    // C++: talliesAreaLimitNum determines vertical division
    const talliesAreaLimitNum = ((talliesToGo % 5 === 0) || (talliesToGo < 5)) ? 0 : 2

    while (talliesToGo >= 5) {
      this.putOneObject(areaW, areaH, 5, 'tallyFive', 0, 0, talliesAreaLimitNum)
      talliesToGo -= 5
    }
    while (talliesToGo >= 1) {
      this.putOneObject(areaW, areaH, 1, 'tallyOne', tallyVari1, 1, talliesAreaLimitNum)
      talliesToGo -= 1
    }

    // --- Place stones ---
    let stonesToGo = stoneCount
    const stoneVariOrder = [1, 2, 3, 4, 5]
    for (let i = stoneVariOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[stoneVariOrder[i], stoneVariOrder[j]] = [stoneVariOrder[j], stoneVariOrder[i]]
    }
    let stoneVari = 0
    const stoneAreaLimitNum = (stonesToGo <= 5) ? 0 : Math.ceil(stonesToGo / 5)
    let stoneAreaLimitIndex = 0

    while (stonesToGo > 0) {
      const stoneStyle = stoneVariOrder[stoneVari] - 1  // 0-indexed for images
      const thisStoneCount = Math.min(5, stonesToGo)

      for (let i = 0; i < thisStoneCount; i++) {
        this.putOneObject(areaW, areaH, 1, 'stone', stoneStyle, stoneAreaLimitIndex, stoneAreaLimitNum)
      }

      stonesToGo -= thisStoneCount
      stoneVari = (stoneVari + 1) % 5
      stoneAreaLimitIndex++
    }
  }

  putOneObject(
    areaW: number, areaH: number, weight: number,
    type: 'stone' | 'tallyOne' | 'tallyFive',
    variant: number, areaLimitIndex: number, areaLimitNum: number
  ) {
    // C++: area subdivision for overflow
    let localAreaH = areaH
    let localAreaBottom = 0
    if (areaLimitNum > 0) {
      localAreaH = areaH / areaLimitNum
      localAreaBottom = localAreaH * (areaLimitNum - areaLimitIndex - 1)
    }

    // C++: object size ~150px for stones, tallies vary
    const objSize = 150

    // C++: 10 trials to find best non-overlapping position
    let bestScore = -Infinity
    let bestX = areaW / 2
    let bestY = localAreaBottom + localAreaH / 2

    for (let trial = 0; trial < 10; trial++) {
      const x = objSize / 2 + Math.random() * (areaW - objSize)
      const y = localAreaBottom + objSize / 2 + Math.random() * (localAreaH - objSize)

      let score = 0
      for (const obj of this.objects) {
        const overlapX = Math.max(0, objSize - Math.abs(obj.x - x))
        const overlapY = Math.max(0, objSize - Math.abs(obj.y - y))
        score -= overlapX * overlapY
      }

      if (score >= bestScore) {
        bestScore = score
        bestX = x
        bestY = y
      }
    }

    this.objects.push({
      x: bestX,
      y: bestY,
      weight,
      value: 0,   // 0 = untouched
      type,
      variant,
      countAnim: 0,
    })
  }

  start() {
    super.start()
    this.loadLevel()
  }

  // C++ AnswerPadMulti: 4 rows x 3 cols, panel size 306x184, gap 10
  // AnswerPad anchored MIDDLE_RIGHT at (gameSize.width-82, gameSize.height/2)
  // padBg size from image. Panel node at bottom of pad.
  // Buttons: 7,8,9 / 4,5,6 / 1,2,3 / 0(wide),delete
  // When answerDigitCount==1, bottom row (0, delete) hidden, panel shifted up

  // Calculate the answer pad position and button rects
  getAnswerPadLayout() {
    // C++: answerPad anchored MIDDLE_RIGHT at (gameSize.width - 82, gameSize.height/2)
    const padW = this.PAD_BG_W
    const padH = this.PAD_BG_H
    // Anchor point is middle-right, so pad extends left from anchor
    const anchorX = GAME_WIDTH - 82
    const anchorY = GAME_HEIGHT / 2
    const padLeft = anchorX - padW
    const padTop = anchorY - padH / 2

    // C++ panel: 306x184 per button, 10px gap, 4 rows x 3 cols
    const btnW = 306
    const btnH = 184
    const gap = 10
    const colCount = 3
    const rowCount = 4

    const showBottomRow = this.answerDigitCount > 1
    // C++: panel positioned at (answerPadSize.width/2, 129) anchor MIDDLE_BOTTOM
    // When single digit, panelNodePosY shifts up by (184+10)
    const panelBaseY = showBottomRow ? 129 : 129 - 184 - gap
    // Panel node: anchor middle-bottom at padCenter
    const panelW = btnW * colCount + gap * (colCount - 1)
    const panelLeft = padLeft + (padW - panelW) / 2
    // panelNode Y in pad coords: panelBaseY is bottom edge
    const panelBottom = padTop + padH - panelBaseY  // convert: padTop + (padH - panelBaseY) -- wait, coords
    // C++ cocos2d Y=0 at bottom, our Y=0 at top. Need to flip.
    // In cocos: panelNode bottom at panelBaseY from pad bottom
    // In screen coords: panelBottom_screen = padTop + padH - panelBaseY
    // panelNode top = panelBottom_screen - (btnH * rowCount + gap)
    const panelGridH = btnH * rowCount + gap
    const panelTopScreen = padTop + padH - panelBaseY - panelGridH

    // C++ panelPos(row, col): row 0 = top, row 3 = bottom
    // x = col * (btnW + gap) + btnW/2
    // y = gap + btnH*rowCount - (row*(btnH+gap) + btnH/2) -- cocos Y
    // Screen Y for row: panelTopScreen + row*(btnH+gap) + btnH/2... but cocos row 0 = top visually
    // Actually cocos row 0 corresponds to numbers 7,8,9 (top row)

    const buttons: { label: string; x: number; y: number; w: number; h: number; tag: number }[] = []

    // panelPos function (returns center position in screen coords)
    const panelPos = (row: number, col: number) => {
      const x = panelLeft + col * (btnW + gap) + btnW / 2
      // C++ y = gap + btnH*rowCount - (row*(btnH+gap) + btnH/2)
      // In screen coords, row 0 is at top
      const y = panelTopScreen + row * (btnH + gap) + btnH / 2
      return { x, y }
    }

    // Numbers 1-9: placed using C++ formula
    // C++: for i=0..9, btnPos = panelPos((9-i)/3, 3 - (9-i)%3 - 1)
    // i=9 -> row=0,col=2 (top-right) = 9
    // i=8 -> row=0,col=1 = 8
    // i=7 -> row=0,col=0 = 7
    // i=6 -> row=1,col=2 = 6
    // ...
    // i=1 -> row=2,col=2 = 1... wait let me recalculate
    // (9-1)/3 = 2, 3 - (9-1)%3 - 1 = 3-2-1=0 -> row=2,col=0 = 1
    // (9-2)/3 = 2, 3 - (9-2)%3 - 1 = 3-1-1=1 -> row=2,col=1 = 2
    // (9-3)/3 = 2, 3 - (9-3)%3 - 1 = 3-0-1=2 -> row=2,col=2 = 3
    // So layout is: row0=[7,8,9], row1=[4,5,6], row2=[1,2,3], row3=[0(wide), _, delete]
    for (let i = 1; i <= 9; i++) {
      const row = Math.floor((9 - i) / colCount)
      const col = colCount - (9 - i) % colCount - 1
      const pos = panelPos(row, col)
      buttons.push({
        label: String(i), tag: i,
        x: pos.x - btnW / 2, y: pos.y - btnH / 2,
        w: btnW, h: btnH,
      })
    }

    // Zero button: C++ center of (row=3,col=0) and (row=3,col=1)
    if (showBottomRow) {
      const p0 = panelPos(rowCount - 1, 0)
      const p1 = panelPos(rowCount - 1, 1)
      const zeroCenter = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
      // Zero is 2x width
      const zeroW = btnW * 2 + gap
      buttons.push({
        label: '0', tag: 0,
        x: zeroCenter.x - zeroW / 2, y: zeroCenter.y - btnH / 2,
        w: zeroW, h: btnH,
      })

      // Delete button: at (row=3, col=2)
      const delPos = panelPos(rowCount - 1, colCount - 1)
      buttons.push({
        label: '\u2190', tag: -1,  // backspace
        x: delPos.x - btnW / 2, y: delPos.y - btnH / 2,
        w: btnW, h: btnH,
      })
    }

    // Answer label positions: C++ at (padW/2 + offset*410, 1100) relative to pad
    // C++ y = showBottomRow ? 1100 : 1100-92
    const ansLabelY_cocos = showBottomRow ? 1100 : 1100 - 92
    // Convert cocos Y to screen Y: screenY = padTop + (padH - ansLabelY_cocos)
    const ansLabelY_screen = padTop + padH - ansLabelY_cocos

    const answerLabelPositions: { x: number; y: number }[] = []
    for (let i = 0; i < this.answerDigitCount; i++) {
      const xOffset = (this.answerDigitCount - 1) * (-0.5) + i
      const lx = padLeft + padW / 2 + xOffset * 410
      answerLabelPositions.push({ x: lx, y: ansLabelY_screen })
    }

    return {
      padLeft, padTop, padW, padH,
      buttons,
      answerLabelPositions,
    }
  }

  onPointerDown(x: number, y: number) {
    if (this.showResult) return
    if (this.hintActive) return

    // Check object taps (counting)
    for (const obj of this.objects) {
      if (obj.value !== 0) continue  // already counted
      const dist = Math.hypot(x - obj.x, y - obj.y)
      const hitSize = obj.type === 'stone' ? 80 : (obj.type === 'tallyFive' ? 100 : 60)
      if (dist < hitSize) {
        this.touchedObjects++
        this.touchedValue += obj.weight
        obj.value = this.touchedValue
        obj.countAnim = 0
        playSound(this.sfxTouch)
        return
      }
    }

    // Check number pad buttons
    const layout = this.getAnswerPadLayout()
    for (const btn of layout.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        if (btn.tag === -1) {
          // Backspace
          if (this.userAnswer.length > 0) {
            this.userAnswer = this.userAnswer.slice(0, -1)
          }
        } else {
          // Number digit
          if (this.userAnswer.length < this.answerDigitCount) {
            this.userAnswer += String(btn.tag)
            // C++ auto-submit: when answerString.size() == answerDigitCount
            if (this.userAnswer.length === this.answerDigitCount) {
              this.checkAnswer()
            }
          }
        }
        return
      }
    }
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  checkAnswer() {
    if (!this.userAnswer) return
    const num = parseInt(this.userAnswer, 10)

    if (num === this.answer) {
      this.showResult = 'correct'
      playSound(this.sfxCorrect)
      this.solvedCount++

      // C++: 2.0s delay, then pad slides out, 0.2s delay, clearAnswer, onStart
      setTimeout(() => {
        this.advanceProblem()
      }, 2000)
    } else {
      // C++ onMiss: plays missEffect, then shows hint animation
      this.showResult = 'wrong'
      playSound(this.sfxMiss)
      this.showHintAnimation()
    }
  }

  showHintAnimation() {
    this.hintLabels = []
    this.hintActive = true

    // C++: Sort objects by ordering:
    // 1. Objects with value != 0 (already touched) keep their user order (by value ascending)
    // 2. Objects with value == 0 sorted by y-desc (top first in cocos = higher y), then x-asc
    // In our screen coords, y increases downward, but C++ cocos y increases upward.
    // C++ sort: lpos.y > rpos.y means "higher position first" in cocos = lower y in screen
    // So for screen coords: a.y < b.y means a is higher = should come first = a.y - b.y (ascending)
    const ordering = [...this.objects.map((obj, idx) => ({ obj, idx }))].sort((a, b) => {
      const intMax = Number.MAX_SAFE_INTEGER
      const aVal = a.obj.value !== 0 ? a.obj.value : intMax
      const bVal = b.obj.value !== 0 ? b.obj.value : intMax
      if (aVal !== bVal) return aVal - bVal
      // C++: lpos.y > rpos.y (cocos) -> screen: a.y < b.y
      if (a.obj.y !== b.obj.y) return a.obj.y - b.obj.y
      return a.obj.x - b.obj.x
    })

    const delayPerObject = 200  // C++: countDelay = 0.2f
    const startDelay = 500     // C++: 0.5f delay

    // C++: First clear all number labels (detachNumber)
    setTimeout(() => {
      for (const obj of this.objects) {
        obj.value = 0
        obj.countAnim = 0
      }
      this.hintLabels = []
    }, startDelay)

    // C++: After another 0.5f delay, re-label sequentially
    let tempCount = this.touchedObjects
    let tempValue = this.touchedValue

    setTimeout(() => {
      let runningValue = 0
      // For objects that were touched, they already had values; for untouched, assign new
      // C++ rebuilds from scratch respecting the ordering
      for (let i = 0; i < ordering.length; i++) {
        const item = ordering[i]
        setTimeout(() => {
          runningValue += item.obj.weight
          item.obj.value = runningValue
          item.obj.countAnim = 1
          this.hintLabels.push({
            x: item.obj.x, y: item.obj.y,
            label: runningValue, alpha: 1,
          })
        }, i * delayPerObject)
      }

      // C++: After all labels shown, wait 1.5f - countDelay, then reset
      const totalTime = ordering.length * delayPerObject + 1300
      setTimeout(() => {
        this.hintLabels = []
        this.hintActive = false
        this.showResult = null
        this.userAnswer = ''
        for (const obj of this.objects) {
          obj.value = 0
          obj.countAnim = 0
        }
        this.touchedObjects = 0
        this.touchedValue = 0
      }, totalTime)
    }, startDelay + 500)
  }

  advanceProblem() {
    if (!this.levelData) return
    const ws = this.levelData.worksheets[this.currentWorksheet]

    // C++: advance within the same worksheet only
    if (this.currentProblem < ws.problems.length - 1) {
      this.currentProblem++
      this.setupProblem()
    } else {
      // C++: CompletePopup -> handleGameComplete
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  update(_time: number, dt: number) {
    for (const obj of this.objects) {
      if (obj.value !== 0 && obj.countAnim < 1) {
        obj.countAnim = Math.min(obj.countAnim + dt * 3, 1)
      }
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

    // Draw all counting objects (stones + tallies)
    for (const obj of this.objects) {
      this.drawObject(obj, gs)
    }

    // Draw answer pad background + buttons + answer labels
    this.drawAnswerPad(gs)

    // Draw hint labels (C++ onMiss counting hint)
    for (const hint of this.hintLabels) {
      ctx.save()
      ctx.globalAlpha = hint.alpha
      const hx = hint.x * gs
      const hy = hint.y * gs
      // C++: counting_image_digit_common_countNumber_BG.png circle behind number
      const bgSize = 60 * gs
      ctx.fillStyle = 'rgba(255, 180, 0, 0.9)'
      ctx.beginPath()
      ctx.arc(hx, hy - 80 * gs, bgSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${36 * gs}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(hint.label), hx, hy - 80 * gs)
      ctx.restore()
    }

    // Draw result feedback (only for correct; wrong shows hint animation instead)
    if (this.showResult === 'correct') {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.3)'
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)
    }

    ctx.restore()
  }

  drawObject(obj: CountingObj, gs: number) {
    const { ctx } = this
    let img: HTMLImageElement | undefined

    if (obj.type === 'stone') {
      img = this.stoneImages[obj.variant]
    } else if (obj.type === 'tallyFive') {
      img = this.branchFiveImage
    } else {
      img = this.branchOneImages[obj.variant]
    }
    ctx.save()
    const x = obj.x * gs
    const y = obj.y * gs

    if (obj.value !== 0 && obj.countAnim < 1) {
      const bounce = Math.sin(obj.countAnim * Math.PI) * 20 * gs
      ctx.translate(x, y - bounce)
    } else {
      ctx.translate(x, y)
    }

    if (imgOk(img)) {
      if (obj.type === 'stone') {
        const size = 150 * gs
        ctx.drawImage(img!, -size / 2, -size / 2, size, size)
      } else if (obj.type === 'tallyFive') {
        const h = 200 * gs
        const w = h * 1.2
        ctx.drawImage(img!, -w / 2, -h / 2, w, h)
      } else {
        const h = 200 * gs
        const w = h * 0.3
        ctx.drawImage(img!, -w / 2, -h / 2, w, h)
      }
    } else {
      // Fallback: draw a simple shape
      if (obj.type === 'stone') {
        const r = 60 * gs
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fillStyle = '#9E9E9E'
        ctx.fill()
        ctx.strokeStyle = '#616161'; ctx.lineWidth = 2 * gs; ctx.stroke()
      } else if (obj.type === 'tallyFive') {
        // Five tally marks grouped
        ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 5 * gs
        for (let i = 0; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo((-60 + i * 28) * gs, -70 * gs)
          ctx.lineTo((-60 + i * 28) * gs, 70 * gs)
          ctx.stroke()
        }
        // Diagonal cross stroke
        ctx.beginPath()
        ctx.moveTo(-76 * gs, 40 * gs)
        ctx.lineTo(-4 * gs, -40 * gs)
        ctx.stroke()
      } else {
        // Single tally mark
        ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 5 * gs
        ctx.beginPath()
        ctx.moveTo(0, -70 * gs); ctx.lineTo(0, 70 * gs)
        ctx.stroke()
      }
    }

    // Draw count number on object if touched
    if (obj.value !== 0) {
      ctx.globalAlpha = Math.min(obj.countAnim * 2, 1)
      // C++: counting_image_digit_common_countNumber_BG.png + number label
      const bgR = 30 * gs
      ctx.fillStyle = 'rgba(255, 180, 0, 0.9)'
      ctx.beginPath()
      ctx.arc(0, -70 * gs, bgR, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${36 * gs}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(obj.value), 0, -70 * gs)
    }

    ctx.restore()
  }

  drawAnswerPad(gs: number) {
    const { ctx } = this
    const layout = this.getAnswerPadLayout()

    // Draw pad background
    if (imgOk(this.padBgImage)) {
      ctx.drawImage(this.padBgImage,
        layout.padLeft * gs, layout.padTop * gs,
        layout.padW * gs, layout.padH * gs)
    } else {
      // Fallback: dark green rounded rect
      ctx.fillStyle = '#2E7D32'
      ctx.beginPath()
      ctx.roundRect(layout.padLeft * gs, layout.padTop * gs,
        layout.padW * gs, layout.padH * gs, 20 * gs)
      ctx.fill()
    }

    // C++: "How many?" label at top of pad
    // questionLabel at (150, answerPadSize.height-65) anchor TOP_LEFT, font size 100
    // Color: rgb(242,245,240)
    ctx.fillStyle = 'rgb(242, 245, 240)'
    ctx.font = `bold ${50 * gs}px sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('How many?', (layout.padLeft + 75) * gs, (layout.padTop + 32) * gs)

    // Draw answer label slots
    // C++: counting_button_answerlabel.png backgrounds, font size 450, color (242,245,240)
    for (let i = 0; i < layout.answerLabelPositions.length; i++) {
      const pos = layout.answerLabelPositions[i]
      const text = i < this.userAnswer.length ? this.userAnswer[i] : ''

      // Draw answer label background (placeholder box)
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      const labelW = 200 * gs
      const labelH = 250 * gs
      ctx.roundRect((pos.x - 100) * gs, (pos.y - 125) * gs, labelW, labelH, 16 * gs)
      ctx.fill()

      // Draw underline
      ctx.strokeStyle = 'rgb(242, 245, 240)'
      ctx.lineWidth = 4 * gs
      ctx.beginPath()
      ctx.moveTo((pos.x - 80) * gs, (pos.y + 100) * gs)
      ctx.lineTo((pos.x + 80) * gs, (pos.y + 100) * gs)
      ctx.stroke()

      // Draw digit text
      if (text) {
        ctx.fillStyle = 'rgb(242, 245, 240)'
        ctx.font = `bold ${180 * gs}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, pos.x * gs, pos.y * gs)
      }
    }

    // Draw buttons
    // C++ colors: normalColor = (59, 140, 56), text color for digits
    const normalColor = 'rgb(59, 140, 56)'
    for (const btn of layout.buttons) {
      const bx = btn.x * gs
      const by = btn.y * gs
      const bw = btn.w * gs
      const bh = btn.h * gs

      // C++: counting_button_numberpad_wide_1x1_normal.png
      ctx.fillStyle = '#A5D6A7'
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, 14 * gs)
      ctx.fill()

      ctx.strokeStyle = '#66BB6A'
      ctx.lineWidth = 2 * gs
      ctx.stroke()

      // Text
      ctx.fillStyle = normalColor
      const fontSize = btn.tag === -1 ? 100 : 80
      ctx.font = `bold ${fontSize * gs}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(btn.label, bx + bw / 2, by + bh / 2)
    }
  }
}
