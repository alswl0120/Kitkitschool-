import { useState, useEffect, useRef, useCallback } from 'react'
import { findClosestLevel } from '../../utils/levelUtils'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Problem {
  first: number
  second: number
  answer: number
  choices: number[]
}

interface LevelData {
  level: number
  operation: string
  problems: Problem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMER_DURATION = 5000 // ms per problem
const MAX_COMBO = 5
const FEEDBACK_DURATION = 700 // ms to show green/red flash

const TILE_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#00bcd4',
]

const OPERATION_SYMBOL: Record<string, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FlameIcon({ lit }: { lit: boolean }) {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" fill="none" style={{ opacity: lit ? 1 : 0.25, transition: 'opacity 0.2s' }}>
      <path
        d="M14 2 C14 2 20 8 20 14 C20 18 18 20 14 22 C10 20 8 18 8 14 C8 8 14 2 14 2Z"
        fill={lit ? '#ff9800' : '#888'}
      />
      <path
        d="M14 14 C14 14 18 18 18 22 C18 26 16 30 14 34 C12 30 10 26 10 22 C10 18 14 14 14 14Z"
        fill={lit ? '#ff5722' : '#666'}
      />
      <ellipse cx="14" cy="28" rx="4" ry="3" fill={lit ? '#ffeb3b' : '#555'} />
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function QuickFactsPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  // Level-select state
  const [availableLevels, setAvailableLevels] = useState<LevelData[]>([])
  const [currentLevelData, setCurrentLevelData] = useState<LevelData | null>(null)

  // Game state
  const [problemIndex, setProblemIndex] = useState(0)
  const [shuffledChoices, setShuffledChoices] = useState<number[]>([])
  const [combo, setCombo] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [showComplete, setShowComplete] = useState(false)

  // Timer state – we drive it with requestAnimationFrame via a ref
  const [timerFraction, setTimerFraction] = useState(1) // 1 = full, 0 = empty
  const timerStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerActiveRef = useRef(false)

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/quickfacts.json')
      .then(r => r.json())
      .then(data => setAvailableLevels(data.levels || []))
      .catch(() => setAvailableLevels([]))
  }, [])

  // ── Auto-start from shell ──────────────────────────────────────────────────

  useEffect(() => {
    if (shellLevel && availableLevels.length > 0 && !currentLevelData) {
      const ld = findClosestLevel(availableLevels, shellLevel) ?? availableLevels[0]
      startLevel(ld)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellLevel, availableLevels])

  // ── Timer RAF loop ─────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    timerActiveRef.current = false
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerActiveRef.current = true
    timerStartRef.current = null
    setTimerFraction(1)

    function tick(ts: number) {
      if (!timerActiveRef.current) return
      if (timerStartRef.current === null) timerStartRef.current = ts
      const elapsed = ts - timerStartRef.current
      const frac = Math.max(0, 1 - elapsed / TIMER_DURATION)
      setTimerFraction(frac)
      if (frac > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Time's up → treat as wrong
        timerActiveRef.current = false
        handleWrong()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer])

  // ── Game logic helpers ─────────────────────────────────────────────────────

  const advanceProblem = useCallback((nextIndex: number, levelData: LevelData) => {
    if (nextIndex >= levelData.problems.length) {
      setShowComplete(true)
      return
    }
    const prob = levelData.problems[nextIndex]
    setProblemIndex(nextIndex)
    setShuffledChoices(shuffle(prob.choices))
    setFeedback(null)
    startTimer()
  }, [startTimer])

  // We store a ref to the current level+problem index so callbacks can read them
  const levelDataRef = useRef<LevelData | null>(null)
  const problemIndexRef = useRef(0)
  levelDataRef.current = currentLevelData
  problemIndexRef.current = problemIndex

  const handleWrong = useCallback(() => {
    stopTimer()
    setCombo(0)
    setFeedback('wrong')
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
    feedbackTimeoutRef.current = setTimeout(() => {
      const ld = levelDataRef.current
      if (!ld) return
      advanceProblem(problemIndexRef.current + 1, ld)
    }, FEEDBACK_DURATION)
  }, [stopTimer, advanceProblem])

  const handleChoice = useCallback((choice: number) => {
    if (feedback !== null) return // already answered / in transition
    const ld = levelDataRef.current
    if (!ld) return
    const prob = ld.problems[problemIndexRef.current]

    stopTimer()

    if (choice === prob.answer) {
      setCombo(c => Math.min(c + 1, MAX_COMBO))
      setFeedback('correct')
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => {
        advanceProblem(problemIndexRef.current + 1, ld)
      }, FEEDBACK_DURATION)
    } else {
      handleWrong()
    }
  }, [feedback, stopTimer, advanceProblem, handleWrong])

  // ── Start level ────────────────────────────────────────────────────────────

  const startLevel = useCallback((ld: LevelData) => {
    stopTimer()
    setCurrentLevelData(ld)
    setProblemIndex(0)
    setCombo(0)
    setFeedback(null)
    setShowComplete(false)
    levelDataRef.current = ld
    problemIndexRef.current = 0
    const prob = ld.problems[0]
    setShuffledChoices(shuffle(prob.choices))
    // Slight delay so state flushes before timer fires
    setTimeout(() => startTimer(), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimer, startTimer])

  // ── Shell complete ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer()
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
    }
  }, [stopTimer])

  // ── Derived display values ─────────────────────────────────────────────────

  const problem = currentLevelData?.problems[problemIndex] ?? null
  const opSymbol = currentLevelData ? (OPERATION_SYMBOL[currentLevelData.operation] ?? currentLevelData.operation) : ''
  const totalProblems = currentLevelData?.problems.length ?? 1

  // Timer bar color interpolation: green → yellow → red
  const timerColor = timerFraction > 0.5
    ? `hsl(${Math.round(timerFraction * 2 * 120)}, 90%, 50%)`
    : `hsl(${Math.round(timerFraction * 2 * 120)}, 90%, 50%)`

  // Feedback overlay color
  const feedbackBg = feedback === 'correct'
    ? 'rgba(76,175,80,0.35)'
    : feedback === 'wrong'
      ? 'rgba(244,67,54,0.35)'
      : 'transparent'

  // ── Level-select screen ────────────────────────────────────────────────────

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
          Quick Facts
        </h1>
        <p style={{ color: '#aac', fontSize: 18, marginTop: -12 }}>Choose a level</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
          {availableLevels.map((ld, idx) => {
            const colors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6']
            const opLabel = OPERATION_SYMBOL[ld.operation] ?? ld.operation
            return (
              <button
                key={ld.level}
                onClick={() => startLevel(ld)}
                style={{
                  width: 88, height: 88, borderRadius: 18,
                  background: colors[idx % colors.length],
                  color: '#fff', fontWeight: 'bold',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  border: 'none', cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span style={{ fontSize: 28 }}>{ld.level}</span>
                <span style={{ fontSize: 20 }}>{opLabel}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Game screen ────────────────────────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      userSelect: 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Feedback overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: feedbackBg,
        pointerEvents: 'none',
        transition: 'background 0.15s',
        zIndex: 10,
      }} />

      <BackButton color="#fff" onClick={isFromShell ? shellBack : undefined} />

      {/* ── Top area: progress dots ── */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        marginTop: 16, marginBottom: 0,
        zIndex: 20,
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

      {/* ── Combo flames ── */}
      <div style={{
        display: 'flex', gap: 4, alignItems: 'center',
        marginTop: 10, zIndex: 20,
      }}>
        {Array.from({ length: MAX_COMBO }).map((_, i) => (
          <FlameIcon key={i} lit={i < combo} />
        ))}
      </div>

      {/* ── Equation display ── */}
      <div style={{
        color: '#fff',
        fontSize: 'clamp(48px, 10vw, 96px)',
        fontWeight: 'bold',
        letterSpacing: 8,
        textShadow: '0 4px 16px rgba(0,0,0,0.6)',
        marginTop: 12,
        zIndex: 20,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {problem ? `${problem.first} ${opSymbol} ${problem.second} = ?` : ''}
      </div>

      {/* ── Timer bar ── */}
      <div style={{
        width: '80%', maxWidth: 480,
        height: 16, borderRadius: 8,
        background: 'rgba(255,255,255,0.15)',
        marginTop: 16,
        overflow: 'hidden',
        zIndex: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          height: '100%',
          width: `${timerFraction * 100}%`,
          background: timerColor,
          borderRadius: 8,
          transition: 'background 0.3s',
        }} />
      </div>

      {/* ── Answer tiles ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        marginTop: 28,
        width: '88%',
        maxWidth: 520,
        zIndex: 20,
      }}>
        {shuffledChoices.map((choice, idx) => {
          const isAnswer = problem && choice === problem.answer
          const tileColor = TILE_COLORS[idx % TILE_COLORS.length]
          const isFlashCorrect = feedback === 'correct' && isAnswer
          const isFlashWrong = feedback === 'wrong' && isAnswer

          return (
            <button
              key={`${choice}-${idx}`}
              onClick={() => handleChoice(choice)}
              disabled={feedback !== null}
              style={{
                height: 'clamp(64px, 12vw, 88px)',
                borderRadius: 16,
                background: isFlashCorrect
                  ? '#4caf50'
                  : isFlashWrong
                    ? '#f44336'
                    : tileColor,
                color: '#fff',
                fontSize: 'clamp(24px, 5vw, 40px)',
                fontWeight: 'bold',
                border: 'none',
                cursor: feedback !== null ? 'default' : 'pointer',
                boxShadow: '0 6px 0 rgba(0,0,0,0.3), 0 2px 12px rgba(0,0,0,0.25)',
                transform: 'translateY(0)',
                transition: 'transform 0.08s, background 0.15s, box-shadow 0.08s',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
              onMouseDown={e => {
                if (feedback !== null) return
                e.currentTarget.style.transform = 'translateY(4px)'
                e.currentTarget.style.boxShadow = '0 2px 0 rgba(0,0,0,0.3), 0 1px 6px rgba(0,0,0,0.25)'
              }}
              onMouseUp={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 6px 0 rgba(0,0,0,0.3), 0 2px 12px rgba(0,0,0,0.25)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 6px 0 rgba(0,0,0,0.3), 0 2px 12px rgba(0,0,0,0.25)'
              }}
            >
              {choice}
            </button>
          )
        })}
      </div>

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
            <div style={{ display: 'flex', gap: 2 }}>
              {Array.from({ length: MAX_COMBO }).map((_, i) => (
                <FlameIcon key={i} lit={i < combo} />
              ))}
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
