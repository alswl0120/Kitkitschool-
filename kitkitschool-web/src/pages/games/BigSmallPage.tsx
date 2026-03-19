import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BigSmallItem {
  emoji: string
  label: string
  size: 'big' | 'small'
}

interface BigSmallQuestion {
  question: string
  items: [BigSmallItem, BigSmallItem]
  answer: 'big' | 'small'
}

interface LevelData {
  levelIndex: number
  questions: BigSmallQuestion[]
}

interface GameData {
  levels: LevelData[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FEEDBACK_DURATION = 950
const BG_GRADIENT = 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%)'
const ACCENT_COLOR = '#00838f'
const CORRECT_COLOR = '#2e7d32'
const WRONG_COLOR = '#c62828'

// ── Sub-components ────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: BigSmallItem
  onClick: () => void
  borderState: 'correct' | 'wrong' | 'idle'
  disabled: boolean
  shake: boolean
}

function ItemCard({ item, onClick, borderState, disabled, shake }: ItemCardProps) {
  const borderColor =
    borderState === 'correct' ? CORRECT_COLOR :
    borderState === 'wrong' ? WRONG_COLOR :
    '#b2dfdb'

  const boxShadow =
    borderState === 'correct'
      ? `0 0 0 6px ${CORRECT_COLOR}, 0 8px 32px rgba(0,0,0,0.18)`
      : borderState === 'wrong'
        ? `0 0 0 6px ${WRONG_COLOR}, 0 8px 32px rgba(0,0,0,0.18)`
        : '0 6px 24px rgba(0,0,0,0.12)'

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width: 200,
        height: 200,
        borderRadius: 28,
        background: '#fff',
        border: `5px solid ${borderColor}`,
        boxShadow,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.08s',
        outline: 'none',
        animation: shake ? 'bigsmall-shake 0.45s ease' : 'none',
        userSelect: 'none',
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.94)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <div style={{ fontSize: 80, lineHeight: 1 }}>{item.emoji}</div>
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#00838f',
        letterSpacing: 1,
      }}>
        {item.label}
      </div>
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BigSmallPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [currentLevel, setCurrentLevel] = useState<LevelData | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [showComplete, setShowComplete] = useState(false)

  // ── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/bigsmall.json')
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
  }, [])

  const handleAnswer = useCallback((itemIndex: number) => {
    if (feedback !== null || !currentLevel) return
    const q = currentLevel.questions[questionIndex]
    const chosen = q.items[itemIndex]
    const isCorrect = chosen.size === q.answer

    setSelectedIndex(itemIndex)
    setFeedback(isCorrect ? 'correct' : 'wrong')

    setTimeout(() => {
      const next = questionIndex + 1
      if (next >= currentLevel.questions.length) {
        setShowComplete(true)
      } else {
        setQuestionIndex(next)
        setFeedback(null)
        setSelectedIndex(null)
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
        color: ACCENT_COLOR, fontSize: 26, fontWeight: 'bold',
      }}>
        Loading...
      </div>
    )
  }

  // ── Level-select screen ──────────────────────────────────────────────────

  if (!currentLevel) {
    const tileBgs = [
      'linear-gradient(135deg, #4dd0e1, #00acc1)',
      'linear-gradient(135deg, #4db6ac, #00897b)',
      'linear-gradient(135deg, #81d4fa, #039be5)',
    ]
    const tileLabels = ['Level 1', 'Level 2', 'Level 3']

    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: BG_GRADIENT,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28,
        userSelect: 'none',
      }}>
        <BackButton color={ACCENT_COLOR} />
        <div style={{ fontSize: 72 }}>🐘🐭</div>
        <h1 style={{
          color: ACCENT_COLOR, fontSize: 40, fontWeight: 800,
          textShadow: '1px 2px 6px rgba(0,0,0,0.1)',
          margin: 0,
          letterSpacing: 1,
        }}>
          Big or Small?
        </h1>
        <p style={{ color: '#00695c', fontSize: 18, margin: 0, fontWeight: 500 }}>
          Tap the right one! Choose a level:
        </p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          {gameData.levels.map((ld, idx) => (
            <button
              key={ld.levelIndex}
              onClick={() => startLevel(ld)}
              style={{
                width: 110, height: 110, borderRadius: 22,
                background: tileBgs[idx % tileBgs.length],
                color: '#fff', fontSize: 18, fontWeight: 800,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                transition: 'transform 0.1s',
                letterSpacing: 0.5,
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
    feedback === 'correct' ? 'rgba(76,175,80,0.22)' :
    feedback === 'wrong' ? 'rgba(244,67,54,0.22)' :
    'transparent'

  const isBigQuestion = q.answer === 'big'

  return (
    <>
      {/* Keyframe animation injected via a style tag */}
      <style>{`
        @keyframes bigsmall-shake {
          0%   { transform: translateX(0); }
          18%  { transform: translateX(-10px) rotate(-3deg); }
          36%  { transform: translateX(10px) rotate(3deg); }
          54%  { transform: translateX(-8px) rotate(-2deg); }
          72%  { transform: translateX(8px) rotate(2deg); }
          100% { transform: translateX(0); }
        }
        @keyframes bigsmall-pop {
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

        <BackButton color={ACCENT_COLOR} onClick={isFromShell ? shellBack : undefined} />
        <ProgressBar current={questionIndex + 1} max={totalQuestions} />

        {/* Question prompt */}
        <div style={{
          marginTop: 64,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ fontSize: 36 }}>{isBigQuestion ? '🔍' : '🔬'}</div>
          <div style={{
            fontSize: 30,
            fontWeight: 800,
            color: '#fff',
            background: isBigQuestion
              ? 'linear-gradient(90deg, #0097a7, #00838f)'
              : 'linear-gradient(90deg, #00897b, #00695c)',
            borderRadius: 18,
            padding: '10px 32px',
            boxShadow: '0 4px 18px rgba(0,0,0,0.2)',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}>
            {q.question}
          </div>
        </div>

        {/* Item cards */}
        <div style={{
          display: 'flex',
          gap: 48,
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          zIndex: 20,
          flexWrap: 'wrap',
          padding: '0 32px',
        }}>
          {q.items.map((item, idx) => {
            let borderState: 'correct' | 'wrong' | 'idle' = 'idle'
            if (feedback !== null) {
              if (item.size === q.answer) {
                borderState = 'correct'
              } else if (selectedIndex === idx) {
                borderState = 'wrong'
              }
            }
            return (
              <ItemCard
                key={idx}
                item={item}
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
            top: '42%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 100,
            zIndex: 30,
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.3))',
            pointerEvents: 'none',
            animation: 'bigsmall-pop 0.35s ease',
          }}>
            {feedback === 'correct' ? '✅' : '❌'}
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
              background: 'linear-gradient(135deg, #e0f7fa, #b2ebf2)',
              borderRadius: 28,
              padding: '44px 52px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
            }}>
              <div style={{ fontSize: 80, animation: 'bigsmall-pop 0.4s ease' }}>🎉</div>
              <div style={{
                color: ACCENT_COLOR,
                fontSize: 44,
                fontWeight: 800,
                textShadow: '1px 1px 4px rgba(0,0,0,0.12)',
              }}>
                Amazing!
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => startLevel(currentLevel)}
                  style={{
                    padding: '14px 30px', borderRadius: 14,
                    background: '#00897b',
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
                    background: '#0097a7',
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
                    background: '#00695c',
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
