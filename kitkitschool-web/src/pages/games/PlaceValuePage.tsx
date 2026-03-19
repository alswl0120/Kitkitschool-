import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestLevel } from '../../utils/levelUtils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProblemData {
  target: number
  hundreds: number
  tens: number
  ones: number
}

interface LevelData {
  level: number
  problems: ProblemData[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CORRECT_FLASH_MS = 900
const NEXT_PROBLEM_DELAY_MS = 600

// ── Block visual component ─────────────────────────────────────────────────────

interface BlockDisplayProps {
  count: number
  color: string
  maxVisible?: number
}

function BlockDisplay({ count, color, maxVisible = 9 }: BlockDisplayProps) {
  const visible = Math.min(count, maxVisible)
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4,
      justifyContent: 'center', alignItems: 'center',
      minHeight: 40,
    }}>
      {Array.from({ length: visible }).map((_, i) => (
        <div key={i} style={{
          width: 18, height: 18, borderRadius: 4,
          background: color,
          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          transition: 'transform 0.15s',
          animation: 'blockPop 0.2s ease-out',
        }} />
      ))}
      {count > maxVisible && (
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 2 }}>
          +{count - maxVisible}
        </span>
      )}
    </div>
  )
}

// ── PlaceValue column ─────────────────────────────────────────────────────────

interface PlaceColumnProps {
  label: string
  value: number
  target: number
  color: string
  blockColor: string
  onIncrement: () => void
  onDecrement: () => void
  disabled: boolean
}

