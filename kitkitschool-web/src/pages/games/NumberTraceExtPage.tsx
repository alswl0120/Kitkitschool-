import { findClosestDictLevel } from '../../utils/levelUtils'
import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

interface NumberItem {
  number: number
  hundreds?: number
  tens: number
  ones: number
}

interface LevelData {
  [level: string]: NumberItem[]
}

// ── Canvas tracing helpers ────────────────────────────────────────────────────

function getDigitSegments(digit: number): boolean[][] {
  // 7 segments: top, topLeft, topRight, middle, botLeft, botRight, bottom
  const seg: Record<number, boolean[]> = {
    0: [true,  true,  true,  false, true,  true,  true ],
    1: [false, false, true,  false, false, true,  false],
    2: [true,  false, true,  true,  true,  false, true ],
    3: [true,  false, true,  true,  false, true,  true ],
    4: [false, true,  true,  true,  false, true,  false],
    5: [true,  true,  false, true,  false, true,  true ],
    6: [true,  true,  false, true,  true,  true,  true ],
    7: [true,  false, true,  false, false, true,  false],
    8: [true,  true,  true,  true,  true,  true,  true ],
    9: [true,  true,  true,  true,  false, true,  true ],
  }
  return [seg[digit] ?? seg[0]]
}

interface Segment {
  x1: number; y1: number; x2: number; y2: number
}

function digitToSegmentLines(digit: number, ox: number, oy: number, w: number, h: number): Segment[] {
  const segs = getDigitSegments(digit)[0]
  const gap = w * 0.08
  const lines: Segment[] = []
  // top
  if (segs[0]) lines.push({ x1: ox + gap, y1: oy,       x2: ox + w - gap, y2: oy })
  // topLeft
  if (segs[1]) lines.push({ x1: ox,       y1: oy + gap,  x2: ox,           y2: oy + h / 2 - gap })
  // topRight
  if (segs[2]) lines.push({ x1: ox + w,   y1: oy + gap,  x2: ox + w,       y2: oy + h / 2 - gap })
  // middle
  if (segs[3]) lines.push({ x1: ox + gap, y1: oy + h / 2, x2: ox + w - gap, y2: oy + h / 2 })
  // botLeft
  if (segs[4]) lines.push({ x1: ox,       y1: oy + h / 2 + gap, x2: ox,     y2: oy + h - gap })
  // botRight
  if (segs[5]) lines.push({ x1: ox + w,   y1: oy + h / 2 + gap, x2: ox + w, y2: oy + h - gap })
  // bottom
  if (segs[6]) lines.push({ x1: ox + gap, y1: oy + h,    x2: ox + w - gap, y2: oy + h })
  return lines
}

function buildGuideSegments(numberStr: string, canvasW: number, canvasH: number): Segment[] {
  const digits = numberStr.split('')
  const count = digits.length
  const charW = Math.min(canvasW * 0.3, 140)
  const charH = charW * 1.7
  const spacing = charW * 1.4
  const totalW = count * spacing - (spacing - charW)
  const startX = (canvasW - totalW) / 2
  const startY = (canvasH - charH) / 2

  const all: Segment[] = []
  digits.forEach((d, i) => {
    const segs = digitToSegmentLines(
      parseInt(d, 10),
      startX + i * spacing,
      startY,
      charW,
      charH,
    )
    all.push(...segs)
  })
  return all
}

interface TracingState {
  segments: Segment[]
  covered: boolean[]
  isDrawing: boolean
  lastX: number
  lastY: number
}

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  state: TracingState,
  w: number,
  h: number,
) {
  ctx.clearRect(0, 0, w, h)

  // Background
  ctx.fillStyle = '#fffde7'
  ctx.fillRect(0, 0, w, h)

  const STROKE_WIDTH = Math.max(w * 0.018, 10)

  // Draw guide (uncovered segments in light gray)
  state.segments.forEach((seg, i) => {
    if (!state.covered[i]) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(180,180,180,0.5)'
      ctx.lineWidth = STROKE_WIDTH * 1.4
      ctx.lineCap = 'round'
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.stroke()
    }
  })

  // Draw covered segments in vibrant orange
  state.segments.forEach((seg, i) => {
    if (state.covered[i]) {
      ctx.beginPath()
      ctx.strokeStyle = '#FF6F00'
      ctx.lineWidth = STROKE_WIDTH
      ctx.lineCap = 'round'
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.stroke()
    }
  })
}

function distToSegment(px: number, py: number, seg: Segment): number {
  const dx = seg.x2 - seg.x1
  const dy = seg.y2 - seg.y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - seg.x1, py - seg.y1)
  let t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (seg.x1 + t * dx), py - (seg.y1 + t * dy))
}

// ── PlaceValueBlocks component ────────────────────────────────────────────────

