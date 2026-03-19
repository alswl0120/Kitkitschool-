import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { COLORING_PAGES, type ColoringPage } from '../data/coloringPages'
import './ColoringBookPage.css'

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#d4a574', '#6b7280',
]

const BRUSH_SIZES = [4, 10, 20, 36]
const MAX_HISTORY = 20

const CANVAS_W = 600
const CANVAS_H = 450

const FREE_DRAW_PAGE: ColoringPage = {
  id: 'freedraw',
  title: 'Free Draw',
  emoji: '✏️',
  draw(ctx, w, h) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  },
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function floodFill(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  hex: string,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { r: fillR, g: fillG, b: fillB } = hexToRgb(hex)
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const ix = Math.floor(startX)
  const iy = Math.floor(startY)
  if (ix < 0 || ix >= width || iy < 0 || iy >= height) return

  const si = (iy * width + ix) * 4
  const targetR = data[si], targetG = data[si + 1], targetB = data[si + 2]

  if (targetR < 80 && targetG < 80 && targetB < 80) return
  if (
    Math.abs(targetR - fillR) < 10 &&
    Math.abs(targetG - fillG) < 10 &&
    Math.abs(targetB - fillB) < 10
  ) return

  const TOL = 48
  const matches = (idx: number) =>
    Math.abs(data[idx] - targetR) < TOL &&
    Math.abs(data[idx + 1] - targetG) < TOL &&
    Math.abs(data[idx + 2] - targetB) < TOL

  const visited = new Uint8Array(width * height)
  const stack: number[] = [iy * width + ix]

  while (stack.length > 0) {
    const pos = stack.pop()!
    const x = pos % width
    const y = (pos - x) / width
    if (visited[pos]) continue
    const idx = pos * 4
    if (!matches(idx)) continue
    visited[pos] = 1
    data[idx] = fillR
    data[idx + 1] = fillG
    data[idx + 2] = fillB
    data[idx + 3] = 255
    if (x + 1 < width) stack.push(pos + 1)
    if (x - 1 >= 0) stack.push(pos - 1)
    if (y + 1 < height) stack.push(pos + width)
    if (y - 1 >= 0) stack.push(pos - width)
  }

  ctx.putImageData(imageData, 0, 0)
}

type Mode = 'fill' | 'brush'

