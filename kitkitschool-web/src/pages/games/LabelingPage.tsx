import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestLevel } from '../../utils/levelUtils'

interface LabelDef {
  id: string
  word: string
  x: number  // percent from left of scene area
  y: number  // percent from top of scene area
}

interface LabelLevel {
  level: number
  scene: string
  sceneEmoji: string
  sceneImage?: string   // optional SVG/PNG path for real illustration
  sceneLabel: string
  labels: LabelDef[]
  wordBank: string[]
}

interface LabelState {
  id: string
  word: string
  x: number
  y: number
  placed: string | null   // word placed here
  status: 'empty' | 'correct' | 'wrong'
}

interface DragState {
  word: string
  x: number
  y: number
}

// ---- keyframe injection (once) ----
let bounceCssInjected = false
function ensureBounceCss() {
  if (bounceCssInjected) return
  bounceCssInjected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes labelBounce {
      0%   { transform: scale(1) translate(-50%, -50%); }
      25%  { transform: scale(1.18) rotate(-4deg) translate(-50%, -50%); }
      50%  { transform: scale(0.88) rotate(4deg) translate(-50%, -50%); }
      75%  { transform: scale(1.10) rotate(-2deg) translate(-50%, -50%); }
      100% { transform: scale(1) translate(-50%, -50%); }
    }
    .label-bounce { animation: labelBounce 0.45s ease; }
    @keyframes celebrationPop {
      0%   { transform: scale(0.5); opacity: 0; }
      60%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .celebration-pop { animation: celebrationPop 0.4s ease forwards; }
  `
  document.head.appendChild(style)
}

export default function LabelingPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [levels, setLevels] = useState<LabelLevel[]>([])
  const [currentLevel, setCurrentLevel] = useState(0)
  const [levelData, setLevelData] = useState<LabelLevel | null>(null)
  const [labelStates, setLabelStates] = useState<LabelState[]>([])
  const [wordBank, setWordBank] = useState<string[]>([])
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [bouncingLabel, setBouncingLabel] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)
  // Track whether a pointer moved enough to count as a drag vs tap
  const dragMovedRef = useRef(false)

  useEffect(() => { ensureBounceCss() }, [])

  // Load level list
  useEffect(() => {
    fetch('/data/games/labeling.json')
      .then(r => r.json())
      .then(data => setLevels(data.levels || []))
      .catch(() => setLevels([]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setCurrentLevel(lvl)
    setShowComplete(false)
    setSelectedWord(null)
    setBouncingLabel(null)
    setDragging(null)
    setHoveredLabel(null)
  }, [])

  // Init level state when currentLevel changes
  useEffect(() => {
    if (currentLevel === 0 || levels.length === 0) return
    const data = findClosestLevel(levels, currentLevel) ?? levels[0]
    if (!data) return
    setLevelData(data)
    setLabelStates(data.labels.map(l => ({
      id: l.id,
      word: l.word,
      x: l.x,
      y: l.y,
      placed: null,
      status: 'empty',
    })))
    // shuffle word bank
    setWordBank([...data.wordBank].sort(() => Math.random() - 0.5))
    setProgress({ current: 0, max: data.labels.length })
  }, [currentLevel, levels])

  // Shell auto-start
  useEffect(() => {
    if (shellLevel && currentLevel === 0 && levels.length > 0) {
      startLevel(shellLevel)
    }
  }, [shellLevel, currentLevel, levels, startLevel])

  // Shell complete callback
  useEffect(() => {
    if (showComplete && isFromShell) {
      onGameComplete()
    }
  }, [showComplete, isFromShell, onGameComplete])

  const applyWordToLabel = useCallback((word: string, labelId: string) => {
    setLabelStates(prev => {
      const label = prev.find(l => l.id === labelId)
      if (!label) return prev
      // Already correctly placed — ignore
      if (label.status === 'correct') return prev

      const isCorrect = word === label.word

      if (isCorrect) {
        const next = prev.map(l =>
          l.id === labelId ? { ...l, placed: word, status: 'correct' as const } : l
        )
        const correctCount = next.filter(l => l.status === 'correct').length
        setProgress({ current: correctCount, max: next.length })
        setWordBank(wb => wb.filter(w => w !== word))
        setSelectedWord(null)
        if (correctCount === next.length) {
          setTimeout(() => setShowComplete(true), 600)
        }
        return next
      } else {
        // Wrong: show red, bounce, then revert
        setBouncingLabel(labelId)
        const next = prev.map(l =>
          l.id === labelId ? { ...l, placed: word, status: 'wrong' as const } : l
        )
        setTimeout(() => {
          setLabelStates(s => s.map(l =>
            l.id === labelId ? { ...l, placed: null, status: 'empty' as const } : l
          ))
          setBouncingLabel(null)
        }, 500)
        return next
      }
    })
  }, [])

  const handleWordSelect = (word: string) => {
    // Don't re-select if already used (removed from bank)
    setSelectedWord(prev => prev === word ? null : word)
  }

  const handleLabelClick = (labelId: string) => {
    if (!selectedWord) return
    applyWordToLabel(selectedWord, labelId)
  }

  // ---- Pointer-based drag handlers for word bank cards ----

  const handleWordPointerDown = useCallback((e: React.PointerEvent, word: string) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragMovedRef.current = false
    setDragging({ word, x: e.clientX, y: e.clientY })
    setHoveredLabel(null)
  }, [])

  const handleWordPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    e.preventDefault()
    dragMovedRef.current = true
    setDragging(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)

    // Detect which label is under the pointer
    const els = document.elementsFromPoint(e.clientX, e.clientY)
    const labelEl = els.find(el => el.getAttribute('data-label-id'))
    if (labelEl) {
      setHoveredLabel(labelEl.getAttribute('data-label-id'))
    } else {
      setHoveredLabel(null)
    }
  }, [dragging])

  const handleWordPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    e.preventDefault()

    if (!dragMovedRef.current) {
      // Short tap — treat as word select
      handleWordSelect(dragging.word)
      setDragging(null)
      setHoveredLabel(null)
      return
    }

    const els = document.elementsFromPoint(e.clientX, e.clientY)
    const labelEl = els.find(el => el.getAttribute('data-label-id'))
    if (labelEl) {
      const labelId = labelEl.getAttribute('data-label-id')!
      applyWordToLabel(dragging.word, labelId)
    }

    setDragging(null)
    setHoveredLabel(null)
  }, [dragging, applyWordToLabel])

  // ---- Level select screen ----
  if (currentLevel === 0) {
    const colors = ['#4CAF50','#2196F3','#FF9800','#9C27B0','#E91E63','#00BCD4','#795548','#607D8B']
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #43cea2, #185a9d)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, textShadow: '2px 2px 4px rgba(0,0,0,0.3)', margin: 0 }}>
          Labeling
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, margin: 0 }}>
          Drag the right word to each label!
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600, padding: '0 20px' }}>
          {levels.map((l, i) => (
            <button
              key={l.level}
              onClick={() => startLevel(l.level)}
              style={{
                width: 80, height: 80, borderRadius: 16,
                background: colors[i % colors.length],
                color: '#fff', fontSize: 22, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 28 }}>{l.sceneEmoji}</span>
              <span style={{ fontSize: 12 }}>{l.level}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!levelData) return null

  // ---- Game screen ----
  const correctCount = labelStates.filter(l => l.status === 'correct').length

  return (
    <div
      style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(160deg, #e0f7fa 0%, #b2ebf2 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}
      onPointerMove={handleWordPointerMove}
      onPointerUp={handleWordPointerUp}
    >
      <BackButton color="#333" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={correctCount} max={labelStates.length} />

      {/* Ghost element that follows the pointer during drag */}
      {dragging && dragMovedRef.current && (
        <div
          style={{
            position: 'fixed',
            left: dragging.x - 40,
            top: dragging.y - 22,
            zIndex: 9999,
            pointerEvents: 'none',
            padding: '10px 20px',
            borderRadius: 12,
            background: '#FFC107',
            border: '2.5px solid #F9A825',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#5d4037',
            userSelect: 'none',
            opacity: 0.92,
            boxShadow: '0 8px 24px rgba(255,193,7,0.45)',
            whiteSpace: 'nowrap',
          }}
        >
          {dragging.word}
        </div>
      )}

      {/* Title */}
      <div style={{
        marginTop: 56, fontSize: 20, fontWeight: 'bold',
        color: '#1565c0', letterSpacing: 1,
      }}>
        Label the {levelData.sceneLabel}
      </div>

      {/* Scene + Labels area */}
      <div style={{
        position: 'relative',
        width: 340, height: 340,
        margin: '12px auto 0',
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
        flexShrink: 0,
      }}>
        {/* Scene: real illustration or emoji fallback */}
        {levelData.sceneImage ? (
          <img
            src={levelData.sceneImage}
            alt={levelData.sceneLabel}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              borderRadius: 24,
              objectFit: 'cover',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        ) : (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 120,
            userSelect: 'none',
            lineHeight: 1,
          }}>
            {levelData.sceneEmoji}
          </div>
        )}

        {/* Label boxes positioned around scene */}
        {labelStates.map(label => {
          const isBouncing = bouncingLabel === label.id
          const isHoveredByDrag = hoveredLabel === label.id && dragging !== null

          const bgColor =
            label.status === 'correct' ? '#4CAF50' :
            label.status === 'wrong'   ? '#F44336' :
            isHoveredByDrag            ? '#E3F2FD' :
            selectedWord              ? '#fff9c4' : '#fff'
          const borderColor =
            label.status === 'correct' ? '#388E3C' :
            label.status === 'wrong'   ? '#C62828' :
            isHoveredByDrag            ? '#1976D2' :
            '#90a4ae'
          const textColor =
            label.status === 'correct' ? '#fff' :
            label.status === 'wrong'   ? '#fff' :
            '#37474f'

          return (
            <div
              key={label.id}
              data-label-id={label.id}
              className={isBouncing ? 'label-bounce' : undefined}
              onClick={() => handleLabelClick(label.id)}
              style={{
                position: 'absolute',
                left: `${label.x}%`,
                top: `${label.y}%`,
                transform: 'translate(-50%, -50%)',
                minWidth: 72,
                height: 34,
                background: bgColor,
                border: `2.5px solid ${borderColor}`,
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13,
                fontWeight: 'bold',
                color: textColor,
                cursor: selectedWord && label.status !== 'correct' ? 'pointer' : 'default',
                boxShadow: isHoveredByDrag
                  ? '0 0 0 3px rgba(25,118,210,0.25), 0 2px 8px rgba(0,0,0,0.15)'
                  : '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 10,
                transition: 'background 0.2s, border-color 0.2s',
                padding: '0 8px',
                whiteSpace: 'nowrap',
                // Ensure pointer events work on child elements too
                pointerEvents: 'auto',
              }}
            >
              {label.placed || '?'}
            </div>
          )
        })}
      </div>

      {/* Instruction */}
      <div style={{
        marginTop: 10, fontSize: 14, color: '#546e7a',
        minHeight: 22,
      }}>
        {dragging
          ? `Drag "${dragging.word}" to a label`
          : selectedWord
          ? `Tap a label box to place "${selectedWord}"`
          : 'Tap or drag a word below'}
      </div>

      {/* Word bank */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10,
        justifyContent: 'center',
        padding: '10px 20px',
        maxWidth: 420,
      }}>
        {wordBank.map(word => {
          const isSelected = selectedWord === word
          const isDraggingThis = dragging?.word === word
          return (
            <button
              key={word}
              onPointerDown={e => handleWordPointerDown(e, word)}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                background: isSelected ? '#FFC107' : '#fff',
                border: `2.5px solid ${isSelected ? '#F9A825' : '#b0bec5'}`,
                fontSize: 16,
                fontWeight: 'bold',
                color: isSelected ? '#5d4037' : '#37474f',
                cursor: 'grab',
                boxShadow: isSelected
                  ? '0 4px 12px rgba(255,193,7,0.5)'
                  : '0 2px 6px rgba(0,0,0,0.1)',
                transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                transition: 'all 0.15s ease',
                opacity: isDraggingThis ? 0.4 : 1,
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              {word}
            </button>
          )
        })}
      </div>

      {/* Progress indicator */}
      <div style={{
        fontSize: 14, color: '#78909c', marginTop: 4,
      }}>
        {correctCount} / {labelStates.length} correct
      </div>

      {/* Completion overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 24,
        }}>
          <div
            className="celebration-pop"
            style={{
              fontSize: 80,
              filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))',
            }}
          >
            🎉
          </div>
          <div style={{
            color: '#fff', fontSize: 40, fontWeight: 'bold',
            textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          }}>
            Great Job!
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={() => startLevel(currentLevel)}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#4CAF50',
                color: '#fff', fontSize: 18, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Play Again
            </button>
            <button
              onClick={() => setCurrentLevel(0)}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#2196F3',
                color: '#fff', fontSize: 18, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Levels
            </button>
            <button
              onClick={() => isFromShell ? shellBack() : navigate('/')}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#FF5722',
                color: '#fff', fontSize: 18, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
