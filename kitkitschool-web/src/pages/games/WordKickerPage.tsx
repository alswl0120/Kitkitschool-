import { findClosestDictLevel } from '../../utils/levelUtils'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

interface Problem {
  word: string
  blank: number
  choices: string[]
  correct: number
}

interface LevelData {
  problems: Problem[]
}

interface GameData {
  levels: Record<string, LevelData>
}

// Soccer field background drawn with CSS layers
function SoccerField() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: '#2d6a2d',
      zIndex: 0,
    }}>
      {/* Center circle */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 200, height: 200,
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.25)',
      }} />
      {/* Center line */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0, left: '50%',
        borderLeft: '3px solid rgba(255,255,255,0.2)',
      }} />
      {/* Left penalty box */}
      <div style={{
        position: 'absolute',
        top: '30%', left: 0,
        width: '15%', height: '40%',
        border: '3px solid rgba(255,255,255,0.2)',
        borderLeft: 'none',
      }} />
      {/* Right penalty box */}
      <div style={{
        position: 'absolute',
        top: '30%', right: 0,
        width: '15%', height: '40%',
        border: '3px solid rgba(255,255,255,0.2)',
        borderRight: 'none',
      }} />
      {/* Field outline */}
      <div style={{
        position: 'absolute',
        top: 12, left: 12, right: 12, bottom: 12,
        border: '3px solid rgba(255,255,255,0.2)',
      }} />
    </div>
  )
}

// Renders the word with the blank shown as an outlined box
function WordDisplay({ word, blank }: { word: string; blank: number }) {
  return (
    <div style={{
      display: 'flex', gap: 8,
      alignItems: 'center', justifyContent: 'center',
    }}>
      {word.split('').map((letter, i) => (
        <div key={i} style={{
          width: 64, height: 72,
          borderRadius: 12,
          background: i === blank ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
          border: i === blank ? '3px dashed #fff' : '3px solid rgba(255,255,255,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 42, fontWeight: 'bold',
          color: i === blank ? 'transparent' : '#1a3a1a',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
        }}>
          {i === blank ? '_' : letter.toUpperCase()}
        </div>
      ))}
    </div>
  )
}

// Simple CSS keyframe injector for ball animation
function injectStyles() {
  const id = 'wordkicker-styles'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `
    @keyframes kickGoal {
      0%   { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
      30%  { transform: translate(60px, -30px) scale(1.1) rotate(120deg); opacity: 1; }
      60%  { transform: translate(130px, -10px) scale(0.9) rotate(270deg); opacity: 1; }
      100% { transform: translate(190px, 0px) scale(0.7) rotate(360deg); opacity: 0.6; }
    }
    @keyframes kickBlock {
      0%   { transform: translate(0, 0) scale(1) rotate(0deg); }
      40%  { transform: translate(60px, -20px) scale(1.1) rotate(90deg); }
      70%  { transform: translate(80px, -5px) scale(1) rotate(120deg); }
      100% { transform: translate(30px, 20px) scale(0.9) rotate(140deg); }
    }
    @keyframes goalPop {
      0%   { transform: scale(0.5) translateY(10px); opacity: 0; }
      60%  { transform: scale(1.2) translateY(-8px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes blockShake {
      0%   { transform: translateX(0); }
      20%  { transform: translateX(-8px); }
      40%  { transform: translateX(8px); }
      60%  { transform: translateX(-5px); }
      80%  { transform: translateX(5px); }
      100% { transform: translateX(0); }
    }
    @keyframes choicePop {
      0%   { transform: scale(0.8); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes celebrate {
      0%   { transform: scale(0.8) rotate(-5deg); opacity: 0; }
      50%  { transform: scale(1.1) rotate(3deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
  `
  document.head.appendChild(style)
}

type AnimState = 'idle' | 'correct' | 'wrong'

