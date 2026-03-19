import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

// C++ card default size from LetterMatchingCard::defaultSize() = Size(450, 570)
const CARD_W = 450
const CARD_H = 570
// C++ scale factors from LetterMatchingScene::onStart()
const CARD_SCALE = 0.8       // _defaultScaleFactor
const CARD_SCALE_UP = 0.9    // _upScaleFactor

// C++ CardSlotBuilder grid spacing factors
const GRID_RHO_X = 1.40
const GRID_RHO_Y = 1.20
const GRID_SHAKE_RATE = (1 / 4) / 2  // 0.125

interface PieceData {
  pieceId: number
  matchSound: string
  imageA: string
  imageB: string
}

interface ProblemData {
  problemId: number
  pieces: PieceData[]
}

interface LevelData {
  level: number
  problems: ProblemData[]
}

interface Card {
  id: number          // pieceID - matches between A and B
  x: number
  y: number
  width: number
  height: number
  scale: number
  image: HTMLImageElement
  matchSound: string
  side: 'A' | 'B'
  matched: boolean
  dragging: boolean
  matchAnim: number
  removed: boolean
  // C++ match animation state
  matchStartX: number
  matchStartY: number
  matchTargetX: number
  matchTargetY: number
  matchMoveTime: number
  matchPhase: 'none' | 'move_to_partner' | 'scale_fade'
}

// C++ star_particle: burst of star shapes on match success
interface StarParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  rotSpeed: number
  alpha: number
  life: number
  maxLife: number
  color: string
}

export interface MatchingConfig {
  assetPath: string
  dataUrl: string
  soundPath: string
}

export class LetterMatchingEngine extends BaseEngine {
  level: number
  config: MatchingConfig
  levelData: LevelData | null = null
  currentProblem = 0
  totalProblems = 0
  cards: Card[] = []
  dragCard: Card | null = null
  linkedCard: Card | null = null  // C++ linking: cards glow when overlapping during drag
  dragOffsetX = 0
  dragOffsetY = 0
  matchedCount = 0
  totalPairs = 0
  bgImage: HTMLImageElement
  sfxSolve: HTMLAudioElement
  zOrderCounter = 30   // C++ Z_ORDER_DEFAULT = 30

