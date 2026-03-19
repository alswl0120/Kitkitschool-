import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/animalpuzzle')

// C++ constants from AnimalPuzzleSceneSpace
const BOARD_WIDTH = 2407
const BOARD_HEIGHT = 1296
const FRAME_WIDTH = 2426
const FRAME_HEIGHT = 1315
const SNAP_RADIUS_MOVED = 20
const SNAP_RADIUS_ENDED = 80

// Board origin: top-aligned so the bottom scatter area is ~444 design px tall.
// Puzzle background images are exactly 2407×1296 px (1:1 with design space).
const BOARD_ORIGIN_X = (GAME_WIDTH - BOARD_WIDTH) / 2   // 76.5
const BOARD_ORIGIN_Y = 60                                 // leaves 444 px below for pieces

// Available vertical space for scattered pieces (below board bottom)
const BOARD_BOTTOM_Y = BOARD_ORIGIN_Y + BOARD_HEIGHT      // 1356
const SCATTER_AREA_H = GAME_HEIGHT - BOARD_BOTTOM_Y       // 444

interface PieceData {
  pieceNumber: number
  filenamePrefix: string
  posX: number
  posY: number
  depth: string | null
  shadow: string | null
}

interface PuzzleData {
  languageTag: string
  level: number
  puzzleIndex: number
  text: string
  folderName: string
  background: string
  pieceCount: number
  mask: string | null
  sound: string | null
  pieces: PieceData[]
}

interface PuzzlePiece {
  data: PieceData
  image: HTMLImageElement
  depthImage: HTMLImageElement | null
  shadowImage: HTMLImageElement | null
  currentX: number
  currentY: number
  targetX: number
  targetY: number
  width: number
  height: number
  // Scale applied when drawing in scatter tray (piece images can be 700-1100 px tall,
  // larger than the 444-px scatter area). scatterScale shrinks them to fit.
  scatterScale: number
  placed: boolean
  dragging: boolean
  snapAnim: number
  scatterTargetX: number
  scatterTargetY: number
  scatterDelay: number
  scatterProgress: number
  bodyVisible: boolean
}

/** Compute how much to scale a piece so it fits in the scatter tray */
function computeScatterScale(w: number, h: number): number {
  const maxH = SCATTER_AREA_H * 0.82          // 82% of tray height
  const maxW = (GAME_WIDTH / 4) * 0.9         // max ~25% of screen width
  return Math.min(1.0, maxH / h, maxW / w)
}

export default class AnimalPuzzleEngine extends BaseEngine {
  level: number
  puzzles: PuzzleData[] = []
  currentPuzzleIndex = 0
  pieces: PuzzlePiece[] = []
  dragPiece: PuzzlePiece | null = null
  dragOffsetX = 0
  dragOffsetY = 0
  totalPuzzles = 0
  solvedCount = 0

  bgImage: HTMLImageElement
  boardFrame: HTMLImageElement
  puzzleBgImage: HTMLImageElement | null = null

  sfxPick: HTMLAudioElement
  sfxSnap: HTMLAudioElement
  sfxSolve: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    this.bgImage = loadImage(`${ASSET_PATH}/_ap_woodbackground.jpg`)
    this.boardFrame = loadImage(`${ASSET_PATH}/ap_boardframe.png`)

