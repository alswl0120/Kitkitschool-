import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CrownChoice {
  count: number
  emoji: string
}

interface CrownQuestion {
  crownNumber: number
  choices: [CrownChoice, CrownChoice, CrownChoice, CrownChoice]
  answer: number
}

interface LevelData {
  levelIndex: number
  questions: CrownQuestion[]
}

interface GameData {
  levels: LevelData[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FEEDBACK_DURATION = 1000
const BG_GRADIENT = 'linear-gradient(135deg, #fffde7 0%, #fff9c4 50%, #fff176 100%)'
const CROWN_COLOR = '#f9a825'
const ACCENT_DARK = '#e65100'
const CORRECT_COLOR = '#2e7d32'
const WRONG_COLOR = '#c62828'

// ── Sub-components ────────────────────────────────────────────────────────────

interface ChoiceGroupProps {
  choice: CrownChoice
  onClick: () => void
  borderState: 'correct' | 'wrong' | 'idle'
  disabled: boolean
  shake: boolean
}

/** Renders a grid of emoji objects for a choice group */
function ChoiceGroup({ choice, onClick, borderState, disabled, shake }: ChoiceGroupProps) {
  const borderColor =
    borderState === 'correct' ? CORRECT_COLOR :
    borderState === 'wrong' ? WRONG_COLOR :
    '#ffe082'

  const bg =
    borderState === 'correct' ? 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' :
    borderState === 'wrong' ? 'linear-gradient(135deg, #ffebee, #ffcdd2)' :
    'linear-gradient(135deg, #fff9c4, #fff8e1)'

  const boxShadow =
    borderState === 'correct'
      ? `0 0 0 5px ${CORRECT_COLOR}, 0 8px 28px rgba(0,0,0,0.18)`
      : borderState === 'wrong'
        ? `0 0 0 5px ${WRONG_COLOR}, 0 8px 28px rgba(0,0,0,0.18)`
        : '0 4px 18px rgba(0,0,0,0.12)'

  // Cap display at 20 so the grid stays tidy
  const display = Math.min(choice.count, 20)
  const emojiSize = choice.count <= 5 ? 28 : choice.count <= 10 ? 22 : 18

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: 160,
        minHeight: 160,
        padding: 14,
        borderRadius: 22,
        background: bg,
        border: `4px solid ${borderColor}`,
        boxShadow,
        cursor: disabled ? 'default' : 'pointer',
        outline: 'none',
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.08s',
        animation: shake ? 'crown-shake 0.45s ease' : 'none',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.94)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {/* Emoji grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 4,
        maxWidth: 130,
      }}>
        {Array.from({ length: display }).map((_, i) => (
          <span key={i} style={{ fontSize: emojiSize, lineHeight: 1 }}>{choice.emoji}</span>
        ))}
      </div>
      {/* Count label */}
      <div style={{
        background: CROWN_COLOR,
        color: '#fff',
        fontWeight: 800,
        fontSize: 20,
        borderRadius: 10,
        padding: '2px 14px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
        marginTop: 4,
      }}>
        {choice.count}
      </div>
    </button>
  )
}

// ── Crown display ─────────────────────────────────────────────────────────────

