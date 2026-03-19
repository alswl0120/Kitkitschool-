export const GAME_WIDTH = 2560
export const GAME_HEIGHT = 1800

export function loadImage(src: string): HTMLImageElement {
  const img = new Image()
  img.src = src
  return img
}

/**
 * Returns true if an image has fully loaded AND is valid (not a broken/404 image).
 * A failed/404 image has complete=true but naturalWidth=0.
 */
export function imgOk(img: HTMLImageElement | null | undefined): img is HTMLImageElement {
  return !!(img?.complete && img.naturalWidth > 0)
}

export function loadAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src)
  audio.preload = 'auto'
  return audio
}

export function playSound(audio: HTMLAudioElement, volume = 0.6) {
  const clone = audio.cloneNode(true) as HTMLAudioElement
  clone.volume = volume
  clone.play().catch(() => {})
}

export type GameState = 'playing' | 'complete'

export abstract class BaseEngine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  gameScale = 1
  lastTime = 0
  animFrameId = 0
  gameState: GameState = 'playing'

  onComplete?: () => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
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

  start() {
    this.resize()
    this.gameState = 'playing'
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('resize', this.resize)
    this.lastTime = performance.now() / 1000
    this.loop()
  }

  stop() {
    cancelAnimationFrame(this.animFrameId)
    clearTimeout(this.animFrameId)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('resize', this.resize)
  }

  toGameCoords(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top
    const w = rect.width
    const h = rect.height
    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    return {
      x: (canvasX - offsetX) / this.gameScale,
      y: (canvasY - offsetY) / this.gameScale,
    }
  }

  handlePointerDown = (e: PointerEvent) => {
    if (this.gameState !== 'playing') return
    e.preventDefault()
    this.canvas.setPointerCapture(e.pointerId)
    const pos = this.toGameCoords(e)
    this.onPointerDown(pos.x, pos.y)
  }

  handlePointerMove = (e: PointerEvent) => {
    if (this.gameState !== 'playing') return
    e.preventDefault()
    const pos = this.toGameCoords(e)
    this.onPointerMove(pos.x, pos.y)
  }

  handlePointerUp = (e: PointerEvent) => {
    if (this.gameState !== 'playing') return
    e.preventDefault()
    try { this.canvas.releasePointerCapture(e.pointerId) } catch { /* */ }
    const pos = this.toGameCoords(e)
    this.onPointerUp(pos.x, pos.y)
  }

  loop = () => {
    const now = performance.now() / 1000
    const dt = Math.min(now - this.lastTime, 0.05)
    this.lastTime = now
    // Only update game logic while playing; draw() continues so the final
    // frame stays visible until the completion overlay / navigation arrives.
    if (this.gameState === 'playing') {
      this.update(now, dt)
    }
    this.draw()
    // Use setTimeout fallback when page is hidden (requestAnimationFrame pauses)
    if (document.hidden) {
      this.animFrameId = window.setTimeout(this.loop, 16) as unknown as number
    } else {
      this.animFrameId = requestAnimationFrame(this.loop)
    }
  }

  drawBackgroundImage(img: HTMLImageElement, w: number, h: number) {
    if (!imgOk(img)) return
    const imgRatio = img.naturalWidth / img.naturalHeight
    const canvasRatio = w / h
    let dw: number, dh: number, dx: number, dy: number
    if (canvasRatio > imgRatio) {
      dw = w; dh = w / imgRatio; dx = 0; dy = (h - dh) / 2
    } else {
      dh = h; dw = h * imgRatio; dx = (w - dw) / 2; dy = 0
    }
    this.ctx.drawImage(img, dx, dy, dw, dh)
  }

  abstract onPointerDown(x: number, y: number): void
  abstract onPointerMove(x: number, y: number): void
  abstract onPointerUp(x: number, y: number): void
  abstract update(time: number, dt: number): void
  abstract draw(): void
}
