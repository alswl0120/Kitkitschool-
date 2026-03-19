import { findClosestDictLevel } from '../../utils/levelUtils'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

interface Problem {
  word: string
  correctEmoji: string
  choices: string[]
}

interface LevelData {
  [level: string]: Problem[]
}

// ── Bird mascot component ─────────────────────────────────────────────────────

function Bird({ state }: { state: 'idle' | 'celebrate' | 'shake' }) {
  const style: React.CSSProperties = {
    fontSize: 64,
    display: 'inline-block',
    transition: 'transform 0.15s',
    transform:
      state === 'celebrate' ? 'scale(1.3) rotate(-10deg)' :
      state === 'shake'     ? 'translateX(6px)' :
      'scale(1)',
    filter:
      state === 'celebrate' ? 'drop-shadow(0 0 12px #FFD700)' :
      state === 'shake'     ? 'drop-shadow(0 0 8px #FF5252)' :
      'none',
  }
  return <span style={style} role="img" aria-label="bird">🐦</span>
}

// ── Choice button ─────────────────────────────────────────────────────────────

function ChoiceButton({
  emoji,
  status,
  onClick,
}: {
  emoji: string
  status: 'idle' | 'correct' | 'wrong'
  onClick: () => void
}) {
  const bg =
    status === 'correct' ? 'linear-gradient(135deg, #A5D6A7, #4CAF50)' :
    status === 'wrong'   ? 'linear-gradient(135deg, #FFCDD2, #EF9A9A)' :
    'linear-gradient(135deg, #ffffff, #E3F2FD)'

  const border =
    status === 'correct' ? '3px solid #2E7D32' :
    status === 'wrong'   ? '3px solid #C62828' :
    '3px solid #90CAF9'

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', aspectRatio: '1',
        background: bg,
        border,
        borderRadius: 20,
        fontSize: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: status === 'idle' ? 'pointer' : 'default',
        boxShadow: status === 'correct'
          ? '0 0 20px rgba(76,175,80,0.5)'
          : status === 'wrong'
          ? '0 0 12px rgba(239,83,80,0.3)'
          : '0 4px 12px rgba(0,0,0,0.1)',
        transition: 'transform 0.1s, box-shadow 0.1s',
        transform: status === 'correct' ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      {emoji}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReadingBirdPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [problemIndex, setProblemIndex] = useState(0)
  const [choiceStatuses, setChoiceStatuses] = useState<('idle' | 'correct' | 'wrong')[]>([])
  const [birdState, setBirdState] = useState<'idle' | 'celebrate' | 'shake'>('idle')
  const [showComplete, setShowComplete] = useState(false)
  const [wordsRead, setWordsRead] = useState(0)
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load levels list
  useEffect(() => {
    fetch('/data/games/readingbird.json')
      .then(r => r.json())
      .then((data: { levels: LevelData }) => {
        const lvls = Object.keys(data.levels).map(Number).sort((a, b) => a - b)
        setAvailableLevels(lvls.length > 0 ? lvls : Array.from({ length: 10 }, (_, i) => i + 1))
      })
      .catch(() => setAvailableLevels(Array.from({ length: 10 }, (_, i) => i + 1)))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    fetch('/data/games/readingbird.json')
      .then(r => r.json())
      .then((data: { levels: LevelData }) => {
        const ps: Problem[] = findClosestDictLevel(data.levels, lvl) ?? []
        setProblems(ps)
        setLevel(lvl)
        setProblemIndex(0)
        setChoiceStatuses(new Array(ps[0]?.choices.length ?? 4).fill('idle'))
        setBirdState('idle')
        setShowComplete(false)
        setWordsRead(0)
      })
      .catch(() => {
        setLevel(lvl)
        setProblemIndex(0)
        setChoiceStatuses([])
        setBirdState('idle')
        setShowComplete(false)
        setWordsRead(0)
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

  const currentProblem = problems[problemIndex]

  // Reset statuses when problem changes
  useEffect(() => {
    if (currentProblem) {
      setChoiceStatuses(new Array(currentProblem.choices.length).fill('idle'))
      setBirdState('idle')
    }
  }, [problemIndex, currentProblem])

  const handleChoice = useCallback((emoji: string, idx: number) => {
    if (!currentProblem) return
    // Ignore clicks after a correct answer
    if (choiceStatuses.some(s => s === 'correct')) return
    if (choiceStatuses[idx] === 'wrong') return

    if (emoji === currentProblem.correctEmoji) {
      // Correct
      const next = [...choiceStatuses]
      next[idx] = 'correct'
      setChoiceStatuses(next)
      setBirdState('celebrate')
      setWordsRead(w => w + 1)

      // Move to next after a short delay
      setTimeout(() => {
        const nextIdx = problemIndex + 1
        if (nextIdx >= problems.length) {
          setShowComplete(true)
        } else {
          setProblemIndex(nextIdx)
        }
      }, 900)
    } else {
      // Wrong
      const next = [...choiceStatuses]
      next[idx] = 'wrong'
      setChoiceStatuses(next)
      setBirdState('shake')

      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => {
        setBirdState('idle')
      }, 500)
    }
  }, [currentProblem, choiceStatuses, problemIndex, problems.length])

  // ── Level select ────────────────────────────────────────────────────────────
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(160deg, #87CEEB 0%, #E0F7FA 60%, #B3E5FC 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
        overflow: 'auto',
      }}>
        <BackButton color="#01579B" />
        <div style={{ fontSize: 72 }}>🐦</div>
        <h1 style={{
          color: '#01579B', fontSize: 36, fontWeight: 'bold',
          textShadow: '1px 1px 0 rgba(255,255,255,0.8)', margin: 0,
        }}>
          Reading Bird
        </h1>
        <p style={{ color: '#0277BD', fontSize: 18, margin: 0 }}>
          Read the word and find the picture!
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
          {availableLevels.map(lvl => (
            <button key={lvl} onClick={() => startLevel(lvl)} style={{
              width: 72, height: 72, borderRadius: 14,
              background: 'linear-gradient(135deg, #0288D1, #01579B)',
              color: '#fff', fontSize: 22, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
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

  // ── Level complete ──────────────────────────────────────────────────────────
  if (showComplete) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(160deg, #87CEEB 0%, #E0F7FA 60%, #B3E5FC 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <div style={{ fontSize: 80 }}>🐦</div>
        <div style={{
          color: '#01579B', fontSize: 48, fontWeight: 'bold',
          textShadow: '1px 1px 0 rgba(255,255,255,0.8)',
        }}>
          Wonderful!
        </div>
        <div style={{
          color: '#0277BD', fontSize: 24,
          background: 'rgba(255,255,255,0.7)',
          borderRadius: 12, padding: '8px 24px',
        }}>
          You read <strong>{wordsRead}</strong> word{wordsRead !== 1 ? 's' : ''}!
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => startLevel(level)} style={{
            padding: '12px 32px', borderRadius: 12, background: '#4CAF50',
            color: '#fff', fontSize: 20, fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer',
          }}>Play Again</button>
          <button onClick={() => { setLevel(0); setShowComplete(false) }} style={{
            padding: '12px 32px', borderRadius: 12, background: '#0288D1',
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
  if (!currentProblem) return null

  const progress = { current: problemIndex + 1, max: problems.length }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #87CEEB 0%, #E0F7FA 60%, #B3E5FC 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <BackButton color="#01579B" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Bird + Word display */}
      <div style={{
        marginTop: 64,
        display: 'flex', flexDirection: 'row',
        alignItems: 'center', gap: 20,
      }}>
        <Bird state={birdState} />
        <div style={{
          background: 'rgba(255,255,255,0.85)',
          borderRadius: 20,
          padding: '12px 32px',
          boxShadow: '0 4px 16px rgba(1,87,155,0.15)',
          border: '3px solid #90CAF9',
        }}>
          <span style={{
            fontSize: 52, fontWeight: 'bold',
            color: '#01579B',
            letterSpacing: 2,
            textShadow: '1px 1px 0 rgba(255,255,255,0.5)',
          }}>
            {currentProblem.word}
          </span>
        </div>
      </div>

      {/* Instruction */}
      <div style={{
        marginTop: 16,
        color: '#0277BD', fontSize: 18,
        background: 'rgba(255,255,255,0.6)',
        borderRadius: 10, padding: '4px 16px',
      }}>
        Find the picture for this word!
      </div>

      {/* 2x2 emoji grid */}
      <div style={{
        marginTop: 24,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        width: '100%', maxWidth: 420,
        padding: '0 24px',
        flex: 1,
        maxHeight: 380,
      }}>
        {currentProblem.choices.map((emoji, idx) => (
          <ChoiceButton
            key={`${problemIndex}-${idx}`}
            emoji={emoji}
            status={choiceStatuses[idx] ?? 'idle'}
            onClick={() => handleChoice(emoji, idx)}
          />
        ))}
      </div>

      {/* Decorative clouds */}
      <div style={{
        position: 'absolute', bottom: 24, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-around',
        fontSize: 32, opacity: 0.4, pointerEvents: 'none',
      }}>
        <span>☁️</span><span>☁️</span><span>☁️</span>
      </div>
    </div>
  )
}
