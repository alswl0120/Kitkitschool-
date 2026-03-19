import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/sentencemaker')

interface ProblemData {
  problem: number
  words: string[]
  wrongWords: string[]
  image: string | null
  sound: string | null
}

interface LevelData {
  level: number
  problems: ProblemData[]
}

interface WordTile {
  text: string
  x: number
  y: number
  w: number
  h: number
  isCorrect: boolean   // belongs to the solution
  slotIndex: number    // -1 = in tray, >=0 = placed in slot
  dragOffsetX: number
  dragOffsetY: number
  hue: number          // color hue for the tile
}

interface Slot {
  x: number
  y: number
  w: number
  h: number
  filledBy: number     // index into tiles[], -1 if empty
}

export class SentenceMakerEngine extends BaseEngine {
  level: number
  levelData: LevelData | null = null
  currentProblem = 0
  totalProblems = 0
  solvedCount = 0

  tiles: WordTile[] = []
  slots: Slot[] = []
  correctWords: string[] = []

  draggingTile = -1    // index of tile being dragged
  isDragging = false

  showResult: 'correct' | 'wrong' | null = null
  resultTimer = 0
  celebrateTimer = 0

  bgImage: HTMLImageElement
  wordCardImg: HTMLImageElement
  wordCardEmptyImg: HTMLImageElement
  hintImage: HTMLImageElement | null = null
  sketchbookImg: HTMLImageElement

  sfxCorrect: HTMLAudioElement
  sfxWrong: HTMLAudioElement
  sfxPick: HTMLAudioElement
  sfxSnap: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  // Tile layout constants matching C++:
  // C++ WordItem height: 128, kSpaceBetweenEachSlotX: 20, gap between bottom items: 20
  // C++ kFontSize: 60, kItemPadding: 50, kFontName: "fonts/TodoSchoolV2.ttf"
  // C++ slot page at: gameSize.height/2 + kPageCorrectionY = 900 - 200 = 700 from bottom
  //   In web Y-down: 1800 - 700 = 1100, but slots are anchored top-left so subtract height
  //   Page center Y in web: 1800 - (1800/2 + (-200)) = 1800 - 700 = 1100 from top (center of slot row)
  // C++ bottom area at: (winSize/2+50, winSize/2 + kBottomAreaLayerCorrectionY)
  //   = (1330, 900 - 820) = y=80 from bottom in gameSize = 1720 from top (anchor middle)
  //   Top of bottom area = 1720 - 200 = 1520 from top
  readonly TILE_H = 128
  readonly SLOT_Y = 1040
  readonly TRAY_Y = 1420
  readonly TILE_GAP = 20

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    // C++ uses sentencemaker_bg.jpg as background, sketchbook drawn on top.
    // sentencemaker_bg.jpg needs to be copied from C++ resources. Fallback to sketchbook.
    this.bgImage = loadImage(`${ASSET_PATH}/sentencemaker_bg.jpg`);
    // If bg.jpg fails to load, fall back to sketchbook (which exists)
    this.bgImage.onerror = () => {
      this.bgImage = loadImage(`${ASSET_PATH}/sentencemaker_sketchbook.png`)
    }
    this.wordCardImg = loadImage(`${ASSET_PATH}/comprehention_filltheblank_wordcard.png`)
    this.wordCardEmptyImg = loadImage(`${ASSET_PATH}/comprehention_filltheblank_wordcard_empty.png`)
    this.sketchbookImg = loadImage(`${ASSET_PATH}/sentencemaker_sketchbook.png`)

