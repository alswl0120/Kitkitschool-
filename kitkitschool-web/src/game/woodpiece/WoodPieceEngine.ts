/**
 * WoodPieceEngine — Shared engine for AlphabetPuzzle & NumberPuzzle
 *
 * Based on C++ WoodenPuzzles framework:
 *   OrderedPuzzleScene: pieces appear 3 at a time on the right DeckBase
 *   FreePuzzleScene: all pieces scattered on screen
 *   RandomOrderedPuzzle: ordered but shuffled sequence
 *
 * Rendering: 4-layer per piece (face, depth, shadow, slot)
 * Interaction: drag & drop with snap detection (AnimalPuzzle pattern)
 */

import { BaseEngine, GAME_WIDTH as GW, GAME_HEIGHT as GH, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

// ─── C++ Layout Constants ────────────────────────────────────

// DeckBase (C++: OrderedPuzzleScene, ANCHOR_MIDDLE_RIGHT)
const DECK_WIDTH = 350
const DECK_HEIGHT = 1735
const DECK_X = GW - 100           // right edge
const DECK_Y = GH / 2             // vertical center
const MAX_DECK_PIECES = 3

// Board position for OrderedPuzzle (C++: ANCHOR_MIDDLE_LEFT at x=100)
const BOARD_MARGIN = 100

// Snap radii (AnimalPuzzle-derived, C++ uses 60% area overlap)
const SNAP_RADIUS_DRAG = 40
const SNAP_RADIUS_RELEASE = 100

// Animation durations (C++ constants)
const ANIM_PIECE_DELAY = 0.4      // delay before new piece in Ordered mode
const SCATTER_DURATION = 0.5      // scatter-out animation duration

// ─── Data Types ──────────────────────────────────────────────

interface PieceData {
  id: number
  motif: string
  x: number; y: number             // Cocos2d coords (bottom-up, relative to board)
  face: string
  depth: string
  shadow: string
  slot: string
}

interface LevelData {
  level: number
  worksheet: number
  puzzleType: string               // OrderedPuzzle | FreePuzzle | RandomOrderedPuzzle
  gameID: string                   // asset subfolder (lowercase)
  boardImage: string
  pieces: PieceData[]
}

type GameType = 'alphabetpuzzle' | 'numberpuzzle'

interface Piece {
  data: PieceData
  faceImg: HTMLImageElement
  depthImg: HTMLImageElement
  shadowImg: HTMLImageElement
  slotImg: HTMLImageElement
  // Canvas positions (game coordinates, top-left corner of piece)
  currentX: number
  currentY: number
  targetX: number                  // snap target (slot position)
  targetY: number
  width: number
  height: number
  placed: boolean
  dragging: boolean
  snapAnim: number                 // 0→1 bounce on snap
  // Scatter animation (FreePuzzle)
  scatterTargetX: number
  scatterTargetY: number
  scatterDelay: number
  scatterProgress: number          // <0 = waiting, 0→1 = animating
  visible: boolean
  // Ordered mode: appears in deck
  inDeck: boolean
  deckY: number                    // position within deck
  deckAppearAnim: number           // 0→1 fade-in animation
}

export class WoodPieceEngine extends BaseEngine {
  game: GameType
  level: number
  levelData: LevelData | null = null
  pieces: Piece[] = []
  orderedQueue: Piece[] = []       // remaining pieces for Ordered mode
  dragPiece: Piece | null = null
  dragOffsetX = 0
  dragOffsetY = 0

  // Board layout (computed from board image)
  boardImg: HTMLImageElement | null = null
  boardNatW = 0                    // natural image width
  boardNatH = 0                    // natural image height
  boardX = 0                       // canvas game-coord top-left
  boardY = 0
  boardW = 0                       // drawn size in game coords
  boardH = 0

  // Background
  bgImg: HTMLImageElement

  // Sounds
  sfxHit: HTMLAudioElement[] = []
  sfxMiss: HTMLAudioElement
  sfxBirth: HTMLAudioElement

  // Callbacks
  declare onComplete?: () => void
  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, game: GameType, level: number) {
    super(canvas)
    this.game = game
    this.level = level

    const base = assetUrl(`/assets/games/${game}`)
    this.bgImg = loadImage(`${base}/background/wp_background.jpg`)

    // Sounds (C++: WoodenPuzzles/Sounds/)
    const soundBase = assetUrl(`/assets/games/${game}/sounds`)
    for (let i = 0; i <= 5; i++) {
      this.sfxHit.push(loadAudio(`${soundBase}/card_hit.${i}.m4a`))
    }
    this.sfxMiss = loadAudio(`${soundBase}/card_miss.m4a`)
    this.sfxBirth = loadAudio(`${soundBase}/card_birth.m4a`)
  }

  start() {
    super.start()
    this.loadLevel()
  }

  async loadLevel() {
    const resp = await fetch(`/data/games/${this.game}.json`)
    const data = await resp.json()

    // Find level (may have multiple worksheets — pick random)
    const candidates = (data.levels as LevelData[]).filter(l => l.level === this.level)
    if (candidates.length === 0) return

    this.levelData = candidates[Math.floor(Math.random() * candidates.length)]
    this.setupPuzzle()
  }

  setupPuzzle() {
    const ld = this.levelData
    if (!ld) return

    this.pieces = []
    this.orderedQueue = []
    this.dragPiece = null

    // Load board image
    const assetBase = assetUrl(`/assets/games/${this.game}/${ld.gameID}`)
    this.boardImg = loadImage(`${assetBase}/${ld.boardImage}`)

    // Determine piece order
    let pieceOrder = [...ld.pieces]
    if (ld.puzzleType === 'RandomOrderedPuzzle') {
      // Shuffle
      for (let i = pieceOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieceOrder[i], pieceOrder[j]] = [pieceOrder[j], pieceOrder[i]]
      }
    }

    // Create Piece objects
    for (const pd of pieceOrder) {
      const faceImg = loadImage(`${assetBase}/${pd.face}`)
      const depthImg = loadImage(`${assetBase}/${pd.depth}`)
      const shadowImg = loadImage(`${assetBase}/${pd.shadow}`)
      const slotImg = loadImage(`${assetBase}/${pd.slot}`)

      const piece: Piece = {
        data: pd,
        faceImg, depthImg, shadowImg, slotImg,
        currentX: 0, currentY: 0,
        targetX: 0, targetY: 0,
        width: 200, height: 200,
        placed: false,
        dragging: false,
        snapAnim: 0,
        scatterTargetX: 0, scatterTargetY: 0,
        scatterDelay: 0, scatterProgress: 1, // default: no scatter
        visible: false,
        inDeck: false,
        deckY: 0,
        deckAppearAnim: 1,
      }
      this.pieces.push(piece)
    }

    // Mode-specific setup
    const isOrdered = ld.puzzleType === 'OrderedPuzzle' || ld.puzzleType === 'RandomOrderedPuzzle'

    if (isOrdered) {
      // OrderedPuzzle: queue all pieces, show first batch in deck
      this.orderedQueue = [...this.pieces]
      for (const p of this.pieces) {
        p.visible = false
        p.inDeck = false
      }
      this.fillDeck()
    } else {
      // FreePuzzle: scatter all pieces below board
      for (let i = 0; i < this.pieces.length; i++) {
        const p = this.pieces[i]
        p.visible = true
        p.scatterDelay = 0.3 + Math.random() * 0.5
        p.scatterProgress = -p.scatterDelay
      }
    }

    this.onProgressChange?.(0, ld.pieces.length)
  }

  /** Fill the deck with up to MAX_DECK_PIECES from the queue */
  fillDeck() {
    const deckPieces = this.pieces.filter(p => p.inDeck && !p.placed)
    const slotsAvailable = MAX_DECK_PIECES - deckPieces.length

    for (let i = 0; i < slotsAvailable && this.orderedQueue.length > 0; i++) {
      const piece = this.orderedQueue.shift()!
      piece.inDeck = true
      piece.visible = true
      piece.deckAppearAnim = 0
      playSound(this.sfxBirth)
    }

    // Position deck pieces vertically
    const deckActive = this.pieces.filter(p => p.inDeck && !p.placed)
    for (let i = 0; i < deckActive.length; i++) {
      const p = deckActive[i]
      p.deckY = DECK_HEIGHT * (MAX_DECK_PIECES - i) / (MAX_DECK_PIECES + 1)
    }
  }

  /** Helper: true if an image loaded successfully (not broken) */
  /** Compute board layout once the board image loads */
  updateBoardLayout() {
    if (!this.boardImg?.complete || this.boardImg.naturalWidth === 0 || this.boardNatW > 0) return

    this.boardNatW = this.boardImg.width
    this.boardNatH = this.boardImg.height

    const ld = this.levelData!
    const isOrdered = ld.puzzleType === 'OrderedPuzzle' || ld.puzzleType === 'RandomOrderedPuzzle'

    if (isOrdered) {
      // C++: GameBoard ANCHOR_MIDDLE_LEFT at (100, gameSize.height/2)
      // Available width = GW - 100 (left margin) - DECK_WIDTH - 100 (right margin for deck)
      const availW = GW - BOARD_MARGIN - DECK_WIDTH - BOARD_MARGIN
      const availH = GH - 60  // small top/bottom padding

      const scale = Math.min(availW / this.boardNatW, availH / this.boardNatH)
      this.boardW = this.boardNatW * scale
      this.boardH = this.boardNatH * scale
      this.boardX = BOARD_MARGIN + (availW - this.boardW) / 2
      this.boardY = (GH - this.boardH) / 2
    } else {
      // C++: GameBoard ANCHOR_MIDDLE at (gameSize/2)
      // Reserve ~35% of height at the bottom for scattered pieces, else they get cut off.
      const maxBoardH = GH * 0.62
      const scale = Math.min((GW - 40) / this.boardNatW, maxBoardH / this.boardNatH)
      this.boardW = this.boardNatW * scale
      this.boardH = this.boardNatH * scale
      // Align board to the top area, leaving room at bottom for pieces
      this.boardX = (GW - this.boardW) / 2
      this.boardY = Math.max(20, (GH * 0.62 - this.boardH) / 2)
    }

    // Compute target positions for all pieces
    this.computePieceTargets()
  }

  /** Convert Cocos2d piece positions to canvas game-coords */
  computePieceTargets() {
    if (this.boardNatW === 0) return

    const scaleX = this.boardW / this.boardNatW
    const scaleY = this.boardH / this.boardNatH

    for (const piece of this.pieces) {
      // Piece image dimensions — only use natural size if image loaded OK
      const faceOk = imgOk(piece.faceImg)
      const pw = faceOk ? piece.faceImg.width * scaleX : piece.width * scaleX
      const ph = faceOk ? piece.faceImg.height * scaleY : piece.height * scaleY
      piece.width = pw
      piece.height = ph

      // C++ position is center of piece in Cocos2d (bottom-up) relative to board
      // Convert to canvas (top-down) top-left corner
      const cx = this.boardX + piece.data.x * scaleX
      const cy = this.boardY + (this.boardNatH - piece.data.y) * scaleY
      piece.targetX = cx - pw / 2
      piece.targetY = cy - ph / 2

      // For FreePuzzle: set scatter positions
      if (!piece.inDeck && !piece.placed) {
        const margin = 40
        piece.scatterTargetX = margin + Math.random() * (GW - pw - margin * 2)
        piece.scatterTargetY = this.boardY + this.boardH + margin +
          Math.random() * Math.max(0, GH - (this.boardY + this.boardH) - ph - margin * 2)

        // If not enough space below board, scatter to the sides
        if (piece.scatterTargetY + ph > GH - margin) {
          piece.scatterTargetY = margin + Math.random() * (GH - ph - margin * 2)
        }

        // Start from target position (like C++)
        if (piece.scatterProgress < 0) {
          piece.currentX = piece.targetX
          piece.currentY = piece.targetY
        }
      }
    }
  }

  // ─── Input ───────────────────────────────────────────────────

  onPointerDown(x: number, y: number) {
    if (this.dragPiece) return

    // Find topmost unplaced visible piece under pointer
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i]
      if (piece.placed || !piece.visible) continue
      if (piece.scatterProgress < 0) continue // not yet visible

      if (x >= piece.currentX && x <= piece.currentX + piece.width &&
          y >= piece.currentY && y <= piece.currentY + piece.height) {
        piece.dragging = true
        piece.inDeck = false // remove from deck when picked
        this.dragPiece = piece
        this.dragOffsetX = x - piece.currentX
        this.dragOffsetY = y - piece.currentY

        // Move to top of render order
        const idx = this.pieces.indexOf(piece)
        this.pieces.splice(idx, 1)
        this.pieces.push(piece)
        return
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.dragPiece) return
    this.dragPiece.currentX = x - this.dragOffsetX
    this.dragPiece.currentY = y - this.dragOffsetY

    // Snap while dragging if very close
    const dist = this.distToTarget(this.dragPiece)
    if (dist < SNAP_RADIUS_DRAG) {
      this.snapPiece(this.dragPiece)
    }
  }

  onPointerUp() {
    if (!this.dragPiece) return
    const piece = this.dragPiece

    const dist = this.distToTarget(piece)
    if (dist < SNAP_RADIUS_RELEASE) {
      this.snapPiece(piece)
    } else {
      // Miss - play miss sound
      playSound(this.sfxMiss)

      // For ordered mode: return to deck
      const ld = this.levelData!
      const isOrdered = ld.puzzleType !== 'FreePuzzle'
      if (isOrdered) {
        piece.inDeck = true
        // Re-position in deck
        const deckActive = this.pieces.filter(p => p.inDeck && !p.placed)
        for (let i = 0; i < deckActive.length; i++) {
          deckActive[i].deckY = DECK_HEIGHT * (MAX_DECK_PIECES - i) / (MAX_DECK_PIECES + 1)
        }
      }
    }

    piece.dragging = false
    this.dragPiece = null
  }

  distToTarget(piece: Piece): number {
    const cx = piece.currentX + piece.width / 2
    const cy = piece.currentY + piece.height / 2
    const tx = piece.targetX + piece.width / 2
    const ty = piece.targetY + piece.height / 2
    return Math.sqrt((cx - tx) ** 2 + (cy - ty) ** 2)
  }

  snapPiece(piece: Piece) {
    if (piece.placed) return

    piece.currentX = piece.targetX
    piece.currentY = piece.targetY
    piece.placed = true
    piece.dragging = false
    piece.inDeck = false
    piece.snapAnim = 0
    this.dragPiece = null

    // Play hit sound (random from 6)
    playSound(this.sfxHit[Math.floor(Math.random() * this.sfxHit.length)])

    // Update progress
    const placedCount = this.pieces.filter(p => p.placed).length
    this.onProgressChange?.(placedCount, this.pieces.length)

    // Check completion
    if (this.pieces.every(p => p.placed)) {
      setTimeout(() => {
        this.gameState = 'complete'
        this.onComplete?.()
      }, 800)
    } else {
      // OrderedPuzzle: refill deck after delay
      const ld = this.levelData!
      if (ld.puzzleType !== 'FreePuzzle') {
        setTimeout(() => this.fillDeck(), ANIM_PIECE_DELAY * 1000)
      }
    }
  }

  // ─── Update ──────────────────────────────────────────────────

  update(_time: number, dt: number) {
    this.updateBoardLayout()

    // Recompute targets if images loaded
    if (this.boardNatW > 0) {
      let needsRecompute = false
      for (const p of this.pieces) {
        if (imgOk(p.faceImg) && p.width !== p.faceImg.width * (this.boardW / this.boardNatW)) {
          needsRecompute = true
          break
        }
      }
      if (needsRecompute) this.computePieceTargets()
    }

    for (const piece of this.pieces) {
      if (!piece.visible) continue

      // Scatter animation (FreePuzzle)
      if (!piece.placed && !piece.dragging && !piece.inDeck && piece.scatterProgress < 1) {
        piece.scatterProgress += dt
        if (piece.scatterProgress >= 0) {
          const t = Math.min(piece.scatterProgress / SCATTER_DURATION, 1)
          const eased = 1 - (1 - t) * (1 - t) // EaseOut
          piece.currentX = piece.targetX + (piece.scatterTargetX - piece.targetX) * eased
          piece.currentY = piece.targetY + (piece.scatterTargetY - piece.targetY) * eased
        }
      }

      // Deck position (Ordered mode)
      if (piece.inDeck && !piece.dragging && !piece.placed) {
        // Animate to deck position
        const ld = this.levelData!
        const isOrdered = ld.puzzleType !== 'FreePuzzle'
        if (isOrdered) {
          const deckLeft = DECK_X - DECK_WIDTH
          const targetX = deckLeft + (DECK_WIDTH - piece.width) / 2
          const targetY = DECK_Y - DECK_HEIGHT / 2 + piece.deckY - piece.height / 2
          piece.currentX += (targetX - piece.currentX) * Math.min(dt * 8, 1)
          piece.currentY += (targetY - piece.currentY) * Math.min(dt * 8, 1)

          if (piece.deckAppearAnim < 1) {
            piece.deckAppearAnim = Math.min(piece.deckAppearAnim + dt * 3, 1)
          }
        }
      }

      // Snap animation
      if (piece.placed && piece.snapAnim < 1) {
        piece.snapAnim = Math.min(piece.snapAnim + dt * 4, 1)
      }
    }
  }

  // ─── Draw ────────────────────────────────────────────────────

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Background (fills entire screen)
    this.drawBackgroundImage(this.bgImg, w, h)

    const offsetX = (w - GW * this.gameScale) / 2
    const offsetY = (h - GH * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Board image
    if (imgOk(this.boardImg) && this.boardNatW > 0) {
      ctx.drawImage(this.boardImg!,
        this.boardX * gs, this.boardY * gs,
        this.boardW * gs, this.boardH * gs)
    } else if (this.boardNatW > 0) {
      // Fallback: draw a plain board background
      ctx.fillStyle = '#F5DEB3'
      ctx.strokeStyle = '#8B6914'
      ctx.lineWidth = 4 * gs
      ctx.beginPath()
      ctx.roundRect(this.boardX * gs, this.boardY * gs, this.boardW * gs, this.boardH * gs, 12 * gs)
      ctx.fill()
      ctx.stroke()
    }

    // C++ WoodSlot: SlotSprite always visible, full opacity
    for (const piece of this.pieces) {
      if (imgOk(piece.slotImg) && this.boardNatW > 0) {
        ctx.drawImage(piece.slotImg,
          piece.targetX * gs, piece.targetY * gs,
          piece.width * gs, piece.height * gs)
      } else if (this.boardNatW > 0 && !piece.placed) {
        // Fallback slot: dashed rounded rect with the piece motif as text
        const sx = piece.targetX * gs
        const sy = piece.targetY * gs
        const sw = piece.width * gs
        const sh = piece.height * gs
        ctx.save()
        ctx.setLineDash([8 * gs, 6 * gs])
        ctx.strokeStyle = 'rgba(100,70,30,0.5)'
        ctx.lineWidth = 3 * gs
        ctx.beginPath()
        ctx.roundRect(sx, sy, sw, sh, 10 * gs)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(100,70,30,0.15)'
        ctx.fill()
        ctx.fillStyle = 'rgba(100,70,30,0.4)'
        ctx.font = `bold ${Math.min(sw, sh) * 0.45}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(piece.data.motif, sx + sw / 2, sy + sh / 2)
        ctx.restore()
      }
    }

    // C++ PLACED: switchTo2D() — face only (no depth, no shadow)
    for (const piece of this.pieces) {
      if (piece.placed) {
        this.drawPlacedPiece(piece, gs)
      }
    }

    // C++ UNPLACED pieces: shadow(z=10) + depth(z=20) + face(z=30), all full opacity (3D)
    for (const piece of this.pieces) {
      if (!piece.placed && piece.visible && (piece.scatterProgress >= 0 || piece.inDeck)) {
        this.drawPiece3D(piece, gs)
      }
    }

    ctx.restore()
  }

  /** Draw a fallback tile (rounded rect + motif text) when sprite images are missing */
  drawPieceFallback(
    piece: Piece,
    x: number, y: number,
    pw: number, ph: number,
    gs: number,
    lifted = false,
  ) {
    const { ctx } = this
    ctx.save()
    if (lifted) ctx.translate(0, -4 * gs)

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.roundRect(x + 5 * gs, y + 5 * gs, pw, ph, 10 * gs)
    ctx.fill()

    // Face
    ctx.fillStyle = piece.dragging ? '#FFD54F' : '#FFCC02'
    ctx.strokeStyle = '#B8860B'
    ctx.lineWidth = 3 * gs
    ctx.beginPath()
    ctx.roundRect(x, y, pw, ph, 10 * gs)
    ctx.fill()
    ctx.stroke()

    // Motif text
    ctx.fillStyle = '#5D4037'
    ctx.font = `bold ${Math.min(pw, ph) * 0.5}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(piece.data.motif, x + pw / 2, y + ph / 2)

    ctx.restore()
  }

  /** C++ switchTo2D: placed piece — face only at target position */
  drawPlacedPiece(piece: Piece, gs: number) {
    const { ctx } = this
    const pw = piece.width * gs
    const ph = piece.height * gs
    const bx = piece.targetX * gs
    const by = piece.targetY * gs

    const faceOk = imgOk(piece.faceImg)
    if (!faceOk) {
      this.drawPieceFallback(piece, bx, by, pw, ph, gs)
      return
    }

    if (piece.snapAnim < 1) {
      // Snap bounce animation
      const scale = 1 + Math.sin(piece.snapAnim * Math.PI) * 0.15
      ctx.save()
      ctx.translate(bx + pw / 2, by + ph / 2)
      ctx.scale(scale, scale)
      ctx.drawImage(piece.faceImg, -pw / 2, -ph / 2, pw, ph)
      ctx.restore()
    } else {
      ctx.drawImage(piece.faceImg, bx, by, pw, ph)
    }
  }

  /** C++ 3D mode: unplaced piece — shadow + depth + face, all full opacity */
  drawPiece3D(piece: Piece, gs: number) {
    const { ctx } = this
    const pw = piece.width * gs
    const ph = piece.height * gs
    const bx = piece.currentX * gs
    const by = piece.currentY * gs

    // Deck appear animation
    if (piece.inDeck && piece.deckAppearAnim < 1) {
      ctx.globalAlpha = piece.deckAppearAnim
    }

    const faceOk = imgOk(piece.faceImg)
    if (!faceOk) {
      this.drawPieceFallback(piece, bx, by, pw, ph, gs, piece.dragging)
    } else if (piece.dragging) {
      // Dragging: drop shadow offset + piece lifted
      if (imgOk(piece.shadowImg)) {
        ctx.drawImage(piece.shadowImg, bx + 6 * gs, by + 6 * gs, pw, ph)
      }
      if (imgOk(piece.depthImg)) {
        ctx.drawImage(piece.depthImg, bx, by - 4 * gs, pw, ph)
      }
      ctx.drawImage(piece.faceImg, bx, by - 4 * gs, pw, ph)
    } else {
      // In deck / scatter: shadow + depth + face at same position (3D stack)
      if (imgOk(piece.shadowImg)) {
        ctx.drawImage(piece.shadowImg, bx, by, pw, ph)
      }
      if (imgOk(piece.depthImg)) {
        ctx.drawImage(piece.depthImg, bx, by, pw, ph)
      }
      ctx.drawImage(piece.faceImg, bx, by, pw, ph)
    }

    if (piece.inDeck && piece.deckAppearAnim < 1) {
      ctx.globalAlpha = 1
    }
  }
}
