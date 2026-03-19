import { useState, useEffect, useCallback } from 'react'
import { findClosestLevel } from '../../utils/levelUtils'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedingProblem {
  left: number
  right: number
  ask: 'more' | 'less'
}

interface LevelData {
  level: number
  problems: FeedingProblem[]
}

interface GameData {
  levels: LevelData[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FEEDBACK_DURATION = 900 // ms

const PLATE_COLORS = ['#ff7043', '#ffb300', '#66bb6a', '#42a5f5', '#ab47bc', '#26c6da', '#ec407a', '#8d6e63']

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Render N food circles inside a plate. Caps visual display at 50. */
function FoodPlate({
  count,
  plateColor,
  glow,
  dimmed,
}: {
  count: number
  plateColor: string
  glow: boolean
  dimmed: boolean
}) {
  // We display at most 50 circles; if count > 20 make them smaller
  const display = Math.min(count, 50)
  const size = count <= 10 ? 28 : count <= 20 ? 22 : count <= 35 ? 16 : 12
  const gap = count <= 10 ? 6 : 4

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 12,
      opacity: dimmed ? 0.4 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Plate */}
      <div style={{
        width: 200, height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff8e1, #ffe082)',
        border: `6px solid ${plateColor}`,
        boxShadow: glow
          ? `0 0 0 6px ${plateColor}, 0 8px 32px rgba(0,0,0,0.25)`
          : '0 8px 24px rgba(0,0,0,0.2)',
        display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'center',
        gap, padding: 16,
        boxSizing: 'border-box',
        transition: 'box-shadow 0.2s',
        overflow: 'hidden',
      }}>
        {Array.from({ length: display }).map((_, i) => (
          <div key={i} style={{
            width: size, height: size,
            borderRadius: '50%',
            background: PLATE_COLORS[i % PLATE_COLORS.length],
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }} />
        ))}
      </div>
      {/* Count label */}
      <div style={{
        background: plateColor,
        color: '#fff', fontWeight: 'bold',
        fontSize: 28, borderRadius: 12,
        padding: '4px 18px',
        boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
      }}>
        {count}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FeedingTimePage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [currentLevelData, setCurrentLevelData] = useState<LevelData | null>(null)
  const [problemIndex, setProblemIndex] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | null>(null)

  // ── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/feedingtime.json')
      .then(r => r.json())
      .then((data: GameData) => setGameData(data))
      .catch(() => setGameData(null))
  }, [])

  // ── Auto-start from shell ────────────────────────────────────────────────

  useEffect(() => {
    if (shellLevel && gameData && !currentLevelData) {
      const ld = findClosestLevel(gameData.levels, shellLevel) ?? gameData.levels[0]
      startLevel(ld)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellLevel, gameData])

  // ── Shell complete ───────────────────────────────────────────────────────

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // ── Game helpers ─────────────────────────────────────────────────────────

  const startLevel = useCallback((ld: LevelData) => {
    setCurrentLevelData(ld)
    setProblemIndex(0)
    setFeedback(null)
    setSelectedSide(null)
    setShowComplete(false)
  }, [])

  const handleAnswer = useCallback((side: 'left' | 'right') => {
    if (feedback !== null || !currentLevelData) return
    const prob = currentLevelData.problems[problemIndex]

    setSelectedSide(side)

    // Determine correct answer
    const correctSide: 'left' | 'right' = prob.ask === 'more'
      ? (prob.left > prob.right ? 'left' : 'right')
      : (prob.left < prob.right ? 'left' : 'right')

    const isCorrect = side === correctSide
    setFeedback(isCorrect ? 'correct' : 'wrong')

    setTimeout(() => {
      const nextIndex = problemIndex + 1
      if (nextIndex >= currentLevelData.problems.length) {
        setShowComplete(true)
      } else {
        setProblemIndex(nextIndex)
        setFeedback(null)
        setSelectedSide(null)
      }
    }, FEEDBACK_DURATION)
  }, [feedback, currentLevelData, problemIndex])

  // ── Loading ──────────────────────────────────────────────────────────────

  if (!gameData) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#2e7d32', fontSize: 24, fontWeight: 'bold',
      }}>
        Loading...
      </div>
    )
  }

  // ── Level-select screen ──────────────────────────────────────────────────

  if (!currentLevelData) {
    const tileColors = ['#ef5350','#ffa726','#ffee58','#66bb6a','#26c6da','#42a5f5','#7e57c2','#ec407a']
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <BackButton color="#2e7d32" />
        <div style={{ fontSize: 64 }}>🍽️</div>
        <h1 style={{
          color: '#2e7d32', fontSize: 38, fontWeight: 'bold',
          textShadow: '1px 1px 4px rgba(0,0,0,0.1)',
          margin: 0,
        }}>
          Feeding Time
        </h1>
        <p style={{ color: '#388e3c', fontSize: 18, margin: 0 }}>
          Which plate has more? Choose a level!
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
          {gameData.levels.map((ld, idx) => (
            <button
              key={ld.level}
              onClick={() => startLevel(ld)}
              style={{
                width: 88, height: 88, borderRadius: 18,
                background: tileColors[idx % tileColors.length],
                color: '#fff', fontSize: 28, fontWeight: 'bold',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                transition: 'transform 0.1s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {ld.level}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Game screen ──────────────────────────────────────────────────────────

  const prob = currentLevelData.problems[problemIndex]
  const totalProblems = currentLevelData.problems.length

  const correctSide: 'left' | 'right' = prob.ask === 'more'
    ? (prob.left > prob.right ? 'left' : 'right')
    : (prob.left < prob.right ? 'left' : 'right')

  const promptEmoji = prob.ask === 'more' ? '🍽️' : '🐣'
  const promptWord = prob.ask === 'more' ? 'MORE' : 'LESS'
  const promptColor = prob.ask === 'more' ? '#e53935' : '#1e88e5'

  // Feedback overlay
  const overlayBg = feedback === 'correct'
    ? 'rgba(76,175,80,0.3)'
    : feedback === 'wrong'
      ? 'rgba(244,67,54,0.3)'
      : 'transparent'

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      userSelect: 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Feedback overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: overlayBg,
        pointerEvents: 'none',
        transition: 'background 0.15s',
        zIndex: 10,
      }} />

      <BackButton color="#2e7d32" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={problemIndex + 1} max={totalProblems} />

      {/* Prompt */}
      <div style={{
        marginTop: 56, zIndex: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{ fontSize: 40 }}>{promptEmoji}</div>
        <div style={{
          fontSize: 32, fontWeight: 'bold',
          color: '#fff',
          background: promptColor,
          borderRadius: 16, padding: '8px 28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          letterSpacing: 2,
        }}>
          Which has {promptWord}?
        </div>
      </div>

      {/* Plates */}
      <div style={{
        display: 'flex', gap: 40,
        alignItems: 'center', justifyContent: 'center',
        flex: 1, zIndex: 20,
        flexWrap: 'wrap',
        padding: '0 24px',
      }}>
        <FoodPlate
          count={prob.left}
          plateColor="#ff7043"
          glow={feedback !== null && 'left' === correctSide}
          dimmed={feedback !== null && selectedSide === 'left' && feedback === 'wrong'}
        />
        <div style={{
          fontSize: 40, fontWeight: 'bold',
          color: '#795548',
          textShadow: '1px 1px 4px rgba(0,0,0,0.15)',
        }}>
          VS
        </div>
        <FoodPlate
          count={prob.right}
          plateColor="#42a5f5"
          glow={feedback !== null && 'right' === correctSide}
          dimmed={feedback !== null && selectedSide === 'right' && feedback === 'wrong'}
        />
      </div>

      {/* Answer buttons */}
      <div style={{
        display: 'flex', gap: 24, marginBottom: 40,
        zIndex: 20,
      }}>
        <button
          onClick={() => handleAnswer('left')}
          disabled={feedback !== null}
          style={{
            padding: '16px 44px', borderRadius: 20,
            background: selectedSide === 'left' && feedback === 'correct'
              ? '#4caf50'
              : selectedSide === 'left' && feedback === 'wrong'
                ? '#f44336'
                : '#ff7043',
            color: '#fff', fontSize: 24, fontWeight: 'bold',
            border: 'none', cursor: feedback !== null ? 'default' : 'pointer',
            boxShadow: '0 6px 0 rgba(0,0,0,0.2), 0 2px 12px rgba(0,0,0,0.15)',
            transition: 'background 0.2s, transform 0.08s',
          }}
          onMouseDown={e => { if (feedback === null) e.currentTarget.style.transform = 'translateY(3px)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          LEFT 🍎
        </button>
        <button
          onClick={() => handleAnswer('right')}
          disabled={feedback !== null}
          style={{
            padding: '16px 44px', borderRadius: 20,
            background: selectedSide === 'right' && feedback === 'correct'
              ? '#4caf50'
              : selectedSide === 'right' && feedback === 'wrong'
                ? '#f44336'
                : '#42a5f5',
            color: '#fff', fontSize: 24, fontWeight: 'bold',
            border: 'none', cursor: feedback !== null ? 'default' : 'pointer',
            boxShadow: '0 6px 0 rgba(0,0,0,0.2), 0 2px 12px rgba(0,0,0,0.15)',
            transition: 'background 0.2s, transform 0.08s',
          }}
          onMouseDown={e => { if (feedback === null) e.currentTarget.style.transform = 'translateY(3px)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
        >
          RIGHT 🍎
        </button>
      </div>

      {/* Feedback icon */}
      {feedback !== null && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 96, zIndex: 30,
          filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.3))',
          pointerEvents: 'none',
        }}>
          {feedback === 'correct' ? '⭐' : '❌'}
        </div>
      )}

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 100, gap: 20,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
            borderRadius: 24, padding: '40px 48px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 72 }}>🎉</div>
            <div style={{
              color: '#2e7d32', fontSize: 42, fontWeight: 'bold',
              textShadow: '1px 1px 4px rgba(0,0,0,0.15)',
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
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