export default function ColoringBookPage() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const history = useRef<ImageData[]>([])

  const [page, setPage] = useState<ColoringPage | null>(null)
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(10)
  const [mode, setMode] = useState<Mode>('fill')
  const [canUndo, setCanUndo] = useState(false)

  const isFreeDraw = page?.id === 'freedraw'

  function saveSnapshot() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
    history.current.push(snapshot)
    if (history.current.length > MAX_HISTORY) history.current.shift()
    setCanUndo(true)
  }

  function undo() {
    const canvas = canvasRef.current
    if (!canvas || history.current.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const snapshot = history.current.pop()!
    ctx.putImageData(snapshot, 0, 0)
    setCanUndo(history.current.length > 0)
  }

  const drawPage = useCallback((p: ColoringPage) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    p.draw(ctx, CANVAS_W, CANVAS_H)
  }, [])

  useEffect(() => {
    if (page) {
      history.current = []
      setCanUndo(false)
      setMode(page.id === 'freedraw' ? 'brush' : 'fill')
      drawPage(page)
    }
  }, [page, drawPage])

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function handleClick(e: React.MouseEvent) {
    if (mode !== 'fill') return
    const canvas = canvasRef.current
    if (!canvas) return
    saveSnapshot()
    const pos = getPos(e, canvas)
    floodFill(canvas, pos.x, pos.y, color)
  }

  function startStroke(e: React.MouseEvent | React.TouchEvent) {
    if (mode !== 'brush') return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    saveSnapshot()
    isDrawing.current = true
    lastPos.current = getPos(e, canvas)
  }

  function doStroke(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current || mode !== 'brush') return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  function stopStroke() { isDrawing.current = false }

  function reset() {
    if (!page) return
    history.current = []
    setCanUndo(false)
    drawPage(page)
  }

  function save() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `coloring-${page?.id ?? 'art'}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  // ── Page select screen ──────────────────────────────────────────────
  if (!page) {
    return (
      <div className="cb-root">
        <div className="cb-header">
          <button className="cb-back" onClick={() => navigate('/tools')}>← Back</button>
          <span className="cb-title">🎨 Drawing & Coloring</span>
          <div style={{ width: 70 }} />
        </div>
        <div className="cb-select-body">
          <div
            className="cb-freedraw-card"
            onClick={() => setPage(FREE_DRAW_PAGE)}
          >
            <span className="cb-freedraw-emoji">✏️</span>
            <div>
              <div className="cb-freedraw-title">Free Draw</div>
              <div className="cb-freedraw-desc">Blank canvas — draw anything you want!</div>
            </div>
            <span className="cb-freedraw-arrow">→</span>
          </div>

          <div className="cb-select-hint">Or pick a picture to color:</div>
          <div className="cb-page-grid">
            {COLORING_PAGES.map(p => (
              <div key={p.id} className="cb-page-card" onClick={() => setPage(p)}>
                <div className="cb-page-emoji">{p.emoji}</div>
                <div className="cb-page-title">{p.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Drawing / Coloring screen ───────────────────────────────────────
  return (
    <div className="cb-root">
      <div className="cb-header">
        <button className="cb-back" onClick={() => setPage(null)}>← Back</button>
        <span className="cb-title">
          {isFreeDraw ? '✏️ Free Draw' : `🎨 ${page.title}`}
        </span>
        <div className="cb-header-actions">
          <button className="cb-btn cb-btn--save" onClick={save}>💾 Save</button>
        </div>
      </div>

      <div className="cb-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="cb-canvas"
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ cursor: mode === 'fill' ? 'cell' : 'crosshair' }}
          onClick={handleClick}
          onMouseDown={startStroke}
          onMouseMove={doStroke}
          onMouseUp={stopStroke}
          onMouseLeave={stopStroke}
          onTouchStart={startStroke}
          onTouchMove={doStroke}
          onTouchEnd={stopStroke}
        />
      </div>

      <div className="cb-toolbar">
        {/* Undo / Reset */}
        <button
          className={`cb-tool-btn cb-tool-btn--undo ${!canUndo ? 'cb-tool-btn--disabled' : ''}`}
          onClick={undo}
          disabled={!canUndo}
        >
          ↩ Undo
        </button>
        <button className="cb-tool-btn cb-tool-btn--reset" onClick={reset}>
          ↺ Reset
        </button>

        <div className="cb-divider" />

        <div className="cb-mode-btns">
          {!isFreeDraw && (
            <button
              className={`cb-mode-btn ${mode === 'fill' ? 'cb-mode-btn--active' : ''}`}
              onClick={() => setMode('fill')}
            >
              🪣 Fill
            </button>
          )}
          <button
            className={`cb-mode-btn ${mode === 'brush' ? 'cb-mode-btn--active' : ''}`}
            onClick={() => setMode('brush')}
          >
            🖌️ Brush
          </button>
        </div>

        <div className="cb-divider" />

        {mode === 'brush' && (
          <>
            <div className="cb-sizes">
              {BRUSH_SIZES.map(s => (
                <button
                  key={s}
                  className={`cb-size ${brushSize === s ? 'cb-size--active' : ''}`}
                  onClick={() => setBrushSize(s)}
                >
                  <div
                    className="cb-size-dot"
                    style={{ width: Math.min(s, 28), height: Math.min(s, 28) }}
                  />
                </button>
              ))}
            </div>
            <div className="cb-divider" />
          </>
        )}

        <div className="cb-colors">
          {COLORS.map(c => (
            <button
              key={c}
              className={`cb-color ${color === c ? 'cb-color--active' : ''}`}
              style={{
                background: c,
                border: c === '#ffffff' ? '1.5px solid #888' : 'none',
              }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
