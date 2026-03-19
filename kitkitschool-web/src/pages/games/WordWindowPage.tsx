import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestLevel } from '../../utils/levelUtils'

interface Problem {
  emoji: string
  leftCount: number
  rightCount: number
  operation: 'add' | 'sub'
  question: string
  answer: number
  choices: number[]
}

interface WindowLevel {
  level: number
  theme: string
  problems: Problem[]
}

// ---- keyframe CSS (injected once) ----
let cssInjected = false
function ensureCss() {
  if (cssInjected) return
  cssInjected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes wwShake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-8px); }
      40%     { transform: translateX(8px); }
      60%     { transform: translateX(-6px); }
      80%     { transform: translateX(6px); }
    }
    .ww-shake { animation: wwShake 0.4s ease; }
    @keyframes wwCorrectPop {
      0%   { transform: scale(0.8); opacity: 0; }
      60%  { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .ww-correct-pop { animation: wwCorrectPop 0.35s ease forwards; }
    @keyframes wwCurtainOpen {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
    @keyframes wwFloat {
      0%,100% { transform: translateY(0); }
      50%     { transform: translateY(-6px); }
    }
    .ww-float { animation: wwFloat 2s ease-in-out infinite; }
  `
  document.head.appendChild(style)
}

function EmojiGrid({ emoji, count, side }: { emoji: string; count: number; side: 'left' | 'right' }) {
  // Arrange items in a neat grid inside the window pane
  const cols = count <= 4 ? count : Math.ceil(Math.sqrt(count))
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 4,
      alignItems: 'center',
      justifyItems: 'center',
      padding: 8,
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="ww-float"
          style={{
            fontSize: count <= 4 ? 32 : count <= 9 ? 26 : 20,
            lineHeight: 1,
            animationDelay: `${(i * 0.15 + (side === 'right' ? 0.07 : 0)).toFixed(2)}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  )
}

function WindowFrame({
  problem,
  revealed,
}: {
  problem: Problem
  revealed: boolean
}) {
  const isSub = problem.operation === 'sub'
  // For subtraction: left pane shows all, right pane shows "hidden" count behind curtain
  const leftCount  = isSub ? problem.leftCount : problem.leftCount
  const rightCount = isSub ? problem.rightCount : problem.rightCount
  const showCurtain = isSub && !revealed

  return (
    <div style={{
      width: 320,
      height: 210,
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      overflow: 'hidden',
      position: 'relative',
      background: '#e3f2fd',
      border: '6px solid #5c8a3c',
      flexShrink: 0,
    }}>
      {/* Window frame bars */}
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 18, background: '#5c8a3c', zIndex: 5,
      }} />
      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 18, background: '#5c8a3c', zIndex: 5,
      }} />
      {/* Left bar */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0,
        width: 14, background: '#5c8a3c', zIndex: 5,
      }} />
      {/* Right bar */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: 0,
        width: 14, background: '#5c8a3c', zIndex: 5,
      }} />
      {/* Center divider */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: 12, background: '#5c8a3c', zIndex: 5,
      }} />

      {/* Sky/scene background */}
      <div style={{
        position: 'absolute', top: 18, bottom: 18, left: 14, right: 14,
        background: 'linear-gradient(180deg, #e3f2fd 0%, #b3e5fc 100%)',
      }}>
        {/* Left pane content */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: 0, right: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingRight: 6,
        }}>
          <EmojiGrid emoji={problem.emoji} count={leftCount} side="left" />
        </div>

        {/* Right pane content */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: '50%', right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingLeft: 6,
          overflow: 'hidden',
        }}>
          {showCurtain ? (
            // Curtain overlay for subtraction
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #8d6e63, #5d4037)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40,
            }}>
              🎭
            </div>
          ) : (
            <EmojiGrid emoji={problem.emoji} count={rightCount} side="right" />
          )}
        </div>
      </div>

      {/* Curtain rod at top */}
      <div style={{
        position: 'absolute', top: 8, left: 8, right: 8,
        height: 8, background: '#8d6e63', borderRadius: 4, zIndex: 6,
      }} />
    </div>
  )
}

