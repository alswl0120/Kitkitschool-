import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../components/BackButton'
import ProgressBar from '../../components/ProgressBar'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestLevel } from '../../utils/levelUtils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProblemData {
  target: number
  cars: [number, number, number]
  correct: number
}

interface LevelData {
  level: number
  problems: ProblemData[]
}

// ── Dot grid component ────────────────────────────────────────────────────────

function DotGrid({ count }: { count: number }) {
  const MAX_DOTS = 50
  const shown = Math.min(count, MAX_DOTS)
  const cols = count <= 5 ? count : count <= 12 ? 4 : count <= 25 ? 5 : 6
  const dotSize = count <= 10 ? 20 : count <= 25 ? 14 : 10
  const gap = count <= 10 ? 6 : 4

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, ${dotSize}px)`,
      gap,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 60,
      padding: '4px 0',
    }}>
      {Array.from({ length: shown }).map((_, i) => (
        <div key={i} style={{
          width: dotSize, height: dotSize,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }} />
      ))}
      {count > MAX_DOTS && (
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', gridColumn: '1 / -1', textAlign: 'center' }}>
          +{count - MAX_DOTS}
        </span>
      )}
    </div>
  )
}

// ── Train car component ───────────────────────────────────────────────────────

interface TrainCarProps {
  count: number
  carIndex: number
  state: string
  onClick: () => void
  disabled: boolean
}

const CAR_COLORS = ['#c0392b', '#2980b9', '#27ae60']
const CAR_BORDER_COLORS = ['#922b21', '#1f618d', '#1e8449']

function TrainCar({ count, carIndex, state, onClick, disabled }: TrainCarProps) {
  const base = CAR_COLORS[carIndex % CAR_COLORS.length]
  const border = CAR_BORDER_COLORS[carIndex % CAR_BORDER_COLORS.length]

  let bg = base
  let borderColor = border
  let shadow = '0 4px 16px rgba(0,0,0,0.4)'
  let scale = '1'
  if (state === 'correct') {
    bg = '#27ae60'
    borderColor = '#1e8449'
    shadow = '0 0 24px 6px rgba(39,174,96,0.7)'
    scale = '1.06'
  } else if (state === 'wrong') {
    bg = '#c0392b'
    borderColor = '#922b21'
    shadow = '0 0 24px 6px rgba(192,57,43,0.7)'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: bg,
        border: `4px solid ${borderColor}`,
        borderRadius: 18,
        padding: '14px 10px 8px',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: shadow,
        transform: `scale(${scale})`,
        transition: 'transform 0.18s, box-shadow 0.18s, background 0.18s',
        position: 'relative',
        minHeight: 160,
      }}
    >
      {/* Roof stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 10, background: 'rgba(0,0,0,0.18)',
        borderRadius: '14px 14px 0 0',
      }} />

      {/* Dots */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <DotGrid count={count} />
      </div>

      {/* Count label */}
      <div style={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14, fontWeight: 'bold',
        marginTop: 4,
      }}>
        {count}
      </div>

      {/* Wheels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        width: '80%', marginTop: 6,
      }}>
        {[0, 1].map(w => (
          <div key={w} style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#333', border: '3px solid #888',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
          }} />
        ))}
      </div>

      {/* Feedback icon */}
      {state !== 'idle' && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: 24,
          animation: 'popIn 0.2s ease-out',
        }}>
          {state === 'correct' ? '✓' : '✗'}
        </div>
      )}
    </button>
  )
}

// ── Locomotive ornament ───────────────────────────────────────────────────────

function Locomotive() {
  return (
    <div style={{
      width: 52, height: '100%', minHeight: 120,
      background: '#8B6914',
      borderRadius: '10px 4px 4px 10px',
      border: '3px solid #5C4000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
      padding: '4px 4px 6px',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Chimney */}
      <div style={{
        position: 'absolute', top: -14, left: '50%',
        transform: 'translateX(-50%)',
        width: 10, height: 14,
        background: '#333', borderRadius: '3px 3px 0 0',
      }} />
      {/* Cab window */}
      <div style={{
        width: 30, height: 22,
        background: '#87CEEB',
        borderRadius: 4,
        border: '2px solid #5C4000',
        marginBottom: 4,
      }} />
      {/* Wheels */}
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1].map(w => (
          <div key={w} style={{
            width: 16, height: 16, borderRadius: '50%',
            background: '#555', border: '2px solid #888',
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NumberTrainPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [availableLevels, setAvailableLevels] = useState<LevelData[]>([])
  const [currentLevelData, setCurrentLevelData] = useState<LevelData | null>(null)
  const [problemIndex, setProblemIndex] = useState(0)
  const [carStates, setCarStates] = useState<Array<'idle' | 'correct' | 'wrong'>>(['idle', 'idle', 'idle'])
  const [answered, setAnswered] = useState(false)
  const [showComplete, setShowComplete] = useState(false)

  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/numbertrain.json')
      .then(r => r.json())
      .then(data => setAvailableLevels(data.levels || []))
      .catch(() => setAvailableLevels([]))
  }, [])

  // ── Shell auto-start ───────────────────────────────────────────────────────

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
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
    }
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetProblem = useCallback((idx: number) => {
    setProblemIndex(idx)
    setCarStates(['idle', 'idle', 'idle'])
    setAnswered(false)
  }, [])

  const startLevel = useCallback((ld: LevelData) => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
    setCurrentLevelData(ld)
    setProblemIndex(0)
    setCarStates(['idle', 'idle', 'idle'])
    setAnswered(false)
    setShowComplete(false)
  }, [])

  const handleCarTap = useCallback((carIdx: number) => {
    if (answered || !currentLevelData) return
    const prob = currentLevelData.problems[problemIndex]
    const isCorrect = carIdx === prob.correct

    const newStates: Array<'idle' | 'correct' | 'wrong'> = ['idle', 'idle', 'idle']
    newStates[carIdx] = isCorrect ? 'correct' : 'wrong'
    if (!isCorrect) {
      // Also show which was correct
      newStates[prob.correct] = 'correct'
    }
    setCarStates(newStates)
    setAnswered(true)

    if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
    nextTimerRef.current = setTimeout(() => {
      const nextIdx = problemIndex + 1
      if (nextIdx >= currentLevelData.problems.length) {
        setShowComplete(true)
      } else {
        resetProblem(nextIdx)
      }
    }, isCorrect ? 800 : 1200)
  }, [answered, currentLevelData, problemIndex, resetProblem])

  // ── Level select ───────────────────────────────────────────────────────────

  if (!currentLevelData) {
    const levelColors = [
      '#FF6B6B','#FF8C42','#FFD166','#4ECDC4',
      '#45B7D1','#96CEB4','#6C63FF','#F7A072',
      '#A8DADC','#457B9D',
    ]
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <style>{`
          @keyframes popIn {
            from { transform: scale(0.3); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <BackButton color="#fff" />
        <h1 style={{
          color: '#fff', fontSize: 40, fontWeight: 'bold',
          textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          letterSpacing: 2, margin: 0,
        }}>
          Number Train
        </h1>
        <p style={{ color: '#aac', fontSize: 18, margin: '-12px 0 0' }}>Choose a level</p>
        <div style={{
          display: 'flex', gap: 14, flexWrap: 'wrap',
          justifyContent: 'center', maxWidth: 560, padding: '0 20px',
        }}>
          {availableLevels.map((ld, idx) => (
            <button
              key={ld.level}
              onClick={() => startLevel(ld)}
              style={{
                width: 88, height: 88, borderRadius: 18,
                background: levelColors[idx % levelColors.length],
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
              <span style={{ fontSize: 30 }}>{ld.level}</span>
              <span style={{ fontSize: 11, opacity: 0.85 }}>
                {ld.level <= 3 ? '1-10' : ld.level <= 6 ? '1-20' : '1-50'}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Game screen ────────────────────────────────────────────────────────────

  const prob = currentLevelData.problems[problemIndex]
  const totalProblems = currentLevelData.problems.length

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
      <style>{`
        @keyframes popIn {
          from { transform: scale(0.3); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>

      <BackButton color="#fff" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={problemIndex + 1} max={totalProblems} />

      {/* Progress dots */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        marginTop: 14, zIndex: 20,
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

      {/* Target number */}
      <div style={{
        marginTop: 16,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 4,
      }}>
        <div style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 'clamp(13px, 2.2vw, 17px)',
          fontWeight: 'bold', letterSpacing: 2,
        }}>
          WHICH CAR HAS THIS MANY?
        </div>
        <div style={{
          color: '#FFD166',
          fontSize: 'clamp(64px, 14vw, 110px)',
          fontWeight: 'bold',
          textShadow: '0 4px 20px rgba(255,209,102,0.4)',
          lineHeight: 1,
        }}>
          {prob.target}
        </div>
      </div>

      {/* Train row */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 8,
        marginTop: 'clamp(12px, 3vh, 28px)',
        width: '94%',
        maxWidth: 700,
        flex: 1,
        minHeight: 0,
        paddingBottom: 20,
      }}>
        {/* Locomotive */}
        <Locomotive />

        {/* Track connector bar */}
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
        }}>
          {/* Coupling bar */}
          <div style={{
            position: 'absolute',
            height: 6,
            background: '#555',
            borderRadius: 3,
            left: '5%', right: '3%',
            top: '75%',
            zIndex: 0,
          }} />

          {/* Cars */}
          {(prob.cars as number[]).map((count, i) => (
            <TrainCar
              key={i}
              count={count}
              carIndex={i}
              state={carStates[i]}
              onClick={() => handleCarTap(i)}
              disabled={answered}
            />
          ))}
        </div>
      </div>

      {/* Complete overlay */}
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
            <div style={{ fontSize: 64 }}>🚂</div>
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
                  padding: '12px 28px', borderRadius: 12, background: '#4CAF50',
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
