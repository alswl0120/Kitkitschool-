import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../components/BackButton'
import ProgressBar from '../../components/ProgressBar'
import { useShellParams } from '../../hooks/useShellParams'

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuestionData {
  emoji: string
  count: number
  answer: number
}

interface LevelData {
  levelIndex: number
  questions: QuestionData[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CORRECT_DELAY_MS = 1000
const WRONG_FLASH_MS = 500

// Positions for scattered emoji objects (as percentage offsets within the display area)
const SCATTER_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '8%',  left: '12%' },
  { top: '6%',  left: '55%' },
  { top: '18%', left: '32%' },
  { top: '22%', left: '74%' },
  { top: '38%', left: '8%'  },
  { top: '35%', left: '50%' },
  { top: '48%', left: '28%' },
  { top: '52%', left: '70%' },
  { top: '62%', left: '15%' },
  { top: '60%', left: '42%' },
  { top: '72%', left: '60%' },
  { top: '76%', left: '22%' },
  { top: '14%', left: '85%' },
  { top: '44%', left: '88%' },
  { top: '68%', left: '82%' },
  { top: '82%', left: '48%' },
  { top: '86%', left: '72%' },
  { top: '88%', left: '10%' },
  { top: '2%',  left: '40%' },
  { top: '30%', left: '90%' },
]

// ── Keypad Button ──────────────────────────────────────────────────────────────

interface KeypadButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  color?: string
  wide?: boolean
}