  starParticles: StarParticle[] = []

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number, config?: MatchingConfig) {
    super(canvas)
    this.level = level
    this.config = config || {
      assetPath: assetUrl('/assets/games/lettermatching'),
      dataUrl: '/data/games/lettermatching.json',
      soundPath: assetUrl('/assets/games/lettermatching/sounds'),
    }
    this.bgImage = loadImage(`${this.config.assetPath}/matching_bg_bigger.jpg`)
    // C++ SOLVE_EFFECT_SOUND = "Counting/UI_Star_Collected.m4a"
    // We use the available play_level_clear.wav as equivalent
    this.sfxSolve = loadAudio(`${this.config.soundPath}/play_level_clear.wav`)
  }

  async loadLevel() {
    const resp = await fetch(this.config.dataUrl)
    const data = await resp.json()
    this.levelData = data.levels.find((l: LevelData) => l.level === this.level) || data.levels[0]
    this.currentProblem = 0
    this.matchedCount = 0
    this.totalProblems = this.levelData ? this.levelData.problems.length : 0
    this.setupProblem()
  }

  /**
   * C++ CardSlotBuilder::pointsInBoundary algorithm:
   * 1. Create grid of candidate points with spacing cardSize/rhoX and cardSize/rhoY
   * 2. Add random shake to each point
   * 3. Sample N points from candidates, choosing the set that maximizes sum of squared distances
   *    (tries 20 random samples)
   *
   * C++ splits board into left and right halves, generates candidates for each half,
   * randomly assigns how many cards go on each side (roughly half each).
   */
  generateCardPositions(cardCount: number, boardRect: { x: number, y: number, w: number, h: number }): Array<{ x: number, y: number }> {
    const cardW = CARD_W * CARD_SCALE
    const cardH = CARD_H * CARD_SCALE

    // Generate candidate grid points within boundary (C++ candidatePointsInBoundary)
    const candidates: Array<{ x: number, y: number }> = []
    const minX = boardRect.x + cardW * (GRID_SHAKE_RATE + 0.5)
    const maxX = boardRect.x + boardRect.w - cardW * (GRID_SHAKE_RATE + 0.5)
    const minY = boardRect.y + cardH * (GRID_SHAKE_RATE + 0.5)
    const maxY = boardRect.y + boardRect.h - cardH * (GRID_SHAKE_RATE + 0.5)

    for (let x = minX; x < maxX; x += cardW / GRID_RHO_X) {
      for (let y = minY; y < maxY; y += cardH / GRID_RHO_Y) {
        const shakeX = (Math.random() * 2 - 1) * cardW * GRID_SHAKE_RATE
        const shakeY = (Math.random() * 2 - 1) * cardH * GRID_SHAKE_RATE
        candidates.push({ x: x + shakeX, y: y + shakeY })
      }
    }

    // If not enough candidates, add random points
    while (candidates.length < cardCount) {
      candidates.push({
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
      })
    }

    // Sample cardCount points, picking the set that maximizes sum of squared distances (20 tries)
    const sample = (arr: Array<{ x: number, y: number }>, n: number) => {
      const copy = [...arr]
      const result: Array<{ x: number, y: number }> = []
      for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = Math.floor(Math.random() * copy.length)
        result.push(copy.splice(idx, 1)[0])
      }
      return result
    }

    const scoreFn = (points: Array<{ x: number, y: number }>) => {
      let score = 0
      for (const a of points) {
        for (const b of points) {
          if (a === b) continue
          const dx = a.x - b.x
          const dy = a.y - b.y
          score += dx * dx + dy * dy
        }
      }
      return score
    }

    let bestPoints = sample(candidates, cardCount)
    let bestScore = scoreFn(bestPoints)
    for (let i = 0; i < 20; i++) {
      const pts = sample(candidates, cardCount)
      const s = scoreFn(pts)
      if (s > bestScore) {
        bestPoints = pts
        bestScore = s
      }
    }

    return bestPoints
  }

  setupProblem() {
    if (!this.levelData) return
    const problem = this.levelData.problems[this.currentProblem]
    if (!problem) return

    this.cards = []
    this.dragCard = null
    this.linkedCard = null
    const pieces = problem.pieces
    this.totalPairs = pieces.length
    this.zOrderCounter = 30

    // C++ creates cardCount = pieces.length * 2 cards total
    const totalCards = pieces.length * 2

    // C++ board rect is full game area: Rect(0, 0, 2560, 1800)
    const boardRect = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT }

    // C++ splits into left and right halves
    const leftRect = { x: boardRect.x, y: boardRect.y, w: boardRect.w / 2, h: boardRect.h }
    const rightRect = { x: boardRect.x + boardRect.w / 2, y: boardRect.y, w: boardRect.w / 2, h: boardRect.h }

    // C++ randomly assigns how many cards on each side
    let leftCount = Math.ceil(totalCards / 2)
    let rightCount = totalCards - leftCount
    if (Math.random() < 0.5) {
      const tmp = leftCount
      leftCount = rightCount
      rightCount = tmp
    }

    // Generate positions for each half
    const leftPositions = this.generateCardPositions(leftCount, leftRect)
    const rightPositions = this.generateCardPositions(rightCount, rightRect)
    const allPositions = [...leftPositions, ...rightPositions]

    // Create card pairs
    const allCards: Card[] = []
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]

      // C++ tries multiple paths for match sound:
      // 1. bare path, 2. NumberMatching/Sound/ prefix, 3. NumberMatching/Images/Letter/ prefix, 4. star.wav fallback
      // In web, sounds are in the sounds directory directly
      const matchSoundFile = piece.matchSound

      const cardA: Card = {
        id: piece.pieceId, x: 0, y: 0,
        width: CARD_W, height: CARD_H, scale: CARD_SCALE,
        image: loadImage(`${this.config.assetPath}/${piece.imageA}`),
        matchSound: matchSoundFile, side: 'A',
        matched: false, dragging: false, matchAnim: 0, removed: false,
        matchStartX: 0, matchStartY: 0,
        matchTargetX: 0, matchTargetY: 0, matchMoveTime: 0, matchPhase: 'none',
      }
      const cardB: Card = {
        id: piece.pieceId, x: 0, y: 0,
        width: CARD_W, height: CARD_H, scale: CARD_SCALE,
        image: loadImage(`${this.config.assetPath}/${piece.imageB}`),
        matchSound: matchSoundFile, side: 'B',
        matched: false, dragging: false, matchAnim: 0, removed: false,
        matchStartX: 0, matchStartY: 0,
        matchTargetX: 0, matchTargetY: 0, matchMoveTime: 0, matchPhase: 'none',
      }
      allCards.push(cardA, cardB)
    }

    // Assign positions to cards
    for (let i = 0; i < allCards.length && i < allPositions.length; i++) {
      allCards[i].x = allPositions[i].x
      allCards[i].y = allPositions[i].y
    }

    this.cards = allCards

    // C++ progress bar shows which problem you're on (1-based)
    this.onProgressChange?.(this.currentProblem + 1, this.totalProblems)
  }

  shuffle(arr: Card[]) {
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
    // C++ iterates matchingCardList checking isTouchedIn
    // We check from end (highest z-order) to start
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const card = this.cards[i]
      if (card.matched || card.removed || card.dragging) continue
      const hw = card.width * card.scale / 2
      const hh = card.height * card.scale / 2
      if (x >= card.x - hw && x <= card.x + hw && y >= card.y - hh && y <= card.y + hh) {
        card.dragging = true
        // C++ ScaleTo::create(0.1f, _upScaleFactor)
        card.scale = CARD_SCALE_UP
        this.dragCard = card
        this.dragOffsetX = card.x - x
        this.dragOffsetY = card.y - y
        // C++ reorderChild(card, ++_zOrder)
        this.zOrderCounter++
        // Move to end of array for rendering on top
        this.cards.splice(i, 1)
        this.cards.push(card)
        break
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.dragCard) return
    // C++ card->setPosition(card->getPosition() + touch->getDelta())
    this.dragCard.x = x + this.dragOffsetX
    this.dragCard.y = y + this.dragOffsetY

    const card = this.dragCard

    if (this.linkedCard) {
      // C++ shouldKeepAsPair: check if still overlapping (same as shouldBecomePair)
      if (!this.cardsOverlap(card, this.linkedCard)) {
        // C++ setLink(nullptr): scale back, stop particle
        this.linkedCard.scale = CARD_SCALE
        this.linkedCard = null
      }
    } else {
      // C++ checks all other cards for matching ID, not linked, not done
      for (const other of this.cards) {
        if (other === card || other.matched || other.removed) continue
        if (other.dragging) continue
        // C++ matches by id (pieceID), cards must have same id but different side
        if (other.id !== card.id) continue
        if (other.side === card.side) continue

        if (this.cardsOverlap(card, other)) {
          // C++ setLink: EaseElasticOut(ScaleTo(0.3, _upScaleFactor)), start particle
          other.scale = CARD_SCALE_UP
          this.linkedCard = other
          // C++ reorders both cards to top
          this.zOrderCounter++
          break
        }
      }
    }
  }

  cardsOverlap(a: Card, b: Card): boolean {
    // C++ shouldBecomePair uses world-space bounding rects (convertToWorldSpace)
    // In our flat coordinate space, this is straightforward rect intersection
    const hw1 = a.width * a.scale / 2
    const hh1 = a.height * a.scale / 2
    const hw2 = b.width * b.scale / 2
    const hh2 = b.height * b.scale / 2
    return !(a.x + hw1 < b.x - hw2 || a.x - hw1 > b.x + hw2 ||
             a.y + hh1 < b.y - hh2 || a.y - hh1 > b.y + hh2)
  }

  onPointerUp(_x: number, _y: number) {
    const card = this.dragCard
    if (!card) return
    // C++ stopParticle, isTouched = false
    card.dragging = false
    this.dragCard = null

    const other = this.linkedCard
    this.linkedCard = null

    if (other && !other.matched && !other.removed && other.id === card.id && other.side !== card.side) {
      // C++ match sequence:
      // card.isMatchDone = true, other.isMatchDone = true
      card.matched = true
      other.matched = true
      other.scale = CARD_SCALE

      // C++ card moves to other's position with EaseElasticOut(MoveTo(0.4s))
      // then other is hidden, card scales up, fades out, plays sound, star particle
      card.matchPhase = 'move_to_partner'
      card.matchStartX = card.x
      card.matchStartY = card.y
      card.matchTargetX = other.x
      card.matchTargetY = other.y
      card.matchMoveTime = 0
      card.matchAnim = 0

      // C++ hides other card (setPosition 9999) when dragged card arrives
      // Other card waits at its position then gets removed
      other.matchPhase = 'none'
      other.matchAnim = 0

      // Play match sound after 0.3s delay (C++ fires in CallFunc after 0.3s)
      if (card.matchSound) {
        setTimeout(() => {
          const audio = loadAudio(`${this.config.soundPath}/${card.matchSound}`)
          playSound(audio)
        }, 300)
      }

      this.matchedCount++

      if (this.matchedCount >= this.totalPairs) {
        // C++ plays SOLVE_EFFECT_SOUND, then after 0.5s delay calls onSolve
        setTimeout(() => {
          playSound(this.sfxSolve)
          // C++ onSolve: update progress, then either auto-advance or show complete
          this.onProgressChange?.(this.currentProblem + 1, this.totalProblems)

          if (this.currentProblem + 1 < this.totalProblems) {
            // C++ auto-advances with advanceToNextProblem (0.2s delay)
            setTimeout(() => {
              this.currentProblem++
              this.matchedCount = 0
              this.setupProblem()
            }, 200)
          } else {
            // C++ shows CompletePopup after 1.0s
            setTimeout(() => {
              this.gameState = 'complete'
              this.onComplete?.()
            }, 1000)
          }
        }, 500)
      }
    } else {
      // C++ no match: card stays where dropped, scale back to default
      // C++ ScaleTo::create(0.1f, _defaultScaleFactor)
      card.scale = CARD_SCALE
      if (other) {
        // C++ setLink(nullptr) on other: if not touched, EaseElasticOut scale back to defaultScale
        other.scale = CARD_SCALE
      }
      // C++ does NOT snap card back to origin position - card stays where it was dropped
    }
  }

  update(_time: number, dt: number) {
    for (const card of this.cards) {
      if (card.removed) continue

      if (card.matchPhase === 'move_to_partner') {
        // C++ EaseElasticOut(MoveTo(0.4s, other.position))
        card.matchMoveTime += dt
        const t = Math.min(card.matchMoveTime / 0.4, 1)
        // Elastic ease out approximation
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * (2 * Math.PI) / 3)

        card.x = card.matchStartX + (card.matchTargetX - card.matchStartX) * eased
        card.y = card.matchStartY + (card.matchTargetY - card.matchStartY) * eased

        if (t >= 1) {
          card.x = card.matchTargetX
          card.y = card.matchTargetY
          // C++ hides the partner card (setPosition 9999) at this point
          for (const other of this.cards) {
            if (other !== card && other.matched && !other.removed &&
                other.id === card.id && other.matchPhase === 'none') {
              other.removed = true
            }
          }
          card.matchPhase = 'scale_fade'
          card.matchAnim = 0
        }
      }

      if (card.matchPhase === 'scale_fade') {
        // C++ after 0.3s delay: EaseBackIn(ScaleTo(0.3s, upScale)) + EaseExponentialIn(FadeOut(0.3s))
        card.matchAnim += dt
        if (card.matchAnim > 0.3 && card.matchAnim <= 0.6) {
          // Scale up and fade out phase (alpha handled in drawCard via matchAnim)
          card.scale = CARD_SCALE_UP
        }
        if (card.matchAnim > 0.6) {
          // C++ addStarParticle at card position when card disappears
          this.spawnStarParticles(card.x, card.y)
          card.removed = true
        }
      }
    }

    // Update star particles
    for (let i = this.starParticles.length - 1; i >= 0; i--) {
      const p = this.starParticles[i]
      p.life += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 200 * dt  // gravity
      p.rotation += p.rotSpeed * dt
      p.alpha = Math.max(0, 1 - p.life / p.maxLife)
      if (p.life >= p.maxLife) {
        this.starParticles.splice(i, 1)
      }
    }
  }

  // C++ addStarParticle: burst of star shapes at position
  spawnStarParticles(gx: number, gy: number) {
    const COLORS = ['#FFD700', '#FFA500', '#FF6347', '#FF69B4', '#87CEEB', '#98FB98']
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5
      const speed = 200 + Math.random() * 300
      this.starParticles.push({
        x: gx,
        y: gy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        size: 20 + Math.random() * 30,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        alpha: 1,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      })
    }
  }

  drawStar(cx: number, cy: number, size: number, rotation: number) {
    const { ctx } = this
    const spikes = 5
    const outerR = size / 2
    const innerR = outerR * 0.4
    ctx.beginPath()
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR
      const angle = rotation + (Math.PI * i) / spikes - Math.PI / 2
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
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

    for (const card of this.cards) {
      if (card.removed) continue
      this.drawCard(card)
    }

    // Draw star particles on top of everything
    for (const p of this.starParticles) {
      const gs = this.gameScale
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      this.drawStar(p.x * gs, p.y * gs, p.size * gs, p.rotation)
      ctx.restore()
    }

    ctx.restore()
  }

  drawCard(card: Card) {
    const { ctx } = this
    const gs = this.gameScale
    const x = card.x * gs
    const y = card.y * gs
    const w = card.width * card.scale * gs
    const h = card.height * card.scale * gs

    ctx.save()

    // C++ match animation: fade out after delay
    if (card.matchPhase === 'scale_fade' && card.matchAnim > 0.3) {
      const fadeT = Math.min((card.matchAnim - 0.3) / 0.3, 1)
      // C++ EaseExponentialIn fade: opacity goes from 1 to 0
      const alpha = 1 - fadeT * fadeT // exponential-ish ease in
      ctx.globalAlpha = Math.max(alpha, 0)
      // C++ EaseBackIn scale up
      const scaleUp = 1 + fadeT * 0.15
      ctx.translate(x, y)
      ctx.scale(scaleUp, scaleUp)
      ctx.translate(-x, -y)
    }

    // C++ card: sprite IS the card, no white background, no padding
    // The card images already contain their own colored backgrounds with rounded corners
    if (imgOk(card.image)) {
      // Draw drop shadow behind card
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = 8 * gs
      ctx.shadowOffsetY = 4 * gs
      ctx.drawImage(card.image, x - w / 2, y - h / 2, w, h)
      ctx.shadowColor = 'transparent'
    }

    // C++ shining particle effect when linked - in C++ this uses particle systems
    // (shining_particle_blur, circle, star). On web, card scale-up is the main feedback.

    ctx.restore()
  }
}