export default function WordWindowPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [levels, setLevels] = useState<WindowLevel[]>([])
  const [currentLevel, setCurrentLevel] = useState(0)
  const [levelData, setLevelData] = useState<WindowLevel | null>(null)

  const [problemIndex, setProblemIndex] = useState(0)
  const [problem, setProblem]           = useState<Problem | null>(null)
  const [feedback, setFeedback]         = useState<'correct' | 'wrong' | null>(null)
  const [shakingChoice, setShakingChoice] = useState<number | null>(null)
  const [revealed, setRevealed]         = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [progress, setProgress]         = useState({ current: 0, max: 5 })

  useEffect(() => { ensureCss() }, [])

  useEffect(() => {
    fetch('/data/games/wordwindow.json')
      .then(r => r.json())
      .then(data => setLevels(data.levels || []))
      .catch(() => setLevels([]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setCurrentLevel(lvl)
    setProblemIndex(0)
    setFeedback(null)
    setShakingChoice(null)
    setRevealed(false)
    setShowComplete(false)
  }, [])

  // Set up level data when level changes
  useEffect(() => {
    if (currentLevel === 0 || levels.length === 0) return
    const data = findClosestLevel(levels, currentLevel) ?? levels[0]
    if (!data) return
    setLevelData(data)
    setProblemIndex(0)
    setProblem(data.problems[0])
    setProgress({ current: 1, max: data.problems.length })
    setFeedback(null)
    setRevealed(false)
  }, [currentLevel, levels])

  // Update current problem when index changes
  useEffect(() => {
    if (!levelData) return
    setProblem(levelData.problems[problemIndex] ?? null)
    setFeedback(null)
    setShakingChoice(null)
    setRevealed(false)
    setProgress({ current: problemIndex + 1, max: levelData.problems.length })
  }, [problemIndex, levelData])

  // Shell auto-start
  useEffect(() => {
    if (shellLevel && currentLevel === 0 && levels.length > 0) {
      startLevel(shellLevel)
    }
  }, [shellLevel, currentLevel, levels, startLevel])

  // Shell complete callback
  useEffect(() => {
    if (showComplete && isFromShell) {
      onGameComplete()
    }
  }, [showComplete, isFromShell, onGameComplete])

  const handleAnswer = (choice: number) => {
    if (!problem || feedback !== null) return

    if (choice === problem.answer) {
      setFeedback('correct')
      // For subtraction: reveal the hidden pane
      if (problem.operation === 'sub') setRevealed(true)
      setTimeout(() => {
        if (!levelData) return
        if (problemIndex + 1 >= levelData.problems.length) {
          setShowComplete(true)
        } else {
          setProblemIndex(i => i + 1)
        }
      }, 900)
    } else {
      setFeedback('wrong')
      setShakingChoice(choice)
      setTimeout(() => {
        setFeedback(null)
        setShakingChoice(null)
      }, 500)
    }
  }

  // ---- Level select screen ----
  if (currentLevel === 0) {
    const colors = ['#FF8A65','#FFB74D','#FFD54F','#AED581','#4DB6AC','#4FC3F7','#7986CB','#BA68C8']
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1a237e, #283593)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, textShadow: '2px 2px 4px rgba(0,0,0,0.3)', margin: 0 }}>
          Word Window
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, margin: 0 }}>
          Count what you see through the window!
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600, padding: '0 20px' }}>
          {levels.map((l, i) => (
            <button
              key={l.level}
              onClick={() => startLevel(l.level)}
              style={{
                width: 80, height: 80, borderRadius: 16,
                background: colors[i % colors.length],
                color: '#fff', fontSize: 22, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 24 }}>🪟</span>
              <span style={{ fontSize: 14 }}>{l.level}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!levelData || !problem) return null

  const isSubProblem = problem.operation === 'sub'

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #1a237e 0%, #283593 50%, #1565c0 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <BackButton color="#fff" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Theme label */}
      <div style={{
        marginTop: 54, fontSize: 16, color: 'rgba(255,255,255,0.7)',
        letterSpacing: 1, fontWeight: 'bold',
      }}>
        {levelData.theme}
      </div>

      {/* Subtitle hint for subtraction */}
      {isSubProblem && !revealed && (
        <div style={{
          fontSize: 13, color: '#ffcc02',
          marginTop: 2, marginBottom: 0,
        }}>
          Some are hidden behind the curtain!
        </div>
      )}

      {/* Window */}
      <div style={{ marginTop: isSubProblem ? 8 : 20 }}>
        <WindowFrame problem={problem} revealed={revealed} />
      </div>

      {/* Pane labels */}
      <div style={{
        display: 'flex', width: 320, marginTop: 6,
        justifyContent: 'space-around',
      }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          Left: {problem.leftCount}
        </div>
        <div style={{ fontSize: 13, color: isSubProblem && !revealed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)' }}>
          {isSubProblem && !revealed ? 'Right: ???' : `Right: ${problem.rightCount}`}
        </div>
      </div>

      {/* Question */}
      <div style={{
        marginTop: 12,
        background: 'rgba(255,255,255,0.12)',
        borderRadius: 14,
        padding: '10px 24px',
        maxWidth: 360,
        textAlign: 'center',
        fontSize: 17,
        fontWeight: 'bold',
        color: '#fff',
        lineHeight: 1.4,
      }}>
        {problem.question}
      </div>

      {/* Choices */}
      <div style={{
        display: 'flex', gap: 14, marginTop: 16,
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {problem.choices.map(choice => {
          const isShaking = shakingChoice === choice
          const isCorrectChoice = feedback === 'correct' && choice === problem.answer

          let bg = 'rgba(255,255,255,0.15)'
          let border = '2px solid rgba(255,255,255,0.3)'
          let color = '#fff'

          if (isCorrectChoice) {
            bg = '#4CAF50'
            border = '2px solid #388E3C'
          } else if (isShaking) {
            bg = '#f44336'
            border = '2px solid #c62828'
          }

          return (
            <button
              key={choice}
              onClick={() => handleAnswer(choice)}
              className={isShaking ? 'ww-shake' : isCorrectChoice ? 'ww-correct-pop' : undefined}
              style={{
                width: 72, height: 72,
                borderRadius: 16,
                background: bg,
                border,
                color,
                fontSize: 28,
                fontWeight: 'bold',
                cursor: feedback !== null ? 'default' : 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {choice}
            </button>
          )
        })}
      </div>

      {/* Feedback text */}
      <div style={{
        marginTop: 12, fontSize: 22, fontWeight: 'bold',
        minHeight: 32,
        color: feedback === 'correct' ? '#69f0ae' : feedback === 'wrong' ? '#ff5252' : 'transparent',
      }}>
        {feedback === 'correct' ? '🎉 Correct!' : feedback === 'wrong' ? 'Try again!' : '.'}
      </div>

      {/* Problem counter */}
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
        Problem {problemIndex + 1} of {levelData.problems.length}
      </div>

      {/* Completion overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 24,
        }}>
          <div style={{ fontSize: 80, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }}>
            🌟
          </div>
          <div style={{
            color: '#fff', fontSize: 40, fontWeight: 'bold',
            textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          }}>
            Great Job!
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={() => startLevel(currentLevel)}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#4CAF50',
                color: '#fff', fontSize: 18, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Play Again
            </button>
            <button
              onClick={() => setCurrentLevel(0)}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#2196F3',
                color: '#fff', fontSize: 18, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Levels
            </button>
            <button
              onClick={() => isFromShell ? shellBack() : navigate('/')}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#FF5722',
                color: '#fff', fontSize: 18, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
