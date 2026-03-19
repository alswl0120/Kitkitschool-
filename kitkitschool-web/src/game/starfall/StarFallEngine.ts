import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/starfall')

// C++ keyboard layout from StarFallDepot::defaultSymbolLayout()
const KEYBOARD_LAYOUT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

// C++ KeyNode::defaultSize() = Size(196.f, 196.f)
const KEY_WIDTH = 196
const KEY_HEIGHT = 196
// C++ keyboard gaps: horizontal = 16, vertical = 12, bottom padding = 8
const KEY_GAP_H = 16
const KEY_GAP_V = 12
// C++ KeyboardNode contentSize() = Size(2104.f, 650.f)
const KEYBOARD_WIDTH = 2104
const KEYBOARD_HEIGHT = 650

// C++ TargetTextNode contentSize() = Size(309.f, 308.f)
const BUBBLE_WIDTH = 309
const BUBBLE_HEIGHT = 308
// sqrt(309^2 + 308^2) ~ 436.28 -- used for swing amplitude in C++
const BUBBLE_DIAGONAL = Math.sqrt(BUBBLE_WIDTH * BUBBLE_WIDTH + BUBBLE_HEIGHT * BUBBLE_HEIGHT)

// C++ ActiveTextNode contentSize() = Size(735.f, 185.f)
const ACTIVE_TEXT_HEIGHT = 185

// C++ key colors
const KEY_REGULAR_COLOR = 'rgb(74, 70, 67)'
const KEY_DISABLED_COLOR = 'rgb(148, 100, 63)'
const KEY_SPECIAL_COLOR = 'rgb(222, 74, 0)'  // vowels
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

// C++ ActiveTextNode colors
const ACTIVE_TEXT_COLOR = 'rgb(74, 70, 67)'     // regularColor
const BAD_TEXT_COLOR = 'rgb(148, 100, 63)'       // disabledColor

// C++ bubble pop timing from StarFallDepot
const KEY_FOR_BUBBLE_POP = 0.1   // keyForBubblePop()
const KEY_FOR_BUBBLE_SCATTER = 0.5  // keyForBubbleScatter()

// C++ font sizes
const KEY_FONT_SIZE = 88     // KeyNode fontSize
const BUBBLE_FONT_SIZE = 100 // TargetTextNode fontSize
const ACTIVE_TEXT_FONT_SIZE = 100 // ActiveTextNode fontSize
const HIT_COUNTER_FONT_SIZE = 80  // HitCounterNode fontSize

interface FallingItem {
  text: string
  // In web canvas coordinates (Y=0 at top)
  x: number
  y: number
  // C++ start/stop positions in game coords (already converted to web canvas Y)
  startX: number
  startY: number
  stopX: number
  stopY: number
  clock: number
  duration: number
  startPhase: number
  stopPhase: number
  swingRatio: number
  alive: boolean
  bubbleVariant: number
}

// Pop animation fragment (C++ TargetDummyNode creates 5 bubble fragments)
interface PopFragment {
  x: number
  y: number
  targetX: number
  targetY: number
  scaleStart: number
  scaleEnd: number
  timer: number
  duration: number
  bubbleVariant: number
}

interface PopAnimation {
  x: number
  y: number
  text: string
  timer: number
  totalDuration: number
  fragments: PopFragment[]
  textOffsetY: number  // C++ text moves up with EaseOut
}

// C++ JSON data format
interface StarFallJsonData {
  defaults: {
    target_hit_count: number
    prelude_duration: number
    target_falling_duration: number
    word_regen_cooltime: number
  }
  levels: {
    level_number: number
    target_hit_count?: number
    prelude_duration?: number
    target_falling_duration?: number
    word_regen_cooltime?: number
    words: string[]
  }[]
}

export class StarFallEngine extends BaseEngine {
  level: number

  // C++ Worksheet fields
  wordList: string[] = []
  enabledSymbols: Set<string> = new Set()
  targetHitCount = 10
  preludeDuration = 0.5
  targetFallingDuration = 10
  wordRegenCooltime = 2

  fallingItems: FallingItem[] = []
  popAnimations: PopAnimation[] = []
  activeText = ''
  badText = ''
  badTextTimer = 0   // C++ scheduleOnce 1.0 second
  hitCount = 0
  missCount = 0
  birthCount = 0
  wordRegenClock = 0
  gamePlaying = false
  gameClock = 0

  bgImage: HTMLImageElement
  bubbleImages: HTMLImageElement[] = []
  keyDefaultImage: HTMLImageElement
  keyCorrectImage: HTMLImageElement
  woodPanelImage: HTMLImageElement
  fireflyImage: HTMLImageElement

  sfxHit: HTMLAudioElement
  sfxMiss: HTMLAudioElement
  sfxSpawn: HTMLAudioElement
  sfxDeath: HTMLAudioElement

