/**
 * WhatIsThisEngine — ported from WhatIsThisScene.cpp / WhatIsThisCard.cpp
 *
 * Game modes:
 *   ChooseSentense (sic — original C++ typo) → top shows IMAGE, bottom shows TEXT
 *   ChoosePicture                            → top shows TEXT,  bottom shows IMAGE
 *
 * Layout (design resolution 2560×1800):
 *   Top card:  centered at (1280, 566)   — Cocos Y 1800-566=1234 → canvas 566
 *   Down cards (image, horizontal):  y=1455 (Cocos y=345), spaced 838px
 *   Down cards (text, vertical):     x=1280, spaced 219px vertically
 */

import {
  BaseEngine,
  GAME_WIDTH,
  GAME_HEIGHT,
  loadImage,
  loadAudio,
  playSound,
} from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

// ─── Constants from C++ ──────────────────────────────────────────────
const CARD_COUNT = 3
const NEXT_DELAY = 0.75
const CARD_DISTANCE_TIME = 0.125
const FLIP_TIME = 0.35
const WAIT_TIME = 2.0
const THROW_TIME = 0.35
const CONTENTS_SIZE_MODIFIER = 0.85

// Layout (converted to canvas top-down Y)
const TOP_CARD_Y = 566                     // Cocos: height - 566
const DOWN_CARD_Y = GAME_HEIGHT - 345      // Cocos: 345
const DOWN_CARD_SPACING_H = 838            // horizontal spacing (ChoosePicture)
const DOWN_CARD_SPACING_V = 219            // vertical spacing (ChooseSentense)
const CENTER_X = GAME_WIDTH / 2            // 1280

// Text colours
const TEXT_COLOR = 'rgba(81, 53, 24, 0.9)' // Color4B(81,53,24,230)

// ─── Data types ──────────────────────────────────────────────────────
interface CardData {
  answer: string
  pic: string
  sound: string
  soundDuration: number
}

interface ProblemData {
  language: string
  level: number
  mode: string         // "ChooseSentense" or "ChoosePicture"
  problem: string
  answer: CardData
  wrongAnswers: CardData[]
}

type CardType = 'image' | 'text'

// ─── Tween system ────────────────────────────────────────────────────
interface Tween {
  startTime: number
  duration: number
  update: (t: number) => void     // t in [0,1]
  onComplete?: () => void
  ease?: (t: number) => number
}

function easeBackOut(t: number): number {
  const s = 1.70158
  return 1 + (t - 1) * (t - 1) * ((s + 1) * (t - 1) + s)
}

