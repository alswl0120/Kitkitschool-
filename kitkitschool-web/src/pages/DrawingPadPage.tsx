import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './DrawingPadPage.css'

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#a16207', '#6b7280',
]

const BRUSH_SIZES = [4, 10, 20, 36]

export default function DrawingPadPage() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(10)
  const [isEraser, setIsEraser] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    isDrawing.current = true
    lastPos.current = getPos(e, canvas)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = isEraser ? '#ffffff' : color
    ctx.lineWidth = isEraser ? brushSize * 2.5 : brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  function stopDraw() {
    isDrawing.current = false
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function downloadCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'drawing.png'
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="dp-root">
      {/* Header */}
      <div className="dp-header">
        <button className="dp-back" onClick={() => navigate('/tools')}>← Back</button>
        <span className="dp-title">🖌️ Drawing Pad</span>
        <div className="dp-header-actions">
          <button className="dp-btn dp-btn--clear" onClick={clearCanvas}>🗑️ Clear</button>
          <button className="dp-btn dp-btn--save" onClick={downloadCanvas}>💾 Save</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="dp-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="dp-canvas"
          width={1200}
          height={800}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      {/* Toolbar */}
      <div className="dp-toolbar">
        <div className="dp-colors">
          {COLORS.map(c => (
            <button
              key={c}
              className={`dp-color ${color === c && !isEraser ? 'dp-color--active' : ''}`}
              style={{
                background: c,
                border: c === '#ffffff' ? '1.5px solid #888' : 'none',
              }}
              onClick={() => { setColor(c); setIsEraser(false) }}
            />
          ))}
        </div>

        <div className="dp-divider" />

        <div className="dp-sizes">
          {BRUSH_SIZES.map(s => (
            <button
              key={s}
              className={`dp-size ${brushSize === s && !isEraser ? 'dp-size--active' : ''}`}
              onClick={() => { setBrushSize(s); setIsEraser(false) }}
            >
              <div
                className="dp-size-dot"
                style={{ width: Math.min(s, 28), height: Math.min(s, 28) }}
              />
            </button>
          ))}
        </div>

        <div className="dp-divider" />

        <button
          className={`dp-eraser ${isEraser ? 'dp-eraser--active' : ''}`}
          onClick={() => setIsEraser(v => !v)}
        >
          🧹 Eraser
        </button>
      </div>
    </div>
  )
}
