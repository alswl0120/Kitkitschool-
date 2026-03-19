import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../components/BackButton'
import ProgressBar from '../../components/ProgressBar'
import { useShellParams } from '../../hooks/useShellParams'

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuestionData {
  emoji: string
  count: number
  choices: number[]
  answer: number        // index into choices[]
  groupA?: number       // for level 2 grouped questions
  groupB?: number
}

interface LevelData {
  levelIndex: number
  questions: QuestionData[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CORRECT_DELAY_MS = 1100
const WRONG_SHAKE_MS = 600

// Scatter positions for up to 10 objects (% within container)
const SCATTER_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '15%', left: '20%' },
  { top: '10%', left: '60%' },
  { top: '40%', left: '10%' },
  { top: '35%', left: '45%' },
  { top: '25%', left: '78%' },
  { top: '62%', left: '25%' },
  { top: '58%', left: '68%' },
  { top: '72%', left: '48%' },
  { top: '65%', left: '84%' },
  { top: '78%', left: '12%' },
]

// Positions for group A and group B in level 2
const GROUP_A_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '20%', left: '8%'  },
  { top: '40%', left: '6%'  },
  { top: '60%', left: '10%' },
  { top: '15%', left: '24%' },
  { top: '55%', left: '26%' },
  { top: '75%', left: '18%' },
]

const GROUP_B_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '18%', left: '58%' },
  { top: '40%', left: '62%' },
  { top: '62%', left: '56%' },
  { top: '20%', left: '76%' },
  { top: '55%', left: '80%' },
  { top: '75%', left: '68%' },
]

// Firework particle colours
const FIREWORK_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8']

// ── Fireworks overlay ──────────────────────────────────────────────────────────

function FireworksOverlay() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
    left: `${10 + Math.floor((i * 37 + 11) % 80)}%`,
    top: `${15 + Math.floor((i * 53 + 7) % 60)}%`,
    delay: `${(i % 6) * 80}ms`,
    size: 8 + (i % 4) * 4,
  }))

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
      <style>{`
        @keyframes fw-burst {
          0%   { transform: scale(0) translateY(0); opacity: 1; }
          60%  { transform: scale(1.4) translateY(-20px); opacity: 0.9; }
          100% { transform: scale(0.2) translateY(-50px); opacity: 0; }
        }
        @keyframes fw-star-spin {
          0%   { transform: rotate(0) scale(0); opacity: 1; }
          50%  { transform: rotate(180deg) scale(1.2); }
          100% { transform: rotate(360deg) scale(0); opacity: 0; }
        }
      `}</style>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: p.id % 3 === 0 ? '50%' : 2,
            background: p.color,
            animation: p.id % 2 === 0
              ? `fw-burst 0.8s ease-out ${p.delay} both`
              : `fw-star-spin 0.8s ease-out ${p.delay} both`,
          }}
        />
      ))}
      {['⭐', '🌟', '✨', '💫', '⭐', '🌟', '✨', '💫'].map((s, i) => (
        <div key={`star-${i}`} style={{
          position: 'absolute',
          left: `${8 + i * 12}%`,
          top: `${25 + (i % 3) * 20}%`,
          fontSize: 20 + (i % 3) * 6,
          animation: `fw-burst 0.9s ease-out ${i * 60}ms both`,
        }}>
          {s}
        </div>
      ))}
    </div>
  )
}

// ── Choice Button ──────────────────────────────────────────────────────────────

type ChoiceState = 'idle' | 'correct' | 'wrong'

interface ChoiceButtonProps {
  value: number
  state: ChoiceState
  onClick: () => void
  disabled: boolean
}

