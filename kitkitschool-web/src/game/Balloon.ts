import type { Color, Rect } from './types'
import { BALLOON_SIZES, BALLOON_COLORS, POP_LABEL_COLORS } from './types'
import { imgOk } from './common/BaseEngine'

export interface FloatingLabel {
  text: string
  x: number
  y: number
  opacity: number
  color: Color
  fontSize: number
  startTime: number
  duration: number
}

export interface SpriteAssets {
  balloonBase: HTMLImageElement[]    // 10 stages
  balloonShading: HTMLImageElement[] // 10 stages (index 0 may be empty)
  balloonKnot: HTMLImageElement
  balloonBurst: HTMLImageElement
  bubbleSprites: HTMLImageElement[]  // 4 bubble variants
}

export class Balloon {
  x: number
  y: number
  tapCount = 0
  maxTap: number
  isBubble: boolean
  color: Color
  colorIndex: number
  opacity = 1
  scale = 1

  // Floating animation
  floatDuration: number
  floatPhase = 0
  baseY: number

  // Pop animation state
  isPopping = false
  popStartTime = 0
  popScale = 0.9
  popOpacity = 1

  // Fade in/out for bubbles
  fadeState: 'waiting' | 'fadingIn' | 'visible' | 'fadingOut' | 'gone' = 'visible'
  fadeDelay = 0
  fadeTimer = 0
  visibleDuration = 2.5
  removed = false

  // Bubble variant (0-3)
  bubbleVariant = 0

  // Cached tinted sprite (avoids creating offscreen canvas every frame)
  private _tintedSprite: HTMLCanvasElement | null = null
  private _tintedStage = -1

  onPopped?: () => void

  constructor(x: number, y: number, maxTap: number, isBubble: boolean) {
    this.x = x
    this.y = y
    this.baseY = y
    this.maxTap = maxTap
    this.isBubble = isBubble
    this.colorIndex = Math.floor(Math.random() * BALLOON_COLORS.length)
    this.color = BALLOON_COLORS[this.colorIndex]
    this.floatDuration = 0.55 + Math.random() * 0.4
    this.floatPhase = Math.random() * Math.PI * 2
    this.bubbleVariant = Math.floor(Math.random() * 4)
  }

  get touchRect(): Rect {
    if (this.isBubble) {
      const size = 120
      return { x: this.x - size / 2, y: this.y - size / 2, width: size, height: size }
    }
    const stage = Math.min(this.tapCount, 9)
    const [w, h] = BALLOON_SIZES[stage]
    const scaledW = w * this.scale
    const scaledH = h * this.scale
    return { x: this.x - scaledW / 2, y: this.y - scaledH / 2 + 50, width: scaledW, height: scaledH }
  }

  get currentSize(): [number, number] {
    if (this.isBubble) return [120, 120]
    const stage = Math.min(this.tapCount, 9)
    return BALLOON_SIZES[stage]
  }

  containsPoint(px: number, py: number): boolean {
    const r = this.touchRect
    return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height
  }

  tap(): boolean {
    if (this.isPopping || this.removed) return false
    if (this.fadeState === 'waiting' || this.fadeState === 'gone') return false

    this.tapCount++

    if (this.tapCount >= this.maxTap) {
      if (this.onPopped) this.onPopped()
      return true
    }

    if (!this.isBubble && this.tapCount > 9) {
      this.scale = 1.0 + 0.1 * (this.tapCount - 9)
    }

    return false
  }

  startPop() {
    this.isPopping = true
    this.popStartTime = performance.now() / 1000
    this.popScale = 0.9
    this.popOpacity = 1
  }

