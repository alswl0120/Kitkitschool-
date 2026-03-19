import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

interface CellData {
  value: number
  given: boolean
}

interface LevelData {
  level: number
  size: number
  start: number
  cells: CellData[]
}

// Per-cell feedback state
type CellState = 'idle' | 'correct' | 'wrong'

const LEVEL_COLORS = [
  '#FF8A65', '#FFB74D', '#FFD54F', '#AED581', '#4DB6AC', '#4FC3F7',
]

export default function ThirtyPuzzlePage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [levels, setLevels] = useState<LevelData[]>([])
  const [level, setLevel] = useState(0)
  const [levelData, setLevelData] = useState<LevelData | null>(null)

  // cells: null = empty slot, number = placed value
  const [cells, setCells] = useState<(number | null)[]>([])
  const [selected, setSelected] = useState<number | null>(null) // selected tile value from bank
  const [cellStates, setCellStates] = useState<CellState[]>([])
  const [bankUsed, setBankUsed] = useState<Set<number>>(new Set())
  const [filledCount, setFilledCount] = useState(0)
  const [showComplete, setShowComplete] = useState(false)

  // Fetch level data once
  useEffect(() => {
    fetch('/data/games/thirtypuzzle.json')
      .then(r => r.json())
      .then(data => setLevels(data.levels))
      .catch(() => setLevels([]))
  }, [])

  // Build missing (bank) values for a level
  const getMissingValues = (ld: LevelData) =>
    ld.cells.filter(c => !c.given).map(c => c.value)

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setSelected(null)
    setBankUsed(new Set())
    setFilledCount(0)
  }, [])

  // Init cells when levelData changes
  useEffect(() => {
    if (!levelData) return
    const init = levelData.cells.map(c => (c.given ? c.value : null))
    setCells(init)
    setCellStates(levelData.cells.map(() => 'idle'))
    setFilledCount(0)
    setBankUsed(new Set())
    setSelected(null)
  }, [levelData])

  // Resolve levelData when levels and level are ready
  useEffect(() => {
    if (level === 0 || levels.length === 0) return
    const ld = levels.find(l => l.level === level) ?? levels[0]
    setLevelData(ld)
  }, [level, levels])

  // Shell auto-start
  useEffect(() => {
    if (shellLevel && level === 0 && levels.length > 0) {
      startLevel(shellLevel)
    }
  }, [shellLevel, level, levels, startLevel])

  // Shell complete callback
  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // Tap a bank tile
  const handleTileSelect = (val: number) => {
    if (bankUsed.has(val)) return
    setSelected(prev => (prev === val ? null : val))
  }

  // Tap a grid cell
  const handleCellTap = (idx: number) => {
    if (!levelData) return
    const cellDef = levelData.cells[idx]

    // Can't tap given cells
    if (cellDef.given) return

    if (selected === null) return

    const correct = selected === cellDef.value

    // Flash feedback
    setCellStates(prev => {
      const next = [...prev]
      next[idx] = correct ? 'correct' : 'wrong'
      return next
    })

    if (correct) {
      // Place the number
      setCells(prev => {
        const next = [...prev]
        next[idx] = selected
        return next
      })
      setBankUsed(prev => new Set(prev).add(selected))
      setSelected(null)

      // Check completion
      const newFilled = filledCount + 1
      setFilledCount(newFilled)
      const totalMissing = levelData.cells.filter(c => !c.given).length
      if (newFilled >= totalMissing) {
        setTimeout(() => setShowComplete(true), 600)
      }

      // Revert cell state after a moment
      setTimeout(() => {
        setCellStates(prev => {
          const next = [...prev]
          next[idx] = 'idle'
          return next
        })
      }, 700)
    } else {
      // Wrong: bounce then revert
      setTimeout(() => {
        setCellStates(prev => {
          const next = [...prev]
          next[idx] = 'idle'
          return next
        })
      }, 500)
    }
  }

  // Determine grid columns based on size
  const getGridCols = (size: number) => {
    if (size <= 10) return 5
    if (size <= 20) return 5
    return 6
  }

  // ─── Level Select ───────────────────────────────────────────────────────────
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #43cea2, #185a9d)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 'bold', textShadow: '1px 1px 4px rgba(0,0,0,0.3)', margin: 0 }}>
          Thirty Puzzle
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, margin: 0 }}>
          Fill in the missing numbers in order!
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 520, padding: '0 20px' }}>
          {levels.map((ld, i) => (
            <button
              key={ld.level}
              onClick={() => startLevel(ld.level)}
              style={{
                width: 80, height: 80, borderRadius: 16,
                background: LEVEL_COLORS[i % LEVEL_COLORS.length],
                color: '#fff', fontSize: 22, fontWeight: 'bold',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span>{ld.level}</span>
              <span style={{ fontSize: 11, fontWeight: 'normal', opacity: 0.9 }}>
                1–{ld.size}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ─── Game View ───────────────────────────────────────────────────────────────
  if (!levelData) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff', fontSize: 24 }}>
        Loading...
      </div>
    )
  }

  const missingValues = getMissingValues(levelData)
  const totalMissing = missingValues.length
  const cols = getGridCols(levelData.size)
  const cellSizeVw = Math.min(10, 50 / cols)

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #43cea2, #185a9d)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      overflow: 'hidden', position: 'relative',
      fontFamily: 'sans-serif',
    }}>
      <BackButton color="#fff" onClick={isFromShell ? shellBack : () => setLevel(0)} />
      <ProgressBar current={bankUsed.size} max={totalMissing} />

      {/* Title */}
      <div style={{ marginTop: 56, marginBottom: 12, color: '#fff', fontSize: 22, fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        Fill in 1 – {levelData.start + levelData.size - 1}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${cellSizeVw}vw)`,
        gap: '0.6vw',
        marginBottom: 16,
      }}>
        {levelData.cells.map((cellDef, idx) => {
          const state = cellStates[idx]
          const placedValue = cells[idx]
          const isEmpty = !cellDef.given && placedValue === null

          let bg = '#fff'
          let color = '#333'
          let border = '2px solid rgba(255,255,255,0.4)'
          let transform = 'scale(1)'

          if (cellDef.given) {
            bg = '#1a5276'
            color = '#fff'
            border = '2px solid #154360'
          } else if (state === 'correct') {
            bg = '#27ae60'
            color = '#fff'
            border = '2px solid #1e8449'
            transform = 'scale(1.12)'
          } else if (state === 'wrong') {
            bg = '#e74c3c'
            color = '#fff'
            border = '2px solid #c0392b'
            transform = 'translateX(-4px)'
          } else if (isEmpty) {
            bg = 'rgba(255,255,255,0.15)'
            color = 'transparent'
            border = '2px dashed rgba(255,255,255,0.6)'
          } else if (placedValue !== null) {
            bg = '#2ecc71'
            color = '#fff'
            border = '2px solid #27ae60'
          }

          return (
            <div
              key={idx}
              onClick={() => handleCellTap(idx)}
              style={{
                width: `${cellSizeVw}vw`,
                height: `${cellSizeVw}vw`,
                borderRadius: '0.8vw',
                background: bg,
                color,
                border,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: `${cellSizeVw * 0.38}vw`,
                fontWeight: 'bold',
                cursor: (!cellDef.given && selected !== null) ? 'pointer' : 'default',
                transition: 'transform 0.15s, background 0.2s',
                transform,
                userSelect: 'none',
                boxShadow: cellDef.given ? '0 2px 6px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.15)',
                animation: state === 'wrong' ? 'shake 0.4s ease' : undefined,
              }}
            >
              {placedValue ?? (cellDef.given ? cellDef.value : '')}
            </div>
          )
        })}
      </div>

      {/* Number Bank */}
      <div style={{
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 16,
        padding: '10px 14px',
        display: 'flex', flexWrap: 'wrap', gap: 8,
        justifyContent: 'center',
        maxWidth: '90vw',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>
          Tap a number, then tap an empty cell
        </div>
        {missingValues.map(val => {
          const used = bankUsed.has(val)
          const isSelected = selected === val
          return (
            <button
              key={val}
              onClick={() => handleTileSelect(val)}
              disabled={used}
              style={{
                width: 44, height: 44, borderRadius: 10,
                background: used
                  ? 'rgba(255,255,255,0.1)'
                  : isSelected
                    ? '#f39c12'
                    : '#fff',
                color: used ? 'transparent' : isSelected ? '#fff' : '#1a5276',
                border: isSelected ? '2px solid #e67e22' : '2px solid rgba(255,255,255,0.5)',
                fontSize: 18, fontWeight: 'bold',
                cursor: used ? 'default' : 'pointer',
                transition: 'all 0.15s',
                transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                boxShadow: isSelected ? '0 4px 12px rgba(243,156,18,0.6)' : '0 2px 6px rgba(0,0,0,0.2)',
                opacity: used ? 0.3 : 1,
              }}
            >
              {used ? '' : val}
            </button>
          )
        })}
      </div>

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 200, gap: 24,
        }}>
          <div style={{ color: '#FFD700', fontSize: 52, fontWeight: 'bold', textShadow: '2px 2px 10px rgba(0,0,0,0.5)' }}>
            Great Job! 🎉
          </div>
          <div style={{ color: '#fff', fontSize: 22 }}>
            You filled all the numbers!
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '12px 32px', borderRadius: 12, background: '#4CAF50',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Play Again</button>
            <button onClick={() => setLevel(0)} style={{
              padding: '12px 32px', borderRadius: 12, background: '#2196F3',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Other Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '12px 32px', borderRadius: 12, background: '#FF5722',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Home</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-6px); }
          40%  { transform: translateX(6px); }
          60%  { transform: translateX(-4px); }
          80%  { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