function KeypadButton({ label, onClick, disabled = false, color = '#2e7d32', wide = false }: KeypadButtonProps) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onPointerDown={() => { if (!disabled) setPressed(true) }}
      onPointerUp={() => { setPressed(false); if (!disabled) onClick() }}
      onPointerLeave={() => setPressed(false)}
      disabled={disabled}
      style={{
        width: wide ? '100%' : 'clamp(52px, 13vw, 80px)',
        height: 'clamp(52px, 13vw, 80px)',
        borderRadius: 16,
        background: disabled
          ? 'rgba(180,180,180,0.3)'
          : pressed
            ? color
            : `${color}cc`,
        color: '#fff',
        fontSize: 'clamp(22px, 5vw, 34px)',
        fontWeight: 'bold',
        border: `3px solid ${disabled ? 'rgba(255,255,255,0.1)' : color}`,
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: pressed
          ? 'inset 0 3px 6px rgba(0,0,0,0.35)'
          : '0 5px 0 rgba(0,0,0,0.3)',
        transform: pressed ? 'translateY(4px)' : 'translateY(0)',
        transition: 'transform 0.07s, box-shadow 0.07s',
        userSelect: 'none',
        opacity: disabled ? 0.45 : 1,
        letterSpacing: 1,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gridColumn: wide ? '1 / -1' : undefined,
      }}
    >
      {label}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function KeypadPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  // Data
  const [allLevels, setAllLevels] = useState<LevelData[]>([])
  const [currentLevel, setCurrentLevel] = useState<LevelData | null>(null)

  // Game state
  const [questionIndex, setQuestionIndex] = useState(0)
  const [typedDigits, setTypedDigits] = useState('')
  const [displayState, setDisplayState] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [showComplete, setShowComplete] = useState(false)
  const [inputLocked, setInputLocked] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/keypad.json')
      .then(r => r.json())
      .then(data => setAllLevels(data.levels || []))
      .catch(() => setAllLevels([]))
  }, [])

  // ── Auto-start from shell ────────────────────────────────────────────────────

  useEffect(() => {
    if (shellLevel !== null && allLevels.length > 0 && !currentLevel) {
      const ld = allLevels.find(l => l.levelIndex === shellLevel) ?? allLevels[0]
      startLevel(ld)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellLevel, allLevels])

  // ── Shell complete ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const startLevel = useCallback((ld: LevelData) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setCurrentLevel(ld)
    setQuestionIndex(0)
    setTypedDigits('')
    setDisplayState('idle')
    setShowComplete(false)
    setInputLocked(false)
  }, [])

  function loadQuestion(idx: number) {
    setQuestionIndex(idx)
    setTypedDigits('')
    setDisplayState('idle')
    setInputLocked(false)
  }

  function handleDigit(digit: string) {
    if (inputLocked || !currentLevel) return
    const q = currentLevel.questions[questionIndex]
    const maxDigits = String(q.answer).length
    if (typedDigits.length >= maxDigits) return
    const next = typedDigits + digit

    // Auto-submit when enough digits typed
    if (next.length === maxDigits) {
      setTypedDigits(next)
      setInputLocked(true)
      if (timerRef.current) clearTimeout(timerRef.current)

      if (parseInt(next, 10) === q.answer) {
        setDisplayState('correct')
        timerRef.current = setTimeout(() => {
          const nextIdx = questionIndex + 1
          if (nextIdx >= currentLevel.questions.length) {
            setShowComplete(true)
          } else {
            loadQuestion(nextIdx)
          }
        }, CORRECT_DELAY_MS)
      } else {
        setDisplayState('wrong')
        timerRef.current = setTimeout(() => {
          setTypedDigits('')
          setDisplayState('idle')
          setInputLocked(false)
        }, WRONG_FLASH_MS)
      }
    } else {
      setTypedDigits(next)
    }
  }

  function handleBackspace() {
    if (inputLocked) return
    setTypedDigits(d => d.slice(0, -1))
  }

  // ── Level select screen ──────────────────────────────────────────────────────

  if (!currentLevel) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #0a2e0a 0%, #1b5e20 60%, #2e7d32 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        userSelect: 'none',
      }}>
        <BackButton color="#a5d6a7" onClick={isFromShell ? shellBack : undefined} />
        <div style={{ fontSize: 56 }}>🔢</div>
        <h1 style={{
          color: '#fff', fontSize: 'clamp(28px, 7vw, 44px)',
          fontWeight: 'bold', margin: 0,
          textShadow: '2px 2px 10px rgba(0,0,0,0.5)',
        }}>
          Keypad Count
        </h1>
        <p style={{ color: '#a5d6a7', fontSize: 18, margin: 0 }}>Choose a level</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {allLevels.map((ld) => {
            const labels = ['1–9', '10–20', '11–99']
            const icons = ['🔢', '🔟', '💯']
            return (
              <button
                key={ld.levelIndex}
                onClick={() => startLevel(ld)}
                style={{
                  width: 110, height: 110, borderRadius: 20,
                  background: 'rgba(255,255,255,0.12)',
                  border: '3px solid rgba(165,214,167,0.5)',
                  color: '#fff', fontWeight: 'bold',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
                  transition: 'transform 0.1s, background 0.15s',
                  fontSize: 16,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span style={{ fontSize: 32 }}>{icons[ld.levelIndex]}</span>
                <span>Level {ld.levelIndex + 1}</span>
                <span style={{ fontSize: 13, opacity: 0.75 }}>{labels[ld.levelIndex]}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Game screen ───────────────────────────────────────────────────────────────

  const q = currentLevel.questions[questionIndex]
  const totalQuestions = currentLevel.questions.length
  const maxDigits = String(q.answer).length

  const displayBg = displayState === 'correct'
    ? 'linear-gradient(135deg, #1b5e20, #2e7d32)'
    : displayState === 'wrong'
      ? 'linear-gradient(135deg, #b71c1c, #c62828)'
      : 'rgba(0,0,0,0.35)'

  const displayBorder = displayState === 'correct'
    ? '3px solid #69f0ae'
    : displayState === 'wrong'
      ? '3px solid #ff5252'
      : '3px solid rgba(255,255,255,0.25)'

  const placeholderDashes = '_'.repeat(maxDigits)
  const displayText = typedDigits.padEnd(maxDigits, '_')

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #0a2e0a 0%, #1b5e20 55%, #388e3c 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      userSelect: 'none',
      position: 'relative',
    }}>
      {/* Keyframe animations */}
      <style>{`
        @keyframes kp-pop {
          0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
          70%  { transform: scale(1.15) rotate(5deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes kp-correct-pulse {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes kp-shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-10px); }
          40%     { transform: translateX(10px); }
          60%     { transform: translateX(-8px); }
          80%     { transform: translateX(8px); }
        }
        @keyframes kp-celebrate {
          0%   { opacity: 0; transform: scale(0.4) rotate(-20deg); }
          60%  { opacity: 1; transform: scale(1.1) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes kp-star-float {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(0.3); opacity: 0; }
        }
      `}</style>

      <BackButton color="#a5d6a7" onClick={isFromShell ? shellBack : undefined} />

      {/* Progress bar */}
      <ProgressBar current={questionIndex + 1} max={totalQuestions} />

      {/* Header label */}
      <div style={{
        marginTop: 'clamp(36px, 8vw, 56px)',
        color: '#a5d6a7',
        fontSize: 'clamp(14px, 3vw, 20px)',
        fontWeight: 'bold',
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}>
        How many {q.emoji}s?
      </div>

      {/* Object display area */}
      <div style={{
        position: 'relative',
        width: '90%',
        maxWidth: 520,
        height: 'clamp(140px, 30vw, 220px)',
        marginTop: 8,
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 20,
        border: '2px solid rgba(255,255,255,0.12)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {Array.from({ length: Math.min(q.count, SCATTER_POSITIONS.length) }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: SCATTER_POSITIONS[i].top,
              left: SCATTER_POSITIONS[i].left,
              fontSize: 'clamp(22px, 5vw, 34px)',
              lineHeight: 1,
              animation: `kp-pop 0.3s ease-out ${i * 60}ms both`,
              userSelect: 'none',
            }}
          >
            {q.emoji}
          </div>
        ))}
        {q.count > SCATTER_POSITIONS.length && (
          <div style={{
            position: 'absolute', bottom: 8, right: 12,
            color: '#a5d6a7', fontSize: 13, fontWeight: 'bold',
          }}>
            +{q.count - SCATTER_POSITIONS.length} more
          </div>
        )}
      </div>

      {/* Answer display box */}
      <div style={{
        marginTop: 10,
        width: 'clamp(100px, 28vw, 180px)',
        height: 'clamp(54px, 12vw, 80px)',
        borderRadius: 16,
        background: displayBg,
        border: displayBorder,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: displayState === 'correct'
          ? '0 0 24px rgba(105,240,174,0.5)'
          : displayState === 'wrong'
            ? '0 0 24px rgba(255,82,82,0.5)'
            : '0 4px 14px rgba(0,0,0,0.4)',
        transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
        animation: displayState === 'correct'
          ? 'kp-correct-pulse 0.4s ease-out'
          : displayState === 'wrong'
            ? 'kp-shake 0.4s ease-out'
            : 'none',
        flexShrink: 0,
      }}>
        <span style={{
          color: displayState === 'idle' ? 'rgba(255,255,255,0.7)' : '#fff',
          fontSize: 'clamp(28px, 7vw, 48px)',
          fontWeight: 'bold',
          letterSpacing: 8,
          fontFamily: 'monospace',
        }}>
          {typedDigits.length === 0 ? placeholderDashes : displayText}
        </span>

        {displayState === 'correct' && (
          <span style={{
            position: 'absolute',
            fontSize: 28,
            marginLeft: 8,
            animation: 'kp-celebrate 0.4s ease-out',
          }}>✓</span>
        )}
      </div>

      {/* Status message */}
      <div style={{
        height: 28,
        marginTop: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {displayState === 'correct' && (
          <span style={{
            color: '#69f0ae', fontWeight: 'bold',
            fontSize: 18, animation: 'kp-celebrate 0.35s ease-out',
          }}>
            Correct! 🎉
          </span>
        )}
        {displayState === 'wrong' && (
          <span style={{
            color: '#ff5252', fontWeight: 'bold',
            fontSize: 18, animation: 'kp-shake 0.35s ease-out',
          }}>
            Try again!
          </span>
        )}
        {displayState === 'idle' && typedDigits.length === 0 && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
            Type the number of {q.emoji}s
          </span>
        )}
      </div>

      {/* Number keypad */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, auto)',
        gap: 'clamp(6px, 1.5vw, 12px)',
        marginTop: 6,
        padding: '10px 16px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 20,
        border: '2px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <KeypadButton
            key={n}
            label={String(n)}
            onClick={() => handleDigit(String(n))}
            disabled={inputLocked}
            color="#2e7d32"
          />
        ))}
        {/* Bottom row: backspace, 0, clear */}
        <KeypadButton
          label="⌫"
          onClick={handleBackspace}
          disabled={inputLocked || typedDigits.length === 0}
          color="#1565c0"
        />
        <KeypadButton
          label="0"
          onClick={() => handleDigit('0')}
          disabled={inputLocked}
          color="#2e7d32"
        />
        <KeypadButton
          label="C"
          onClick={() => { if (!inputLocked) setTypedDigits('') }}
          disabled={inputLocked || typedDigits.length === 0}
          color="#6a1b9a"
        />
      </div>

      {/* Celebration floating stars on correct */}
      {displayState === 'correct' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
          {['⭐', '✨', '🌟', '💫', '⭐', '✨'].map((star, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${15 + i * 14}%`,
              top: '55%',
              fontSize: 24,
              animation: `kp-star-float 0.9s ease-out ${i * 80}ms both`,
            }}>
              {star}
            </div>
          ))}
        </div>
      )}

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 20,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0a2e0a, #1b5e20)',
            borderRadius: 28,
            padding: '36px 44px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 18,
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            border: '2px solid rgba(105,240,174,0.35)',
            animation: 'kp-celebrate 0.5s ease-out',
          }}>
            <div style={{ fontSize: 70 }}>🎉</div>
            <div style={{
              color: '#69f0ae', fontSize: 'clamp(28px, 7vw, 42px)',
              fontWeight: 'bold',
              textShadow: '0 0 20px rgba(105,240,174,0.4)',
            }}>
              Level Complete!
            </div>
            <div style={{ color: '#a5d6a7', fontSize: 16 }}>
              All {totalQuestions} questions done!
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => startLevel(currentLevel)}
                style={{
                  padding: '12px 24px', borderRadius: 14,
                  background: '#2e7d32', color: '#fff',
                  fontSize: 17, fontWeight: 'bold',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 5px 0 rgba(0,0,0,0.3)',
                }}
              >
                Play Again
              </button>
              <button
                onClick={() => { setCurrentLevel(null); setShowComplete(false) }}
                style={{
                  padding: '12px 24px', borderRadius: 14,
                  background: '#1565c0', color: '#fff',
                  fontSize: 17, fontWeight: 'bold',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 5px 0 rgba(0,0,0,0.3)',
                }}
              >
                Levels
              </button>
              <button
                onClick={() => isFromShell ? shellBack() : navigate('/')}
                style={{
                  padding: '12px 24px', borderRadius: 14,
                  background: '#e65100', color: '#fff',
                  fontSize: 17, fontWeight: 'bold',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 5px 0 rgba(0,0,0,0.3)',
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
