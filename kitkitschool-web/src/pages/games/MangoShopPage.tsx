import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

interface Problem {
  price: number
  choices: number[]
  correct: number
}

interface LevelData {
  level: number
  problems: Problem[]
}

interface GameData {
  levels: LevelData[]
}

// ---- Coin purse SVG component ----
function CoinPurse({ count, selected, state, onTap }: {
  count: number
  selected: boolean
  state: 'idle' | 'correct' | 'wrong'
  onTap: () => void
}) {
  const borderColor =
    state === 'correct' ? '#4CAF50' :
    state === 'wrong'   ? '#F44336' :
    selected            ? '#FF9800' :
                          '#E0A020'

  const bgColor =
    state === 'correct' ? '#E8F5E9' :
    state === 'wrong'   ? '#FFEBEE' :
    selected            ? '#FFF9C4' :
                          '#FFFDE7'

  const shake = state === 'wrong'
  const bounce = state === 'correct'

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px 12px',
        borderRadius: 20,
        border: `4px solid ${borderColor}`,
        background: bgColor,
        cursor: 'pointer',
        minWidth: 120,
        minHeight: 120,
        boxShadow: selected || state !== 'idle'
          ? `0 6px 20px rgba(0,0,0,0.25)`
          : `0 3px 10px rgba(0,0,0,0.15)`,
        transform: bounce ? 'scale(1.08)' : shake ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        animation: shake ? 'mangoShake 0.35s ease' :
                   bounce ? 'mangoBounce 0.4s ease' : 'none',
      }}
    >
      {/* Purse icon (SVG) */}
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <ellipse cx="22" cy="28" rx="17" ry="13" fill="#F9A825" stroke="#E65100" strokeWidth="2" />
        <ellipse cx="22" cy="27" rx="14" ry="11" fill="#FFD54F" />
        {/* Purse strap */}
        <path d="M16 18 Q22 10 28 18" stroke="#E65100" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Dollar sign */}
        <text x="22" y="31" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#E65100">$</text>
      </svg>
      {/* Coin dots */}
      <CoinDots count={count} />
      <span style={{ fontWeight: 'bold', fontSize: 20, color: '#E65100' }}>{count}</span>
    </div>
  )
}