function CrownDisplay({ number, sparkle }: { number: number; sparkle: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      animation: sparkle ? 'crown-sparkle 0.5s ease' : 'none',
      position: 'relative',
    }}>
      <div style={{ fontSize: 80, lineHeight: 1 }}>👑</div>
      <div style={{
        position: 'absolute',
        top: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 34,
        fontWeight: 900,
        color: '#fff',
        textShadow: '0 1px 4px rgba(180,100,0,0.6)',
        letterSpacing: -1,
        minWidth: 40,
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        {number}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CrownPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [currentLevel, setCurrentLevel] = useState<LevelData | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [crownSparkle, setCrownSparkle] = useState(false)

  // ── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/crown.json')
      .then(r => r.json())
      .then((data: GameData) => setGameData(data))
      .catch(() => setGameData(null))
  }, [])

  // ── Auto-start from shell ────────────────────────────────────────────────

  useEffect(() => {
    if (shellLevel !== null && gameData && !currentLevel) {
      const ld = gameData.levels.find(l => l.levelIndex === shellLevel) ?? gameData.levels[0]
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
    setCurrentLevel(ld)
    setQuestionIndex(0)
    setFeedback(null)
    setSelectedIndex(null)
    setShowComplete(false)
    setCrownSparkle(false)
  }, [])

  const handleAnswer = useCallback((choiceIndex: number) => {
    if (feedback !== null || !currentLevel) return
    const q = currentLevel.questions[questionIndex]
    const isCorrect = choiceIndex === q.answer

    setSelectedIndex(choiceIndex)
    setFeedback(isCorrect ? 'correct' : 'wrong')

    if (isCorrect) {
      setCrownSparkle(true)
      setTimeout(() => setCrownSparkle(false), 500)
    }

    setTimeout(() => {
      const next = questionIndex + 1
      if (next >= currentLevel.questions.length) {
        setShowComplete(true)
      } else {
        setQuestionIndex(next)
        setFeedback(null)
        setSelectedIndex(null)
        setCrownSparkle(false)
      }
    }, FEEDBACK_DURATION)
  }, [feedback, currentLevel, questionIndex])

  // ── Loading ──────────────────────────────────────────────────────────────

  if (!gameData) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: BG_GRADIENT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: CROWN_COLOR, fontSize: 26, fontWeight: 'bold',
      }}>
        Loading...
      </div>
    )
  }

  // ── Level-select screen ──────────────────────────────────────────────────

  if (!currentLevel) {
    const tileBgs = [
      'linear-gradient(135deg, #ffd54f, #ffb300)',
      'linear-gradient(135deg, #ffb74d, #ef6c00)',
      'linear-gradient(135deg, #ff8a65, #d84315)',
    ]
    const tileLabels = ['Level 1\n1–5', 'Level 2\n1–10', 'Level 3\n5–20']

    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: BG_GRADIENT,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28,
        userSelect: 'none',
      }}>
        <BackButton color={ACCENT_DARK} />
        <div style={{ fontSize: 80 }}>👑</div>
        <h1 style={{
          color: ACCENT_DARK, fontSize: 40, fontWeight: 800,
          textShadow: '1px 2px 6px rgba(0,0,0,0.1)',
          margin: 0,
          letterSpacing: 1,
        }}>
          Crown Count!
        </h1>
        <p style={{ color: '#bf360c', fontSize: 18, margin: 0, fontWeight: 500 }}>
          Find the group that matches the crown! Pick a level:
        </p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          {gameData.levels.map((ld, idx) => (
            <button
              key={ld.levelIndex}
              onClick={() => startLevel(ld)}
              style={{
                width: 120, height: 120, borderRadius: 22,
                background: tileBgs[idx % tileBgs.length],
                color: '#fff', fontSize: 16, fontWeight: 800,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                transition: 'transform 0.1s',
                whiteSpace: 'pre-line',
                lineHeight: 1.4,
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {tileLabels[idx]}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Game screen ──────────────────────────────────────────────────────────

  const q = currentLevel.questions[questionIndex]
  const totalQuestions = currentLevel.questions.length
  const overlayBg =
    feedback === 'correct' ? 'rgba(76,175,80,0.2)' :
    feedback === 'wrong' ? 'rgba(244,67,54,0.2)' :
    'transparent'

  return (
    <>
      <style>{`
        @keyframes crown-shake {
          0%   { transform: translateX(0); }
          18%  { transform: translateX(-10px) rotate(-3deg); }
          36%  { transform: translateX(10px) rotate(3deg); }
          54%  { transform: translateX(-8px) rotate(-2deg); }
          72%  { transform: translateX(8px) rotate(2deg); }
          100% { transform: translateX(0); }
        }
        @keyframes crown-sparkle {
          0%   { transform: scale(1) rotate(0deg); filter: brightness(1); }
          30%  { transform: scale(1.25) rotate(-8deg); filter: brightness(1.5); }
          60%  { transform: scale(1.2) rotate(6deg); filter: brightness(1.4); }
          100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
        }
        @keyframes crown-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div style={{
        width: '100vw', height: '100vh',
        background: BG_GRADIENT,
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

        <BackButton color={ACCENT_DARK} onClick={isFromShell ? shellBack : undefined} />
        <ProgressBar current={questionIndex + 1} max={totalQuestions} />

        {/* Crown prompt */}
        <div style={{
          marginTop: 64,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: ACCENT_DARK,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            Find the group that matches:
          </div>

          {/* Crown with sparkle effect on correct */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
            {feedback === 'correct' && (
              <>
                <span style={{ fontSize: 28, animation: 'crown-pop 0.3s ease' }}>✨</span>
              </>
            )}
            <CrownDisplay number={q.crownNumber} sparkle={crownSparkle} />
            {feedback === 'correct' && (
              <span style={{ fontSize: 28, animation: 'crown-pop 0.3s ease' }}>✨</span>
            )}
          </div>
        </div>

        {/* Choice grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          zIndex: 20,
          marginTop: 24,
          padding: '0 24px',
        }}>
          {q.choices.map((choice, idx) => {
            let borderState: 'correct' | 'wrong' | 'idle' = 'idle'
            if (feedback !== null) {
              if (idx === q.answer) {
                borderState = 'correct'
              } else if (selectedIndex === idx) {
                borderState = 'wrong'
              }
            }
            return (
              <ChoiceGroup
                key={idx}
                choice={choice}
                onClick={() => handleAnswer(idx)}
                borderState={borderState}
                disabled={feedback !== null}
                shake={feedback === 'wrong' && selectedIndex === idx}
              />
            )
          })}
        </div>

        {/* Feedback icon */}
        {feedback !== null && (
          <div style={{
            position: 'absolute',
            top: '44%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 96,
            zIndex: 30,
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.28))',
            pointerEvents: 'none',
            animation: 'crown-pop 0.35s ease',
          }}>
            {feedback === 'correct' ? '⭐' : '❌'}
          </div>
        )}

        {/* Complete overlay */}
        {showComplete && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.52)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #fffde7, #fff9c4)',
              borderRadius: 28,
              padding: '44px 52px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
            }}>
              <div style={{ fontSize: 80, animation: 'crown-pop 0.4s ease' }}>👑✨</div>
              <div style={{
                color: ACCENT_DARK,
                fontSize: 44,
                fontWeight: 800,
                textShadow: '1px 1px 4px rgba(0,0,0,0.12)',
              }}>
                You're a Star!
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => startLevel(currentLevel)}
                  style={{
                    padding: '14px 30px', borderRadius: 14,
                    background: '#f9a825',
                    color: '#fff', fontSize: 18, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  }}
                >
                  Play Again
                </button>
                <button
                  onClick={() => { setCurrentLevel(null); setShowComplete(false) }}
                  style={{
                    padding: '14px 30px', borderRadius: 14,
                    background: '#ef6c00',
                    color: '#fff', fontSize: 18, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  }}
                >
                  Levels
                </button>
                <button
                  onClick={() => isFromShell ? shellBack() : navigate('/')}
                  style={{
                    padding: '14px 30px', borderRadius: 14,
                    background: '#d84315',
                    color: '#fff', fontSize: 18, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  }}
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