    // C++: SFX_Wood_SlideOut, SFX_Wood_Correct, SFX_Counting_Win
    this.sfxPick = loadAudio(assetUrl('/assets/games/animalpuzzle/sound/sfx_wood_slideout.m4a'))
    this.sfxSnap = loadAudio(assetUrl('/assets/games/animalpuzzle/sound/sfx_wood_correct.m4a'))
    this.sfxSolve = loadAudio(assetUrl('/assets/games/animalpuzzle/sound/sfx_counting_win.m4a'))
  }

  async loadLevel() {
    const resp = await fetch('/data/games/animalpuzzle.json')
    const data = await resp.json()
    const levelKey = String(this.level)
    this.puzzles = data.levels[levelKey] || []

    if (this.puzzles.length === 0) return

    // C++: for level >= 5, shuffle puzzles and pick only 1
    if (this.level >= 5) {
      for (let i = this.puzzles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.puzzles[i], this.puzzles[j]] = [this.puzzles[j], this.puzzles[i]]
      }
      this.puzzles = [this.puzzles[0]]
    }

    this.totalPuzzles = this.puzzles.length
    this.solvedCount = 0
    this.currentPuzzleIndex = 0
    this.setupPuzzle()
  }

  /**
   * Convert piece data position (Cocos2d bottom-left relative to board)
   * to canvas top-left in game space (Y-down).
   */
  pieceTargetCanvasPos(posX: number, posY: number, pieceW: number, pieceH: number) {
    return {
      x: BOARD_ORIGIN_X + posX,
      y: BOARD_ORIGIN_Y + (BOARD_HEIGHT - posY - pieceH),
    }
  }

  setupPuzzle() {
    const puzzle = this.puzzles[this.currentPuzzleIndex]
    if (!puzzle) return

    this.pieces = []
    this.dragPiece = null

    // Load puzzle background
    this.puzzleBgImage = loadImage(`${ASSET_PATH}/${puzzle.folderName}${puzzle.background}`)

    const startDelay = puzzle.text.length > 15 ? 2.0 : 1.2

    for (let i = 0; i < puzzle.pieces.length; i++) {
      const pieceData = puzzle.pieces[i]
      const image = loadImage(`${ASSET_PATH}/${puzzle.folderName}${pieceData.filenamePrefix}.png`)
      const depthImage = loadImage(`${ASSET_PATH}/${puzzle.folderName}${pieceData.filenamePrefix}depth.png`)
      const shadowImage = loadImage(`${ASSET_PATH}/${puzzle.folderName}${pieceData.filenamePrefix}shadow.png`)

      const defaultW = 400
      const defaultH = 400
      const initScale = computeScatterScale(defaultW, defaultH)

      const target = this.pieceTargetCanvasPos(pieceData.posX, pieceData.posY, defaultW, defaultH)

      const sw = defaultW * initScale
      const sh = defaultH * initScale
      const scatterX = Math.random() * Math.max(0, GAME_WIDTH - sw)
      const scatterY = BOARD_BOTTOM_Y + Math.random() * Math.max(0, SCATTER_AREA_H - sh)
      const scatterDelay = startDelay + Math.random() * 0.5

      this.pieces.push({
        data: pieceData,
        image,
        depthImage,
        shadowImage,
        currentX: target.x,
        currentY: target.y,
        targetX: target.x,
        targetY: target.y,
        width: defaultW,
        height: defaultH,
        scatterScale: initScale,
        placed: false,
        dragging: false,
        snapAnim: 0,
        scatterTargetX: scatterX,
        scatterTargetY: scatterY,
        scatterDelay,
        scatterProgress: -scatterDelay,
        bodyVisible: false,
      })
    }

    this.onProgressChange?.(this.solvedCount + 1, this.totalPuzzles)
  }

  /** Update piece dimensions + scatterScale once images finish loading */
  updatePieceTargetsFromImages() {
    for (const piece of this.pieces) {
      if (imgOk(piece.image) &&
          (piece.width !== piece.image.width || piece.height !== piece.image.height)) {
        piece.width = piece.image.width
        piece.height = piece.image.height
        piece.scatterScale = computeScatterScale(piece.width, piece.height)

        // Recompute board target position with actual dimensions
        const target = this.pieceTargetCanvasPos(
          piece.data.posX, piece.data.posY, piece.width, piece.height
        )
        const wasAtOldTarget = (piece.currentX === piece.targetX && piece.currentY === piece.targetY)
        piece.targetX = target.x
        piece.targetY = target.y

        if (wasAtOldTarget && piece.scatterProgress < 0) {
          piece.currentX = target.x
          piece.currentY = target.y
        }

        // Update scatter target using scaled dimensions so it fits in the tray
        const sw = piece.width * piece.scatterScale
        const sh = piece.height * piece.scatterScale
        piece.scatterTargetX = Math.random() * Math.max(0, GAME_WIDTH - sw)
        piece.scatterTargetY = BOARD_BOTTOM_Y + Math.random() * Math.max(0, SCATTER_AREA_H - sh)
      }
    }
  }

  start() {
    super.start()
    this.loadLevel()
  }

  onPointerDown(x: number, y: number) {
    if (this.dragPiece) return

    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i]
      if (piece.placed || !piece.bodyVisible) continue

      // Hit test uses scatter-scaled dimensions (the visible size)
      const pw = piece.width * piece.scatterScale
      const ph = piece.height * piece.scatterScale

      if (x >= piece.currentX && x <= piece.currentX + pw &&
          y >= piece.currentY && y <= piece.currentY + ph) {
        piece.dragging = true
        this.dragPiece = piece
        // Store offset relative to scatter-scaled top-left
        this.dragOffsetX = x - piece.currentX
        this.dragOffsetY = y - piece.currentY

        playSound(this.sfxPick)

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

    // Snap check uses full-size piece center vs target center
    const piece = this.dragPiece
    const cx = piece.currentX + piece.width / 2
    const cy = piece.currentY + piece.height / 2
    const tx = piece.targetX + piece.width / 2
    const ty = piece.targetY + piece.height / 2
    if (Math.sqrt((cx - tx) ** 2 + (cy - ty) ** 2) < SNAP_RADIUS_MOVED) {
      this.snapPiece(piece)
    }
  }

  onPointerUp(_x: number, _y: number) {
    if (!this.dragPiece) return
    const piece = this.dragPiece

    const cx = piece.currentX + piece.width / 2
    const cy = piece.currentY + piece.height / 2
    const tx = piece.targetX + piece.width / 2
    const ty = piece.targetY + piece.height / 2

    if (Math.sqrt((cx - tx) ** 2 + (cy - ty) ** 2) < SNAP_RADIUS_ENDED) {
      this.snapPiece(piece)
    }

    piece.dragging = false
    this.dragPiece = null
  }

  snapPiece(piece: PuzzlePiece) {
    if (piece.placed) return
    piece.currentX = piece.targetX
    piece.currentY = piece.targetY
    piece.placed = true
    piece.dragging = false
    piece.snapAnim = 0
    this.dragPiece = null

    const allPlaced = this.pieces.every(p => p.placed)
    if (allPlaced) {
      this.solvedCount++
      playSound(this.sfxSolve)
      const puzzle = this.puzzles[this.currentPuzzleIndex]
      const voiceDelay = puzzle && puzzle.text.length > 15 ? 2.0 : 1.0
      setTimeout(() => { this.advancePuzzle() }, (voiceDelay + 1.0) * 1000)
    } else {
      playSound(this.sfxSnap)
    }
  }

  advancePuzzle() {
    if (this.currentPuzzleIndex < this.puzzles.length - 1) {
      this.currentPuzzleIndex++
      this.setupPuzzle()
    } else {
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  update(_time: number, dt: number) {
    this.updatePieceTargetsFromImages()

    for (const piece of this.pieces) {
      if (!piece.placed && piece.scatterProgress < 1) {
        piece.scatterProgress += dt
        if (piece.scatterProgress >= 0 && !piece.bodyVisible) {
          piece.bodyVisible = true
        }
        if (piece.bodyVisible) {
          const t = Math.min(Math.max(piece.scatterProgress / 0.5, 0), 1)
          const eased = 1 - (1 - t) * (1 - t)
          piece.currentX = piece.targetX + (piece.scatterTargetX - piece.targetX) * eased
          piece.currentY = piece.targetY + (piece.scatterTargetY - piece.targetY) * eased
        }
      }

      if (piece.placed && piece.snapAnim < 1) {
        piece.snapAnim = Math.min(piece.snapAnim + dt * 4, 1)
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

    // Board area metrics
    const puzzleAreaX = BOARD_ORIGIN_X * gs
    const puzzleAreaY = BOARD_ORIGIN_Y * gs
    const puzzleAreaW = BOARD_WIDTH * gs
    const puzzleAreaH = BOARD_HEIGHT * gs

    // Board frame (aligned to the board position)
    if (imgOk(this.boardFrame)) {
      const frameW = FRAME_WIDTH * gs
      const frameH = FRAME_HEIGHT * gs
      const frameX = ((GAME_WIDTH - FRAME_WIDTH) / 2) * gs
      const frameY = (BOARD_ORIGIN_Y - (FRAME_HEIGHT - BOARD_HEIGHT) / 2) * gs
      ctx.drawImage(this.boardFrame, frameX, frameY, frameW, frameH)
    } else {
      // Fallback board frame
      ctx.strokeStyle = '#5D4037'
      ctx.lineWidth = 8 * gs
      ctx.strokeRect(puzzleAreaX, puzzleAreaY, puzzleAreaW, puzzleAreaH)
    }

    // Puzzle background (clipped to board area)
    if (imgOk(this.puzzleBgImage)) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(puzzleAreaX, puzzleAreaY, puzzleAreaW, puzzleAreaH)
      ctx.clip()
      ctx.drawImage(this.puzzleBgImage!, puzzleAreaX, puzzleAreaY, puzzleAreaW, puzzleAreaH)
      ctx.restore()
    } else {
      ctx.fillStyle = '#FFF8E1'
      ctx.fillRect(puzzleAreaX, puzzleAreaY, puzzleAreaW, puzzleAreaH)
    }

    // Slot shadows at target positions (full size — they're on the board)
    for (const piece of this.pieces) {
      if (!piece.placed) this.drawSlotShadow(piece, gs)
    }

    // Placed pieces (full size on board)
    for (const piece of this.pieces) {
      if (piece.placed) this.drawPlacedPiece(piece, gs)
    }

    // Scattered / dragging pieces
    for (const piece of this.pieces) {
      if (!piece.placed && piece.bodyVisible) this.drawActivePiece(piece, gs)
    }

    // Completion text
    const puzzle = this.puzzles[this.currentPuzzleIndex]
    if (puzzle && this.pieces.every(p => p.placed)) {
      ctx.fillStyle = '#464646'
      ctx.font = `bold ${80 * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 4 * gs
      ctx.fillText(puzzle.text, (GAME_WIDTH / 2) * gs, (GAME_HEIGHT - 80) * gs)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }

    ctx.restore()
  }

  /** Draw slot shadow at full size on the board */
  drawSlotShadow(piece: PuzzlePiece, gs: number) {
    const { ctx } = this
    const pw = (imgOk(piece.image) ? piece.image.width : piece.width) * gs
    const ph = (imgOk(piece.image) ? piece.image.height : piece.height) * gs
    const tx = piece.targetX * gs
    const ty = piece.targetY * gs

    if (imgOk(piece.shadowImage)) {
      ctx.globalAlpha = 0.5
      ctx.drawImage(piece.shadowImage!, tx, ty, pw, ph)
      ctx.globalAlpha = 1
    } else if (imgOk(piece.image)) {
      ctx.globalAlpha = 0.5
      ctx.drawImage(piece.image, tx, ty, pw, ph)
      ctx.globalAlpha = 1
    } else {
      // Fallback slot outline
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.strokeStyle = '#5D4037'
      ctx.lineWidth = 3 * gs
      ctx.setLineDash([8 * gs, 6 * gs])
      ctx.strokeRect(tx, ty, pw, ph)
      ctx.setLineDash([])
      ctx.restore()
    }
  }

  /** Draw a fallback rectangle+label when piece image is missing */
  drawPieceFallback(piece: PuzzlePiece, x: number, y: number, pw: number, ph: number, gs: number) {
    const { ctx } = this
    ctx.save()
    ctx.fillStyle = '#FFB74D'
    ctx.strokeStyle = '#E65100'
    ctx.lineWidth = 3 * gs
    ctx.beginPath()
    ctx.roundRect(x, y, pw, ph, 8 * gs)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#5D4037'
    ctx.font = `bold ${Math.min(pw, ph) * 0.35}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(piece.data.filenamePrefix ?? '?', x + pw / 2, y + ph / 2)
    ctx.restore()
  }

  /** Draw placed piece at full size */
  drawPlacedPiece(piece: PuzzlePiece, gs: number) {
    const { ctx } = this
    const pw = piece.width * gs
    const ph = piece.height * gs
    const bx = piece.targetX * gs
    const by = piece.targetY * gs

    if (!imgOk(piece.image)) {
      this.drawPieceFallback(piece, bx, by, pw, ph, gs)
      return
    }

    if (piece.snapAnim < 1) {
      const scale = 1 + Math.sin(piece.snapAnim * Math.PI) * 0.15
      ctx.save()
      ctx.translate(bx + pw / 2, by + ph / 2)
      ctx.scale(scale, scale)
      ctx.drawImage(piece.image, -pw / 2, -ph / 2, pw, ph)
      ctx.restore()
    } else {
      ctx.drawImage(piece.image, bx, by, pw, ph)
    }
  }

  /**
   * Draw scattered or dragging piece.
   * - Scattered (in tray): drawn at scatterScale so pieces fit below the board.
   * - Dragging: drawn at full size for precise placement feedback.
   */
  drawActivePiece(piece: PuzzlePiece, gs: number) {
    const { ctx } = this
    const displayScale = piece.dragging ? 1.0 : piece.scatterScale
    const pw = piece.width * displayScale * gs
    const ph = piece.height * displayScale * gs
    const bx = piece.currentX * gs
    const by = piece.currentY * gs

    if (!imgOk(piece.image)) {
      this.drawPieceFallback(piece, bx, by, pw, ph, gs)
      return
    }

    if (piece.dragging) {
      // Dragging: full-size with drop shadow lifted 4px
      if (imgOk(piece.shadowImage)) {
        ctx.drawImage(piece.shadowImage!, bx + 6 * gs, by + 6 * gs, pw, ph)
      }
      if (imgOk(piece.depthImage)) {
        ctx.drawImage(piece.depthImage!, bx, by - 4 * gs, pw, ph)
      }
      ctx.drawImage(piece.image, bx, by - 4 * gs, pw, ph)
    } else {
      // In scatter tray: 3D look at reduced scale
      if (imgOk(piece.shadowImage)) {
        ctx.drawImage(piece.shadowImage!, bx, by, pw, ph)
      }
      if (imgOk(piece.depthImage)) {
        ctx.drawImage(piece.depthImage!, bx, by, pw, ph)
      }
      ctx.drawImage(piece.image, bx, by, pw, ph)
    }
  }
}