    // C++ sound effects: kSolveEffectSound="Counting/UI_Star_Collected.m4a",
    //   kPickEffectSound="Common/Sounds/Effect/SFX_Wood_SlideOut.m4a",
    //   kSnapEffectSound="Common/Sounds/Effect/SFX_Wood_Correct.m4a"
    // These C++ sounds are not yet copied to web assets; fallback to existing lettermatching sounds
    this.sfxCorrect = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxWrong = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxPick = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
    this.sfxSnap = loadAudio(assetUrl('/assets/games/lettermatching/sounds/play_level_clear.wav'))
  }

  async loadLevel() {
    try {
      const resp = await fetch('/data/games/sentencemaker.json')
      const data = await resp.json()
      this.levelData = data.levels.find((l: LevelData) => l.level === this.level) || null
    } catch {
      this.levelData = null
    }

    if (!this.levelData) {
      // Fallback data
      const fallbackProblems: ProblemData[] = [
        { problem: 1, words: ['The', 'cat', 'sat'], wrongWords: [], image: null, sound: null },
        { problem: 2, words: ['I', 'like', 'dogs'], wrongWords: [], image: null, sound: null },
        { problem: 3, words: ['She', 'runs', 'fast'], wrongWords: [], image: null, sound: null },
        { problem: 4, words: ['The', 'sun', 'shines'], wrongWords: [], image: null, sound: null },
        { problem: 5, words: ['He', 'reads', 'books'], wrongWords: [], image: null, sound: null },
        { problem: 6, words: ['We', 'play', 'games'], wrongWords: [], image: null, sound: null },
        { problem: 7, words: ['Birds', 'fly', 'high'], wrongWords: [], image: null, sound: null },
        { problem: 8, words: ['The', 'ball', 'bounces'], wrongWords: [], image: null, sound: null },
        { problem: 9, words: ['Fish', 'swim', 'fast'], wrongWords: [], image: null, sound: null },
        { problem: 10, words: ['It', 'is', 'red'], wrongWords: [], image: null, sound: null },
      ]
      this.levelData = { level: this.level, problems: fallbackProblems }
    }

    this.totalProblems = this.levelData.problems.length
    this.solvedCount = 0
    this.currentProblem = 0
    this.setupProblem()
  }

  setupProblem() {
    if (!this.levelData) return
    const prob = this.levelData.problems[this.currentProblem]
    if (!prob) return

    this.showResult = null
    this.resultTimer = 0
    this.celebrateTimer = 0
    this.draggingTile = -1
    this.isDragging = false
    this.tiles = []
    this.slots = []
    this.correctWords = [...prob.words]

    // Load hint image if available
    if (prob.image) {
      this.hintImage = loadImage(`${ASSET_PATH}/images/${prob.image}`)
    } else {
      this.hintImage = null
    }

    // Combine correct words and wrong words
    const allWords = [...prob.words]
    if (prob.wrongWords.length > 0) {
      allWords.push(...prob.wrongWords)
    }

    // Measure tile widths using a temporary measurement
    const ctx = this.ctx
    ctx.font = `bold 60px TodoSchoolV2, sans-serif`
    const tileSizes = allWords.map(w => {
      const m = ctx.measureText(w)
      return Math.max(m.width + 100, 128)
    })

    // Create slots for the correct words
    const slotTotalWidth = prob.words.reduce((sum, w, i) => {
      ctx.font = `bold 60px TodoSchoolV2, sans-serif`
      return sum + Math.max(ctx.measureText(w).width + 100, 128)
    }, 0) + (prob.words.length - 1) * this.TILE_GAP
    let slotX = (GAME_WIDTH - slotTotalWidth) / 2

    for (let i = 0; i < prob.words.length; i++) {
      ctx.font = `bold 60px TodoSchoolV2, sans-serif`
      const sw = Math.max(ctx.measureText(prob.words[i]).width + 60, 120)
      this.slots.push({
        x: slotX,
        y: this.SLOT_Y,
        w: sw,
        h: this.TILE_H,
        filledBy: -1,
      })
      slotX += sw + this.TILE_GAP
    }

    // Shuffle allWords for the tray
    const shuffled = allWords.map((text, idx) => ({
      text,
      origIdx: idx,
      tileW: tileSizes[idx],
    }))
    this.shuffleArray(shuffled)

    // Layout tiles in the tray area (multi-row if needed) - C++ bottom area: 1600 wide
    const trayMaxWidth = 1600
    let trayX = (GAME_WIDTH - trayMaxWidth) / 2
    let trayRow = 0
    const rowHeight = this.TILE_H + 10

    const trayStartX = (GAME_WIDTH - trayMaxWidth) / 2
    for (let i = 0; i < shuffled.length; i++) {
      const tw = shuffled[i].tileW
      if (trayX + tw > trayStartX + trayMaxWidth && i > 0) {
        trayX = trayStartX
        trayRow++
      }

      const isCorrect = shuffled[i].origIdx < prob.words.length
      this.tiles.push({
        text: shuffled[i].text,
        x: trayX,
        y: this.TRAY_Y + trayRow * rowHeight,
        w: tw,
        h: this.TILE_H,
        isCorrect,
        slotIndex: -1,
        dragOffsetX: 0,
        dragOffsetY: 0,
        hue: (i * 47 + 180) % 360,
      })

      trayX += tw + this.TILE_GAP
    }

    // Center the tray tiles
    this.centerTrayTiles()

    this.onProgressChange?.(this.solvedCount + 1, this.totalProblems)
  }

  centerTrayTiles() {
    // Group tiles by row
    const trayTiles = this.tiles.filter(t => t.slotIndex === -1)
    if (trayTiles.length === 0) return

    const rows: WordTile[][] = []
    let currentRow: WordTile[] = []
    let currentY = trayTiles[0].y

    for (const t of trayTiles) {
      if (Math.abs(t.y - currentY) > 10) {
        rows.push(currentRow)
        currentRow = [t]
        currentY = t.y
      } else {
        currentRow.push(t)
      }
    }
    if (currentRow.length > 0) rows.push(currentRow)

    for (const row of rows) {
      const totalW = row.reduce((sum, t) => sum + t.w, 0) + (row.length - 1) * this.TILE_GAP
      let startX = (GAME_WIDTH - totalW) / 2
      for (const t of row) {
        t.x = startX
        startX += t.w + this.TILE_GAP
      }
    }
  }

  shuffleArray<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  start() {
    super.start()
    this.loadLevel()
  }

  onPointerDown(x: number, y: number) {
    if (this.showResult) return

    // Check if clicking on a tile
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const t = this.tiles[i]
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
        this.draggingTile = i
        this.isDragging = true
        t.dragOffsetX = x - t.x
        t.dragOffsetY = y - t.y

        // C++ plays pick sound when tile is picked up
        playSound(this.sfxPick)

        // If tile was in a slot, free it
        if (t.slotIndex >= 0) {
          this.slots[t.slotIndex].filledBy = -1
          t.slotIndex = -1
        }
        break
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.isDragging || this.draggingTile < 0) return
    const t = this.tiles[this.draggingTile]
    t.x = x - t.dragOffsetX
    t.y = y - t.dragOffsetY
  }

  onPointerUp(x: number, y: number) {
    if (!this.isDragging || this.draggingTile < 0) return
    const t = this.tiles[this.draggingTile]

    // C++ logic: find the closest empty slot within distance threshold
    // that matches the tile's word (newSlot->_word == item->_word)
    let placed = false
    let bestSlotIdx = -1
    let bestDist = -1

    const tileCX = t.x + t.w / 2
    const tileCY = t.y + t.h / 2

    for (let si = 0; si < this.slots.length; si++) {
      const s = this.slots[si]
      if (s.filledBy >= 0) continue // slot already taken

      // C++ uses world-coordinate distance with threshold of 100
      const slotCX = s.x + s.w / 2
      const slotCY = s.y + s.h / 2
      const dist = Math.sqrt((tileCX - slotCX) ** 2 + (tileCY - slotCY) ** 2)

      // C++ only snaps if the word matches the slot word, threshold = 100
      if (dist < 100 && t.text === this.correctWords[si]) {
        if (bestDist < 0 || dist < bestDist) {
          bestDist = dist
          bestSlotIdx = si
        }
      }
    }

    if (bestSlotIdx >= 0) {
      const s = this.slots[bestSlotIdx]
      t.x = s.x + (s.w - t.w) / 2
      t.y = s.y + (s.h - t.h) / 2
      t.slotIndex = bestSlotIdx
      s.filledBy = this.draggingTile
      placed = true
      // C++ plays snap sound when tile enters slot
      playSound(this.sfxSnap)
    }

    if (!placed) {
      // Return to tray
      t.slotIndex = -1
      this.repositionTrayTiles()
    }

    this.isDragging = false
    this.draggingTile = -1

    // Check if all slots are filled (all correct since C++ only allows matching words)
    this.checkAnswer()
  }

  repositionTrayTiles() {
    const trayTiles = this.tiles.filter(t => t.slotIndex === -1)
    // C++ bottom area: 1600 wide
    const trayMaxWidth = 1600
    let trayX = (GAME_WIDTH - trayMaxWidth) / 2
    let trayRow = 0
    const rowHeight = this.TILE_H + 10

    const trayStartX2 = (GAME_WIDTH - trayMaxWidth) / 2
    for (const t of trayTiles) {
      if (trayX + t.w > trayStartX2 + trayMaxWidth && trayX > trayStartX2) {
        trayX = trayStartX2
        trayRow++
      }
      t.x = trayX
      t.y = this.TRAY_Y + trayRow * rowHeight
      trayX += t.w + this.TILE_GAP
    }
    this.centerTrayTiles()
  }

  checkAnswer() {
    // All slots must be filled
    const allFilled = this.slots.every(s => s.filledBy >= 0)
    if (!allFilled) return

    // Check correctness: each slot's tile text must match the correct word
    let correct = true
    for (let i = 0; i < this.slots.length; i++) {
      const tileIdx = this.slots[i].filledBy
      if (tileIdx < 0 || this.tiles[tileIdx].text !== this.correctWords[i]) {
        correct = false
        break
      }
    }

    if (correct) {
      this.showResult = 'correct'
      this.solvedCount++
      this.celebrateTimer = 0
      // C++ flow: 0.6s delay, play sentence sound, wait for sentence duration + 0.6s,
      // then play solve effect, then 1.0s delay before next problem
      setTimeout(() => playSound(this.sfxCorrect), 600)
      setTimeout(() => this.advanceProblem(), 2200)
    } else {
      this.showResult = 'wrong'
      playSound(this.sfxWrong)
      setTimeout(() => {
        this.showResult = null
        // Return all tiles to tray
        for (const s of this.slots) s.filledBy = -1
        for (const t of this.tiles) t.slotIndex = -1
        this.repositionTrayTiles()
      }, 1000)
    }
  }

  advanceProblem() {
    if (!this.levelData) return

    if (this.currentProblem < this.levelData.problems.length - 1) {
      this.currentProblem++
      this.setupProblem()
    } else {
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  update(_time: number, dt: number) {
    if (this.showResult) {
      this.resultTimer += dt
      this.celebrateTimer += dt
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    // Draw background
    ctx.fillStyle = '#FFF5EE'
    ctx.fillRect(0, 0, w, h)
    this.drawBackgroundImage(this.bgImage, w, h)

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw hint image - C++ image size: 1000 x 640
    if (this.hintImage && imgOk(this.hintImage)) {
      const imgW = 1000 * gs
      const imgH = 640 * gs
      const imgX = (GAME_WIDTH / 2) * gs - imgW / 2
      const imgY = 100 * gs
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.15)'
      ctx.shadowBlur = 12 * gs
      ctx.beginPath()
      ctx.roundRect(imgX, imgY, imgW, imgH, 16 * gs)
      ctx.clip()
      ctx.drawImage(this.hintImage, imgX, imgY, imgW, imgH)
      ctx.restore()
    }

    // Draw slots (drop targets)
    for (let i = 0; i < this.slots.length; i++) {
      this.drawSlot(this.slots[i], gs)
    }

    // Draw separator line
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 2 * gs
    ctx.setLineDash([10 * gs, 8 * gs])
    ctx.beginPath()
    ctx.moveTo(100 * gs, (this.TRAY_Y - 80) * gs)
    ctx.lineTo((GAME_WIDTH - 100) * gs, (this.TRAY_Y - 80) * gs)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw tray label
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.font = `${24 * gs}px TodoSchoolV2, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Drag words to form a sentence', GAME_WIDTH / 2 * gs, (this.TRAY_Y - 50) * gs)

    // Draw tiles (non-dragging first, then dragging on top)
    for (let i = 0; i < this.tiles.length; i++) {
      if (i === this.draggingTile) continue
      this.drawTile(this.tiles[i], gs, false)
    }
    if (this.draggingTile >= 0) {
      this.drawTile(this.tiles[this.draggingTile], gs, true)
    }

    // Draw result feedback
    if (this.showResult) {
      const alpha = Math.min(this.resultTimer * 3, 0.4)
      ctx.fillStyle = this.showResult === 'correct'
        ? `rgba(76, 175, 80, ${alpha})` : `rgba(244, 67, 54, ${alpha})`
      ctx.fillRect(0, 0, GAME_WIDTH * gs, GAME_HEIGHT * gs)

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${72 * gs}px TodoSchoolV2, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const bounce = Math.sin(this.celebrateTimer * 4) * 10 * gs
      ctx.fillText(
        this.showResult === 'correct' ? 'Correct!' : 'Try Again',
        GAME_WIDTH / 2 * gs, GAME_HEIGHT / 2 * gs + bounce
      )
    }

    ctx.restore()
  }

  drawSlot(slot: Slot, gs: number) {
    const { ctx } = this
    const x = slot.x * gs
    const y = slot.y * gs
    const w = slot.w * gs
    const h = slot.h * gs

    // Slot background
    ctx.fillStyle = slot.filledBy >= 0 ? 'rgba(200, 230, 255, 0.3)' : 'rgba(200, 200, 200, 0.2)'
    ctx.strokeStyle = slot.filledBy >= 0 ? '#90CAF9' : '#BDBDBD'
    ctx.lineWidth = 2.5 * gs
    ctx.setLineDash(slot.filledBy >= 0 ? [] : [8 * gs, 6 * gs])
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 12 * gs)
    ctx.fill()
    ctx.stroke()
    ctx.setLineDash([])

    // Slot number label
    if (slot.filledBy < 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.font = `bold ${36 * gs}px TodoSchoolV2, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', x + w / 2, y + h / 2)
    }
  }

  drawTile(tile: WordTile, gs: number, isDragging: boolean) {
    const { ctx } = this
    const x = tile.x * gs
    const y = tile.y * gs
    const w = tile.w * gs
    const h = tile.h * gs

    ctx.save()

    if (isDragging) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 16 * gs
      ctx.shadowOffsetY = 4 * gs
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.12)'
      ctx.shadowBlur = 6 * gs
      ctx.shadowOffsetY = 2 * gs
    }

    // Tile background
    const hue = tile.hue
    ctx.fillStyle = `hsl(${hue}, 70%, 92%)`
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 14 * gs)
    ctx.fill()

    // Border
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = `hsl(${hue}, 60%, 70%)`
    ctx.lineWidth = 2.5 * gs
    ctx.stroke()

    // Text
    ctx.fillStyle = `hsl(${hue}, 50%, 30%)`
    ctx.font = `bold ${44 * gs}px TodoSchoolV2, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(tile.text, x + w / 2, y + h / 2)

    ctx.restore()
  }
}
