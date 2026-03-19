import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

interface Problem {
  factor1: number
  factor2: number
  answer: number
  choices: number[]
}

interface LevelData {
  level: number
  title: string
  problems: Problem[]
}

type AnswerState = 'idle' | 'correct' | 'wrong'

const LEVEL_COLORS = [
  '#7B1FA2', '#6A1B9A', '#5E35B1', '#3949AB',
  '#1565C0', '#0277BD', '#00838F', '#2E7D32',
]

export default function MultiplicationBoardPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [levels, setLevels] = useState<LevelData[]>([])
  const [level, setLevel] = useState(0)
  const [levelData, setLevelData] = useState<LevelData | null>(null)

  const [problemIdx, setProblemIdx] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [choiceStates, setChoiceStates] = useState<AnswerState[]>([])
  const [dotsLit, setDotsLit] = useState(false)
  const [dotsShake, setDotsShake] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch data
  useEffect(() => {
    fetch('/data/games/multiplicationboard.json')
      .then(r => r.json())
      .then(data => setLevels(data.levels))
      .catch(() => setLevels([]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProblemIdx(0)
    setAnswered(false)
    setDotsLit(false)
    setDotsShake(false)
    setCorrectCount(0)
  }, [])

  // Resolve level data
  useEffect(() => {
    if (level === 0 || levels.length === 0) return
    const ld = levels.find(l => l.level === level) ?? levels[0]
    setLevelData(ld)
    setProblemIdx(0)
    setAnswered(false)
    setDotsLit(false)
    setDotsShake(false)
    setCorrectCount(0)
  }, [level, levels])

  // Reset choices when problem changes
  useEffect(() => {
    if (!levelData) return
    const prob = levelData.problems[problemIdx]
    if (!prob) return
    setChoiceStates(prob.choices.map(() => 'idle'))
    setAnswered(false)
    setDotsLit(false)
    setDotsShake(false)
  }, [problemIdx, levelData])

  // Shell auto-start
  useEffect(() => {
    if (shellLevel && level === 0 && levels.length > 0) {
      startLevel(shellLevel)
    }
  }, [shellLevel, level, levels, startLevel])

  // Shell complete
  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  const handleChoice = (choiceIdx: number) => {
    if (!levelData || answered) return
    const prob = levelData.problems[problemIdx]
    const chosen = prob.choices[choiceIdx]
    const correct = chosen === prob.answer

    const newStates: AnswerState[] = prob.choices.map((c, i) => {
      if (i === choiceIdx) return correct ? 'correct' : 'wrong'
      return 'idle'
    })
    setChoiceStates(newStates)
    setAnswered(true)

    if (correct) {
      setDotsLit(true)
      const newCount = correctCount + 1
      setCorrectCount(newCount)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const nextIdx = problemIdx + 1
        if (nextIdx >= levelData.problems.length) {
          setShowComplete(true)
        } else {
          setProblemIdx(nextIdx)
        }
      }, 1000)
    } else {
      setDotsShake(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setDotsShake(false)
        setChoiceStates(prob.choices.map(() => 'idle'))
        setAnswered(false)
      }, 700)
    }
  }

  // ─── Level Select ───────────────────────────────────────────────────────────
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #4a00e0, #8e2de2)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 'bold', textShadow: '1px 1px 4px rgba(0,0,0,0.4)', margin: 0 }}>
          Multiplication Board
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, margin: 0 }}>
          Choose the correct answer!
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 520, padding: '0 20px' }}>
          {levels.map((ld, i) => (
            <button
              key={ld.level}
              onClick={() => startLevel(ld.level)}
              style={{
                width: 90, height: 90, borderRadius: 16,
                background: LEVEL_COLORS[i % LEVEL_COLORS.length],
                color: '#fff', fontSize: 16, fontWeight: 'bold',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                border: '2px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 22 }}>{ld.level}</span>
              <span style={{ fontSize: 11, opacity: 0.9, textAlign: 'center', lineHeight: 1.2 }}>{ld.title}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (!levelData) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff', fontSize: 24 }}>
        Loading...
      </div>
    )
  }

  const prob = levelData.problems[problemIdx]
  const totalProblems = levelData.problems.length

  // Dot grid: factor1 rows × factor2 columns
  const dots: boolean[][] = []
  for (let r = 0; r < prob.factor1; r++) {
    const row: boolean[] = []
    for (let c = 0; c < prob.factor2; c++) {
      row.push(true)
    }
    dots.push(row)
  }

  const dotSize = Math.min(22, Math.floor(140 / Math.max(prob.factor1, prob.factor2)))

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #4a00e0, #8e2de2)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      overflow: 'hidden', position: 'relative',
      fontFamily: 'sans-serif',
    }}>
      <BackButton color="#fff" onClick={isFromShell ? shellBack : () => setLevel(0)} />
      <ProgressBar current={problemIdx} max={totalProblems} />

      {/* Level title */}
      <div style={{ marginTop: 56, color: 'rgba(255,255,255,0.7)', fontSize: 15, letterSpacing: 1 }}>
        {levelData.title} — Problem {problemIdx + 1} / {totalProblems}
      </div>

      {/* Equation display */}
      <div style={{
        marginTop: 12, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          fontSize: '9vw', fontWeight: 'bold', color: '#fff',
          textShadow: '0 2px 10px rgba(0,0,0,0.4)',
          minWidth: '8vw', textAlign: 'center',
        }}>
          {prob.factor1}
        </span>
        <span style={{ fontSize: '7vw', color: '#FFD700', fontWeight: 'bold' }}>×</span>
        <span style={{
          fontSize: '9vw', fontWeight: 'bold', color: '#fff',
          textShadow: '0 2px 10px rgba(0,0,0,0.4)',
          minWidth: '8vw', textAlign: 'center',
        }}>
          {prob.factor2}
        </span>
        <span style={{ fontSize: '7vw', color: 'rgba(255,255,255,0.6)', fontWeight: 'bold' }}>=</span>
        <span style={{
          fontSize: '9vw', fontWeight: 'bold',
          color: dotsLit ? '#FFD700' : 'rgba(255,255,255,0.3)',
          textShadow: dotsLit ? '0 0 20px rgba(255,215,0,0.8)' : 'none',
          minWidth: '8vw', textAlign: 'center',
          transition: 'all 0.3s',
        }}>
          {dotsLit ? prob.answer : '?'}
        </span>
      </div>

      {/* Dot grid visualization */}
      <div style={{
        marginBottom: 20,
        display: 'flex', flexDirection: 'column', gap: 4,
        animation: dotsShake ? 'shake 0.4s ease' : undefined,
      }}>
        {dots.map((row, rIdx) => (
          <div key={rIdx} style={{ display: 'flex', gap: 4 }}>
            {row.map((_, cIdx) => (
              <div
                key={cIdx}
                style={{
                  width: dotSize, height: dotSize,
                  borderRadius: '50%',
                  background: dotsLit
                    ? '#4CAF50'
                    : dotsShake
                      ? '#e74c3c'
                      : 'rgba(255,255,255,0.7)',
                  boxShadow: dotsLit
                    ? '0 0 8px rgba(76,175,80,0.8)'
                    : dotsShake
                      ? '0 0 8px rgba(231,76,60,0.6)'
                      : 'none',
                  transition: 'background 0.3s, box-shadow 0.3s',
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Answer choice grid 2×2 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        width: 'min(320px, 80vw)',
      }}>
        {prob.choices.map((choice, i) => {
          const state = choiceStates[i] ?? 'idle'
          let bg = 'rgba(255,255,255,0.15)'
          let border = '2px solid rgba(255,255,255,0.35)'
          let color = '#fff'
          let transform = 'scale(1)'

          if (state === 'correct') {
            bg = '#4CAF50'
            border = '2px solid #388E3C'
            transform = 'scale(1.08)'
          } else if (state === 'wrong') {
            bg = '#e74c3c'
            border = '2px solid #c0392b'
            transform = 'scale(0.95)'
          }

          return (
            <button
              key={i}
              onClick={() => handleChoice(i)}
              disabled={answered}
              style={{
                height: 64, borderRadius: 14,
                background: bg, color, border,
                fontSize: 28, fontWeight: 'bold',
                cursor: answered ? 'default' : 'pointer',
                transition: 'all 0.15s',
                transform,
                boxShadow: state === 'correct'
                  ? '0 4px 16px rgba(76,175,80,0.5)'
                  : state === 'wrong'
                    ? '0 4px 16px rgba(231,76,60,0.4)'
                    : '0 2px 8px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {choice}
            </button>
          )
        })}
      </div>

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 200, gap: 20,
        }}>
          <div style={{ color: '#FFD700', fontSize: 52, fontWeight: 'bold', textShadow: '2px 2px 10px rgba(0,0,0,0.5)' }}>
            Well Done! ⭐
          </div>
          <div style={{ color: '#fff', fontSize: 22 }}>
            {correctCount} / {totalProblems} correct on first try!
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '12px 32px', borderRadius: 12, background: '#4CAF50',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Play Again</button>
            <button onClick={() => setLevel(0)} style={{
              padding: '12px 32px', borderRadius: 12, background: '#7B1FA2',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Other Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '12px 32px', borderRadius: 12, background: '#FF5722',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Home</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-8px); }
          40%  { transform: translateX(8px); }
          60%  { transform: translateX(-5px); }
          80%  { transform: translateX(5px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
