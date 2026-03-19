import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/fishtank')

interface FishTankLevel {
  level: number
  problems: string[][]
  isMinus: boolean
  showAnswer: boolean
}

interface Fish {
  x: number
  y: number
  color: string
  dir: number
  speed: number
  wobblePhase: number
  scale: number
}

interface Tank {
  x: number
  y: number
  w: number
  h: number
  fish: Fish[]
}

export class FishTankEngine extends BaseEngine {
  level: number
  levelData: FishTankLevel | null = null
  problems: string[][] = []
  currentProblem = 0
  totalProblems = 5
  solvedCount = 0

  leftTank: Tank = { x: 0, y: 0, w: 0, h: 0, fish: [] }
  rightTank: Tank = { x: 0, y: 0, w: 0, h: 0, fish: [] }

  operand1 = 0
  operand2 = 0
  operator = '+'
  answer = 0
  userAnswer = ''
  showResult: 'correct' | 'wrong' | null = null
  resultTimer = 0
  isMinus = false
  showAnswerMode = false

  bgWall: HTMLImageElement
  bgFloor: HTMLImageElement
  tankRound: HTMLImageElement
  tankMinus: HTMLImageElement
  fishImages: HTMLImageElement[] = []
  shelfImage: HTMLImageElement

  sfxCorrect: HTMLAudioElement
  sfxWrong: HTMLAudioElement
  sfxBubble: HTMLAudioElement

  // Fish body colors for procedural drawing
  fishColors = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCB77', '#4D96FF', '#FF8E53', '#C084FC', '#F472B6']

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    this.bgWall = loadImage(`${ASSET_PATH}/fishgame_background_wall.png`)
    this.bgFloor = loadImage(`${ASSET_PATH}/fishgame_background_floor.png`)
    this.tankRound = loadImage(`${ASSET_PATH}/fishgame_tank_round.png`)
    this.tankMinus = loadImage(`${ASSET_PATH}/fishgame_tank_minus.png`)
    this.shelfImage = loadImage(`${ASSET_PATH}/fishgame_shelf.png`)

    for (let i = 1; i <= 5; i++) {
      this.fishImages.push(loadImage(`${ASSET_PATH}/fishgame_fish_${i}.png`))
    }