export default function WordKickerPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [problemIndex, setProblemIndex] = useState(0)
  const [animState, setAnimState] = useState<AnimState>('idle')
  const [showComplete, setShowComplete] = useState(false)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)

  useEffect(() => { injectStyles() }, [])

  useEffect(() => {
    fetch('/data/games/wordkicker.json')
      .then(r => r.json())
      .then((data: GameData) => {
        setGameData(data)
        const lvls = Object.keys(data.levels).map(Number).sort((a, b) => a - b)
        setAvailableLevels(lvls)
      })
      .catch(() => setAvailableLevels([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setProblemIndex(0)
    setAnimState('idle')
    setShowComplete(false)
    setSelectedChoice(null)
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

  const currentProblems: Problem[] = findClosestDictLevel(gameData!.levels, level)?.problems ?? []
  const currentProblem = currentProblems[problemIndex] ?? null
  const totalProblems = currentProblems.length

  const handleChoice = (choiceIdx: number) => {
    if (animState !== 'idle' || !currentProblem) return
    setSelectedChoice(choiceIdx)

    if (choiceIdx === currentProblem.correct) {
      setAnimState('correct')
      setTimeout(() => {
        const nextIdx = problemIndex + 1
        if (nextIdx >= totalProblems) {
          setShowComplete(true)
        } else {
          setProblemIndex(nextIdx)
          setAnimState('idle')
          setSelectedChoice(null)
        }
      }, 1400)
    } else {
      setAnimState('wrong')
      setTimeout(() => {
        setAnimState('idle')
        setSelectedChoice(null)
      }, 1200)
    }
  }

  // Level select screen
  if (level === 0) {
    const colors = ['#FF8A65','#FFB74D','#FFD54F','#AED581','#4DB6AC','#4FC3F7','#7986CB','#BA68C8','#F06292','#A1887F']
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(160deg, #1b5e20 0%, #388e3c 60%, #1b5e20 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        position: 'relative',
      }}>
        <BackButton color="#fff" />
        <div style={{ fontSize: 64 }}>⚽</div>
        <h1 style={{
          color: '#fff', fontSize: 40, fontWeight: 'bold',
          textShadow: '2px 2px 8px rgba(0,0,0,0.4)', margin: 0,
        }}>
          Word Kicker
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, margin: 0 }}>
          Choose a level to play
        </p>
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap',
          justifyContent: 'center', maxWidth: 500,
        }}>
          {availableLevels.map(lvl => (
            <button key={lvl} onClick={() => startLevel(lvl)} style={{
              width: 80, height: 80, borderRadius: 16,
              background: colors[(lvl - 1) % colors.length],
              color: '#fff', fontSize: 24, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'transform 0.1s',
            }}>
              {lvl}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!currentProblem) return null

  // Build the display word with blank
  const displayLetters = currentProblem.word.split('')

  return (
    <div style={{
      width: '100vw', height: '100vh',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <SoccerField />

      <BackButton color="#fff" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={problemIndex + 1} max={totalProblems} />

      {/* Level badge */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        background: 'rgba(0,0,0,0.4)', borderRadius: 20,
        padding: '4px 14px', color: '#fff', fontSize: 14, fontWeight: 'bold',
      }}>
        Level {level}
      </div>

      {/* Main game area */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 32, zIndex: 5, padding: '60px 20px 20px',
      }}>

        {/* Word display card */}
        <div style={{
          background: 'rgba(0,0,0,0.45)',
          borderRadius: 24,
          padding: '28px 36px',
          backdropFilter: 'blur(4px)',
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 16,
            margin: '0 0 16px', letterSpacing: 1,
          }}>
            Fill in the missing letter
          </p>
          <WordDisplay word={currentProblem.word} blank={currentProblem.blank} />
        </div>

        {/* Soccer animation area */}
        <div style={{
          position: 'relative', width: 260, height: 80,
          display: 'flex', alignItems: 'center',
        }}>
          {/* Goal post */}
          <div style={{
            position: 'absolute', right: 0, top: 0,
            width: 60, height: 80,
            border: '4px solid #fff',
            borderLeft: '4px solid #fff',
            borderRadius: '0 8px 8px 0',
            background: 'rgba(255,255,255,0.1)',
          }} />

          {/* Soccer ball */}
          {animState !== 'idle' && (
            <div style={{
              position: 'absolute', left: 20, top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 36,
              animation: animState === 'correct'
                ? 'kickGoal 1.2s ease-in forwards'
                : 'kickBlock 1.0s ease-out forwards',
            }}>
              ⚽
            </div>
          )}

          {/* Goalkeeper blocker on wrong */}
          {animState === 'wrong' && (
            <div style={{
              position: 'absolute', right: 2, top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 40,
              animation: 'blockShake 0.6s ease-in-out',
            }}>
              🧤
            </div>
          )}

          {/* GOAL text */}
          {animState === 'correct' && (
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#FFD700', fontSize: 32, fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              animation: 'goalPop 0.5s ease-out forwards',
              zIndex: 10, whiteSpace: 'nowrap',
            }}>
              GOAL! ⚽
            </div>
          )}
        </div>

        {/* Choice buttons */}
        <div style={{ display: 'flex', gap: 16 }}>
          {currentProblem.choices.map((choice, idx) => {
            const isSelected = selectedChoice === idx
            const isCorrectSelected = isSelected && animState === 'correct'
            const isWrongSelected = isSelected && animState === 'wrong'
            return (
              <button
                key={idx}
                onClick={() => handleChoice(idx)}
                disabled={animState !== 'idle'}
                style={{
                  width: 80, height: 80,
                  borderRadius: 16,
                  fontSize: 36, fontWeight: 'bold',
                  border: 'none', cursor: animState === 'idle' ? 'pointer' : 'default',
                  background: isCorrectSelected
                    ? '#4CAF50'
                    : isWrongSelected
                      ? '#f44336'
                      : 'rgba(255,255,255,0.9)',
                  color: (isCorrectSelected || isWrongSelected) ? '#fff' : '#1a3a1a',
                  boxShadow: isSelected
                    ? '0 2px 8px rgba(0,0,0,0.2)'
                    : '0 6px 16px rgba(0,0,0,0.3)',
                  transform: isSelected ? 'scale(0.95)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                  animation: `choicePop 0.3s ease-out ${idx * 60}ms both`,
                }}
              >
                {choice.toUpperCase()}
              </button>
            )
          })}
        </div>
      </div>

      {/* Level complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 20,
        }}>
          <div style={{
            animation: 'celebrate 0.6s ease-out forwards',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 16,
          }}>
            <div style={{ fontSize: 72 }}>⚽🏆⚽</div>
            <div style={{
              color: '#FFD700', fontSize: 52, fontWeight: 'bold',
              textShadow: '3px 3px 10px rgba(0,0,0,0.5)',
            }}>
              Level Complete!
            </div>
            <div style={{ color: '#fff', fontSize: 24 }}>
              Great job! You scored every goal!
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '12px 28px', borderRadius: 12,
              background: '#4CAF50', color: '#fff',
              fontSize: 18, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              Play Again
            </button>
            <button onClick={() => setLevel(0)} style={{
              padding: '12px 28px', borderRadius: 12,
              background: '#2196F3', color: '#fff',
              fontSize: 18, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              Other Levels
            </button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '12px 28px', borderRadius: 12,
              background: '#FF5722', color: '#fff',
              fontSize: 18, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