  // Firefly rocket animation (C++ RocketNode)
  fireflyActive = false
  fireflyStartX = 0
  fireflyStartY = 0
  fireflyTargetX = 0
  fireflyTargetY = 0
  // Bezier control points (C++ uses random bezier path)
  fireflyCP1X = 0
  fireflyCP1Y = 0
  fireflyCP2X = 0
  fireflyCP2Y = 0
  fireflyTimer = 0
  fireflyDuration = KEY_FOR_BUBBLE_POP  // C++ keyForBubblePop = 0.1
  fireflyOpacity = 0  // C++ starts invisible, fades in at BasePosition

  // Keyboard geometry - computed once
  keyRects: { x: number; y: number; w: number; h: number; symbol: string }[] = []

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    this.bgImage = loadImage(`${ASSET_PATH}/night_sky.png`)
    for (let i = 1; i <= 5; i++) {
      this.bubbleImages.push(loadImage(`${ASSET_PATH}/bubble_${i}.png`))
    }
    this.keyDefaultImage = loadImage(`${ASSET_PATH}/keyboard_default.png`)
    this.keyCorrectImage = loadImage(`${ASSET_PATH}/keyboard_correct.png`)
    this.woodPanelImage = loadImage(`${ASSET_PATH}/bottom_woodpanel.png`)
    this.fireflyImage = loadImage(`${ASSET_PATH}/firefly.png`)

    this.sfxHit = loadAudio(`${ASSET_PATH}/sounds/text_hit.0.m4a`)
    this.sfxMiss = loadAudio(`${ASSET_PATH}/sounds/text_miss.m4a`)
    this.sfxSpawn = loadAudio(`${ASSET_PATH}/sounds/target_birth.m4a`)
    this.sfxDeath = loadAudio(`${ASSET_PATH}/sounds/target_death.m4a`)