function PlaceColumn({
  label, value, target, color, blockColor,
  onIncrement, onDecrement, disabled,
}: PlaceColumnProps) {
  const isCorrect = value === target
  const isOver = value > target

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 8,
      flex: 1,
      background: isCorrect
        ? 'rgba(76,175,80,0.25)'
        : isOver
          ? 'rgba(244,67,54,0.18)'
          : 'rgba(255,255,255,0.07)',
      borderRadius: 18,
      padding: '14px 8px',
      border: isCorrect
        ? '2px solid #4caf50'
        : isOver
          ? '2px solid #f44336'
          : '2px solid rgba(255,255,255,0.15)',
      transition: 'background 0.3s, border 0.3s',
      minWidth: 0,
    }}>
      {/* Label */}
      <div style={{
        color, fontWeight: 'bold',
        fontSize: 'clamp(13px, 2.5vw, 18px)',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>

      {/* Target digit hint */}
      <div style={{
        color: 'rgba(255,255,255,0.35)',
        fontSize: 13,
        fontWeight: 'bold',
      }}>
        needs: {target}
      </div>

      {/* Current value */}
      <div style={{
        color: isCorrect ? '#4caf50' : isOver ? '#f44336' : '#fff',
        fontSize: 'clamp(32px, 7vw, 52px)',
        fontWeight: 'bold',
        lineHeight: 1,
        transition: 'color 0.2s',
        textShadow: isCorrect ? '0 0 12px #4caf50' : isOver ? '0 0 10px #f44336' : 'none',
      }}>
        {value}
      </div>

      {/* Block visual */}
      <div style={{ minHeight: 50, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <BlockDisplay count={value} color={isCorrect ? '#4caf50' : blockColor} maxVisible={9} />
      </div>

      {/* +/- buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onDecrement}
          disabled={disabled || value === 0}
          style={{
            width: 'clamp(36px, 7vw, 48px)',
            height: 'clamp(36px, 7vw, 48px)',
            borderRadius: 10,
            background: 'rgba(244,67,54,0.75)',
            color: '#fff',
            fontSize: 'clamp(18px, 3.5vw, 28px)',
            fontWeight: 'bold',
            border: 'none',
            cursor: disabled || value === 0 ? 'default' : 'pointer',
            opacity: disabled || value === 0 ? 0.4 : 1,
            boxShadow: '0 3px 0 rgba(0,0,0,0.3)',
            transition: 'opacity 0.15s, transform 0.08s',
            lineHeight: 1,
          }}
          onMouseDown={e => { if (!disabled && value > 0) e.currentTarget.style.transform = 'translateY(3px)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          −
        </button>
        <button
          onClick={onIncrement}
          disabled={disabled}
          style={{
            width: 'clamp(36px, 7vw, 48px)',
            height: 'clamp(36px, 7vw, 48px)',
            borderRadius: 10,
            background: 'rgba(76,175,80,0.75)',
            color: '#fff',
            fontSize: 'clamp(18px, 3.5vw, 28px)',
            fontWeight: 'bold',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            boxShadow: '0 3px 0 rgba(0,0,0,0.3)',
            transition: 'opacity 0.15s, transform 0.08s',
            lineHeight: 1,
          }}
          onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(3px)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          +
        </button>
      </div>

      {/* Correct checkmark */}
      {isCorrect && (
        <div style={{ fontSize: 22, animation: 'fadeIn 0.2s ease-out' }}>✓</div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlaceValuePage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  // Level select
  const [availableLevels, setAvailableLevels] = useState<LevelData[]>([])
  const [currentLevelData, setCurrentLevelData] = useState<LevelData | null>(null)

  // Game state
  const [problemIndex, setProblemIndex] = useState(0)
  const [hundreds, setHundreds] = useState(0)
  const [tens, setTens] = useState(0)
  const [ones, setOnes] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  const [problemCorrect, setProblemCorrect] = useState(false)
  const [inputDisabled, setInputDisabled] = useState(false)

  const nextProblemTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/placevalue.json')
      .then(r => r.json())
      .then(data => setAvailableLevels(data.levels || []))
      .catch(() => setAvailableLevels([]))
  }, [])

  // ── Auto-start from shell ──────────────────────────────────────────────────

  useEffect(() => {
    if (shellLevel && availableLevels.length > 0 && !currentLevelData) {
      const ld = findClosestLevel(availableLevels, shellLevel as number) ?? availableLevels[0]
      startLevel(ld)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellLevel, availableLevels])

  // ── Shell complete ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (nextProblemTimerRef.current) clearTimeout(nextProblemTimerRef.current)
    }
  }, [])

  // ── Check correctness whenever values change ───────────────────────────────

  const currentLevelDataRef = useRef<LevelData | null>(null)
  const problemIndexRef = useRef(0)
  currentLevelDataRef.current = currentLevelData
  problemIndexRef.current = problemIndex

  useEffect(() => {
    const ld = currentLevelData
    if (!ld || problemCorrect) return
    const prob = ld.problems[problemIndex]
    if (!prob) return

    // Check if all three place values match
    if (hundreds === prob.hundreds && tens === prob.tens && ones === prob.ones) {
      setProblemCorrect(true)
      setInputDisabled(true)

      if (nextProblemTimerRef.current) clearTimeout(nextProblemTimerRef.current)
      nextProblemTimerRef.current = setTimeout(() => {
        const nextIdx = problemIndex + 1
        if (nextIdx >= ld.problems.length) {
          setShowComplete(true)
        } else {
          loadProblem(nextIdx)
        }
      }, CORRECT_FLASH_MS + NEXT_PROBLEM_DELAY_MS)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hundreds, tens, ones])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function loadProblem(idx: number) {
    setProblemIndex(idx)
    setHundreds(0)
    setTens(0)
    setOnes(0)
    setProblemCorrect(false)
    setInputDisabled(false)
  }

  const startLevel = useCallback((ld: LevelData) => {
    if (nextProblemTimerRef.current) clearTimeout(nextProblemTimerRef.current)
    setCurrentLevelData(ld)
    setProblemIndex(0)
    setHundreds(0)
    setTens(0)
    setOnes(0)
    setProblemCorrect(false)
    setInputDisabled(false)
    setShowComplete(false)
  }, [])

  // ── Level select screen ────────────────────────────────────────────────────

  if (!currentLevelData) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <BackButton color="#fff" />
        <h1 style={{
          color: '#fff', fontSize: 40, fontWeight: 'bold',
          textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          letterSpacing: 2,
        }}>
          Place Value
        </h1>
        <p style={{ color: '#aac', fontSize: 18, marginTop: -12 }}>Choose a level</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
          {availableLevels.map((ld, idx) => {
            const colors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c']
            const maxTarget = Math.max(...ld.problems.map(p => p.target))
            return (
              <button
                key={ld.level}
                onClick={() => startLevel(ld)}
                style={{
                  width: 92, height: 92, borderRadius: 18,
                  background: colors[idx % colors.length],
                  color: '#fff', fontWeight: 'bold',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  border: 'none', cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span style={{ fontSize: 28 }}>{ld.level}</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>up to {maxTarget}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Game screen ────────────────────────────────────────────────────────────

  const prob = currentLevelData.problems[problemIndex]
  const totalProblems = currentLevelData.problems.length
  const showHundreds = currentLevelData.problems.some(p => p.hundreds > 0)

  // The current total the player has built
  const playerTotal = hundreds * 100 + tens * 10 + ones

  // Color for the total display
  const totalColor = playerTotal === prob.target
    ? '#4caf50'
    : playerTotal > prob.target
      ? '#f44336'
      : '#fff'

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      userSelect: 'none',
      position: 'relative',
    }}>
      {/* CSS animations */}
      <style>{`
        @keyframes blockPop {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <BackButton color="#fff" onClick={isFromShell ? shellBack : undefined} />

      {/* ── Progress dots ── */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        marginTop: 16, zIndex: 20,
      }}>
        {Array.from({ length: totalProblems }).map((_, i) => (
          <div key={i} style={{
            width: 12, height: 12, borderRadius: '50%',
            background: i < problemIndex
              ? '#4caf50'
              : i === problemIndex
                ? '#fff'
                : 'rgba(255,255,255,0.3)',
            transition: 'background 0.3s',
            boxShadow: i === problemIndex ? '0 0 6px #fff' : 'none',
          }} />
        ))}
      </div>

      {/* ── Target number ── */}
      <div style={{
        marginTop: 12,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 4,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: 'bold', letterSpacing: 2 }}>
          MAKE THIS NUMBER
        </div>
        <div style={{
          color: '#fff',
          fontSize: 'clamp(56px, 13vw, 100px)',
          fontWeight: 'bold',
          textShadow: '0 4px 20px rgba(255,255,255,0.2)',
          lineHeight: 1,
          letterSpacing: 6,
        }}>
          {prob.target}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Your total: <span style={{ color: totalColor, fontWeight: 'bold', fontSize: 16 }}>{playerTotal}</span>
        </div>
      </div>

      {/* ── Place value columns ── */}
      <div style={{
        display: 'flex',
        gap: 'clamp(6px, 2vw, 16px)',
        marginTop: 16,
        width: '94%',
        maxWidth: 640,
        flex: 1,
        minHeight: 0,
      }}>
        {showHundreds && (
          <PlaceColumn
            label="Hundreds"
            value={hundreds}
            target={prob.hundreds}
            color="#e74c3c"
            blockColor="rgba(231,76,60,0.85)"
            onIncrement={() => setHundreds(h => h + 1)}
            onDecrement={() => setHundreds(h => Math.max(0, h - 1))}
            disabled={inputDisabled || problemCorrect}
          />
        )}
        <PlaceColumn
          label="Tens"
          value={tens}
          target={prob.tens}
          color="#f1c40f"
          blockColor="rgba(241,196,15,0.85)"
          onIncrement={() => setTens(t => t + 1)}
          onDecrement={() => setTens(t => Math.max(0, t - 1))}
          disabled={inputDisabled || problemCorrect}
        />
        <PlaceColumn
          label="Ones"
          value={ones}
          target={prob.ones}
          color="#3498db"
          blockColor="rgba(52,152,219,0.85)"
          onIncrement={() => setOnes(o => o + 1)}
          onDecrement={() => setOnes(o => Math.max(0, o - 1))}
          disabled={inputDisabled || problemCorrect}
        />
      </div>

      {/* ── Correct flash banner ── */}
      {problemCorrect && !showComplete && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%', transform: 'translateX(-50%)',
          background: '#4caf50',
          color: '#fff',
          borderRadius: 14,
          padding: '12px 36px',
          fontSize: 24, fontWeight: 'bold',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease-out',
          zIndex: 50,
          whiteSpace: 'nowrap',
        }}>
          Correct! ✓
        </div>
      )}

      {/* ── Complete popup ── */}
      {showComplete && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 100, gap: 24,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
            borderRadius: 24, padding: '40px 48px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '2px solid rgba(255,255,255,0.15)',
          }}>
            <div style={{ fontSize: 64 }}>🎉</div>
            <div style={{
              color: '#fff', fontSize: 42, fontWeight: 'bold',
              textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
            }}>
              Great Job!
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => startLevel(currentLevelData)}
                style={{
                  padding: '12px 28px', borderRadius: 12, background: '#4caf50',
                  color: '#fff', fontSize: 18, fontWeight: 'bold',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                Play Again
              </button>
              <button
                onClick={() => { setCurrentLevelData(null); setShowComplete(false) }}
                style={{
                  padding: '12px 28px', borderRadius: 12, background: '#2196F3',
                  color: '#fff', fontSize: 18, fontWeight: 'bold',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                Levels
              </button>
              <button
                onClick={() => isFromShell ? shellBack() : navigate('/')}
                style={{
                  padding: '12px 28px', borderRadius: 12, background: '#FF5722',
                  color: '#fff', fontSize: 18, fontWeight: 'bold',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
