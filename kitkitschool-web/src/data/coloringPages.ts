export interface ColoringPage {
  id: string
  title: string
  emoji: string
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

function setup(ctx: CanvasRenderingContext2D, lw = 4) {
  ctx.strokeStyle = '#111'
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

export const COLORING_PAGES: ColoringPage[] = [
  {
    id: 'sun',
    title: 'Sunny Day',
    emoji: '☀️',
    draw(ctx, w, h) {
      setup(ctx)
      const cx = w / 2, cy = h / 2 - 20
      // Sun circle
      ctx.beginPath()
      ctx.arc(cx, cy, 85, 0, Math.PI * 2)
      ctx.stroke()
      // Rays
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * 105, cy + Math.sin(angle) * 105)
        ctx.lineTo(cx + Math.cos(angle) * 145, cy + Math.sin(angle) * 145)
        ctx.stroke()
      }
      // Cloud left
      setup(ctx, 3)
      ctx.beginPath()
      ctx.arc(80, 90, 35, Math.PI, 0)
      ctx.arc(115, 75, 40, Math.PI, 0)
      ctx.arc(155, 90, 30, Math.PI, 0)
      ctx.lineTo(155, 110)
      ctx.lineTo(80, 110)
      ctx.closePath()
      ctx.stroke()
      // Hill / ground
      setup(ctx, 4)
      ctx.beginPath()
      ctx.moveTo(0, h - 60)
      ctx.quadraticCurveTo(w / 2, h - 150, w, h - 60)
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      ctx.stroke()
    },
  },

  {
    id: 'cat',
    title: 'Cute Cat',
    emoji: '🐱',
    draw(ctx, w, h) {
      setup(ctx)
      const cx = w / 2, cy = h / 2 + 20
      // Head
      ctx.beginPath()
      ctx.arc(cx, cy, 120, 0, Math.PI * 2)
      ctx.stroke()
      // Left ear
      ctx.beginPath()
      ctx.moveTo(cx - 90, cy - 92)
      ctx.lineTo(cx - 135, cy - 170)
      ctx.lineTo(cx - 38, cy - 130)
      ctx.closePath()
      ctx.stroke()
      // Right ear
      ctx.beginPath()
      ctx.moveTo(cx + 90, cy - 92)
      ctx.lineTo(cx + 135, cy - 170)
      ctx.lineTo(cx + 38, cy - 130)
      ctx.closePath()
      ctx.stroke()
      // Left eye
      ctx.beginPath()
      ctx.arc(cx - 45, cy - 22, 22, 0, Math.PI * 2)
      ctx.stroke()
      // Right eye
      ctx.beginPath()
      ctx.arc(cx + 45, cy - 22, 22, 0, Math.PI * 2)
      ctx.stroke()
      // Nose
      ctx.beginPath()
      ctx.moveTo(cx, cy + 18)
      ctx.lineTo(cx - 16, cy + 38)
      ctx.lineTo(cx + 16, cy + 38)
      ctx.closePath()
      ctx.stroke()
      // Mouth
      ctx.beginPath()
      ctx.moveTo(cx - 16, cy + 38)
      ctx.quadraticCurveTo(cx - 42, cy + 66, cx - 58, cy + 55)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx + 16, cy + 38)
      ctx.quadraticCurveTo(cx + 42, cy + 66, cx + 58, cy + 55)
      ctx.stroke()
      // Whiskers
      setup(ctx, 2)
      ctx.beginPath(); ctx.moveTo(cx - 125, cy + 16); ctx.lineTo(cx - 28, cy + 28); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx - 125, cy + 36); ctx.lineTo(cx - 28, cy + 42); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + 125, cy + 16); ctx.lineTo(cx + 28, cy + 28); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + 125, cy + 36); ctx.lineTo(cx + 28, cy + 42); ctx.stroke()
    },
  },

  {
    id: 'house',
    title: 'My House',
    emoji: '🏠',
    draw(ctx, w, h) {
      setup(ctx)
      // Body
      ctx.strokeRect(120, 220, 360, 190)
      // Roof
      ctx.beginPath()
      ctx.moveTo(88, 222)
      ctx.lineTo(300, 58)
      ctx.lineTo(512, 222)
      ctx.closePath()
      ctx.stroke()
      // Chimney
      ctx.strokeRect(375, 75, 52, 85)
      // Door
      ctx.beginPath()
      ctx.roundRect(238, 305, 124, 105, [12, 12, 0, 0])
      ctx.stroke()
      // Door knob
      ctx.beginPath()
      ctx.arc(350, 360, 7, 0, Math.PI * 2)
      ctx.stroke()
      // Left window
      ctx.strokeRect(142, 254, 82, 72)
      setup(ctx, 2)
      ctx.beginPath(); ctx.moveTo(183, 254); ctx.lineTo(183, 326); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(142, 290); ctx.lineTo(224, 290); ctx.stroke()
      // Right window
      setup(ctx, 4)
      ctx.strokeRect(378, 254, 82, 72)
      setup(ctx, 2)
      ctx.beginPath(); ctx.moveTo(419, 254); ctx.lineTo(419, 326); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(378, 290); ctx.lineTo(460, 290); ctx.stroke()
      // Ground
      setup(ctx, 4)
      ctx.beginPath()
      ctx.moveTo(50, 410)
      ctx.lineTo(550, 410)
      ctx.stroke()
      // Tree trunk
      ctx.strokeRect(530, 330, 22, 80)
      // Tree top
      ctx.beginPath()
      ctx.arc(541, 300, 40, 0, Math.PI * 2)
      ctx.stroke()
    },
  },

  {
    id: 'flower',
    title: 'Pretty Flower',
    emoji: '🌸',
    draw(ctx, w, h) {
      setup(ctx)
      const cx = w / 2, cy = h / 2 - 30
      // 6 petals
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
        ctx.save()
        ctx.translate(cx + Math.cos(angle) * 72, cy + Math.sin(angle) * 72)
        ctx.rotate(angle + Math.PI / 2)
        ctx.beginPath()
        ctx.ellipse(0, 0, 36, 56, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      // Center
      ctx.beginPath()
      ctx.arc(cx, cy, 46, 0, Math.PI * 2)
      ctx.stroke()
      // Stem
      ctx.beginPath()
      ctx.moveTo(cx, cy + 46)
      ctx.quadraticCurveTo(cx - 22, cy + 130, cx, cy + 205)
      ctx.stroke()
      // Right leaf
      ctx.beginPath()
      ctx.moveTo(cx, cy + 120)
      ctx.quadraticCurveTo(cx + 65, cy + 100, cx + 85, cy + 135)
      ctx.quadraticCurveTo(cx + 55, cy + 168, cx, cy + 120)
      ctx.closePath()
      ctx.stroke()
      // Left leaf
      ctx.beginPath()
      ctx.moveTo(cx, cy + 155)
      ctx.quadraticCurveTo(cx - 62, cy + 132, cx - 80, cy + 168)
      ctx.quadraticCurveTo(cx - 48, cy + 198, cx, cy + 155)
      ctx.closePath()
      ctx.stroke()
    },
  },

  {
    id: 'star',
    title: 'Shooting Star',
    emoji: '⭐',
    draw(ctx, w, h) {
      setup(ctx)
      const cx = w / 2, cy = h / 2
      const outerR = 160, innerR = 68, points = 5

      const drawStar = (x: number, y: number, outer: number, inner: number, lw: number) => {
        setup(ctx, lw)
        ctx.beginPath()
        for (let i = 0; i < points * 2; i++) {
          const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
          const r = i % 2 === 0 ? outer : inner
          const px = x + Math.cos(angle) * r
          const py = y + Math.sin(angle) * r
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()
      }

      drawStar(cx, cy, outerR, innerR, 4)
      // Surrounding small stars
      drawStar(90, 80, 36, 15, 2.5)
      drawStar(510, 95, 28, 12, 2.5)
      drawStar(70, 340, 24, 10, 2.5)
      drawStar(530, 335, 32, 13, 2.5)
      drawStar(300, 28, 20, 8, 2)
      // Sparkle lines
      setup(ctx, 2)
      const sparkles = [[158, 170], [442, 165], [120, 268], [480, 272]]
      sparkles.forEach(([sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(sx - 10, sy); ctx.lineTo(sx + 10, sy); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(sx, sy - 10); ctx.lineTo(sx, sy + 10); ctx.stroke()
      })
    },
  },

  {
    id: 'fish',
    title: 'Happy Fish',
    emoji: '🐟',
    draw(ctx, w, h) {
      setup(ctx)
      const cx = w / 2 - 20, cy = h / 2
      // Body
      ctx.beginPath()
      ctx.ellipse(cx, cy, 155, 92, 0, 0, Math.PI * 2)
      ctx.stroke()
      // Tail
      ctx.beginPath()
      ctx.moveTo(cx + 150, cy)
      ctx.lineTo(cx + 230, cy - 85)
      ctx.lineTo(cx + 230, cy + 85)
      ctx.closePath()
      ctx.stroke()
      // Eye outer
      ctx.beginPath()
      ctx.arc(cx - 95, cy - 26, 24, 0, Math.PI * 2)
      ctx.stroke()
      // Eye pupil
      ctx.beginPath()
      ctx.arc(cx - 95, cy - 26, 9, 0, Math.PI * 2)
      ctx.stroke()
      // Mouth
      ctx.beginPath()
      ctx.arc(cx - 150, cy + 12, 20, -0.4, 0.7)
      ctx.stroke()
      // Top fin
      ctx.beginPath()
      ctx.moveTo(cx - 50, cy - 88)
      ctx.quadraticCurveTo(cx - 8, cy - 162, cx + 52, cy - 88)
      ctx.stroke()
      // Scale arcs
      setup(ctx, 2)
      const scalePositions = [
        [cx - 30, cy - 22], [cx + 25, cy - 22], [cx + 80, cy - 22],
        [cx - 30, cy + 32], [cx + 25, cy + 32], [cx + 80, cy + 32],
      ]
      scalePositions.forEach(([sx, sy]) => {
        ctx.beginPath()
        ctx.arc(sx, sy, 36, -Math.PI * 0.7, 0)
        ctx.stroke()
      })
      // Bubbles
      setup(ctx, 2.5)
      ctx.beginPath(); ctx.arc(cx - 178, cy - 72, 12, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx - 198, cy - 112, 18, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx - 170, cy - 155, 10, 0, Math.PI * 2); ctx.stroke()
    },
  },
]