    this.buildKeyboardLayout()
  }

  buildKeyboardLayout() {
    // C++ keyboard is anchored at MIDDLE_BOTTOM of gameSize, positioned at (GameSize.width/2, 0)
    // The keyboard content size is 2104x650 in game coordinates.
    // Keys are laid out in game coords (Y=0 at bottom in C++).
    // In web canvas (Y=0 at top), we flip when drawing.
    const maxCols = Math.max(...KEYBOARD_LAYOUT.map(r => r.length))

    this.keyRects = []
    for (let rowIdx = 0; rowIdx < KEYBOARD_LAYOUT.length; rowIdx++) {
      const row = KEYBOARD_LAYOUT[rowIdx]
      const colMargin = maxCols - row.length
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        // C++ X position: (colIdx + colMargin/2) * (KeyNodeSize.width + 16)
        const localX = (colIdx + colMargin / 2) * (KEY_WIDTH + KEY_GAP_H)
        // C++ Y position (bottom-up): (numRows-1-rowIdx) * (KeyNodeSize.height + 12) + 8
        const localY = (KEYBOARD_LAYOUT.length - 1 - rowIdx) * (KEY_HEIGHT + KEY_GAP_V) + 8
        this.keyRects.push({
          x: localX,
          y: localY,
          w: KEY_WIDTH,
          h: KEY_HEIGHT,
          symbol: row[colIdx],
        })
      }
    }
  }

  async loadLevel() {
    let data: StarFallJsonData | null = null
    try {
      const resp = await fetch('/data/games/starfall.json')
      data = await resp.json() as StarFallJsonData
    } catch {
      // fallback handled below
    }

    // C++ Worksheet defaults
    let targetHitCount = 10
    let preludeDuration = 0.5
    let targetFallingDuration = 10.0
    let wordRegenCooltime = 2.0
    let words: string[] = []

    if (data) {
      const defaults = data.defaults
      // C++ Worksheet::forLevelID -- search levels array by level_number
      const levelEntry = data.levels.find(l => l.level_number === this.level)
      if (levelEntry) {
        // C++ getValue pattern: level value overrides defaults value
        targetHitCount = levelEntry.target_hit_count ?? defaults.target_hit_count ?? 10
        preludeDuration = levelEntry.prelude_duration ?? defaults.prelude_duration ?? 0.5
        targetFallingDuration = levelEntry.target_falling_duration ?? defaults.target_falling_duration ?? 10.0
        wordRegenCooltime = levelEntry.word_regen_cooltime ?? defaults.word_regen_cooltime ?? 2.0
        words = levelEntry.words || []
      }
    }

    if (words.length === 0) {
      // Fallback to C++ dummyLevel1
      words = ['a', 'e', 'i', 'o', 'u']
    }

    this.wordList = words
    this.targetHitCount = targetHitCount
    this.preludeDuration = preludeDuration
    this.targetFallingDuration = targetFallingDuration
    this.wordRegenCooltime = wordRegenCooltime

    // C++ enabledSymbolsWithWords: extract individual characters from all words
    this.enabledSymbols = new Set<string>()
    for (const word of this.wordList) {
      for (const c of word) {
        this.enabledSymbols.add(c)
      }
    }

    // Reset game state (C++ clearInternals)
    this.hitCount = 0
    this.missCount = 0
    this.birthCount = 0
    this.activeText = ''
    this.badText = ''
    this.badTextTimer = 0
    this.gameClock = 0
    this.fallingItems = []
    this.popAnimations = []
    this.fireflyActive = false
    this.fireflyOpacity = 0

    // C++ beginTheWork: first word spawns faster
    // WordRegenClock = max(0, WordRegenCooltime - PreludeDuration)
    const t = wordRegenCooltime - preludeDuration
    this.wordRegenClock = Math.max(0, Math.min(t, wordRegenCooltime))
    this.gamePlaying = true

    this.onProgressChange?.(0, this.targetHitCount)
  }

  start() {
    super.start()
    window.addEventListener('keydown', this.handleKeyDown)
    this.loadLevel()
  }

  stop() {
    super.stop()
    window.removeEventListener('keydown', this.handleKeyDown)
  }

  handleKeyDown = (e: KeyboardEvent) => {
    if (this.gameState !== 'playing' || !this.gamePlaying) return
    const key = e.key.toLowerCase()
    if (key.length === 1 && this.enabledSymbols.has(key)) {
      this.onKeyPressed(key)
    }
  }

  appendNewTargetTextNode() {
    if (this.wordList.length === 0) return

    // C++ tries up to 20 times to find a word not already on screen
    let title = ''
    for (let trial = 0; trial < 20; trial++) {
      const wordId = Math.floor(Math.random() * this.wordList.length)
      const candidate = this.wordList[wordId]
      const collision = this.fallingItems.some(it => it.alive && it.text === candidate)
      if (!collision) {
        title = candidate
        break
      }
    }
    if (!title) return  // C++ returns if no suitable word found

    // C++ positions (Cocos2d, Y=0 at bottom):
    //   PointX = random(100, GameSize.width - 100)
    //   StartPosition = (PointX, GameSize.height - 100) -- near top
    //   StopPosition = (PointX, keyboardHeight) -- above keyboard
    //
    // Web canvas (Y=0 at top):
    //   startY = GAME_HEIGHT - (GameSize.height - 100) = 100  (near top)
    //   stopY = GAME_HEIGHT - keyboardHeight = GAME_HEIGHT - KEYBOARD_HEIGHT (above keyboard)
    //
    // But C++ anchor is MIDDLE_BOTTOM, so the bubble's bottom edge is at the position.
    // In web, we'll track the top-left corner of the bubble for drawing.
    // The C++ position represents the bottom-center of the bubble.
    // In web canvas coords, the bubble bottom-center at C++ (px, py) maps to:
    //   webY = GAME_HEIGHT - py (for the bottom edge)
    //   To get top-left for drawing: webY - BUBBLE_HEIGHT for the top edge
    // Actually, let's track the C++ position directly (bottom-center) and convert at draw time.
    // We'll track the bubble's position as the bottom-center in web coordinates.

    const pointX = 100 + Math.random() * (GAME_WIDTH - 200)
    // In C++ game coords (Y=0 bottom): startY = GAME_HEIGHT - 100, stopY = KEYBOARD_HEIGHT
    // Convert to web (Y=0 top): webY = GAME_HEIGHT - cocosY
    const startY_web = 100  // GAME_HEIGHT - (GAME_HEIGHT - 100) = 100
    const stopY_web = GAME_HEIGHT - KEYBOARD_HEIGHT  // GAME_HEIGHT - KEYBOARD_HEIGHT

    this.fallingItems.push({
      text: title,
      x: pointX,
      y: startY_web,
      startX: pointX,
      startY: startY_web,
      stopX: pointX,
      stopY: stopY_web,
      clock: 0,
      duration: this.targetFallingDuration,
      // C++ StartPhase = random(0, 2*PI)
      startPhase: Math.random() * Math.PI * 2,
      // C++ StopPhase = (2*PI * random(1,3)) + (PI/2 * 3)
      stopPhase: Math.PI * 2 * (1 + Math.floor(Math.random() * 3)) + Math.PI * 1.5,
      // C++ SwingRatio = random(0.02, 0.06)
      swingRatio: 0.02 + Math.random() * 0.04,
      alive: true,
      // C++ random(1,5) mapped to 0-indexed
      bubbleVariant: Math.floor(Math.random() * 5),
    })

    this.birthCount++
  }

  onKeyPressed(symbol: string) {
    // C++ OnKeyPressed: ActiveText += Symbol, then refreshActiveTextForSanity
    this.activeText += symbol
    this.refreshActiveTextForSanity()
  }

  refreshActiveTextForSanity() {
    // C++ logic from StarFallScene::refreshActiveTextForSanity()
    let exactHit: FallingItem | null = null
    let promising = false

    for (const item of this.fallingItems) {
      if (!item.alive) continue
      // C++ checks if ActiveText is a prefix of TitleText:
      //   TextNode->TitleText().compare(0, ActiveText().length(), ActiveText()) == 0
      if (item.text.startsWith(this.activeText)) {
        promising = true
        // No break -- C++ continues scanning for exact match
      }
      if (item.text === this.activeText) {
        exactHit = item
        break
      }
    }

    if (exactHit) {
      // C++ plays word sound first, falls back to hit sound
      playSound(this.sfxHit)
      this.hitCount++

      // Launch firefly toward the bubble (C++ RocketNode)
      this.launchFirefly(exactHit)

      // Spawn pop animation (C++ TargetDummyNode)
      this.spawnPopAnimation(exactHit.x, exactHit.y, exactHit.text, exactHit.bubbleVariant)

      exactHit.alive = false
      this.activeText = ''

      this.onProgressChange?.(this.hitCount, this.targetHitCount)

      // C++ checks HitCount >= TargetHitCount in the HitCount callback
      if (this.hitCount >= this.targetHitCount) {
        this.gamePlaying = false
        this.gameState = 'complete'
        this.onComplete?.()
      }
      return
    }

    if (promising) {
      // C++ plays soundForKeyInput -- we don't have key_input.m4a so skip
      return
    }

    // Not promising: clear input, play miss sound
    // C++ sets BadText = ActiveText, then ActiveText = ""
    playSound(this.sfxMiss)
    this.badText = this.activeText
    this.badTextTimer = 1.0  // C++ scheduleOnce 1.0 second
    this.activeText = ''
  }

  launchFirefly(target: FallingItem) {
    // C++ RocketNode: base position is at (GameSize.width/2, keyboardHeight + activeTextHeight)
    // Target position is bubble position + (0, TargetDummyNode::defaultSize().height / 2)
    // In web coords (Y=0 top), we need to flip
    const baseX = GAME_WIDTH / 2
    const baseY = GAME_HEIGHT - KEYBOARD_HEIGHT - ACTIVE_TEXT_HEIGHT  // web Y for base

    // Target: C++ adds Vec2(0, BUBBLE_HEIGHT/2) in Cocos2d (upward), which in web is subtracting
    const targetX = target.x
    const targetY = target.y - BUBBLE_HEIGHT / 2  // move up in web coords

    // C++ uses BezierTo with random control points
    const distance = Math.sqrt((targetX - baseX) ** 2 + (targetY - baseY) ** 2)
    const dx = targetX - baseX
    const dy = targetY - baseY
    const unitX = dx / (distance || 1)
    const unitY = dy / (distance || 1)
    const perpX = -unitY
    const perpY = unitX
    const diversity = distance * 0.5

    // Control point 1: 1/3 along path + random perpendicular offset
    const cp1X = baseX + unitX * distance / 3 + perpX * (Math.random() * 2 - 1) * diversity
    const cp1Y = baseY + unitY * distance / 3 + perpY * (Math.random() * 2 - 1) * diversity
    // Control point 2: 2/3 along path + random perpendicular offset
    const cp2X = targetX - unitX * distance / 3 + perpX * (Math.random() * 2 - 1) * diversity
    const cp2Y = targetY - unitY * distance / 3 + perpY * (Math.random() * 2 - 1) * diversity

    this.fireflyActive = true
    this.fireflyStartX = baseX
    this.fireflyStartY = baseY
    this.fireflyTargetX = targetX
    this.fireflyTargetY = targetY
    this.fireflyCP1X = cp1X
    this.fireflyCP1Y = cp1Y
    this.fireflyCP2X = cp2X
    this.fireflyCP2Y = cp2Y
    this.fireflyTimer = 0
    this.fireflyDuration = KEY_FOR_BUBBLE_POP  // 0.1 seconds
  }

  spawnPopAnimation(x: number, y: number, text: string, bubbleVariant: number) {
    // C++ TargetDummyNode: creates 5 bubble fragments that scatter
    const fragments: PopFragment[] = []
    const bubbleDiag = BUBBLE_DIAGONAL

    for (let i = 0; i < 5; i++) {
      // C++ random radius and theta for scatter direction
      const radius = bubbleDiag * (0.3 + Math.random() * 0.9)
      const theta = Math.random() * Math.PI * 2
      const targetOffX = Math.cos(theta) * radius
      const targetOffY = Math.sin(theta) * radius
      const scaleStart = 0.05 + Math.random() * 0.15
      const scaleEnd = scaleStart * 2

      fragments.push({
        x: x,
        y: y,
        targetX: x + targetOffX,
        targetY: y + targetOffY,
        scaleStart,
        scaleEnd,
        timer: 0,
        duration: KEY_FOR_BUBBLE_SCATTER,  // total duration including pop delay
        bubbleVariant: Math.floor(Math.random() * 5),
      })
    }

    // C++ text moves upward by Point(CS).length() * 0.10 and fades out
    const textOffsetY = bubbleDiag * 0.10

    this.popAnimations.push({
      x,
      y,
      text,
      timer: 0,
      totalDuration: KEY_FOR_BUBBLE_SCATTER,
      fragments,
      textOffsetY,
    })
  }

  onPointerDown(x: number, y: number) {
    if (!this.gamePlaying) return
    // Check if a keyboard key was tapped
    // Keys are in local keyboard coordinates. Need to transform.
    // Keyboard is anchored MIDDLE_BOTTOM at (GAME_WIDTH/2, 0) in C++ game coords.
    // So keyboard left edge = GAME_WIDTH/2 - KEYBOARD_WIDTH/2
    const kbLeft = (GAME_WIDTH - KEYBOARD_WIDTH) / 2

    for (const key of this.keyRects) {
      if (!this.enabledSymbols.has(key.symbol)) continue
      // key.x, key.y are in C++ local keyboard coords (Y=0 at bottom of keyboard)
      // In web canvas: keyboard top is at GAME_HEIGHT - KEYBOARD_HEIGHT
      // A key at local C++ Y position (bottom of key) maps to:
      //   web key top = GAME_HEIGHT - (key.y + key.h)  -- flip and go from bottom edge
      const keyScreenX = kbLeft + key.x
      // C++ Y=0 is bottom of keyboard. key.y is bottom edge of key in local coords.
      // In web (Y=0 top), keyboard bottom is GAME_HEIGHT, keyboard top is GAME_HEIGHT - KEYBOARD_HEIGHT.
      // Key bottom in web = GAME_HEIGHT - key.y
      // Key top in web = GAME_HEIGHT - key.y - key.h
      const keyScreenY = GAME_HEIGHT - key.y - key.h

      if (x >= keyScreenX && x <= keyScreenX + key.w &&
          y >= keyScreenY && y <= keyScreenY + key.h) {
        this.onKeyPressed(key.symbol)
        return
      }
    }
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  update(_time: number, dt: number) {
    if (this.gameState !== 'playing' || !this.gamePlaying) return

    // C++ update: GameClock and WordRegenClock advance
    this.gameClock += dt
    this.wordRegenClock += dt

    // C++ WordRegenClock callback: spawn when > cooltime (strictly greater)
    if (this.wordRegenClock > this.wordRegenCooltime) {
      // C++ target birth sound commented out in original
      this.appendNewTargetTextNode()
      this.wordRegenClock = 0
    }

    // Update falling items (C++ TargetTextNode::update + Clock.OnValueUpdate)
    for (const item of this.fallingItems) {
      if (!item.alive) continue
      item.clock += dt

      // C++ position calculation from TargetTextNode::clearInternals Clock.OnValueUpdate:
      //   Alpha = clamp(Clock, 0, Duration) / Duration
      //   BaseP = StartPosition * (1 - Alpha) + StopPosition * Alpha
      //   Phase = StartPhase * (1 - Alpha) + StopPhase * Alpha
      //   P = BaseP + (Point(cos(Phase), 0) * Point(CS).length() * SwingRatio)
      //
      // In C++, Point(CS).length() = sqrt(309^2 + 308^2) ~ 436.28
      // The swing is HORIZONTAL only (added to x position)

      const alpha = Math.min(Math.max(0, item.clock), item.duration) / item.duration
      // Interpolate Y position (main vertical falling motion)
      const baseY = item.startY * (1 - alpha) + item.stopY * alpha
      // Interpolate X position (should stay at startX since startX == stopX)
      const baseX = item.startX * (1 - alpha) + item.stopX * alpha
      // Interpolate phase for sinusoidal swing
      const phase = item.startPhase * (1 - alpha) + item.stopPhase * alpha
      // Horizontal swing offset
      const swingX = Math.cos(phase) * BUBBLE_DIAGONAL * item.swingRatio

      item.x = baseX + swingX
      item.y = baseY

      // C++ checkForTimeOver: Clock > Duration
      if (item.clock > item.duration) {
        item.alive = false
        playSound(this.sfxDeath, 0.3)
        this.missCount++
        // C++ calls refreshActiveTextForSanity() on miss to re-validate current input
        this.refreshActiveTextForSanity()
      }
    }

    // Clean up dead items
    this.fallingItems = this.fallingItems.filter(i => i.alive)

    // Update bad text timer (C++ hides after 1 second)
    if (this.badTextTimer > 0) {
      this.badTextTimer -= dt
    }

    // Update firefly
    if (this.fireflyActive) {
      this.fireflyTimer += dt
      if (this.fireflyTimer >= this.fireflyDuration) {
        this.fireflyActive = false
      }
    }

    // Update pop animations
    for (const pop of this.popAnimations) {
      pop.timer += dt
    }
    this.popAnimations = this.popAnimations.filter(p => p.timer < p.totalDuration)
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

    // Draw keyboard panel at bottom
    this.drawKeyboard(gs)

    // Draw active text above keyboard (C++ ActiveTextNode)
    this.drawActiveText(gs)

    // Draw falling bubble items
    for (const item of this.fallingItems) {
      if (!item.alive) continue
      this.drawFallingItem(item, gs)
    }

    // Draw pop animations (C++ TargetDummyNode)
    for (const pop of this.popAnimations) {
      this.drawPopAnimation(pop, gs)
    }

    // Draw firefly (C++ RocketNode)
    if (this.fireflyActive) {
      const t = Math.min(this.fireflyTimer / this.fireflyDuration, 1)
      // Cubic bezier: B(t) = (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)*t^2*P2 + t^3*P3
      const mt = 1 - t
      const fx = mt * mt * mt * this.fireflyStartX +
                 3 * mt * mt * t * this.fireflyCP1X +
                 3 * mt * t * t * this.fireflyCP2X +
                 t * t * t * this.fireflyTargetX
      const fy = mt * mt * mt * this.fireflyStartY +
                 3 * mt * mt * t * this.fireflyCP1Y +
                 3 * mt * t * t * this.fireflyCP2Y +
                 t * t * t * this.fireflyTargetY

      // C++ RocketNode contentSize = 209 x 159
      const fWidth = 209 * gs
      const fHeight = 159 * gs
      ctx.globalAlpha = 1
      if (imgOk(this.fireflyImage)) {
        ctx.drawImage(this.fireflyImage,
          fx * gs - fWidth / 2, fy * gs - fHeight / 2,
          fWidth, fHeight)
      } else {
        ctx.fillStyle = '#FFD700'
        ctx.beginPath()
        ctx.arc(fx * gs, fy * gs, 20 * gs, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw hit counter (C++ top right, anchor TOP_RIGHT, position (GameSize.width-100, GameSize.height-50))
    // In web canvas (Y=0 top): y = 50 (near top)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${HIT_COUNTER_FONT_SIZE * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${this.hitCount} / ${this.targetHitCount}`, (GAME_WIDTH - 100) * gs, 50 * gs)

    ctx.restore()
  }

  drawKeyboard(gs: number) {
    const { ctx } = this
    const kbLeft = (GAME_WIDTH - KEYBOARD_WIDTH) / 2

    // Draw wood panel background
    // C++ keyboard background sprite anchored at MIDDLE_BOTTOM, positioned at (CS.width/2, 0)
    // In web: keyboard occupies bottom KEYBOARD_HEIGHT pixels
    const kbTopWeb = (GAME_HEIGHT - KEYBOARD_HEIGHT) * gs
    if (imgOk(this.woodPanelImage)) {
      const panelW = KEYBOARD_WIDTH * gs
      const panelH = KEYBOARD_HEIGHT * gs
      const panelX = kbLeft * gs
      ctx.drawImage(this.woodPanelImage, panelX, kbTopWeb, panelW, panelH)
    } else {
      ctx.fillStyle = '#5D4037'
      ctx.fillRect(kbLeft * gs, kbTopWeb, KEYBOARD_WIDTH * gs, KEYBOARD_HEIGHT * gs)
    }

    // Draw keys
    for (const key of this.keyRects) {
      const enabled = this.enabledSymbols.has(key.symbol)
      // key.x, key.y are in C++ local coords (Y=0 at bottom of keyboard)
      // Convert to web canvas:
      const kx = (kbLeft + key.x) * gs
      // In web, keyboard top is at GAME_HEIGHT - KEYBOARD_HEIGHT
      // Key top in web = GAME_HEIGHT - key.y - key.h
      const ky = (GAME_HEIGHT - key.y - key.h) * gs
      const kw = key.w * gs
      const kh = key.h * gs

      if (enabled) {
        const keyImg = this.keyDefaultImage
        if (imgOk(keyImg)) {
          ctx.drawImage(keyImg, kx, ky, kw, kh)
        } else {
          ctx.fillStyle = '#8D6E63'
          ctx.beginPath()
          ctx.roundRect(kx, ky, kw, kh, 12 * gs)
          ctx.fill()
        }
      } else {
        // Disabled key - C++ uses disabledSkin image; fallback to semi-transparent
        ctx.fillStyle = 'rgba(60,40,30,0.5)'
        ctx.beginPath()
        ctx.roundRect(kx, ky, kw, kh, 12 * gs)
        ctx.fill()
      }

      // Key label - C++ uses different colors
      if (!enabled) {
        ctx.fillStyle = KEY_DISABLED_COLOR
      } else if (VOWELS.has(key.symbol)) {
        ctx.fillStyle = KEY_SPECIAL_COLOR  // C++ specialColor for vowels
      } else {
        ctx.fillStyle = KEY_REGULAR_COLOR
      }
      ctx.font = `bold ${KEY_FONT_SIZE * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(key.symbol, kx + kw / 2, ky + kh / 2)
    }
  }

  drawActiveText(gs: number) {
    const { ctx } = this
    // C++ ActiveTextNode positioned at (GameSize.width/2, keyboardHeight) with anchor MIDDLE_BOTTOM
    // Content size is 735x185. Text is at textRegion midpoint = (140+453/2, 11+146/2) = (366.5, 84)
    // In web canvas (Y=0 top): the node bottom edge is at GAME_HEIGHT - KEYBOARD_HEIGHT
    // The node center Y in web = GAME_HEIGHT - KEYBOARD_HEIGHT - ACTIVE_TEXT_HEIGHT/2
    const centerY = (GAME_HEIGHT - KEYBOARD_HEIGHT - ACTIVE_TEXT_HEIGHT / 2) * gs

    if (this.activeText) {
      ctx.fillStyle = ACTIVE_TEXT_COLOR
      ctx.font = `bold ${ACTIVE_TEXT_FONT_SIZE * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.activeText, GAME_WIDTH / 2 * gs, centerY)
    }

    if (this.badTextTimer > 0 && this.badText) {
      // C++ bad text is visible for 1 second then hidden (no fade, just visibility toggle)
      ctx.fillStyle = BAD_TEXT_COLOR
      ctx.font = `bold ${ACTIVE_TEXT_FONT_SIZE * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.badText, GAME_WIDTH / 2 * gs, centerY)
    }
  }

  drawFallingItem(item: FallingItem, gs: number) {
    const { ctx } = this
    // item.x, item.y are the bottom-center position in web canvas coords
    // The bubble is anchored at MIDDLE_BOTTOM in C++
    // So: top-left corner for drawing = (x - BUBBLE_WIDTH/2, y - BUBBLE_HEIGHT)
    // But we stored y as the web equivalent of the C++ anchor point.
    // In C++, StartPosition.y = GAME_HEIGHT - 100 maps to web y = 100 (top of the bubble bottom edge)
    // Actually in web coords, item.y represents where the bottom of the bubble is in the game area.
    // Let's draw centered on the position more carefully.
    //
    // In C++ Cocos2d with ANCHOR_MIDDLE_BOTTOM:
    //   The position point is at the middle-bottom of the node.
    //   So the bubble extends from (x - w/2, y) to (x + w/2, y + h)
    //
    // In web canvas (Y flipped):
    //   If C++ bottom is at cocosY, web equivalent = GAME_HEIGHT - cocosY
    //   But we already converted: item.y = GAME_HEIGHT - cocosY
    //   So item.y is where the C++ bottom of the bubble is, in web coords (which is visually the BOTTOM)
    //   The bubble in web goes from y-BUBBLE_HEIGHT (top) to y (bottom)
    //
    // Wait, let me reconsider. We set:
    //   startY_web = 100 (which is the web Y for the C++ "near top" position)
    //   stopY_web = GAME_HEIGHT - KEYBOARD_HEIGHT (web Y for the keyboard top)
    //
    // In C++, the anchor is MIDDLE_BOTTOM. The position (px, py) means:
    //   bottom-center of bubble is at (px, py) in Cocos2d coords.
    //   The bubble image extends from py to py + BUBBLE_HEIGHT upward.
    //
    // In web, after converting, item.y corresponds to the TOP side of the bubble
    // (because high Cocos2d Y = low web Y = near top of screen).
    // Actually: C++ position cocosY = GAME_HEIGHT - 100. That's near the top.
    // web Y = GAME_HEIGHT - cocosY = 100. That's also near the top.
    //
    // But in C++, the bubble bottom is at cocosY = GAME_HEIGHT-100, and it extends UPWARD.
    // In web terms, the bubble bottom is at webY = 100... but webY = 100 is near the TOP.
    //
    // This is confusing. Let me think differently:
    // In C++ the ANCHOR_MIDDLE_BOTTOM means the position is the bottom-center.
    // The bubble visual occupies from (x-w/2, y) to (x+w/2, y+h) in Cocos2d.
    // Cocos2d y increases upward.
    // In web, y increases downward.
    //
    // For C++ point (cx, cy):
    //   Web point = (cx, GAME_HEIGHT - cy)
    //
    // Bubble top in Cocos2d = cy + BUBBLE_HEIGHT
    // Bubble top in web = GAME_HEIGHT - (cy + BUBBLE_HEIGHT)
    //
    // So the bubble in web draws from:
    //   top = GAME_HEIGHT - cy - BUBBLE_HEIGHT
    //   bottom = GAME_HEIGHT - cy
    //   left = cx - BUBBLE_WIDTH/2
    //   right = cx + BUBBLE_WIDTH/2
    //
    // Our item.y = GAME_HEIGHT - cocosY = GAME_HEIGHT - cy
    //   => cy = GAME_HEIGHT - item.y
    //   => bubble top in web = GAME_HEIGHT - (GAME_HEIGHT - item.y) - BUBBLE_HEIGHT = item.y - BUBBLE_HEIGHT
    //   => bubble bottom in web = item.y
    //
    // So the bubble draws from (item.x - BUBBLE_WIDTH/2, item.y - BUBBLE_HEIGHT) with size (BUBBLE_WIDTH, BUBBLE_HEIGHT)

    const bx = (item.x - BUBBLE_WIDTH / 2) * gs
    const by = (item.y - BUBBLE_HEIGHT) * gs
    const bw = BUBBLE_WIDTH * gs
    const bh = BUBBLE_HEIGHT * gs

    // Draw bubble image
    const bubbleImg = this.bubbleImages[item.bubbleVariant]
    if (imgOk(bubbleImg)) {
      ctx.drawImage(bubbleImg, bx, by, bw, bh)
    } else {
      ctx.fillStyle = 'rgba(100,181,246,0.7)'
      ctx.beginPath()
      ctx.arc(item.x * gs, (item.y - BUBBLE_HEIGHT / 2) * gs, BUBBLE_WIDTH / 2 * gs, 0, Math.PI * 2)
      ctx.fill()
    }

    // Text inside bubble (C++ anchor MIDDLE, position at CS/2 = center of bubble)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${BUBBLE_FONT_SIZE * gs}px TodoMainCurly, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 4 * gs
    ctx.fillText(item.text, item.x * gs, (item.y - BUBBLE_HEIGHT / 2) * gs)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }

  drawPopAnimation(pop: PopAnimation, gs: number) {
    const { ctx } = this
    const t = pop.timer

    // Phase 1: bubble visible for KEY_FOR_BUBBLE_POP seconds, then disappears
    // Phase 2: fragments appear and scatter from KEY_FOR_BUBBLE_POP to KEY_FOR_BUBBLE_SCATTER
    const scatterStart = KEY_FOR_BUBBLE_POP
    const scatterDuration = KEY_FOR_BUBBLE_SCATTER - KEY_FOR_BUBBLE_POP

    // Draw the original bubble (fades out instantly at pop time)
    if (t < scatterStart) {
      // Bubble still visible
      const bubbleImg = this.bubbleImages[0]
      if (imgOk(bubbleImg)) {
        const bx = (pop.x - BUBBLE_WIDTH / 2) * gs
        const by = (pop.y - BUBBLE_HEIGHT) * gs
        ctx.drawImage(bubbleImg, bx, by, BUBBLE_WIDTH * gs, BUBBLE_HEIGHT * gs)
      }
    }

    // Draw text (moves up and fades out after pop)
    if (t >= scatterStart && t < pop.totalDuration) {
      const textProgress = (t - scatterStart) / scatterDuration
      const eased = 1 - (1 - textProgress) // EaseOut factor (simplified)
      const textAlpha = 1 - textProgress  // FadeOut
      const textYOffset = -pop.textOffsetY * eased  // moves up in web coords (negative Y)

      ctx.globalAlpha = Math.max(0, textAlpha)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${BUBBLE_FONT_SIZE * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(pop.text, pop.x * gs, (pop.y - BUBBLE_HEIGHT / 2 + textYOffset) * gs)
      ctx.globalAlpha = 1
    }

    // Draw fragments (appear at pop time, scatter outward)
    if (t >= scatterStart) {
      const fragProgress = Math.min((t - scatterStart) / scatterDuration, 1)

      for (const frag of pop.fragments) {
        // C++ EaseOut for movement, FadeOut, scale interpolation
        const eased = 1 - (1 - fragProgress) * (1 - fragProgress)
        const fragX = frag.x * (1 - eased) + frag.targetX * eased
        const fragY = frag.y * (1 - eased) + frag.targetY * eased
        const scale = frag.scaleStart + (frag.scaleEnd - frag.scaleStart) * fragProgress
        const alpha = 1 - fragProgress

        const bubbleImg = this.bubbleImages[frag.bubbleVariant]
        if (imgOk(bubbleImg) && alpha > 0) {
          ctx.globalAlpha = alpha
          const fw = BUBBLE_WIDTH * scale * gs
          const fh = BUBBLE_HEIGHT * scale * gs
          ctx.drawImage(bubbleImg,
            fragX * gs - fw / 2,
            (fragY - BUBBLE_HEIGHT / 2) * gs - fh / 2,
            fw, fh)
          ctx.globalAlpha = 1
        }
      }
    }
  }
}
