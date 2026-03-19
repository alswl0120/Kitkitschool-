import { Balloon } from './Balloon'
import type { FloatingLabel, SpriteAssets } from './Balloon'
import type { LevelConfig } from './types'
import { LEVELS, GAME_WIDTH, GAME_HEIGHT, POP_LABEL_COLORS } from './types'
import { assetUrl } from '../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/tapping')

export type GameState = 'playing' | 'complete'

function loadImage(src: string): HTMLImageElement {
  const img = new Image()
  img.src = src
  return img
}

function loadAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src)
  audio.preload = 'auto'
  return audio
}

export class TappingEngine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  level: number
  config: LevelConfig
  balloons: Balloon[] = []
  labels: FloatingLabel[] = []
  popCount = 0
  gameState: GameState = 'playing'
  gameScale = 1
  lastTime = 0
  animFrameId = 0

  // Sprite assets
  sprites: SpriteAssets
  bgImage: HTMLImageElement

  // Sound effects
  sfxBlowUp: HTMLAudioElement
  sfxPop: HTMLAudioElement
  sfxBalloonUp: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void
  onComplete?: () => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.level = Math.max(1, Math.min(level, 3))
    this.config = LEVELS[this.level - 1]

    // Preload sprites
    this.sprites = {
      balloonBase: Array.from({ length: 10 }, (_, i) =>
        loadImage(`${ASSET_PATH}/tg_balloon${i + 1}_base.png`)
      ),
      balloonShading: Array.from({ length: 10 }, (_, i) => {
        // Stage 1 has no shading file
        if (i === 0) return new Image()
        return loadImage(`${ASSET_PATH}/tg_balloon${i + 1}_shading.png`)
      }),
      balloonKnot: loadImage(`${ASSET_PATH}/tg_balloon_string_knot.png`),
      balloonBurst: loadImage(`${ASSET_PATH}/tg_balloonburst_effect.png`),
      bubbleSprites: Array.from({ length: 4 }, (_, i) =>
        loadImage(`${ASSET_PATH}/bubble_soap_${i + 1}.png`)
      ),
    }

    // Background
    this.bgImage = loadImage(
      this.config.isBubble
        ? `${ASSET_PATH}/tappinggame_grassbackground1.jpg`
        : `${ASSET_PATH}/tg_background1.jpg`
    )

    // Sound effects
    this.sfxBlowUp = loadAudio(`${ASSET_PATH}/sfx_balloon-blow-up.m4a`)
    this.sfxPop = loadAudio(`${ASSET_PATH}/sfx_balloon-pop.m4a`)
    this.sfxBalloonUp = loadAudio(`${ASSET_PATH}/sfx_balloon_up.m4a`)
  }

  playSound(audio: HTMLAudioElement) {
    // Clone and play to allow overlapping sounds
    const clone = audio.cloneNode(true) as HTMLAudioElement
    clone.volume = 0.6
    clone.play().catch(() => {})
  }

  start() {
    this.resize()
    this.popCount = 0
    this.balloons = []
    this.labels = []
    this.gameState = 'playing'

    for (let i = 0; i < this.config.balloonCount; i++) {
      this.placeBalloon(this.config.isBubble ? Math.random() * 5 : 0)
    }

    this.updateProgress()

    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('resize', this.resize)

    this.lastTime = performance.now() / 1000
    this.loop()
  }

  stop() {
    cancelAnimationFrame(this.animFrameId)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('resize', this.resize)
  }

  resize = () => {
    const parent = this.canvas.parentElement!
    const dpr = window.devicePixelRatio || 1
    const w = parent.clientWidth
    const h = parent.clientHeight
    this.canvas.width = w * dpr
    this.canvas.height = h * dpr
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.gameScale = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT)
  }

  handlePointerDown = (e: PointerEvent) => {
    if (this.gameState !== 'playing') return

    const rect = this.canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    const offsetX = (rect.width - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (rect.height - GAME_HEIGHT * this.gameScale) / 2
    const gameX = (canvasX - offsetX) / this.gameScale
    const gameY = (canvasY - offsetY) / this.gameScale

    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const balloon = this.balloons[i]
      if (balloon.containsPoint(gameX, gameY)) {
        const popped = balloon.tap()

        if (!balloon.isBubble && !popped) {
          // Inflation tap — play blow-up sound
          this.playSound(this.sfxBlowUp)
          this.labels.push(balloon.createTapLabel())
        }

        if (popped) {
          // Pop sound
          this.playSound(this.sfxPop)
        }

        break
      }
    }
  }

  placeBalloon(delay = 0) {
    const area = this.config.area

    let bestPoint = { x: 0, y: 0 }
    let maxMinDist = -1

    for (let attempt = 0; attempt < 10; attempt++) {
      const px = area.x + Math.random() * area.width
      const py = area.y + Math.random() * area.height

      if (maxMinDist < 0) bestPoint = { x: px, y: py }

      let minDist = -1
      for (const b of this.balloons) {
        const dist = Math.hypot(px - b.x, py - b.y)
        if (minDist < 0 || dist < minDist) minDist = dist
      }

      if (minDist > maxMinDist) {
        maxMinDist = minDist
        bestPoint = { x: px, y: py }
      }
    }

    const balloon = new Balloon(
      bestPoint.x,
      bestPoint.y,
      this.config.maxTap,
      this.config.isBubble
    )

    if (this.config.isBubble) {
      balloon.fadeState = 'waiting'
      balloon.fadeDelay = delay + Math.random() * 0.5
      balloon.fadeTimer = 0
      balloon.visibleDuration = 2.5 + 3.0 * (100 - this.popCount) / 100

      balloon.onPopped = () => {
        if (balloon.fadeState === 'gone') {
          this.removeBalloon(balloon)
          this.placeBalloon(1 + Math.random() * 2)
        } else {
          balloon.startPop()
          this.playSound(this.sfxPop)
          this.popCount++
          this.updateProgress()

          const color = POP_LABEL_COLORS[Math.floor(Math.random() * POP_LABEL_COLORS.length)]
          this.labels.push({
            text: String(this.popCount),
            x: balloon.x,
            y: balloon.y,
            opacity: 1,
            color,
            fontSize: 40,
            startTime: performance.now() / 1000,
            duration: 0.7,
          })

          if (this.popCount >= this.config.goalPops) {
            this.gameState = 'complete'
            setTimeout(() => this.onComplete?.(), 500)
          } else {
            setTimeout(() => {
              this.updateProgress()
              this.placeBalloon()
            }, 700)
          }
        }
      }
    } else {
      balloon.onPopped = () => {
        balloon.startPop()
        this.popCount++
        this.updateProgress()

        const color = POP_LABEL_COLORS[Math.floor(Math.random() * POP_LABEL_COLORS.length)]
        this.labels.push({
          text: String(this.popCount),
          x: balloon.x,
          y: balloon.y - 50,
          opacity: 1,
          color,
          fontSize: 80,
          startTime: performance.now() / 1000,
          duration: 0.7,
        })

        if (this.popCount >= this.config.goalPops) {
          this.gameState = 'complete'
          setTimeout(() => this.onComplete?.(), 500)
        } else {
          setTimeout(() => {
            this.updateProgress()
            this.placeBalloon()
          }, 700)
        }
      }
    }

    this.balloons.push(balloon)
  }

  removeBalloon(balloon: Balloon) {
    const idx = this.balloons.indexOf(balloon)
    if (idx >= 0) this.balloons.splice(idx, 1)
  }

  updateProgress() {
    if (!this.config.isBubble) {
      this.onProgressChange?.(this.popCount + 1, this.config.goalPops)
    }
  }

  loop = () => {
    const now = performance.now() / 1000
    const dt = Math.min(now - this.lastTime, 0.05)
    this.lastTime = now

    this.update(now, dt)
    this.draw()

    this.animFrameId = requestAnimationFrame(this.loop)
  }

  update(time: number, dt: number) {
    for (const b of this.balloons) {
      b.update(time, dt)
    }
    this.balloons = this.balloons.filter(b => !b.removed)

    for (const label of this.labels) {
      const elapsed = time - label.startTime
      const t = elapsed / label.duration
      label.y -= dt * 70
      label.opacity = Math.max(1 - t, 0)
    }
    this.labels = this.labels.filter(l => l.opacity > 0)
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight

    ctx.clearRect(0, 0, w, h)

    this.drawBackground(w, h)

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2

    ctx.save()
    ctx.translate(offsetX, offsetY)

    for (const b of this.balloons) {
      b.draw(ctx, this.gameScale, this.sprites)
    }

    for (const label of this.labels) {
      ctx.save()
      ctx.globalAlpha = label.opacity
      ctx.fillStyle = `rgb(${label.color.r}, ${label.color.g}, ${label.color.b})`
      ctx.font = `bold ${label.fontSize * this.gameScale}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 3 * this.gameScale
      ctx.strokeText(label.text, label.x * this.gameScale, label.y * this.gameScale)
      ctx.fillText(label.text, label.x * this.gameScale, label.y * this.gameScale)
      ctx.restore()
    }

    ctx.restore()

    if (this.gameState === 'complete') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${48}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Great Job!', w / 2, h / 2)
    }
  }

  drawBackground(w: number, h: number) {
    if (imgOk(this.bgImage)) {
      // Draw background image covering the canvas
      const imgRatio = this.bgImage.width / this.bgImage.height
      const canvasRatio = w / h
      let dw: number, dh: number, dx: number, dy: number
      if (canvasRatio > imgRatio) {
        dw = w
        dh = w / imgRatio
        dx = 0
        dy = (h - dh) / 2
      } else {
        dh = h
        dw = h * imgRatio
        dx = (w - dw) / 2
        dy = 0
      }
      this.ctx.drawImage(this.bgImage, dx, dy, dw, dh)
    } else {
      // Fallback gradient
      if (this.config.isBubble) {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0, '#87CEEB')
        grad.addColorStop(0.6, '#98D8C8')
        grad.addColorStop(1, '#4CAF50')
        this.ctx.fillStyle = grad
        this.ctx.fillRect(0, 0, w, h)
      } else {
        const grad = this.ctx.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0, '#4FC3F7')
        grad.addColorStop(0.5, '#81D4FA')
        grad.addColorStop(1, '#B3E5FC')
        this.ctx.fillStyle = grad
        this.ctx.fillRect(0, 0, w, h)
      }
    }
  }
}
