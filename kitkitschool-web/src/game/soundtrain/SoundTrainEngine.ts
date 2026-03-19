import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound, imgOk } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const GW = GAME_WIDTH   // 2560
const GH = GAME_HEIGHT  // 1800

// ── Constants ──
const SNAP_RADIUS = 80
const RAIL_Y_COCOS = 645
const RAIL_Y = GH - RAIL_Y_COCOS  // 1155
const TRAIN_SPEED = 2200
const CONNECTOR_MARGIN = 47

// Freight car slot geometry (reuse from patterntrain constants)
const SLOT_HEIGHT_LOCAL = 330
const SLOT_LEFT_MARGIN = 226
const SLOT_GAP = 13
const SLOT_W = 234
const SLOT_H = 238

// Letter card dimensions
const CARD_W = 240
const CARD_H = 240

// Answer row y position (bottom area)
const ANSWER_Y = GH - 200

// Image / sound bases
const IMG_BASE = assetUrl('/assets/games/patterntrain/')
const SND_BASE = assetUrl('/assets/games/patterntrain/sounds/')

// Colors for letter cards (cycling palette)
const CARD_COLORS = [
  '#E53935', '#8E24AA', '#1E88E5', '#00897B',
  '#F4511E', '#6D4C41', '#039BE5', '#43A047',
  '#FFB300', '#D81B60', '#5E35B1', '#00ACC1',
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Data Types ──
interface SlotObj {
  localX: number    // relative to car left edge
  localY: number    // Cocos local Y (from car bottom)
  correctLetter: string  // expected letter (lowercase)
  cardInSlot: LetterCard | null
  filled: boolean
}

interface FreightCarObj {
  x: number         // canvas X of car left edge
  y: number         // canvas Y = RAIL_Y (bottom of car)
  width: number
  height: number
  letterCount: number   // 2 or 3
  slots: SlotObj[]
  imgKey: string    // 'base2' or 'base3'
}

interface LetterCard {
  x: number
  y: number
  letter: string
  color: string
  originalX: number
  originalY: number
  draggable: boolean
  visible: boolean
  inSlot: boolean
  zOrder: number
}

interface Anim {
  type: string
  startTime: number
  duration: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  done: boolean
}

// ═══════════════════════════════════════════════
// SoundTrainEngine
// ═══════════════════════════════════════════════
export class SoundTrainEngine extends BaseEngine {
  level: number
  words: string[] = []
  wordIndex = 0
  wordsPerRound = 5
  problemWords: string[] = []

  // Train objects
  locomotiveX = 0
  locomotiveY = RAIL_Y
  locomotiveArriveX = 0
  freightCar: FreightCarObj | null = null
  trainTotalWidth = 0

  // Cards
  cards: LetterCard[] = []
  dragging: LetterCard | null = null

  // Animation
  anims: Anim[] = []
  currentTime = 0

  // State
  phase: 'arriving' | 'playing' | 'correct' | 'leaving' | 'idle' = 'idle'
  inputEnabled = false

  // Images
  images: Record<string, HTMLImageElement> = {}
  // Sounds
  sounds: Record<string, HTMLAudioElement> = {}

  // Callbacks
  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
  }

  loadLevel(words: string[]) {
    this.words = shuffle([...words])
    // Pick 5 words for this round
    this.problemWords = this.words.slice(0, this.wordsPerRound)
    this.wordIndex = 0
  }

  start() {
    this.loadAssets()
    super.start()
    this.setProblem()
  }

  loadAssets() {
    this.images.bg = loadImage(IMG_BASE + '_train_pattern_bg.png')
    this.images.locomotive = loadImage(IMG_BASE + 'train_pattern_front_block.png')
    this.images.base2 = loadImage(IMG_BASE + 'train_pattern_base_2blocks.png')
    this.images.base3 = loadImage(IMG_BASE + 'train_pattern_base_3blocks.png')
    this.images.connector = loadImage(IMG_BASE + 'train_pattern_connector.png')
    this.images.emptySpot = loadImage(IMG_BASE + 'train_pattern_empty_spot.png')

    this.sounds.slotIn = loadAudio(SND_BASE + 'blockslotin.m4a')
    this.sounds.touch = loadAudio(SND_BASE + 'blocktouch.m4a')
    this.sounds.miss = loadAudio(SND_BASE + 'blockmiss.m4a')
    this.sounds.move = loadAudio(SND_BASE + 'trainmoves.m4a')
    this.sounds.come = loadAudio(SND_BASE + 'train2.m4a')
    this.sounds.whistle1 = loadAudio(SND_BASE + 'pattern_train_1.m4a')
    this.sounds.whistle2 = loadAudio(SND_BASE + 'pattern_train_2.m4a')
    this.sounds.whistle3 = loadAudio(SND_BASE + 'pattern_train_3.m4a')
  }

  // ── Problem Setup ──
  setProblem() {
    if (this.wordIndex >= this.problemWords.length) {
      this.gameState = 'complete'
      this.onComplete?.()
      return
    }

    this.onProgressChange?.(this.wordIndex + 1, this.problemWords.length)

    // Reset
    this.freightCar = null
    this.cards = []
    this.anims = []
    this.dragging = null
    this.inputEnabled = false
    this.phase = 'idle'

    const word = this.problemWords[this.wordIndex]
    this.buildTrain(word)
    this.trainCome()

    // Schedule cards to appear after train arrives (~1.3s)
    this.addAnim('showCards', this.currentTime + 1.3, 0.01, { word })
  }

  buildTrain(word: string) {
    const locoImg = this.images.locomotive
    const locoW = imgOk(locoImg) ? locoImg.naturalWidth : 455

    // Choose freight car type based on letter count
    const letterCount = word.length
    // Use base3 for words with 3+ letters (base2 for exactly 2-letter words)
    const useBase3 = letterCount >= 3
    const imgKey = useBase3 ? 'base3' : 'base2'
    const carImg = this.images[imgKey]
    const carW = imgOk(carImg) ? carImg.naturalWidth : (useBase3 ? 706 : 467)
    const carH = imgOk(carImg) ? carImg.naturalHeight : 97

    // Build slots for each letter
    const slots: SlotObj[] = []
    for (let i = 0; i < letterCount; i++) {
      slots.push({
        localX: SLOT_LEFT_MARGIN + (SLOT_GAP + SLOT_W) * i,
        localY: SLOT_HEIGHT_LOCAL,
        correctLetter: word[i],
        cardInSlot: null,
        filled: false,
      })
    }

    this.trainTotalWidth = locoW + CONNECTOR_MARGIN + carW
    const arriveX = GW / 2 - this.trainTotalWidth / 2

    this.freightCar = {
      x: GW + carW,  // start off-screen right
      y: RAIL_Y,
      width: carW,
      height: carH,
      letterCount,
      slots,
      imgKey,
    }

    this.locomotiveX = GW
    this.locomotiveY = RAIL_Y
    this.locomotiveArriveX = arriveX
  }

  trainCome() {
    this.phase = 'arriving'
    const t = this.currentTime

    // Locomotive arrive
    const locoImg = this.images.locomotive
    const locoW = imgOk(locoImg) ? locoImg.naturalWidth : 455
    const carArriveX = this.locomotiveArriveX + locoW + CONNECTOR_MARGIN

    const locoMoveDist = GW - this.locomotiveArriveX
    const moveTime = locoMoveDist / TRAIN_SPEED

    this.addAnim('locoArrive', t + 0.3, moveTime, {
      startX: GW,
      endX: this.locomotiveArriveX,
    })
    this.addAnim('playSound', t + 0.3, 0.01, { sound: 'come' })

    if (this.freightCar) {
      const car = this.freightCar
      const carStartX = GW + car.width
      this.addAnim('carArrive', t + 0.3, moveTime, {
        startX: carStartX,
        endX: carArriveX,
      })
    }
  }

  showCards(word: string) {
    const letters = word.split('')
    // Create shuffled letter cards
    const shuffledLetters = shuffle([...letters])
    const totalW = shuffledLetters.length * (CARD_W + 20) - 20
    const startX = GW / 2 - totalW / 2 + CARD_W / 2

    for (let i = 0; i < shuffledLetters.length; i++) {
      const letter = shuffledLetters[i]
      const targetX = startX + i * (CARD_W + 20)
      const targetY = ANSWER_Y
      const color = CARD_COLORS[letter.charCodeAt(0) % CARD_COLORS.length]

      const card: LetterCard = {
        x: targetX,
        y: targetY + 600,
        letter,
        color,
        originalX: targetX,
        originalY: targetY,
        draggable: true,
        visible: true,
        inSlot: false,
        zOrder: 1,
      }
      this.cards.push(card)

      // Animate rise
      this.addAnim('cardRise', this.currentTime + 0.08 * i, 0.35, {
        card,
        startY: targetY + 600,
        endY: targetY,
      })
    }

    // Enable input after cards appear
    this.addAnim('enableInput', this.currentTime + 0.08 * shuffledLetters.length + 0.2, 0.01, {})
  }

  // ── Animation helpers ──
  addAnim(type: string, startTime: number, duration: number, data: Record<string, unknown>) {
    this.anims.push({ type, startTime, duration, data, done: false })
  }

  updateAnims(t: number) {
    for (const a of this.anims) {
      if (a.done) continue
      if (t < a.startTime) continue

      const elapsed = t - a.startTime
      const progress = Math.min(elapsed / Math.max(a.duration, 0.001), 1)

      switch (a.type) {
        case 'locoArrive': {
          const ep = 1 - (1 - progress) * (1 - progress)
          this.locomotiveX = a.data.startX + (a.data.endX - a.data.startX) * ep
          if (progress >= 1) {
            this.locomotiveX = a.data.endX
            a.done = true
          }
          break
        }
        case 'carArrive': {
          const ep = 1 - (1 - progress) * (1 - progress)
          if (this.freightCar) {
            this.freightCar.x = a.data.startX + (a.data.endX - a.data.startX) * ep
          }
          if (progress >= 1) {
            if (this.freightCar) this.freightCar.x = a.data.endX
            a.done = true
            this.phase = 'playing'
          }
          break
        }
        case 'playSound': {
          const snd = this.sounds[a.data.sound as string]
          if (snd) playSound(snd)
          a.done = true
          break
        }
        case 'showCards': {
          this.showCards(a.data.word as string)
          a.done = true
          break
        }
        case 'enableInput': {
          this.inputEnabled = true
          this.phase = 'playing'
          a.done = true
          break
        }
        case 'cardRise': {
          const ep = 1 - (1 - progress) * (1 - progress)
          const card = a.data.card as LetterCard
          card.y = a.data.startY + (a.data.endY - a.data.startY) * ep
          if (progress >= 1) {
            card.y = a.data.endY
            a.done = true
          }
          break
        }
        case 'cardMoveTo': {
          const card = a.data.card as LetterCard
          card.x = a.data.startX + (a.data.endX - a.data.startX) * progress
          card.y = a.data.startY + (a.data.endY - a.data.startY) * progress
          if (progress >= 1) {
            card.x = a.data.endX
            card.y = a.data.endY
            a.done = true
            if (a.data.onDone) (a.data.onDone as () => void)()
          }
          break
        }
        case 'cardBounce': {
          // bounce back animation (slightly overshooting)
          const ep = progress < 0.7
            ? (progress / 0.7)
            : 1 - (progress - 0.7) / 0.3 * 0.1
          const card = a.data.card as LetterCard
          card.x = a.data.startX + (a.data.endX - a.data.startX) * ep
          card.y = a.data.startY + (a.data.endY - a.data.startY) * ep
          if (progress >= 1) {
            card.x = a.data.endX
            card.y = a.data.endY
            a.done = true
            if (a.data.onDone) (a.data.onDone as () => void)()
          }
          break
        }
        case 'slotJump': {
          const jumpH = 60
          const jumpArc = -4 * jumpH * progress * (progress - 1)
          a.data.offsetY = -jumpArc
          if (progress >= 1) {
            a.data.offsetY = 0
            a.done = true
            // Play a whistle sound
            const idx = (a.data.slotIndex as number) % 3
            if (idx === 0) playSound(this.sounds.whistle1)
            else if (idx === 1) playSound(this.sounds.whistle2)
            else playSound(this.sounds.whistle3)
          }
          break
        }
        case 'trainGo': {
          const ep = progress * progress
          this.locomotiveX = a.data.startLocoX + a.data.dx * ep
          if (this.freightCar) {
            this.freightCar.x = a.data.startCarX + a.data.dx * ep
          }
          if (progress >= 1) {
            a.done = true
          }
          break
        }
        case 'cardsExit': {
          for (const card of a.data.cards as LetterCard[]) {
            const ep = progress * progress
            card.x = card.originalX + (GW / 2 - card.originalX) * ep
            card.y = card.originalY + (GH + 400 - card.originalY) * ep
            if (progress >= 1) card.visible = false
          }
          if (progress >= 1) a.done = true
          break
        }
        case 'nextProblem': {
          if (!a.done) {
            a.done = true
            this.wordIndex++
            this.setProblem()
          }
          break
        }
      }
    }

    this.anims = this.anims.filter(a => !a.done || t - a.startTime < 5)
  }

  // ── Slot World Position ──
  getSlotWorldPos(car: FreightCarObj, slot: SlotObj): { x: number, y: number } {
    return {
      x: car.x + slot.localX - SLOT_W / 2,
      y: car.y - slot.localY + SLOT_H / 2,
    }
  }

  findNearestSlot(bx: number, by: number): { car: FreightCarObj, slot: SlotObj } | null {
    if (!this.freightCar) return null
    const car = this.freightCar
    let best: { car: FreightCarObj, slot: SlotObj } | null = null
    let bestDist = Infinity

    for (const slot of car.slots) {
      if (slot.filled) continue
      const wp = this.getSlotWorldPos(car, slot)
      const dx = wp.x - bx
      const dy = wp.y - by
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= SNAP_RADIUS && dist < bestDist) {
        bestDist = dist
        best = { car, slot }
      }
    }
    return best
  }

  // ── Check if all slots filled correctly ──
  checkAllFilled(): boolean {
    if (!this.freightCar) return false
    return this.freightCar.slots.every(s => s.filled)
  }

  onCorrect() {
    this.phase = 'correct'
    this.inputEnabled = false

    // Jump each slot in sequence
    if (this.freightCar) {
      for (let i = 0; i < this.freightCar.slots.length; i++) {
        this.addAnim('slotJump', this.currentTime + 0.25 * (i + 1), 0.5, {
          slotIndex: i,
          slot: this.freightCar.slots[i],
          offsetY: 0,
        })
      }
    }

    const totalSlots = this.freightCar?.slots.length ?? 1
    const goStart = this.currentTime + 0.25 * totalSlots + 0.7

    // Exit leftover free cards
    const freeCards = this.cards.filter(c => !c.inSlot && c.visible)
    if (freeCards.length > 0) {
      this.addAnim('cardsExit', this.currentTime, 0.5, { cards: freeCards })
    }

    // Train departs
    this.addAnim('playSound', goStart, 0.01, { sound: 'move' })
    this.addAnim('trainGo', goStart, 1.5, {
      startLocoX: this.locomotiveX,
      startCarX: this.freightCar?.x ?? 0,
      dx: -GW - 1000,
    })

    // Next problem
    this.addAnim('nextProblem', goStart + 1.8, 0.01, {})
  }

  // ── Pointer events ──
  onPointerDown(gx: number, gy: number) {
    if (!this.inputEnabled || this.phase !== 'playing') return

    // Hit test cards (last = highest z-order)
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const card = this.cards[i]
      if (!card.draggable || !card.visible || card.inSlot) continue
      if (
        gx >= card.x - CARD_W / 2 && gx <= card.x + CARD_W / 2 &&
        gy >= card.y - CARD_H / 2 && gy <= card.y + CARD_H / 2
      ) {
        this.dragging = card
        card.zOrder = 100
        playSound(this.sounds.touch)
        return
      }
    }
  }

  onPointerMove(gx: number, gy: number) {
    if (!this.dragging) return
    this.dragging.x = gx
    this.dragging.y = gy
  }

  onPointerUp(_gx: number, _gy: number) {
    if (!this.dragging) return
    const card = this.dragging
    this.dragging = null
    card.zOrder = 1

    const nearSlot = this.findNearestSlot(card.x, card.y)

    if (nearSlot && !nearSlot.slot.filled) {
      // Snap to slot position
      const wp = this.getSlotWorldPos(nearSlot.car, nearSlot.slot)

      // Check if correct
      if (card.letter === nearSlot.slot.correctLetter) {
        // Correct!
        playSound(this.sounds.slotIn)
        card.draggable = false
        card.inSlot = true
        nearSlot.slot.filled = true
        nearSlot.slot.cardInSlot = card

        this.addAnim('cardMoveTo', this.currentTime, 0.12, {
          card,
          startX: card.x, startY: card.y,
          endX: wp.x, endY: wp.y,
          onDone: () => {
            if (this.checkAllFilled()) {
              this.onCorrect()
            }
          },
        })
      } else {
        // Wrong - bounce back
        playSound(this.sounds.miss)
        this.addAnim('cardBounce', this.currentTime, 0.35, {
          card,
          startX: card.x, startY: card.y,
          endX: card.originalX, endY: card.originalY,
        })
      }
    } else {
      // Return to original
      this.addAnim('cardMoveTo', this.currentTime, 0.2, {
        card,
        startX: card.x, startY: card.y,
        endX: card.originalX, endY: card.originalY,
      })
    }
  }

  // ── Update & Draw ──
  update(_time: number, dt: number) {
    this.currentTime += dt
    this.updateAnims(this.currentTime)
  }

  draw() {
    const ctx = this.ctx
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const gs = this.gameScale

    ctx.clearRect(0, 0, w, h)

    const offsetX = (w - GW * gs) / 2
    const offsetY = (h - GH * gs) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(gs, gs)

    this.drawBg(w, gs, offsetX, offsetY)
    this.drawWordDisplay()
    this.drawTrain()
    this.drawCards()

    ctx.restore()
  }

  drawBg(canvasW: number, gs: number, offsetX: number, offsetY: number) {
    const ctx = this.ctx
    const bg = this.images.bg
    const visLeft = -offsetX / gs
    const visTop = -offsetY / gs
    const visW = canvasW / gs
    const visH = this.canvas.clientHeight / gs

    ctx.fillStyle = '#87CEEB'
    ctx.fillRect(visLeft, visTop, visW, visH)

    if (imgOk(bg)) {
      ctx.drawImage(bg, visLeft, 0, visW, GH)
    }
  }

  drawWordDisplay() {
    if (this.wordIndex >= this.problemWords.length) return
    const ctx = this.ctx
    const word = this.problemWords[this.wordIndex]

    // Panel background
    const panelW = Math.max(word.length * 160 + 80, 500)
    const panelH = 200
    const panelX = GW / 2 - panelW / 2
    const panelY = 60

    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(panelX, panelY, panelW, panelH, 24)
    ctx.fill()
    ctx.stroke()

    // Draw each letter (filled ones in color, empty ones as "?")
    const filledLetters = this.freightCar
      ? this.freightCar.slots.map(s => s.filled ? s.correctLetter : '_')
      : word.split('').map(() => '_')

    const letterSpacing = 160
    const totalLetterW = word.length * letterSpacing - 20
    const startX = GW / 2 - totalLetterW / 2 + letterSpacing / 2

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < word.length; i++) {
      const lx = startX + i * letterSpacing
      const ly = panelY + panelH / 2

      if (filledLetters[i] !== '_') {
        // Filled letter
        ctx.font = 'bold 110px Arial, sans-serif'
        ctx.fillStyle = CARD_COLORS[word[i].charCodeAt(0) % CARD_COLORS.length]
        ctx.fillText(word[i].toUpperCase(), lx, ly)
      } else {
        // Unfilled - draw underscore line
        ctx.strokeStyle = '#aaa'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(lx - 50, ly + 50)
        ctx.lineTo(lx + 50, ly + 50)
        ctx.stroke()
        // Draw "?" faintly
        ctx.font = '80px Arial, sans-serif'
        ctx.fillStyle = 'rgba(180,180,180,0.5)'
        ctx.fillText('?', lx, ly)
      }
    }

    ctx.restore()
  }

  drawTrain() {
    const ctx = this.ctx

    // Draw freight car first (behind locomotive)
    if (this.freightCar) {
      this.drawFreightCar(this.freightCar)
    }

    // Draw locomotive
    const locoImg = this.images.locomotive
    if (imgOk(locoImg)) {
      ctx.drawImage(locoImg, this.locomotiveX, this.locomotiveY - locoImg.naturalHeight)
    }

    // Draw connector between loco and car
    const connImg = this.images.connector
    if (imgOk(connImg) && this.freightCar) {
      ctx.drawImage(connImg,
        this.freightCar.x - connImg.naturalWidth,
        this.freightCar.y - 60 - connImg.naturalHeight)
    }
  }

  drawFreightCar(car: FreightCarObj) {
    const ctx = this.ctx

    // Car body
    const carImg = this.images[car.imgKey]
    if (imgOk(carImg)) {
      ctx.drawImage(carImg, car.x, car.y - carImg.naturalHeight)
    }

    // Slots
    for (let i = 0; i < car.slots.length; i++) {
      const slot = car.slots[i]
      const wp = this.getSlotWorldPos(car, slot)

      // Draw empty spot indicator
      if (!slot.filled) {
        const emptyImg = this.images.emptySpot
        if (imgOk(emptyImg)) {
          ctx.drawImage(emptyImg,
            wp.x - emptyImg.naturalWidth / 2,
            wp.y - emptyImg.naturalHeight / 2)
        }
      }

      // Draw card in slot (if filled)
      if (slot.filled && slot.cardInSlot) {
        const card = slot.cardInSlot
        // Check for jump animation offset
        let jumpOffsetY = 0
        for (const a of this.anims) {
          if (a.type === 'slotJump' && a.data.slot === slot && !a.done) {
            jumpOffsetY = a.data.offsetY || 0
          }
        }
        this.drawLetterCard(card, wp.x, wp.y + jumpOffsetY, 0.88)
      }
    }
  }

  drawLetterCard(card: LetterCard, cx: number, cy: number, scale = 1.0) {
    const ctx = this.ctx
    const w = CARD_W * scale
    const h = CARD_H * scale

    ctx.save()
    ctx.translate(cx, cy)

    // Card shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 12 * scale
    ctx.shadowOffsetY = 6 * scale

    // Rounded rect background
    ctx.fillStyle = card.color
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, 20 * scale)
    ctx.fill()

    // Reset shadow for text
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Highlight on top
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h * 0.45, [20 * scale, 20 * scale, 0, 0])
    ctx.fill()

    // Letter text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.floor(110 * scale)}px Arial, sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 6 * scale
    ctx.fillText(card.letter.toUpperCase(), 0, 0)

    ctx.restore()
  }

  drawCards() {
    // Sort by zOrder
    const sorted = [...this.cards]
      .filter(c => c.visible && !c.inSlot)
      .sort((a, b) => a.zOrder - b.zOrder)

    for (const card of sorted) {
      this.drawLetterCard(card, card.x, card.y, 1.0)
    }

    // Draw dragging card on top
    if (this.dragging) {
      this.drawLetterCard(this.dragging, this.dragging.x, this.dragging.y, 1.05)
    }
  }
}