function PlaceValueBlocks({ hundreds, tens, ones }: { hundreds?: number; tens: number; ones: number }) {
  const flats = Array.from({ length: hundreds ?? 0 }, (_, i) => i)
  const rods = Array.from({ length: tens }, (_, i) => i)
  const cubes = Array.from({ length: ones }, (_, i) => i)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      flexWrap: 'wrap',
      justifyContent: 'center',
      padding: '8px 16px',
    }}>
      {/* Hundreds flats */}
      {flats.map(i => (
        <div key={`hun-${i}`} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 8px)',
          gridTemplateRows: 'repeat(10, 8px)',
          gap: 1,
          background: '#4CAF50',
          padding: 2,
          borderRadius: 3,
          border: '1px solid #388E3C',
        }}>
          {Array.from({ length: 100 }, (_, j) => (
            <div key={j} style={{ width: 8, height: 8, background: '#81C784', borderRadius: 1 }} />
          ))}
        </div>
      ))}
      {/* Tens rods */}
      {rods.map(i => (
        <div key={`ten-${i}`} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {Array.from({ length: 10 }, (_, j) => (
            <div key={j} style={{
              width: 18,
              height: 18,
              background: '#1565C0',
              borderRadius: 3,
              border: '1px solid #0D47A1',
            }} />
          ))}
        </div>
      ))}

      {/* Ones cubes */}
      {cubes.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 2,
          maxWidth: 90,
          alignItems: 'flex-end',
        }}>
          {cubes.map(i => (
            <div key={`one-${i}`} style={{
              width: 18,
              height: 18,
              background: '#FF8F00',
              borderRadius: 3,
              border: '1px solid #E65100',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page component ───────────────────────────────────────────────────────

export default function NumberTraceExtPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<TracingState | null>(null)
  const rafRef = useRef<number>(0)

  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [levelProblems, setLevelProblems] = useState<NumberItem[]>([])
  const [problemIndex, setProblemIndex] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [tracingDone, setTracingDone] = useState(false)

  // Load levels
  useEffect(() => {
    fetch('/data/games/numbertraceext.json')
      .then(r => r.json())
      .then((data: { levels: LevelData }) => {
        const lvls = Object.keys(data.levels).map(Number).sort((a, b) => a - b)
        setAvailableLevels(lvls.length > 0 ? lvls : [1, 2, 3, 4, 5, 6, 7, 8])
      })
      .catch(() => setAvailableLevels([1, 2, 3, 4, 5, 6, 7, 8]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    fetch('/data/games/numbertraceext.json')
      .then(r => r.json())
      .then((data: { levels: LevelData }) => {
        const problems = findClosestDictLevel(data.levels, lvl) ?? []
        setLevelProblems(problems)
        setLevel(lvl)
        setProblemIndex(0)
        setShowFeedback(false)
        setShowComplete(false)
        setTracingDone(false)
      })
      .catch(() => {
        setLevel(lvl)
        setProblemIndex(0)
        setShowFeedback(false)
        setShowComplete(false)
        setTracingDone(false)
      })
  }, [])

  // Shell integration
  useEffect(() => {
    if (shellLevel && level === 0) {
      startLevel(shellLevel)
    }
  }, [shellLevel, level, startLevel])

  useEffect(() => {
    if (showComplete && isFromShell) {
      onGameComplete()
    }
  }, [showComplete, isFromShell, onGameComplete])

  // Canvas tracing setup per problem
  const currentItem = levelProblems[problemIndex]

  useEffect(() => {
    if (level === 0 || !currentItem || tracingDone) return
    const canvas = canvasRef.current
    if (!canvas) return

    const w = canvas.clientWidth || 600
    const h = canvas.clientHeight || 280
    canvas.width = w
    canvas.height = h

    const segments = buildGuideSegments(String(currentItem.number), w, h)
    stateRef.current = {
      segments,
      covered: new Array(segments.length).fill(false),
      isDrawing: false,
      lastX: 0,
      lastY: 0,
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawCanvas(ctx, stateRef.current, w, h)

    function getXY(e: MouseEvent | TouchEvent): [number, number] {
      const rect = canvas!.getBoundingClientRect()
      const scaleX = w / rect.width
      const scaleY = h / rect.height
      if (e instanceof TouchEvent) {
        const t = e.touches[0] || e.changedTouches[0]
        return [(t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY]
      }
      return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY]
    }

    function checkCoverage(x: number, y: number) {
      const s = stateRef.current!
      const threshold = Math.max(w * 0.04, 20)
      s.segments.forEach((seg, i) => {
        if (!s.covered[i] && distToSegment(x, y, seg) < threshold) {
          s.covered[i] = true
        }
      })
    }

    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      const [x, y] = getXY(e)
      const s = stateRef.current!
      s.isDrawing = true
      s.lastX = x
      s.lastY = y
      checkCoverage(x, y)
      drawCanvas(ctx!, s, w, h)
    }

    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      const s = stateRef.current!
      if (!s.isDrawing) return
      const [x, y] = getXY(e)
      checkCoverage(x, y)
      s.lastX = x
      s.lastY = y
      drawCanvas(ctx!, s, w, h)

      // Check if all segments covered
      if (s.covered.every(Boolean)) {
        setTracingDone(true)
        setShowFeedback(true)
      }
    }

    function onEnd(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      const s = stateRef.current!
      s.isDrawing = false
    }

    canvas.addEventListener('mousedown', onStart)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onEnd)
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', onStart)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onEnd)
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
      cancelAnimationFrame(rafRef.current)
    }
  }, [level, currentItem, tracingDone])

  const handleNext = useCallback(() => {
    const next = problemIndex + 1
    if (next >= levelProblems.length) {
      setShowComplete(true)
    } else {
      setProblemIndex(next)
      setShowFeedback(false)
      setTracingDone(false)
    }
  }, [problemIndex, levelProblems.length])

  // ── Level select screen ─────────────────────────────────────────────────────
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1565C0, #42A5F5)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, textShadow: '2px 2px 4px rgba(0,0,0,0.3)', margin: 0 }}>
          Number Trace Extended
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, margin: 0 }}>
          Place value tracing for bigger numbers!
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {availableLevels.map(lvl => (
            <button key={lvl} onClick={() => startLevel(lvl)} style={{
              width: 72, height: 72, borderRadius: 14,
              background: '#1565C0', color: '#fff',
              fontSize: 22, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              border: '2px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
            }}>
              {lvl}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Game complete screen ────────────────────────────────────────────────────
  if (showComplete) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1565C0, #42A5F5)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <div style={{ fontSize: 72 }}>🌟</div>
        <div style={{ color: '#fff', fontSize: 48, fontWeight: 'bold', textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
          Great Job!
        </div>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 22 }}>
          You traced {levelProblems.length} numbers!
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <button onClick={() => startLevel(level)} style={{
            padding: '12px 32px', borderRadius: 12, background: '#4CAF50',
            color: '#fff', fontSize: 20, fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer',
          }}>Play Again</button>
          <button onClick={() => { setLevel(0); setShowComplete(false) }} style={{
            padding: '12px 32px', borderRadius: 12, background: '#2196F3',
            color: '#fff', fontSize: 20, fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer',
          }}>Other Levels</button>
          <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
            padding: '12px 32px', borderRadius: 12, background: '#FF5722',
            color: '#fff', fontSize: 20, fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer',
          }}>Home</button>
        </div>
      </div>
    )
  }

  // ── Game screen ─────────────────────────────────────────────────────────────
  const progress = { current: problemIndex + 1, max: levelProblems.length }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(180deg, #E3F2FD 0%, #BBDEFB 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflow: 'hidden',
      position: 'relative',
    }}>
      <BackButton color="#1565C0" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Header */}
      <div style={{
        marginTop: 56, textAlign: 'center',
        color: '#1565C0', fontSize: 20, fontWeight: 'bold',
      }}>
        Trace this number!
      </div>

      {currentItem && (
        <>
          {/* Place value blocks visualization */}
          <div style={{
            background: 'rgba(255,255,255,0.8)',
            borderRadius: 16,
            padding: '12px 20px',
            marginTop: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{ fontSize: 13, color: '#555', fontWeight: 'bold' }}>
              {currentItem.tens > 0 && (
                <span style={{ color: '#1565C0' }}>
                  {currentItem.tens} ten{currentItem.tens > 1 ? 's' : ''}
                </span>
              )}
              {currentItem.tens > 0 && currentItem.ones > 0 && (
                <span style={{ color: '#888', margin: '0 6px' }}>+</span>
              )}
              {currentItem.ones > 0 && (
                <span style={{ color: '#E65100' }}>
                  {currentItem.ones} one{currentItem.ones > 1 ? 's' : ''}
                </span>
              )}
              {currentItem.ones === 0 && currentItem.tens > 0 && ''}
            </div>
            <PlaceValueBlocks hundreds={currentItem.hundreds} tens={currentItem.tens} ones={currentItem.ones} />
          </div>

          {/* Number display */}
          <div style={{
            fontSize: 72, fontWeight: 'bold',
            color: '#1565C0',
            textShadow: '2px 2px 0 rgba(21,101,192,0.2)',
            marginTop: 8, lineHeight: 1,
          }}>
            {currentItem.number}
          </div>

          {/* Canvas tracing area */}
          <div style={{
            flex: 1, width: '100%', maxWidth: 640,
            padding: '0 16px 16px',
            display: 'flex', flexDirection: 'column',
          }}>
            <canvas
              ref={canvasRef}
              style={{
                flex: 1, width: '100%',
                borderRadius: 16,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                touchAction: 'none',
                cursor: 'crosshair',
                background: '#fffde7',
              }}
            />
          </div>

          {/* Feedback overlay */}
          {showFeedback && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 200, gap: 20,
            }}>
              <div style={{ fontSize: 72 }}>⭐</div>
              <div style={{
                color: '#fff', fontSize: 52, fontWeight: 'bold',
                textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
              }}>
                Great!
              </div>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 24 }}>
                You traced {currentItem.number}!
              </div>
              <button
                onClick={handleNext}
                style={{
                  padding: '14px 48px', borderRadius: 14,
                  background: '#4CAF50', color: '#fff',
                  fontSize: 22, fontWeight: 'bold',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                }}
              >
                {problemIndex + 1 >= levelProblems.length ? 'Finish!' : 'Next'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
