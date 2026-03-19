import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestDictLevel } from '../../utils/levelUtils'

interface Question {
  q: string
  choices: string[]
  correct: number
}

interface PassageSet {
  passage: string
  questions: Question[]
}

interface LRComprehensionData {
  levels: Record<string, PassageSet[]>
}

type AnswerState = 'idle' | 'correct' | 'wrong'

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

const LEVEL_COLORS = [
  '#1565C0', '#1976D2', '#1E88E5', '#2196F3',
  '#039BE5', '#00ACC1', '#00838F', '#006064',
]

export default function LRComprehensionPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [sets, setSets] = useState<PassageSet[]>([])

  // gameplay state
  const [setIndex, setSetIndex] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [showComplete, setShowComplete] = useState(false)

  // progress: count total questions answered correctly across all sets
  const [progress, setProgress] = useState({ current: 0, max: 1 })

  useEffect(() => {
    fetch('/data/games/lrcomprehension.json')
      .then(r => r.json())
      .then((data: LRComprehensionData) => {
        const keys = Object.keys(data.levels).map(Number).sort((a, b) => a - b)
        setAvailableLevels(keys)
      })
      .catch(() => {})
  }, [])

  const startLevel = useCallback((lvl: number) => {
    fetch('/data/games/lrcomprehension.json')
      .then(r => r.json())
      .then((data: LRComprehensionData) => {
        const levelSets: PassageSet[] = findClosestDictLevel(data.levels, lvl) ?? []
        const totalQuestions = levelSets.reduce((acc, s) => acc + s.questions.length, 0)
        setSets(levelSets)
        setLevel(lvl)
        setSetIndex(0)
        setQuestionIndex(0)
        setAnswerState('idle')
        setSelectedChoice(null)
        setShowComplete(false)
        setProgress({ current: 0, max: totalQuestions })
      })
      .catch(() => {})
  }, [])

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

  const currentSet = sets[setIndex]
  const currentQuestion = currentSet?.questions[questionIndex]

  const handleChoiceClick = (choiceIndex: number) => {
    if (answerState !== 'idle') return
    setSelectedChoice(choiceIndex)
    if (choiceIndex === currentQuestion.correct) {
      setAnswerState('correct')
      setProgress(p => ({ ...p, current: p.current + 1 }))
      // Advance after a short delay
      setTimeout(() => {
        const nextQIndex = questionIndex + 1
        if (nextQIndex < currentSet.questions.length) {
          setQuestionIndex(nextQIndex)
          setAnswerState('idle')
          setSelectedChoice(null)
        } else {
          // All questions done for this set — wait for "Next Passage" button
          setAnswerState('correct') // keep green state, button will appear
        }
      }, 700)
    } else {
      setAnswerState('wrong')
      setTimeout(() => {
        setAnswerState('idle')
        setSelectedChoice(null)
      }, 800)
    }
  }

  const handleNextPassage = () => {
    const nextSetIndex = setIndex + 1
    if (nextSetIndex < sets.length) {
      setSetIndex(nextSetIndex)
      setQuestionIndex(0)
      setAnswerState('idle')
      setSelectedChoice(null)
    } else {
      setShowComplete(true)
    }
  }

  const allQuestionsForSetDone =
    answerState === 'correct' &&
    currentSet &&
    questionIndex === currentSet.questions.length - 1

  // Level select screen
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1a237e, #42a5f5)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" />
        <div style={{ fontSize: 48 }}>📖</div>
        <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.3)', margin: 0 }}>
          Reading Comprehension
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, margin: 0 }}>Choose a level to begin</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 }}>
          {availableLevels.map((lvl, i) => (
            <button
              key={lvl}
              onClick={() => startLevel(lvl)}
              style={{
                width: 72, height: 72, borderRadius: 14,
                background: LEVEL_COLORS[i % LEVEL_COLORS.length],
                color: '#fff', fontSize: 22, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: 'none', cursor: 'pointer',
              }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!currentSet || !currentQuestion) {
    return null
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #e3f2fd 0%, #bbdefb 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
      position: 'relative',
    }}>
      <BackButton color="#1565C0" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Header strip */}
      <div style={{
        width: '100%',
        background: 'linear-gradient(90deg, #1565C0, #1976D2)',
        padding: '48px 24px 16px',
        textAlign: 'center',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 4 }}>
          Level {level} — Passage {setIndex + 1} of {sets.length}
        </div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
          Reading Comprehension 📖
        </div>
      </div>

      {/* Passage box */}
      <div style={{
        margin: '24px 16px 16px',
        maxWidth: 680,
        width: 'calc(100% - 32px)',
        background: '#fff',
        borderRadius: 20,
        padding: '24px 28px',
        boxShadow: '0 4px 20px rgba(21,101,192,0.15)',
        borderLeft: '6px solid #1976D2',
        lineHeight: 1.8,
        fontSize: 20,
        color: '#1a237e',
        fontFamily: 'Georgia, serif',
      }}>
        {currentSet.passage}
      </div>

      {/* Question */}
      <div style={{
        maxWidth: 680,
        width: 'calc(100% - 32px)',
        margin: '0 16px 12px',
        background: 'rgba(255,255,255,0.7)',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 13, color: '#1565C0', fontWeight: 'bold', marginBottom: 6 }}>
          Question {questionIndex + 1} of {currentSet.questions.length}
        </div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: '#212121', lineHeight: 1.5 }}>
          {currentQuestion.q}
        </div>
      </div>

      {/* Choices */}
      <div style={{
        maxWidth: 680,
        width: 'calc(100% - 32px)',
        margin: '0 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {currentQuestion.choices.map((choice, i) => {
          let bg = '#fff'
          let border = '2px solid #BBDEFB'
          let color = '#212121'

          if (selectedChoice === i) {
            if (answerState === 'correct') {
              bg = '#E8F5E9'
              border = '2px solid #4CAF50'
              color = '#1B5E20'
            } else if (answerState === 'wrong') {
              bg = '#FFEBEE'
              border = '2px solid #F44336'
              color = '#B71C1C'
            }
          } else if (answerState === 'correct' && i === currentQuestion.correct) {
            bg = '#E8F5E9'
            border = '2px solid #4CAF50'
            color = '#1B5E20'
          }

          return (
            <button
              key={i}
              onClick={() => handleChoiceClick(i)}
              disabled={answerState !== 'idle'}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px',
                borderRadius: 14,
                background: bg,
                border,
                color,
                fontSize: 17,
                fontWeight: '500',
                textAlign: 'left',
                cursor: answerState === 'idle' ? 'pointer' : 'default',
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{
                width: 32, height: 32, borderRadius: 8,
                background: selectedChoice === i && answerState === 'correct'
                  ? '#4CAF50'
                  : selectedChoice === i && answerState === 'wrong'
                    ? '#F44336'
                    : i === currentQuestion.correct && answerState === 'correct'
                      ? '#4CAF50'
                      : '#1976D2',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: 15, flexShrink: 0,
              }}>
                {CHOICE_LABELS[i]}
              </span>
              {choice}
            </button>
          )
        })}
      </div>

      {/* Next Passage button — shown after all questions in the set are answered */}
      {allQuestionsForSetDone && (
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={handleNextPassage}
            style={{
              padding: '14px 40px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #43A047, #1B5E20)',
              color: '#fff',
              fontSize: 18,
              fontWeight: 'bold',
              boxShadow: '0 4px 16px rgba(27,94,32,0.4)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {setIndex + 1 < sets.length ? '📖 Next Passage →' : '🏆 Finish!'}
          </button>
        </div>
      )}

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 20,
        }}>
          <div style={{ fontSize: 64 }}>🏆</div>
          <div style={{ color: '#fff', fontSize: 42, fontWeight: 'bold', textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
            Great Job!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20 }}>
            You finished all passages!
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '12px 28px', borderRadius: 12, background: '#4CAF50',
              color: '#fff', fontSize: 18, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Play Again</button>
            <button onClick={() => setLevel(0)} style={{
              padding: '12px 28px', borderRadius: 12, background: '#2196F3',
              color: '#fff', fontSize: 18, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Other Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '12px 28px', borderRadius: 12, background: '#FF5722',
              color: '#fff', fontSize: 18, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