    this.sfxCorrect = loadAudio(`${ASSET_PATH}/sounds/matrix_rightanswer.m4a`)
    this.sfxWrong = loadAudio(`${ASSET_PATH}/sounds/matrix_wrongmove.m4a`)
    this.sfxBubble = loadAudio(`${ASSET_PATH}/sounds/bubble_up_2.m4a`)
  }

  start() {
    super.start()
    this.loadLevel()
  }

  async loadLevel() {
    try {
      const resp = await fetch('/data/games/fishtank.json')
      const data = await resp.json()
      this.levelData = data.levels.find((l: FishTankLevel) => l.level === this.level) || null
    } catch {
      this.levelData = null
    }

    if (this.levelData && this.levelData.problems.length > 0) {
      // C++ shuffles if IsRandom, picks 5 problems
      const shuffled = this.shuffleArray([...this.levelData.problems])
      this.problems = shuffled.slice(0, Math.min(5, shuffled.length))
      this.isMinus = this.levelData.isMinus
      this.showAnswerMode = this.levelData.showAnswer
    } else {
      // Generate fallback problems
      this.problems = this.generateFallbackProblems()
    }

    this.totalProblems = this.problems.length
    this.currentProblem = 0
    this.solvedCount = 0
    this.setupProblem()
  }

  generateFallbackProblems(): string[][] {
    const problems: string[][] = []
    const maxFish = this.level <= 5 ? 5 : 10
    const minFish = this.level <= 5 ? 1 : 5

    for (let i = 0; i < 5; i++) {
      if (this.level > 5 && this.level <= 10) {
        // Subtraction levels
        const a = Math.floor(Math.random() * (maxFish - minFish + 1)) + minFish
        const b = Math.floor(Math.random() * a) + 1
        problems.push([String(a), '-', String(b), '=', String(a - b)])
        this.isMinus = true
      } else {
        const a = Math.floor(Math.random() * (maxFish - minFish + 1)) + minFish
        const b = Math.floor(Math.random() * (maxFish - minFish + 1)) + minFish
        problems.push([String(a), '+', String(b), '=', String(a + b)])
        this.isMinus = false
      }
    }
    return problems
  }

  setupProblem() {
    if (this.currentProblem >= this.problems.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    const prob = this.problems[this.currentProblem]
    this.operand1 = parseInt(prob[0], 10)
    this.operator = prob[1]
    this.operand2 = parseInt(prob[2], 10)
    this.answer = parseInt(prob[4], 10)
    // C++ showAnswer mode: pre-fill the answer so player sees the equation fully
    this.userAnswer = this.showAnswerMode ? String(this.answer) : ''
    this.showResult = null
    this.resultTimer = 0

    // C++ uses m_WinSize with height=1440, width varies but typically ~2048
    // Scale factor from C++ (1440 height) to web (1800 height): 1800/1440 = 1.25
    // Tank sprite sizes are loaded from .csb files; estimated round tank sprite ~630x542
    const S = GAME_HEIGHT / 1440  // 1.25 scale factor
    const tankSpriteW = 630  // approximate tank sprite width in C++ coords
    const tankSpriteH = 542  // approximate tank sprite height in C++ coords
    const tankW = tankSpriteW * S
    const tankH = tankSpriteH * S

    if (this.isMinus) {
      // C++ minus mode: source tank at (width/2, 744) in C++ Y-up coords
      // In web Y-down: tankCenterY = (1440 - 744) * S = 696 * 1.25 = 870
      const srcTankCX = GAME_WIDTH / 2
      const srcTankCY = (1440 - 744) * S
      this.leftTank = {
        x: srcTankCX - tankW / 2,
        y: srcTankCY - tankH / 2,
        w: tankW, h: tankH,
        fish: this.createFish(this.operand1, tankW, tankH),
      }
      // C++ target tank at (width/2 + 193, srcTankY + 47) in C++ coords
      // +47 in C++ Y-up means higher => in web Y-down means -47*S
      const tgtTankCX = GAME_WIDTH / 2 + 193 * S
      const tgtTankCY = srcTankCY - 47 * S
      this.rightTank = {
        x: tgtTankCX - tankW / 2,
        y: tgtTankCY - tankH / 2,
        w: tankW, h: tankH,
        fish: this.createFish(this.operand2, tankW, tankH),
      }
    } else {
      // C++ addition mode: source tanks at top, target tanks at bottom
      // C++ source (top) tanks: y = 1440 - 132 - spriteH/2 = 1440 - 132 - 271 = 1037 from bottom
      // In web Y-down: (1440 - 1037) * S = 403 * 1.25 = ~504 from top (center)
      // C++ target (bottom) tanks: y = 118 + spriteH/2 = 118 + 271 = 389 from bottom
      // In web Y-down: (1440 - 389) * S = 1051 * 1.25 = ~1314 from top (center)
      // But web game shows the source tanks as the ones with fish (operand1, operand2)
      // C++ with 2 top tanks: x = width/2 - 103 - spriteW/2 + i*(206+spriteW)
      const topTankCY = (1440 - 1037) * S  // ~504 from top
      // C++ with 2 tanks: posX = width/2 - 103 - spriteW/2 + i*(206 + spriteW)
      // i=0: centerX = width/2 - 103 - spriteW/2  (this is the node position, sprite centered inside)
      // i=1: centerX = width/2 - 103 - spriteW/2 + 206 + spriteW = width/2 + 103 + spriteW/2
      // In web coords (scaled): left center = GAME_WIDTH/2 - (103+tankSpriteW/2)*S
      //                         right center = GAME_WIDTH/2 + (103+tankSpriteW/2)*S
      const leftTankCX = GAME_WIDTH / 2 - (103 + tankSpriteW / 2) * S
      const rightTankCX = GAME_WIDTH / 2 + (103 + tankSpriteW / 2) * S

      this.leftTank = {
        x: leftTankCX - tankW / 2,
        y: topTankCY - tankH / 2,
        w: tankW, h: tankH,
        fish: this.createFish(this.operand1, tankW, tankH),
      }
      this.rightTank = {
        x: rightTankCX - tankW / 2,
        y: topTankCY - tankH / 2,
        w: tankW, h: tankH,
        fish: this.createFish(this.operand2, tankW, tankH),
      }
    }

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  createFish(count: number, tankW: number, tankH: number): Fish[] {
    const fish: Fish[] = []
    const margin = 60
    for (let i = 0; i < count; i++) {
      fish.push({
        x: margin + Math.random() * (tankW - margin * 2),
        y: margin + 80 + Math.random() * (tankH - margin * 2 - 100),
        color: this.fishColors[i % this.fishColors.length],
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 20 + Math.random() * 40,
        wobblePhase: Math.random() * Math.PI * 2,
        scale: 0.7 + Math.random() * 0.4,
      })
    }
    return fish
  }

  shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  onPointerDown(x: number, y: number) {
    if (this.showResult) return

    // Number pad at bottom of screen
    const padY = GAME_HEIGHT - 200
    const padStartX = GAME_WIDTH / 2 - 5 * 150 / 2
    const btnSize = 125
    const gap = 25

    for (let i = 0; i <= 9; i++) {
      const bx = padStartX + i * (btnSize + gap)
      const by = padY
      if (x >= bx && x <= bx + btnSize && y >= by && y <= by + btnSize) {
        if (this.userAnswer.length < 3) {
          this.userAnswer += String(i)
        }
        return
      }
    }

    // Backspace button
    const backX = padStartX - (btnSize + gap)
    if (x >= backX && x <= backX + btnSize && y >= padY && y <= padY + btnSize) {
      this.userAnswer = this.userAnswer.slice(0, -1)
      return
    }

    // Confirm button
    const confirmX = padStartX + 10 * (btnSize + gap)
    if (x >= confirmX && x <= confirmX + btnSize * 1.5 && y >= padY && y <= padY + btnSize) {
      this.checkAnswer()
      return
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
      setTimeout(() => {
        this.currentProblem++
        this.setupProblem()
      }, 1200)
    } else {
      this.showResult = 'wrong'
      playSound(this.sfxWrong)
      setTimeout(() => {
        this.showResult = null
        this.userAnswer = ''
      }, 800)
    }
  }

  update(time: number, dt: number) {
    if (this.showResult) {
      this.resultTimer += dt
    }

    // Animate fish swimming
    this.animateFishInTank(this.leftTank, time, dt)
    this.animateFishInTank(this.rightTank, time, dt)
  }

  animateFishInTank(tank: Tank, time: number, dt: number) {
    const margin = 60
    for (const fish of tank.fish) {
      fish.x += fish.dir * fish.speed * dt
      fish.wobblePhase += dt * 3

      // Bounce off tank walls
      if (fish.x < margin) {
        fish.x = margin
        fish.dir = 1
      }
      if (fish.x > tank.w - margin) {
        fish.x = tank.w - margin
        fish.dir = -1
      }
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Draw background
    if (this.bgWall.complete && this.bgWall.naturalWidth > 0) {
      this.drawBackgroundImage(this.bgWall, w, h)
    } else {
      ctx.fillStyle = '#87CEEB'
      ctx.fillRect(0, 0, w, h)
    }

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw shelf - C++ shelf positioned at tank bottom: tankY - spriteH/2
    // For addition: top tank center at ~504, shelf at 504 + tankH/2 = 504+339 = ~843 from top
    // For minus: source tank center at ~870, shelf at 870 + tankH/2 = 870+339 = ~1209 from top
    if (this.shelfImage.complete && this.shelfImage.naturalWidth > 0) {
      const shelfW = GAME_WIDTH * 0.9
      const shelfX = (GAME_WIDTH - shelfW) / 2
      const shelfY = this.leftTank.y + this.leftTank.h
      ctx.drawImage(this.shelfImage, shelfX * gs, shelfY * gs, shelfW * gs, 60 * gs)
    } else {
      // Fallback shelf
      const shelfW = GAME_WIDTH * 0.9
      const shelfX = (GAME_WIDTH - shelfW) / 2
      const shelfY = this.leftTank.y + this.leftTank.h
      ctx.fillStyle = '#8B6914'
      ctx.fillRect(shelfX * gs, shelfY * gs, shelfW * gs, 60 * gs)
    }

    // Draw tanks
    this.drawTank(this.leftTank, gs)
    this.drawTank(this.rightTank, gs)

    // Draw equation display between tanks
    this.drawEquationDisplay(gs)

    // Draw answer area
    this.drawAnswerDisplay(gs)

    // Draw number pad
    this.drawNumberPad(gs)

    // Draw result feedback
    if (this.showResult) {
      ctx.fillStyle = this.showResult === 'correct'
        ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${80 * gs}px TodoSchoolV2, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        this.showResult === 'correct' ? 'Correct!' : 'Try Again',
        GAME_WIDTH / 2 * gs, GAME_HEIGHT / 2 * gs
      )
    }

    ctx.restore()
  }

  drawTank(tank: Tank, gs: number) {
    const { ctx } = this
    const tx = tank.x * gs
    const ty = tank.y * gs
    const tw = tank.w * gs
    const th = tank.h * gs

    // Draw tank image or fallback
    const tankImg = this.isMinus ? this.tankMinus : this.tankRound
    if (tankImg.complete && tankImg.naturalWidth > 0) {
      ctx.drawImage(tankImg, tx, ty, tw, th)
    } else {
      // Fallback: draw tank as rounded rectangle
      ctx.fillStyle = 'rgba(173, 216, 230, 0.4)'
      ctx.strokeStyle = '#5DADE2'
      ctx.lineWidth = 4 * gs
      ctx.beginPath()
      ctx.roundRect(tx, ty, tw, th, 20 * gs)
      ctx.fill()
      ctx.stroke()
    }

    // Draw fish inside tank
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(tx + 10 * gs, ty + 10 * gs, tw - 20 * gs, th - 20 * gs, 16 * gs)
    ctx.clip()

    for (const fish of tank.fish) {
      this.drawFish(fish, tank.x, tank.y, gs)
    }

    ctx.restore()

    // Draw fish count label
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.font = `bold ${40 * gs}px TodoSchoolV2, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(tank.fish.length), (tank.x + tank.w / 2) * gs, (tank.y + 35) * gs)
  }

  drawFish(fish: Fish, tankX: number, tankY: number, gs: number) {
    const { ctx } = this
    const fx = (tankX + fish.x) * gs
    const fy = (tankY + fish.y + Math.sin(fish.wobblePhase) * 8) * gs
    const bodyW = 50 * fish.scale * gs
    const bodyH = 28 * fish.scale * gs

    ctx.save()
    ctx.translate(fx, fy)
    if (fish.dir < 0) ctx.scale(-1, 1)

    // Check if we have a fish sprite to use
    const fishImgIdx = Math.floor(Math.abs(fish.x + fish.y)) % this.fishImages.length
    const fishImg = this.fishImages[fishImgIdx]

    if (fishImg && fishImg.complete && fishImg.naturalWidth > 0) {
      const imgW = 70 * fish.scale * gs
      const imgH = 50 * fish.scale * gs
      ctx.drawImage(fishImg, -imgW / 2, -imgH / 2, imgW, imgH)
    } else {
      // Procedural fish: oval body + triangle tail
      // Body
      ctx.fillStyle = fish.color
      ctx.beginPath()
      ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2)
      ctx.fill()

      // Tail
      ctx.beginPath()
      ctx.moveTo(-bodyW * 0.8, 0)
      ctx.lineTo(-bodyW * 1.5, -bodyH * 0.8)
      ctx.lineTo(-bodyW * 1.5, bodyH * 0.8)
      ctx.closePath()
      ctx.fill()

      // Eye
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(bodyW * 0.4, -bodyH * 0.2, 6 * fish.scale * gs, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#333'
      ctx.beginPath()
      ctx.arc(bodyW * 0.5, -bodyH * 0.2, 3 * fish.scale * gs, 0, Math.PI * 2)
      ctx.fill()

      // Fin
      ctx.fillStyle = fish.color
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.moveTo(0, bodyH * 0.5)
      ctx.lineTo(-bodyW * 0.3, bodyH * 1.2)
      ctx.lineTo(bodyW * 0.3, bodyH * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
    }

    ctx.restore()
  }

  drawEquationDisplay(gs: number) {
    const { ctx } = this
    const centerX = GAME_WIDTH / 2
    // Operator between tanks - vertically centered between left and right tanks
    const eqY = this.leftTank.y + this.leftTank.h / 2

    // Operator sign between tanks
    ctx.fillStyle = '#333'
    ctx.font = `bold ${100 * gs}px TodoSchoolV2, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.operator, centerX * gs, eqY * gs)

    // Equation text below tanks, near the slots area
    // C++ slots at y = m_WinSize.height - 958 - slotH/2 in C++ coords
    // = (1440 - 958) * S = 482 * 1.25 = ~603 from bottom in web... that seems above shelf
    // Actually slots are placed below the shelf in the green board area
    const eqTextY = this.leftTank.y + this.leftTank.h + 150
    ctx.font = `bold ${60 * gs}px TodoSchoolV2, sans-serif`
    ctx.fillStyle = '#333'

    const eqText = `${this.operand1} ${this.operator} ${this.operand2} = `
    const fullW = ctx.measureText(eqText + '?').width
    const startX = (GAME_WIDTH * gs - fullW) / 2

    ctx.textAlign = 'left'
    ctx.fillText(eqText, startX, eqTextY * gs)

    // Answer box
    const ansBoxX = startX + ctx.measureText(eqText).width
    const ansBoxW = 120 * gs
    const ansBoxH = 80 * gs

    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 6 * gs
    ctx.beginPath()
    ctx.roundRect(ansBoxX, eqTextY * gs - ansBoxH / 2, ansBoxW, ansBoxH, 10 * gs)
    ctx.fill()
    ctx.shadowColor = 'transparent'

    ctx.strokeStyle = this.showResult === 'correct' ? '#4CAF50'
      : this.showResult === 'wrong' ? '#F44336' : '#2196F3'
    ctx.lineWidth = 3 * gs
    ctx.stroke()

    // C++ card label font size: 116, color: Color4B(69,69,69,255) = #454545
    ctx.fillStyle = this.userAnswer ? '#454545' : '#999'
    ctx.font = `bold ${50 * gs}px TodoSchoolV2, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.userAnswer || '?', ansBoxX + ansBoxW / 2, eqTextY * gs)
  }

  drawAnswerDisplay(_gs: number) {
    // The answer display is integrated into drawEquationDisplay
  }

  drawNumberPad(gs: number) {
    const { ctx } = this
    const padY = (GAME_HEIGHT - 200) * gs
    const btnSize = 125 * gs
    const gap = 25 * gs
    const padStartX = (GAME_WIDTH / 2 - 5 * (125 + 25) / 2) * gs

    // Backspace
    const backX = padStartX - (btnSize + gap)
    ctx.fillStyle = '#FF7043'
    ctx.beginPath()
    ctx.roundRect(backX, padY, btnSize, btnSize, 12 * gs)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${30 * gs}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('\u2190', backX + btnSize / 2, padY + btnSize / 2)

    // Number buttons 0-9
    for (let i = 0; i <= 9; i++) {
      const bx = padStartX + i * (btnSize + gap)
      ctx.fillStyle = '#0093E9'
      ctx.beginPath()
      ctx.roundRect(bx, padY, btnSize, btnSize, 12 * gs)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${44 * gs}px TodoSchoolV2, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i), bx + btnSize / 2, padY + btnSize / 2)
    }

    // Confirm button
    const confirmX = padStartX + 10 * (btnSize + gap)
    ctx.fillStyle = '#4CAF50'
    ctx.beginPath()
    ctx.roundRect(confirmX, padY, btnSize * 1.5, btnSize, 12 * gs)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${30 * gs}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('\u2713', confirmX + btnSize * 0.75, padY + btnSize / 2)
  }
}