  update(time: number, dt: number) {
    // Floating animation (sine wave)
    this.floatPhase += dt / this.floatDuration * Math.PI
    const floatOffset = Math.sin(this.floatPhase) * 10
    this.y = this.baseY + floatOffset

    // Pop animation
    if (this.isPopping) {
      const elapsed = time - this.popStartTime
      const t = Math.min(elapsed / 0.3, 1)
      this.popScale = 0.9 + 0.4 * t
      this.popOpacity = 1 - t
      if (t >= 1) {
        this.removed = true
      }
      return
    }

    // Bubble fade in/out
    if (this.isBubble) {
      this.fadeTimer += dt
      switch (this.fadeState) {
        case 'waiting':
          if (this.fadeTimer >= this.fadeDelay) {
            this.fadeState = 'fadingIn'
            this.fadeTimer = 0
          }
          this.opacity = 0
          break
        case 'fadingIn':
          this.opacity = Math.min(this.fadeTimer / 0.2, 1)
          if (this.fadeTimer >= 0.2) {
            this.fadeState = 'visible'
            this.fadeTimer = 0
          }
          break
        case 'visible':
          this.opacity = 1
          if (this.fadeTimer >= this.visibleDuration) {
            this.fadeState = 'fadingOut'
            this.fadeTimer = 0
          }
          break
        case 'fadingOut':
          this.opacity = Math.max(1 - this.fadeTimer / 0.2, 0)
          if (this.fadeTimer >= 0.2) {
            this.fadeState = 'gone'
            this.removed = true
            if (this.onPopped) this.onPopped()
          }
          break
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, gameScale: number, sprites?: SpriteAssets) {
    if (this.removed) return

    ctx.save()

    const drawX = this.x * gameScale
    const drawY = this.y * gameScale

    if (this.isPopping) {
      ctx.globalAlpha = this.popOpacity
      ctx.translate(drawX, drawY)
      ctx.scale(this.popScale, this.popScale)

      // Use burst sprite if available
      if (imgOk(sprites?.balloonBurst)) {
        const size = 160 * gameScale
        ctx.drawImage(sprites.balloonBurst, -size / 2, -size / 2, size, size)
      } else {
        const burstSize = 80 * gameScale
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          const dist = burstSize * 0.6
          ctx.fillStyle = this.isBubble
            ? `rgba(180, 220, 255, ${this.popOpacity})`
            : `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.popOpacity})`
          ctx.beginPath()
          ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, burstSize * 0.15, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
      return
    }

    ctx.globalAlpha = this.opacity

    if (this.isBubble) {
      ctx.translate(drawX, drawY)
      // Use bubble sprite if available
      const bubbleImg = sprites?.bubbleSprites?.[this.bubbleVariant]
      if (imgOk(bubbleImg)) {
        const size = 120 * gameScale
        ctx.drawImage(bubbleImg, -size / 2, -size / 2, size, size)
      } else {
        // Fallback canvas drawing
        const bubbleR = 55 * gameScale
        const grad = ctx.createRadialGradient(-bubbleR * 0.3, -bubbleR * 0.3, bubbleR * 0.1, 0, 0, bubbleR)
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)')
        grad.addColorStop(0.5, 'rgba(180, 220, 255, 0.3)')
        grad.addColorStop(1, 'rgba(120, 180, 255, 0.15)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(0, 0, bubbleR, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.beginPath()
        ctx.ellipse(-bubbleR * 0.25, -bubbleR * 0.25, bubbleR * 0.25, bubbleR * 0.15, -0.5, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.translate(drawX, drawY)
      const stage = Math.min(this.tapCount, 9)

      const baseImg = sprites?.balloonBase?.[stage]
      const shadingImg = sprites?.balloonShading?.[stage]

      if (imgOk(baseImg)) {
        // Cache tinted sprite (regenerate only when stage changes)
        if (!this._tintedSprite || this._tintedStage !== stage) {
          const pw = baseImg.naturalWidth
          const ph = baseImg.naturalHeight
          this._tintedSprite = document.createElement('canvas')
          this._tintedSprite.width = pw
          this._tintedSprite.height = ph
          const oc = this._tintedSprite.getContext('2d')!
          oc.drawImage(baseImg, 0, 0, pw, ph)
          oc.globalCompositeOperation = 'multiply'
          oc.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`
          oc.fillRect(0, 0, pw, ph)
          oc.globalCompositeOperation = 'destination-in'
          oc.drawImage(baseImg, 0, 0, pw, ph)
          oc.globalCompositeOperation = 'source-over'
          if (imgOk(shadingImg)) {
            oc.drawImage(shadingImg, 0, 0, pw, ph)
          }
          this._tintedStage = stage
        }

        // Match C++ behavior: sprite displayed at natural texture size (787x1548 game pts)
        // Visual growth comes from different opaque content in each stage sprite
        // scale is 1.0 for stages 1-10, extra scaling for tapCount > 9
        const imgW = baseImg.naturalWidth   // 787
        const imgH = baseImg.naturalHeight  // 1548
        const frameW = imgW * gameScale * this.scale
        const frameH = imgH * gameScale * this.scale

        // Anchor at center (0.5, 0.5) like Cocos2D default
        ctx.drawImage(this._tintedSprite, -frameW / 2, -frameH / 2, frameW, frameH)
      } else {
        // Fallback: canvas-drawn balloon
        const [bw, bh] = this.currentSize
        const w = bw * gameScale * this.scale * 0.5
        const h = bh * gameScale * this.scale * 0.5

        ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`
        ctx.beginPath()
        ctx.ellipse(0, -h * 0.2, w * 0.48, h * 0.48, 0, 0, Math.PI * 2)
        ctx.fill()

        const shadGrad = ctx.createRadialGradient(-w * 0.15, -h * 0.35, w * 0.05, 0, -h * 0.2, w * 0.48)
        shadGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
        shadGrad.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
        ctx.fillStyle = shadGrad
        ctx.beginPath()
        ctx.ellipse(0, -h * 0.2, w * 0.48, h * 0.48, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `rgb(${Math.max(this.color.r - 30, 0)}, ${Math.max(this.color.g - 30, 0)}, ${Math.max(this.color.b - 30, 0)})`
        ctx.beginPath()
        ctx.moveTo(-6 * gameScale, h * 0.25)
        ctx.lineTo(6 * gameScale, h * 0.25)
        ctx.lineTo(0, h * 0.32)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = '#888'
        ctx.lineWidth = 1.5 * gameScale
        ctx.beginPath()
        ctx.moveTo(0, h * 0.32)
        ctx.quadraticCurveTo(5 * gameScale, h * 0.5, -3 * gameScale, h * 0.65)
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  createTapLabel(): FloatingLabel {
    const color = POP_LABEL_COLORS[Math.floor(Math.random() * POP_LABEL_COLORS.length)]
    return {
      text: String(this.tapCount),
      x: this.x + (Math.random() - 0.5) * 100,
      y: this.y - 50,
      opacity: 1,
      color,
      fontSize: this.isBubble ? 40 : 50,
      startTime: performance.now() / 1000,
      duration: 0.7,
    }
  }
}