function ChoiceButton({ value, state, onClick, disabled }: ChoiceButtonProps) {
  const [pressed, setPressed] = useState(false)

  const bg =
    state === 'correct' ? 'linear-gradient(135deg, #2e7d32, #43a047)' :
    state === 'wrong'   ? 'linear-gradient(135deg, #c62828, #e53935)' :
    pressed             ? 'linear-gradient(135deg, #e65100, #f57c00)' :
                          'linear-gradient(135deg, #bf360c, #e64a19)'

  const border =
    state === 'correct' ? '3px solid #69f0ae' :
    state === 'wrong'   ? '3px solid #ff5252' :
                          '3px solid rgba(255,255,255,0.2)'

  const glow =
    state === 'correct' ? '0 0 22px rgba(105,240,174,0.6), 0 6px 0 rgba(0,0,0,0.3)' :
    state === 'wrong'   ? '0 0 22px rgba(255,82,82,0.5), 0 6px 0 rgba(0,0,0,0.3)' :
    pressed             ? 'inset 0 3px 8px rgba(0,0,0,0.4)' :
                          '0 6px 0 rgba(0,0,0,0.3)'

  return (
    <button
      onPointerDown={() => { if (!disabled) setPressed(true) }}
      onPointerUp={() => { setPressed(false); if (!disabled && state === 'idle') onClick() }}
      onPointerLeave={() => setPressed(false)}
      disabled={disabled}
      style={{
        width: 'clamp(68px, 16vw, 100px)',
        height: 'clamp(68px, 16vw, 100px)',
        borderRadius: 20,
        background: bg,
        border,
        color: '#fff',
        fontSize: 'clamp(26px, 6vw, 40px)',
        fontWeight: 'bold',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: glow,
        transform: pressed ? 'translateY(5px) scale(0.95)' : 'translateY(0) scale(1)',
        transition: 'transform 0.08s, box-shadow 0.12s, background 0.15s, border 0.15s',
        animation:
          state === 'correct' ? 'c10-correct-bounce 0.4s ease-out' :
          state === 'wrong'   ? 'c10-shake 0.5s ease-out' :
          'none',
        userSelect: 'none',
        opacity: disabled && state === 'idle' ? 0.55 : 1,
      }}
    >
      {value}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Count10Page() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  // Data
  const [allLevels, setAllLevels] = useState<LevelData[]>([])
  const [currentLevel, setCurrentLevel] = useState<LevelData | null>(null)

  // Game state
  const [questionIndex, setQuestionIndex] = useState(0)
  const [choiceStates, setChoiceStates] = useState<ChoiceState[]>(['idle', 'idle', 'idle', 'idle'])
  const [showFireworks, setShowFireworks] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [inputLocked, setInputLocked] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/count10.json')
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
    setChoiceStates(['idle', 'idle', 'idle', 'idle'])
    setShowFireworks(false)
    setShowComplete(false)
    setInputLocked(false)
  }, [])

  function loadQuestion(idx: number) {
    setQuestionIndex(idx)
    setChoiceStates(['idle', 'idle', 'idle', 'idle'])
    setShowFireworks(false)
    setInputLocked(false)
  }

  function handleChoiceTap(choiceIdx: number) {
    if (inputLocked || !currentLevel) return
    const q = currentLevel.questions[questionIndex]

    if (choiceIdx === q.answer) {
      // Correct
      const next = ['idle', 'idle', 'idle', 'idle'] as ChoiceState[]
      next[choiceIdx] = 'correct'
      setChoiceStates(next)
      setShowFireworks(true)
      setInputLocked(true)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setShowFireworks(false)
        const nextIdx = questionIndex + 1
        if (nextIdx >= currentLevel.questions.length) {
          setShowComplete(true)
        } else {
          loadQuestion(nextIdx)
        }
      }, CORRECT_DELAY_MS)
    } else {
      // Wrong: flash the tapped button red, keep input locked briefly
      const next = [...choiceStates] as ChoiceState[]
      next[choiceIdx] = 'wrong'
      setChoiceStates(next)
      setInputLocked(true)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setChoiceStates(['idle', 'idle', 'idle', 'idle'])
        setInputLocked(false)
      }, WRONG_SHAKE_MS)
    }
  }

  // ── Determine if this level uses grouped display ─────────────────────────────

  function isGroupedLevel(ld: LevelData): boolean {
    return ld.questions.some(q => q.groupA !== undefined)
  }

  // ── Level select screen ──────────────────────────────────────────────────────

  if (!currentLevel) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #3e1f00 0%, #bf360c 55%, #e64a19 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        userSelect: 'none',
      }}>
        <style>{`
          @keyframes c10-level-bounce {
            0%,100% { transform: scale(1); }
            50%      { transform: scale(1.05); }
          }
        `}</style>
        <BackButton color="#ffccbc" onClick={isFromShell ? shellBack : undefined} />
        <div style={{ fontSize: 60 }}>🔢</div>
        <h1 style={{
          color: '#fff', fontSize: 'clamp(28px, 7vw, 44px)',
          fontWeight: 'bold', margin: 0,
          textShadow: '2px 2px 10px rgba(0,0,0,0.5)',
        }}>
          Count to 10
        </h1>
        <p style={{ color: '#ffccbc', fontSize: 18, margin: 0 }}>Choose a level</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {allLevels.map((ld) => {
            const labels = ['Count 1–5', 'Count 1–10', 'Groups']
            const icons = ['🌟', '🔟', '🍎+🍊']
            return (
              <button
                key={ld.levelIndex}
                onClick={() => startLevel(ld)}
                style={{
                  width: 120, height: 120, borderRadius: 22,
                  background: 'rgba(255,255,255,0.12)',
                  border: '3px solid rgba(255,204,188,0.45)',
                  color: '#fff', fontWeight: 'bold',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  transition: 'transform 0.1s, background 0.15s',
                  fontSize: 15,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span style={{ fontSize: 28 }}>{icons[ld.levelIndex]}</span>
                <span>Level {ld.levelIndex + 1}</span>
                <span style={{ fontSize: 12, opacity: 0.75 }}>{labels[ld.levelIndex]}</span>
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
  const grouped = isGroupedLevel(currentLevel) && q.groupA !== undefined

  // Determine which emoji(s) to render
  const emojiParts = q.emoji.includes('+') ? q.emoji.split('+') : [q.emoji]
  const emojiA = emojiParts[0]?.trim() ?? q.emoji
  const emojiB = emojiParts[1]?.trim() ?? q.emoji

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #3e1f00 0%, #bf360c 50%, #e64a19 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      userSelect: 'none',
      position: 'relative',
    }}>
      {/* Keyframe animations */}
      <style>{`
        @keyframes c10-pop {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          70%  { transform: scale(1.2) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes c10-correct-bounce {
          0%,100% { transform: scale(1); }
          40%     { transform: scale(1.25); }
          70%     { transform: scale(0.95); }
        }
        @keyframes c10-shake {
          0%,100% { transform: translateX(0) scale(1); }
          20%     { transform: translateX(-10px) scale(0.97); }
          40%     { transform: translateX(10px) scale(0.97); }
          60%     { transform: translateX(-7px); }
          80%     { transform: translateX(7px); }
        }
        @keyframes c10-complete-in {
          0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
          70%  { transform: scale(1.05) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes c10-pulse-border {
          0%,100% { border-color: rgba(255,204,188,0.3); }
          50%     { border-color: rgba(255,204,188,0.8); }
        }
      `}</style>

      <BackButton color="#ffccbc" onClick={isFromShell ? shellBack : undefined} />

      {/* Progress bar */}
      <ProgressBar current={questionIndex + 1} max={totalQuestions} />

      {/* Question label */}
      <div style={{
        marginTop: 'clamp(36px, 8vw, 54px)',
        color: '#ffccbc',
        fontSize: 'clamp(14px, 3vw, 20px)',
        fontWeight: 'bold',
        letterSpacing: 2,
        textTransform: 'uppercase',
        textAlign: 'center',
        padding: '0 8px',
      }}>
        {grouped
          ? `How many ${emojiA} and ${emojiB} altogether?`
          : `How many ${q.emoji}?`
        }
      </div>

      {/* Object display area */}
      <div style={{
        position: 'relative',
        width: '90%',
        maxWidth: 500,
        height: 'clamp(150px, 32vw, 240px)',
        marginTop: 8,
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 22,
        border: '2px solid rgba(255,204,188,0.2)',
        overflow: 'hidden',
        flexShrink: 0,
        animation: 'c10-pulse-border 3s ease-in-out infinite',
      }}>
        {/* Group divider for level 2 */}
        {grouped && (
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '10%',
            bottom: '10%',
            width: 2,
            background: 'rgba(255,204,188,0.3)',
            borderRadius: 2,
          }} />
        )}

        {grouped ? (
          <>
            {/* Group A */}
            {Array.from({ length: Math.min(q.groupA ?? 0, GROUP_A_POSITIONS.length) }).map((_, i) => (
              <div key={`ga-${i}`} style={{
                position: 'absolute',
                top: GROUP_A_POSITIONS[i].top,
                left: GROUP_A_POSITIONS[i].left,
                fontSize: 'clamp(22px, 5vw, 32px)',
                lineHeight: 1,
                animation: `c10-pop 0.3s ease-out ${i * 70}ms both`,
              }}>
                {emojiA}
              </div>
            ))}
            {/* Group B */}
            {Array.from({ length: Math.min(q.groupB ?? 0, GROUP_B_POSITIONS.length) }).map((_, i) => (
              <div key={`gb-${i}`} style={{
                position: 'absolute',
                top: GROUP_B_POSITIONS[i].top,
                left: GROUP_B_POSITIONS[i].left,
                fontSize: 'clamp(22px, 5vw, 32px)',
                lineHeight: 1,
                animation: `c10-pop 0.3s ease-out ${((q.groupA ?? 0) + i) * 70}ms both`,
              }}>
                {emojiB}
              </div>
            ))}
            {/* Group labels */}
            <div style={{
              position: 'absolute', bottom: 4, left: '12%',
              color: 'rgba(255,204,188,0.6)', fontSize: 12, fontWeight: 'bold',
            }}>
              {q.groupA}
            </div>
            <div style={{
              position: 'absolute', bottom: 4, right: '12%',
              color: 'rgba(255,204,188,0.6)', fontSize: 12, fontWeight: 'bold',
            }}>
              {q.groupB}
            </div>
          </>
        ) : (
          <>
            {Array.from({ length: Math.min(q.count, SCATTER_POSITIONS.length) }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: SCATTER_POSITIONS[i].top,
                left: SCATTER_POSITIONS[i].left,
                fontSize: 'clamp(24px, 5.5vw, 38px)',
                lineHeight: 1,
                animation: `c10-pop 0.3s ease-out ${i * 70}ms both`,
              }}>
                {q.emoji}
              </div>
            ))}
          </>
        )}

        {/* Fireworks overlay inside display */}
        {showFireworks && <FireworksOverlay />}
      </div>

      {/* Instruction */}
      <div style={{
        marginTop: 8,
        color: 'rgba(255,204,188,0.65)',
        fontSize: 'clamp(13px, 2.5vw, 17px)',
        fontWeight: 'bold',
      }}>
        Tap the correct number
      </div>

      {/* Choice buttons */}
      <div style={{
        display: 'flex',
        gap: 'clamp(10px, 2.5vw, 20px)',
        marginTop: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        padding: '12px 20px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 24,
        border: '2px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        {q.choices.map((val, idx) => (
          <ChoiceButton
            key={idx}
            value={val}
            state={choiceStates[idx]}
            onClick={() => handleChoiceTap(idx)}
            disabled={inputLocked && choiceStates[idx] === 'idle'}
          />
        ))}
      </div>

      {/* Correct/wrong text feedback */}
      <div style={{
        height: 32,
        marginTop: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {choiceStates.some(s => s === 'correct') && (
          <span style={{
            color: '#69f0ae', fontWeight: 'bold',
            fontSize: 20, animation: 'c10-correct-bounce 0.4s ease-out',
          }}>
            Correct! 🎉
          </span>
        )}
        {choiceStates.some(s => s === 'wrong') && !choiceStates.some(s => s === 'correct') && (
          <span style={{
            color: '#ff8a65', fontWeight: 'bold',
            fontSize: 20, animation: 'c10-shake 0.5s ease-out',
          }}>
            Try again! 🔄
          </span>
        )}
      </div>

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.72)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 20,
        }}>
          <FireworksOverlay />
          <div style={{
            background: 'linear-gradient(135deg, #3e1f00, #bf360c)',
            borderRadius: 28,
            padding: '36px 44px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 18,
            boxShadow: '0 12px 44px rgba(0,0,0,0.6)',
            border: '2px solid rgba(255,204,188,0.35)',
            animation: 'c10-complete-in 0.55s ease-out',
            zIndex: 10,
            position: 'relative',
          }}>
            <div style={{ fontSize: 68 }}>🏆</div>
            <div style={{
              color: '#ffccbc',
              fontSize: 'clamp(26px, 6vw, 40px)',
              fontWeight: 'bold',
              textShadow: '0 0 20px rgba(255,140,0,0.5)',
            }}>
              Amazing!
            </div>
            <div style={{ color: 'rgba(255,204,188,0.75)', fontSize: 16 }}>
              You counted all {totalQuestions} questions!
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => startLevel(currentLevel)}
                style={{
                  padding: '12px 26px', borderRadius: 14,
                  background: '#e64a19', color: '#fff',
                  fontSize: 17, fontWeight: 'bold',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 5px 0 rgba(0,0,0,0.3)',
                  transition: 'opacity 0.15s',
                }}
              >
                Play Again
              </button>
              <button
                onClick={() => { setCurrentLevel(null); setShowComplete(false) }}
                style={{
                  padding: '12px 26px', borderRadius: 14,
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
                  padding: '12px 26px', borderRadius: 14,
                  background: '#2e7d32', color: '#fff',
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