function CoinDots({ count }: { count: number }) {
  const MAX_DISPLAY = 10
  const shown = Math.min(count, MAX_DISPLAY)
  const cols = shown <= 3 ? shown : shown <= 6 ? 3 : shown <= 9 ? 3 : 4
  const size = shown <= 5 ? 10 : 8

  if (count > MAX_DISPLAY) {
    // Show stacked coin icons for large numbers
    const tens = Math.floor(count / 10)
    const ones = count % 10
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 90 }}>
        {Array.from({ length: Math.min(tens, 5) }).map((_, i) => (
          <span key={`t${i}`} style={{ fontSize: 14 }}>🟡</span>
        ))}
        {Array.from({ length: Math.min(ones, 9) }).map((_, i) => (
          <span key={`o${i}`} style={{ fontSize: 10 }}>🟡</span>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, ${size}px)`,
      gap: 3,
      justifyContent: 'center',
    }}>
      {Array.from({ length: shown }).map((_, i) => (
        <div key={i} style={{
          width: size, height: size,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #FFE57F, #FFA000)',
          border: '1.5px solid #E65100',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }} />
      ))}
    </div>
  )
}

// ---- Main page ----
export default function MangoShopPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])

  // In-game state
  const [problems, setProblems] = useState<Problem[]>([])
  const [problemIndex, setProblemIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [choiceState, setChoiceState] = useState<('idle' | 'correct' | 'wrong')[]>([])
  const [showComplete, setShowComplete] = useState(false)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [flyCoins, setFlyCoins] = useState(false)

  const lockedRef = useRef(false)

  // Load data
  useEffect(() => {
    fetch('/data/games/mangoshop.json')
      .then(r => r.json())
      .then((data: GameData) => {
        setGameData(data)
        const lvls = data.levels.map(l => l.level).sort((a, b) => a - b)
        setAvailableLevels(lvls)
      })
      .catch(() => setAvailableLevels([]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProblemIndex(0)
    setSelectedChoice(null)
    setFlyCoins(false)
    lockedRef.current = false
  }, [])

  // Init problems when level/data ready
  useEffect(() => {
    if (!gameData || level === 0) return
    const found = gameData.levels.find(l => l.level === level)
    const probs = found ? found.problems : []
    setProblems(probs)
    setProgress({ current: 1, max: probs.length })
    setChoiceState(Array(probs.length > 0 ? probs[0].choices.length : 4).fill('idle'))
    setProblemIndex(0)
    setSelectedChoice(null)
    setFlyCoins(false)
    lockedRef.current = false
  }, [gameData, level])

  // Shell auto-start
  useEffect(() => {
    if (shellLevel && level === 0) startLevel(shellLevel)
  }, [shellLevel, level, startLevel])

  // Shell complete
  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  const currentProblem = problems[problemIndex]

  const handleChoice = useCallback((choiceIdx: number) => {
    if (lockedRef.current || !currentProblem) return
    if (selectedChoice !== null) return

    lockedRef.current = true
    setSelectedChoice(choiceIdx)

    const isCorrect = choiceIdx === currentProblem.correct
    const newStates: ('idle' | 'correct' | 'wrong')[] = currentProblem.choices.map((_, i) => {
      if (i === choiceIdx) return isCorrect ? 'correct' : 'wrong'
      return 'idle'
    })
    setChoiceState(newStates)

    if (isCorrect) {
      setFlyCoins(true)
      setTimeout(() => {
        setFlyCoins(false)
        const next = problemIndex + 1
        if (next >= problems.length) {
          setShowComplete(true)
        } else {
          setProblemIndex(next)
          setProgress({ current: next + 1, max: problems.length })
          setChoiceState(Array(problems[next].choices.length).fill('idle'))
          setSelectedChoice(null)
          lockedRef.current = false
        }
      }, 900)
    } else {
      setTimeout(() => {
        setChoiceState(Array(currentProblem.choices.length).fill('idle'))
        setSelectedChoice(null)
        lockedRef.current = false
      }, 700)
    }
  }, [currentProblem, problemIndex, problems, selectedChoice])

  // ---------- Level select screen ----------
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #FFD54F, #FF8F00)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <style>{`
          @keyframes mangoShake {
            0%,100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-6px); }
            80% { transform: translateX(6px); }
          }
          @keyframes mangoBounce {
            0% { transform: scale(1); }
            40% { transform: scale(1.18); }
            70% { transform: scale(0.95); }
            100% { transform: scale(1); }
          }
          @keyframes coinFly {
            0%   { transform: translateY(0) scale(1); opacity: 1; }
            60%  { transform: translateY(-60px) scale(1.3); opacity: 1; }
            100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
          }
        `}</style>
        <BackButton color="#fff" />
        <div style={{ fontSize: 64 }}>🥭</div>
        <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.3)', margin: 0 }}>
          Mango Shop
        </h1>
        <p style={{ color: '#fff8', fontSize: 18, margin: 0 }}>Pick the right amount!</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
          {availableLevels.map((lvl, i) => {
            const colors = ['#FF8A65','#FFB74D','#FFD54F','#AED581','#4DB6AC','#4FC3F7','#7986CB','#BA68C8','#F06292','#A1887F']
            return (
              <button key={lvl} onClick={() => startLevel(lvl)} style={{
                width: 80, height: 80, borderRadius: 16,
                background: colors[i % colors.length],
                color: '#fff', fontSize: 24, fontWeight: 'bold',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              }}>
                {lvl}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------- Game screen ----------
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #FFF9C4 0%, #FFE082 50%, #FFCA28 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      gap: 0,
    }}>
      <style>{`
        @keyframes mangoShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes mangoBounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.18); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes coinFly {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          60%  { transform: translateY(-70px) scale(1.4); opacity: 1; }
          100% { transform: translateY(-150px) scale(0.3); opacity: 0; }
        }
        @keyframes mangoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <BackButton color="#B45309" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Shop header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 70,
        background: 'linear-gradient(90deg, #FF8F00, #FF6F00)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
      }}>
        <span style={{ fontSize: 28, marginRight: 10 }}>🛒</span>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 22, letterSpacing: 1 }}>
          Mango Shop
        </span>
      </div>

      {/* Main area */}
      {currentProblem && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 24,
          marginTop: 60,
          width: '100%', maxWidth: 560, padding: '0 16px',
        }}>

          {/* Mango + price display */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 12,
          }}>
            <div style={{ animation: 'mangoFloat 2.5s ease-in-out infinite', fontSize: 80 }}>
              🥭
            </div>

            {/* Price tag */}
            <div style={{
              background: '#fff',
              border: '4px solid #FF8F00',
              borderRadius: 20,
              padding: '10px 28px',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              position: 'relative',
            }}>
              {/* Tag hole */}
              <div style={{
                position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
                width: 10, height: 10, borderRadius: '50%',
                border: '2px solid #FF8F00', background: '#fff',
              }} />
              <span style={{ fontSize: 18, color: '#FF8F00', fontWeight: 'bold' }}>Price:</span>
              <span style={{ fontSize: 38, fontWeight: 'bold', color: '#E65100' }}>
                ${currentProblem.price}
              </span>
            </div>

            <p style={{ color: '#B45309', fontWeight: 'bold', fontSize: 16, margin: 0 }}>
              Tap the coin purse with the right amount!
            </p>
          </div>

          {/* Flying coins animation */}
          {flyCoins && (
            <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 20 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${(i - 2) * 22}px`,
                  animation: `coinFly 0.8s ease ${i * 0.07}s forwards`,
                  fontSize: 26,
                }}>
                  🪙
                </div>
              ))}
            </div>
          )}

          {/* Choice grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16, width: '100%',
          }}>
            {currentProblem.choices.map((count, i) => (
              <CoinPurse
                key={i}
                count={count}
                selected={selectedChoice === i}
                state={choiceState[i] ?? 'idle'}
                onTap={() => handleChoice(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completion overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 24,
        }}>
          <div style={{ fontSize: 72 }}>🎉</div>
          <div style={{ color: '#fff', fontSize: 42, fontWeight: 'bold', textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
            Great Job!
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '12px 28px', borderRadius: 12, background: '#4CAF50',
              color: '#fff', fontSize: 18, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>Play Again</button>
            <button onClick={() => { setLevel(0); setShowComplete(false) }} style={{
              padding: '12px 28px', borderRadius: 12, background: '#2196F3',
              color: '#fff', fontSize: 18, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>Other Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '12px 28px', borderRadius: 12, background: '#FF5722',
              color: '#fff', fontSize: 18, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