function easeBackIn(t: number): number {
  const s = 1.70158
  return t * t * ((s + 1) * t - s)
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function easeInQuad(t: number): number {
  return t * t
}

// ─── Card visual state ───────────────────────────────────────────────
interface CardState {
  x: number
  y: number
  baseX: number
  baseY: number
  scaleX: number
  scaleY: number
  opacity: number
  rotationY: number           // degrees, for flip
  rotationX: number           // degrees, for text flip
  visible: boolean
  cardType: CardType
  data: CardData
  showBack: boolean           // show card back instead of front
  showWrong: boolean          // show wrong-answer BG
  wrongOpacity: number        // fade for wrong BG
  isCorrect: boolean          // is this the correct answer?
  shakeOffset: number         // horizontal shake offset
}

// ─── Engine ──────────────────────────────────────────────────────────
export class WhatIsThisEngine extends BaseEngine {
  private level: number
  private allProblems: ProblemData[] = []
  private currentProblems: ProblemData[] = []
  private totalProblemCount = 0
  private currentProblemIndex = 0

  // Card states
  private topCard: CardState | null = null
  private failCard: CardState | null = null
  private downCards: CardState[] = []

  // Touch lock
  private holdTouch = new Set<string>()

  // Tweens
  private tweens: Tween[] = []
  private currentTime = 0

  // Images (preloaded)
  private bgImg: HTMLImageElement
  // Top card images
  private topImgBg: HTMLImageElement
  private topImgBgWrong: HTMLImageElement
  private topImgMask: HTMLImageElement
  private topTextBg: HTMLImageElement
  private topTextBgWrong: HTMLImageElement
  // Down card images
  private downImgFront: HTMLImageElement
  private downImgFrontWrong: HTMLImageElement
  private downImgBack: HTMLImageElement
  private downImgMask: HTMLImageElement
  private downTextFront: HTMLImageElement
  private downTextFrontWrong: HTMLImageElement
  private downTextBack: HTMLImageElement
  // Content images cache
  private contentImages = new Map<string, HTMLImageElement>()

  // Sounds
  private sndShuffle: HTMLAudioElement
  private sndBlockSlot: HTMLAudioElement
  private sndCorrect: HTMLAudioElement
  private sndWrong: HTMLAudioElement

  // Callbacks
  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    const base = assetUrl('/assets/games/whatisthis')

    // Background
    this.bgImg = loadImage(`${base}/images/showandtel_image_background.png`)

    // Top card images
    this.topImgBg = loadImage(`${base}/images/showandtel_image_card-large_for-image.png`)
    this.topImgBgWrong = loadImage(`${base}/images/showandtel_image_card-large_for-image_wrong.png`)
    this.topImgMask = loadImage(`${base}/images/showandtel_image_card-large_for-image-mask.png`)
    this.topTextBg = loadImage(`${base}/images/showandtel_image_card-question-long_for-text.png`)
    this.topTextBgWrong = loadImage(`${base}/images/showandtel_image_card-question-long_for-text_wrong.png`)

    // Down card images
    this.downImgFront = loadImage(`${base}/images/showandtel_image_card-answer_for-image_front.png`)
    this.downImgFrontWrong = loadImage(`${base}/images/showandtel_image_card-answer_for-image_front_wrong.png`)
    this.downImgBack = loadImage(`${base}/images/showandtel_image_card-answer_for-image_back.png`)
    this.downImgMask = loadImage(`${base}/images/showandtel_image_card-answer_for-image-mask.png`)
    this.downTextFront = loadImage(`${base}/images/showandtel_image_card-answer-long_for-text_front.png`)
    this.downTextFrontWrong = loadImage(`${base}/images/showandtel_image_card-answer-long_for-text_front_wrong.png`)
    this.downTextBack = loadImage(`${base}/images/showandtel_image_card-answer-long_for-text_back.png`)

    // Sounds
    this.sndShuffle = loadAudio(`${base}/sounds/showandtell_sfx_card_shuffle_short.m4a`)
    this.sndBlockSlot = loadAudio(`${base}/sounds/blockslotin.m4a`)
    this.sndCorrect = loadAudio(`${base}/sounds/showandtell_sfx_answer_right.m4a`)
    this.sndWrong = loadAudio(`${base}/sounds/sfx_wood_incorrect.m4a`)
  }

  // ─── Preload content image ──────────────────────────────────────
  private getContentImage(pic: string): HTMLImageElement {
    if (!pic) return this.bgImg // fallback
    const key = pic.toLowerCase()
    let img = this.contentImages.get(key)
    if (!img) {
      img = loadImage(assetUrl(`/assets/games/whatisthis/content/images/${pic}`))
      this.contentImages.set(key, img)
    }
    return img
  }

  private playVoice(soundFile: string): void {
    if (!soundFile) return
    const audio = loadAudio(assetUrl(`/assets/games/whatisthis/content/sounds/${soundFile}`))
    playSound(audio, 0.8)
  }

  // ─── Data loading ──────────────────────────────────────────────
  async loadData(): Promise<void> {
    const resp = await fetch('/data/games/whatisthis/whatisthis.tsv')
    const text = await resp.text()
    this.parseTSV(text)

    // Preload images for current level
    const problems = this.allProblems.filter(p => p.level === this.level)
    for (const p of problems) {
      this.getContentImage(p.answer.pic)
      for (const w of p.wrongAnswers) {
        this.getContentImage(w.pic)
      }
    }
  }

  private parseTSV(raw: string): void {
    const lines = raw.split('\n').filter(l => l.trim().length > 0)
    if (lines.length < 2) return

    // Find header (skip # prefix)
    let headerIdx = 0
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      if (line.startsWith('#')) {
        line = line.substring(1)
      }
      const cols = line.split('\t')
      if (cols.some(c => c.trim() === 'language')) {
        headerIdx = i
        break
      }
    }

    let header = lines[headerIdx]
    if (header.startsWith('#')) header = header.substring(1)
    const cols = header.split('\t')
    const idx: Record<string, number> = {}
    cols.forEach((c, i) => { idx[c.trim()] = i })

    const dataByLevel = new Map<number, ProblemData[]>()

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const parts = lines[i].split('\t')
      if (parts.length < cols.length) continue

      const get = (key: string) => (parts[idx[key]] || '').trim()

      const data: ProblemData = {
        language: get('language'),
        level: parseInt(get('level')) || 0,
        mode: get('mode'),
        problem: get('problem'),
        answer: {
          answer: get('answer'),
          pic: get('answer pic'),
          sound: get('answer sound'),
          soundDuration: parseFloat(get('answer sound duration')) || 0,
        },
        wrongAnswers: [],
      }

      // Wrong answers (up to CARD_COUNT-1 = 2)
      for (let w = 1; w < CARD_COUNT; w++) {
        const wa: CardData = {
          answer: get(`wrong answer ${w}`),
          pic: get(`wrong answer ${w} pic`),
          sound: get(`wrong answer ${w} sound`),
          soundDuration: parseFloat(get(`wrong answer ${w} sound duration`)) || 0,
        }
        if (wa.answer || wa.pic) {
          data.wrongAnswers.push(wa)
        }
      }

      if (!dataByLevel.has(data.level)) dataByLevel.set(data.level, [])
      dataByLevel.get(data.level)!.push(data)
    }

    this.allProblems = []
    dataByLevel.forEach(v => this.allProblems.push(...v))
  }

  // ─── Game flow ─────────────────────────────────────────────────
  startGame(): void {
    this.holdTouch.add('StartGame')

    if (this.currentProblems.length === 0) {
      const levelProblems = this.allProblems.filter(p => p.level === this.level)
      // Shuffle
      for (let i = levelProblems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [levelProblems[i], levelProblems[j]] = [levelProblems[j], levelProblems[i]]
      }
      this.currentProblems = [...levelProblems]
      this.totalProblemCount = this.currentProblems.length
      this.currentProblemIndex = 0
      this.onProgressChange?.(0, this.totalProblemCount)
    }

    const currentData = this.currentProblems.shift()!
    this.currentProblemIndex++
    this.onProgressChange?.(this.currentProblemIndex, this.totalProblemCount)

    playSound(this.sndShuffle)

    const isChooseSentence = currentData.mode === 'ChooseSentense'

    // ── Top card setup ──
    const topCardType: CardType = isChooseSentence ? 'image' : 'text'
    this.topCard = this.createCardState(CENTER_X, TOP_CARD_Y, topCardType, currentData.answer, true)
    this.topCard.visible = true
    // ThrowIn: from left
    this.topCard.x = CENTER_X - GAME_WIDTH
    this.addTween({
      startTime: this.currentTime,
      duration: THROW_TIME,
      ease: easeBackOut,
      update: (t) => {
        this.topCard!.x = (CENTER_X - GAME_WIDTH) + t * GAME_WIDTH
      },
    })

    // ── Fail card (for wrong answer display) ──
    this.failCard = this.createCardState(CENTER_X, TOP_CARD_Y, topCardType, currentData.answer, true)
    this.failCard.visible = false
    this.failCard.showWrong = true

    // ── Down cards setup ──
    const answerCount = currentData.wrongAnswers.length + 1
    const downCardType: CardType = isChooseSentence ? 'text' : 'image'

    // Build shuffled indices
    const indices = Array.from({ length: answerCount }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }

    this.downCards = []
    for (let i = 0; i < answerCount; i++) {
      const slotIdx = indices[i]
      const isAnswer = (i === answerCount - 1) // last shuffled = correct

      // Calculate position
      let bx: number, by: number
      if (isChooseSentence) {
        // Vertical layout
        bx = CENTER_X
        by = DOWN_CARD_Y - DOWN_CARD_SPACING_V * (slotIdx - (answerCount - 1) / 2)
      } else {
        // Horizontal layout
        if (answerCount > 2) {
          bx = CENTER_X + DOWN_CARD_SPACING_H * (slotIdx - (answerCount - 1) / 2)
        } else {
          bx = CENTER_X - 556 + slotIdx * 1112
        }
        by = DOWN_CARD_Y
      }

      const cardData = isAnswer ? currentData.answer : currentData.wrongAnswers[i]
      const card = this.createCardState(bx, by, downCardType, cardData, false)
      card.isCorrect = isAnswer
      card.visible = false
      card.opacity = 0
      this.downCards.push(card)

      // Staggered ThrowIn (fade in) — reversed order like C++
      const throwDelay = CARD_DISTANCE_TIME * (answerCount - 1 - this.downCards.length + 1)
      this.addTween({
        startTime: this.currentTime + throwDelay + CARD_DISTANCE_TIME * i,
        duration: 0.1,
        update: (t) => {
          card.opacity = t
          card.visible = true
        },
      })
    }

    // Release touch hold after all cards are in
    const totalThrowTime = CARD_DISTANCE_TIME * answerCount + 0.1
    this.addTween({
      startTime: this.currentTime + totalThrowTime,
      duration: 0.01,
      update: () => {},
      onComplete: () => { this.holdTouch.delete('StartGame') },
    })
  }

  private nextGame(): void {
    this.holdTouch.add('NextGame')

    if (this.currentProblems.length === 0) {
      this.holdTouch.delete('NextGame')
      this.endGame()
      return
    }

    // ThrowOut top card (to right)
    if (this.topCard) {
      const startX = this.topCard.x
      this.addTween({
        startTime: this.currentTime,
        duration: THROW_TIME,
        ease: easeBackIn,
        update: (t) => {
          this.topCard!.x = startX + t * GAME_WIDTH
        },
      })
    }

    // ThrowOut down cards (fade out, reversed order)
    for (let i = 0; i < this.downCards.length; i++) {
      const card = this.downCards[this.downCards.length - 1 - i]
      this.addTween({
        startTime: this.currentTime + CARD_DISTANCE_TIME * i,
        duration: 0.1,
        update: (t) => {
          card.opacity = 1 - t
        },
        onComplete: () => { card.visible = false },
      })
    }

    // After delay, start next game
    const totalDelay = CARD_DISTANCE_TIME * this.downCards.length + NEXT_DELAY
    this.addTween({
      startTime: this.currentTime + totalDelay,
      duration: 0.01,
      update: () => {},
      onComplete: () => {
        this.holdTouch.delete('NextGame')
        this.startGame()
      },
    })
  }

  private endGame(): void {
    this.onProgressChange?.(this.totalProblemCount, this.totalProblemCount)
    this.addTween({
      startTime: this.currentTime + 0.3,
      duration: 0.01,
      update: () => {},
      onComplete: () => {
        this.gameState = 'complete'
        this.onComplete?.()
      },
    })
  }

  // ─── Card creation helper ──────────────────────────────────────
  private createCardState(
    x: number, y: number, cardType: CardType,
    data: CardData, isTop: boolean,
  ): CardState {
    return {
      x, y, baseX: x, baseY: y,
      scaleX: 1, scaleY: 1,
      opacity: 1,
      rotationY: 0, rotationX: 0,
      visible: true,
      cardType,
      data,
      showBack: false,
      showWrong: false,
      wrongOpacity: 0,
      isCorrect: false,
      shakeOffset: 0,
    }
  }

  // ─── Click handling ────────────────────────────────────────────
  onPointerDown(x: number, y: number): void {
    if (this.holdTouch.size > 0) return

    // Check which down card was clicked
    for (const card of this.downCards) {
      if (!card.visible || card.opacity < 0.5) continue
      if (this.hitTestCard(x, y, card)) {
        this.onCardClicked(card)
        return
      }
    }
  }

  onPointerMove(_x: number, _y: number): void { /* no drag */ }
  onPointerUp(_x: number, _y: number): void { /* no drag */ }

  private hitTestCard(px: number, py: number, card: CardState): boolean {
    let cw: number, ch: number
    if (card.cardType === 'image') {
      cw = this.downImgFront.naturalWidth || 776
      ch = this.downImgFront.naturalHeight || 652
    } else {
      cw = this.downTextFront.naturalWidth || 2208
      ch = this.downTextFront.naturalHeight || 200
    }
    const hw = cw / 2
    const hh = ch / 2
    return (
      px >= card.x - hw && px <= card.x + hw &&
      py >= card.y - hh && py <= card.y + hh
    )
  }

  private onCardClicked(card: CardState): void {
    if (this.holdTouch.size > 0) return

    playSound(this.sndBlockSlot)

    if (card.isCorrect) {
      this.handleCorrectAnswer(card)
    } else {
      this.handleWrongAnswer(card)
    }
  }

  private handleCorrectAnswer(card: CardState): void {
    this.holdTouch.add('CardFlip')

    // Play correct sound
    playSound(this.sndCorrect)

    // Scale up correct card
    const targetScale = card.cardType === 'image' ? 1.1 : 1.05
    this.addTween({
      startTime: this.currentTime,
      duration: FLIP_TIME,
      ease: easeOutQuad,
      update: (t) => {
        const s = 1 + t * (targetScale - 1)
        card.scaleX = s
        card.scaleY = s
      },
    })

    // Play answer voice
    const voiceDelay = FLIP_TIME
    this.addTween({
      startTime: this.currentTime + voiceDelay,
      duration: 0.01,
      update: () => {},
      onComplete: () => {
        this.playVoice(card.data.sound)
      },
    })

    // Flip wrong cards to back
    for (const other of this.downCards) {
      if (other === card) continue
      this.flipCardToBack(other)
    }

    // Wait then next
    const waitDuration = Math.max(WAIT_TIME, card.data.soundDuration || 0)
    this.addTween({
      startTime: this.currentTime + voiceDelay + waitDuration,
      duration: 0.01,
      update: () => {},
      onComplete: () => {
        this.holdTouch.delete('CardFlip')
        this.nextGame()
      },
    })
  }

  private handleWrongAnswer(hitCard: CardState): void {
    this.holdTouch.add('CardFail')

    // Shake the hit card
    const shakeStart = this.currentTime
    this.addTween({
      startTime: shakeStart,
      duration: FLIP_TIME,
      update: (t) => {
        hitCard.shakeOffset = Math.sin(Math.PI * 4 * t) * Math.sin(Math.PI * t) * 25
      },
      onComplete: () => { hitCard.shakeOffset = 0 },
    })

    // Play wrong sound
    playSound(this.sndWrong)

    // Play wrong answer's voice
    this.playVoice(hitCard.data.sound)

    // Show wrong BG on hit card (fade in then out)
    this.addTween({
      startTime: this.currentTime,
      duration: 0.3,
      update: (t) => { hitCard.wrongOpacity = t },
    })

    const waitDuration = Math.max(WAIT_TIME, hitCard.data.soundDuration || 0)
    this.addTween({
      startTime: this.currentTime + waitDuration - 0.3,
      duration: 0.3,
      update: (t) => { hitCard.wrongOpacity = 1 - t },
    })

    // Show fail card dropping from top
    if (this.failCard) {
      const fc = this.failCard
      // Set fail card content to the wrong answer's complementary view
      // If down cards are images, fail card shows what that image represents (text/image)
      const isChooseSentence = this.topCard?.cardType === 'image'
      fc.cardType = isChooseSentence ? 'image' : 'text'
      fc.data = hitCard.data
      fc.showWrong = true
      fc.visible = true
      fc.opacity = 1
      fc.y = TOP_CARD_Y - GAME_HEIGHT

      // Drop in
      this.addTween({
        startTime: this.currentTime,
        duration: 0.35,
        ease: easeOutQuad,
        update: (t) => {
          fc.y = (TOP_CARD_Y - GAME_HEIGHT) + t * GAME_HEIGHT
        },
      })

      // Lift back up
      const liftDelay = 0.35 + Math.max(1.3, (hitCard.data.soundDuration || 0) - 0.7)
      this.addTween({
        startTime: this.currentTime + liftDelay,
        duration: 0.35,
        ease: easeInQuad,
        update: (t) => {
          fc.y = TOP_CARD_Y - t * GAME_HEIGHT
        },
        onComplete: () => { fc.visible = false },
      })
    }

    // Release touch hold after wait
    this.addTween({
      startTime: this.currentTime + waitDuration,
      duration: 0.01,
      update: () => {},
      onComplete: () => {
        this.holdTouch.delete('CardFail')
      },
    })
  }

  private flipCardToBack(card: CardState): void {
    // Flip animation: rotate 180 degrees
    this.addTween({
      startTime: this.currentTime,
      duration: FLIP_TIME,
      ease: easeInQuad,
      update: (t) => {
        const angle = t * 180
        if (card.cardType === 'image') {
          card.rotationY = angle
        } else {
          card.rotationX = angle
        }
        if (angle > 90) {
          card.showBack = true
        }
      },
    })
  }

  // ─── Tween management ─────────────────────────────────────────
  private addTween(tween: Tween): void {
    this.tweens.push(tween)
  }

  private updateTweens(time: number): void {
    const completed: Tween[] = []

    for (const tw of this.tweens) {
      if (time < tw.startTime) continue

      const elapsed = time - tw.startTime
      let t = Math.min(elapsed / tw.duration, 1)
      if (tw.ease) t = tw.ease(t)
      tw.update(t)

      if (elapsed >= tw.duration) {
        completed.push(tw)
      }
    }

    for (const tw of completed) {
      tw.onComplete?.()
      const idx = this.tweens.indexOf(tw)
      if (idx >= 0) this.tweens.splice(idx, 1)
    }
  }

  // ─── Update & Draw ─────────────────────────────────────────────
  update(time: number, _dt: number): void {
    this.currentTime = time
    this.updateTweens(time)
  }

  draw(): void {
    const ctx = this.ctx
    const gs = this.gameScale
    const cw = this.canvas.width / (window.devicePixelRatio || 1)
    const ch = this.canvas.height / (window.devicePixelRatio || 1)
    const ox = (cw - GAME_WIDTH * gs) / 2
    const oy = (ch - GAME_HEIGHT * gs) / 2

    ctx.clearRect(0, 0, cw, ch)
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(gs, gs)

    // Background
    if (imgOk(this.bgImg)) {
      this.drawImageCentered(this.bgImg, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
    } else {
      ctx.fillStyle = '#87CEEB'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    // Top card
    if (this.topCard?.visible) {
      this.drawTopCard(this.topCard, false)
    }

    // Fail card (drawn above top card)
    if (this.failCard?.visible) {
      this.drawTopCard(this.failCard, true)
    }

    // Down cards
    for (const card of this.downCards) {
      if (card.visible) {
        this.drawDownCard(card)
      }
    }

    ctx.restore()
  }

  private drawTopCard(card: CardState, isFail: boolean): void {
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = card.opacity
    ctx.translate(card.x, card.y)
    ctx.scale(card.scaleX, card.scaleY)

    if (card.cardType === 'image') {
      // Image mode top card
      const bg = (card.showWrong && isFail) ? this.topImgBgWrong : this.topImgBg
      if (imgOk(bg)) {
        this.drawImageCentered(bg, 0, 0)
      }
      // Draw content image (clipped to mask area)
      if (imgOk(this.topImgMask) && card.data.pic) {
        const maskW = this.topImgMask.naturalWidth * CONTENTS_SIZE_MODIFIER
        const maskH = this.topImgMask.naturalHeight * CONTENTS_SIZE_MODIFIER
        const img = this.getContentImage(card.data.pic)
        if (imgOk(img)) {
          this.drawImageCentered(img, 0, 0, maskW, maskH)
        }
      }
    } else {
      // Text mode top card
      const bg = (card.showWrong && isFail) ? this.topTextBgWrong : this.topTextBg
      if (imgOk(bg)) {
        this.drawImageCentered(bg, 0, 0)
      }
      // Draw text
      this.drawCardText(card.data.answer, 0, 0, 2038, 120, true)
    }

    // Speaker icon for top card (when not fail card)
    if (!isFail && card.cardType === 'text') {
      this.drawSpeakerIcon(card)
    }

    ctx.restore()
  }

  private drawSpeakerIcon(card: CardState): void {
    // Draw a simple speaker icon at top-left of the text card
    const ctx = this.ctx
    const bgW = imgOk(this.topTextBg) ? this.topTextBg.naturalWidth : 2208
    const bgH = imgOk(this.topTextBg) ? this.topTextBg.naturalHeight : 340
    const iconX = -bgW / 2 + 90
    const iconY = -bgH / 2 + 80

    // Purple circle
    ctx.fillStyle = '#7C4DFF'
    ctx.beginPath()
    ctx.arc(iconX, iconY, 40, 0, Math.PI * 2)
    ctx.fill()

    // Speaker symbol
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🔊', iconX, iconY)
  }

  private drawDownCard(card: CardState): void {
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = card.opacity
    ctx.translate(card.x + card.shakeOffset, card.y)
    ctx.scale(card.scaleX, card.scaleY)

    // Apply rotation for flip
    if (card.rotationY !== 0) {
      const scaleX = Math.cos(card.rotationY * Math.PI / 180)
      ctx.scale(scaleX, 1)
    }
    if (card.rotationX !== 0) {
      const scaleY = Math.cos(card.rotationX * Math.PI / 180)
      ctx.scale(1, scaleY)
    }

    if (card.showBack) {
      // Show card back
      const backImg = card.cardType === 'image' ? this.downImgBack : this.downTextBack
      if (imgOk(backImg)) {
        this.drawImageCentered(backImg, 0, 0)
      }
    } else {
      if (card.cardType === 'image') {
        // Image card front
        const bg = this.downImgFront
        if (imgOk(bg)) {
          this.drawImageCentered(bg, 0, 0)
        }
        // Wrong BG overlay
        if (card.wrongOpacity > 0 && imgOk(this.downImgFrontWrong)) {
          ctx.save()
          ctx.globalAlpha = card.wrongOpacity * card.opacity
          this.drawImageCentered(this.downImgFrontWrong, 0, 0)
          ctx.restore()
        }
        // Content image (clipped to mask area)
        if (imgOk(this.downImgMask) && card.data.pic) {
          const maskW = this.downImgMask.naturalWidth * CONTENTS_SIZE_MODIFIER
          const maskH = this.downImgMask.naturalHeight * CONTENTS_SIZE_MODIFIER
          const img = this.getContentImage(card.data.pic)
          if (imgOk(img)) {
            this.drawImageCentered(img, 0, 0, maskW, maskH)
          }
        }
      } else {
        // Text card front
        const bg = this.downTextFront
        if (imgOk(bg)) {
          this.drawImageCentered(bg, 0, 0)
        }
        // Wrong BG overlay
        if (card.wrongOpacity > 0 && imgOk(this.downTextFrontWrong)) {
          ctx.save()
          ctx.globalAlpha = card.wrongOpacity * card.opacity
          this.drawImageCentered(this.downTextFrontWrong, 0, 0)
          ctx.restore()
        }
        // Text label
        const bgW = imgOk(this.downTextFront) ? this.downTextFront.naturalWidth : 2208
        this.drawCardText(card.data.answer, 0, 0, bgW * 0.85, 82, false)
      }
    }

    ctx.restore()
  }

  // ─── Drawing helpers ───────────────────────────────────────────
  private drawImageCentered(
    img: HTMLImageElement,
    cx: number, cy: number,
    w?: number, h?: number,
  ): void {
    const dw = w ?? img.naturalWidth
    const dh = h ?? img.naturalHeight
    if (w && h) {
      // Aspect-fit
      const imgRatio = img.naturalWidth / img.naturalHeight
      const boxRatio = dw / dh
      let fw: number, fh: number
      if (imgRatio > boxRatio) {
        fw = dw
        fh = dw / imgRatio
      } else {
        fh = dh
        fw = dh * imgRatio
      }
      this.ctx.drawImage(img, cx - fw / 2, cy - fh / 2, fw, fh)
    } else {
      this.ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
    }
  }

  private drawCardText(
    text: string, cx: number, cy: number,
    maxWidth: number, fontSize: number,
    isTopCard: boolean,
  ): void {
    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = TEXT_COLOR
    ctx.textAlign = isTopCard ? 'center' : 'left'
    ctx.textBaseline = 'middle'

    // Check if text has multiple lines
    const lines = text.split('\n')
    let actualFontSize = fontSize

    // For top card: check if text is too long, reduce if multi-line
    ctx.font = `${actualFontSize}px "TodoSchoolV2", sans-serif`

    if (isTopCard) {
      // Measure text width to see if it wraps
      const measured = ctx.measureText(text)
      if (measured.width > maxWidth) {
        actualFontSize = Math.floor(fontSize * (100 / 120)) // scale down like C++
        ctx.font = `${actualFontSize}px "TodoSchoolV2", sans-serif`
        ctx.textAlign = 'left'
        // Word wrap
        const wrappedLines = this.wordWrap(text, maxWidth, ctx)
        const lineHeight = actualFontSize * 1.3
        const totalH = wrappedLines.length * lineHeight
        for (let i = 0; i < wrappedLines.length; i++) {
          ctx.fillText(wrappedLines[i], -maxWidth / 2, cy - totalH / 2 + lineHeight * (i + 0.5))
        }
        ctx.restore()
        return
      }
      ctx.fillText(text, cx, cy)
    } else {
      // Down card text - shrink to fit
      const textX = -maxWidth / 2
      let w = ctx.measureText(text).width
      if (w > maxWidth && maxWidth > 0) {
        actualFontSize = Math.floor(fontSize * (maxWidth / w))
        ctx.font = `${actualFontSize}px "TodoSchoolV2", sans-serif`
      }
      ctx.fillText(text, textX, cy)
    }

    ctx.restore()
  }

  private wordWrap(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }
}
