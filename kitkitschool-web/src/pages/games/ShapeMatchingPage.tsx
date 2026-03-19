import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

type ShapeName = 'circle' | 'square' | 'triangle' | 'rectangle' | 'star' | 'heart' | 'diamond' | 'oval'

interface Problem {
  shape: ShapeName
  choices: ShapeName[]
  correct: number
}

interface LevelData {
  level: number
  problems: Problem[]
}

interface GameData {
  levels: LevelData[]
}

// ---- SVG shape renderer ----
const SHAPE_COLORS: Record<number, string> = {
  0: '#2196F3',  // blue
  1: '#F44336',  // red
  2: '#4CAF50',  // green
  3: '#FF9800',  // orange
}

function ShapeSVG({
  shape,
  size = 80,
  colorIndex = 0,
  filled = true,
}: {
  shape: ShapeName
  size?: number
  colorIndex?: number
  filled?: boolean
}) {
  const color = SHAPE_COLORS[colorIndex % 4]
  const fill = filled ? color : 'none'
  const stroke = color
  const sw = size * 0.06

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.42

  switch (shape) {
    case 'circle':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      )
    case 'square': {
      const pad = size * 0.1
      const s = size - pad * 2
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect x={pad} y={pad} width={s} height={s} rx={size * 0.04} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      )
    }
    case 'triangle': {
      const pts = [
        `${cx},${size * 0.08}`,
        `${size * 0.05},${size * 0.92}`,
        `${size * 0.95},${size * 0.92}`,
      ].join(' ')
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      )
    }
    case 'rectangle': {
      const padX = size * 0.06
      const padY = size * 0.22
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect
            x={padX} y={padY}
            width={size - padX * 2} height={size - padY * 2}
            rx={size * 0.04}
            fill={fill} stroke={stroke} strokeWidth={sw}
          />
        </svg>
      )
    }
    case 'star': {
      const outerR = size * 0.44
      const innerR = size * 0.18
      const points = 5
      const pts: string[] = []
      for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI / points) * i - Math.PI / 2
        const rad = i % 2 === 0 ? outerR : innerR
        pts.push(`${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`)
      }
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      )
    }
    case 'heart': {
      const s2 = size
      // Heart via cubic bezier
      const path = `
        M ${s2 * 0.5} ${s2 * 0.78}
        C ${s2 * 0.18} ${s2 * 0.55}, ${s2 * 0.05} ${s2 * 0.35}, ${s2 * 0.18} ${s2 * 0.22}
        C ${s2 * 0.28} ${s2 * 0.10}, ${s2 * 0.42} ${s2 * 0.10}, ${s2 * 0.50} ${s2 * 0.25}
        C ${s2 * 0.58} ${s2 * 0.10}, ${s2 * 0.72} ${s2 * 0.10}, ${s2 * 0.82} ${s2 * 0.22}
        C ${s2 * 0.95} ${s2 * 0.35}, ${s2 * 0.82} ${s2 * 0.55}, ${s2 * 0.50} ${s2 * 0.78}
        Z
      `
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <path d={path} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      )
    }
    case 'diamond': {
      const pts2 = [
        `${cx},${size * 0.06}`,
        `${size * 0.94},${cy}`,
        `${cx},${size * 0.94}`,
        `${size * 0.06},${cy}`,
      ].join(' ')
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={pts2} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      )
    }
    case 'oval': {
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <ellipse cx={cx} cy={cy} rx={size * 0.44} ry={size * 0.28} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      )
    }
    default:
      return <svg width={size} height={size} />
  }
}

const SHAPE_LABELS: Record<ShapeName, string> = {
  circle: 'Circle',
  square: 'Square',
  triangle: 'Triangle',
  rectangle: 'Rectangle',
  star: 'Star',
  heart: 'Heart',
  diamond: 'Diamond',
  oval: 'Oval',
}

// ---- Choice card ----
function ShapeChoiceCard({
  shape,
  colorIndex,
  state,
  onTap,
}: {
  shape: ShapeName
  colorIndex: number
  state: 'idle' | 'correct' | 'wrong'
  onTap: () => void
}) {
  const borderColor =
    state === 'correct' ? '#4CAF50' :
    state === 'wrong'   ? '#F44336' :
                          '#CBD5E1'

  const bg =
    state === 'correct' ? '#E8F5E9' :
    state === 'wrong'   ? '#FFEBEE' :
                          '#fff'

  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 18,
        border: `4px solid ${borderColor}`,
        background: bg,
        cursor: 'pointer',
        boxShadow: state !== 'idle'
          ? '0 6px 18px rgba(0,0,0,0.2)'
          : '0 3px 10px rgba(0,0,0,0.1)',
        animation:
          state === 'wrong'   ? 'shapeShake 0.35s ease' :
          state === 'correct' ? 'shapePop 0.35s ease' : 'none',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <ShapeSVG shape={shape} size={72} colorIndex={colorIndex} />
      <span style={{
        fontWeight: 'bold',
        fontSize: 14,
        color: '#555',
        letterSpacing: 0.3,
      }}>
        {SHAPE_LABELS[shape]}
      </span>
    </div>
  )
}

// ---- Main page ----
export default function ShapeMatchingPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])

  const [problems, setProblems] = useState<Problem[]>([])
  const [problemIndex, setProblemIndex] = useState(0)
  const [choiceStates, setChoiceStates] = useState<('idle' | 'correct' | 'wrong')[]>([])
  const [showComplete, setShowComplete] = useState(false)
  const [progress, setProgress] = useState({ current: 0, max: 1 })

  const lockedRef = useRef(false)

  useEffect(() => {
    // Try both case variants for cross-platform compatibility
    fetch('/data/games/shapeMatching.json')
      .catch(() => fetch('/data/games/shapematching.json'))
      .then(r => r.json())
      .then((data: GameData) => {
        setGameData(data)
        setAvailableLevels(data.levels.map(l => l.level).sort((a, b) => a - b))
      })
      .catch(() => {
        // Fallback: hardcoded problems so the game is always playable
        const fallback: GameData = {
          levels: [
            {
              level: 1,
              problems: [
                { shape: 'circle',   choices: ['circle','square','triangle','rectangle'], correct: 0 },
                { shape: 'square',   choices: ['triangle','square','circle','rectangle'], correct: 1 },
                { shape: 'triangle', choices: ['circle','rectangle','triangle','square'], correct: 2 },
                { shape: 'rectangle', choices: ['square','circle','rectangle','triangle'], correct: 2 },
              ],
            },
            {
              level: 2,
              problems: [
                { shape: 'star',     choices: ['star','heart','diamond','oval'],    correct: 0 },
                { shape: 'heart',    choices: ['diamond','heart','star','oval'],    correct: 1 },
                { shape: 'diamond',  choices: ['oval','star','diamond','heart'],    correct: 2 },
                { shape: 'oval',     choices: ['heart','star','oval','diamond'],    correct: 2 },
              ],
            },
            {
              level: 3,
              problems: [
                { shape: 'circle',   choices: ['star','circle','oval','triangle'],  correct: 1 },
                { shape: 'star',     choices: ['star','heart','square','rectangle'], correct: 0 },
                { shape: 'oval',     choices: ['circle','triangle','star','oval'],  correct: 3 },
                { shape: 'diamond',  choices: ['heart','diamond','star','square'],  correct: 1 },
              ],
            },
          ],
        }
        setGameData(fallback)
        setAvailableLevels(fallback.levels.map(l => l.level))
      })
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProblemIndex(0)
    lockedRef.current = false
  }, [])

  useEffect(() => {
    if (!gameData || level === 0) return
    const found = gameData.levels.find(l => l.level === level)
    const probs = found ? found.problems : []
    setProblems(probs)
    setProgress({ current: 1, max: probs.length })
    setChoiceStates(Array(probs.length > 0 ? probs[0].choices.length : 4).fill('idle'))
    setProblemIndex(0)
    lockedRef.current = false
  }, [gameData, level])

  useEffect(() => {
    if (shellLevel && level === 0) startLevel(shellLevel)
  }, [shellLevel, level, startLevel])

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  const currentProblem = problems[problemIndex]

  const handleChoice = useCallback((choiceIdx: number) => {
    if (lockedRef.current || !currentProblem) return

    lockedRef.current = true
    const isCorrect = choiceIdx === currentProblem.correct

    setChoiceStates(prev => prev.map((_, i) => {
      if (i === choiceIdx) return isCorrect ? 'correct' : 'wrong'
      return 'idle'
    }))

    if (isCorrect) {
      setTimeout(() => {
        const next = problemIndex + 1
        if (next >= problems.length) {
          setShowComplete(true)
        } else {
          setProblemIndex(next)
          setProgress({ current: next + 1, max: problems.length })
          setChoiceStates(Array(problems[next].choices.length).fill('idle'))
          lockedRef.current = false
        }
      }, 700)
    } else {
      setTimeout(() => {
        setChoiceStates(Array(currentProblem.choices.length).fill('idle'))
        lockedRef.current = false
      }, 600)
    }
  }, [currentProblem, problemIndex, problems])

  // ---- Level select ----
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #E3F2FD, #90CAF9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <style>{`
          @keyframes shapeShake {
            0%,100% { transform: translateX(0); }
            20% { transform: translateX(-7px); }
            40% { transform: translateX(7px); }
            60% { transform: translateX(-5px); }
            80% { transform: translateX(5px); }
          }
          @keyframes shapePop {
            0% { transform: scale(1); }
            40% { transform: scale(1.2); }
            70% { transform: scale(0.93); }
            100% { transform: scale(1); }
          }
          @keyframes shapeFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>
        <BackButton color="#1565C0" />
        <div style={{ display: 'flex', gap: 10, animation: 'shapeFloat 3s ease-in-out infinite' }}>
          <ShapeSVG shape="circle"   size={44} colorIndex={0} />
          <ShapeSVG shape="star"     size={44} colorIndex={1} />
          <ShapeSVG shape="triangle" size={44} colorIndex={2} />
          <ShapeSVG shape="heart"    size={44} colorIndex={3} />
        </div>
        <h1 style={{ color: '#1565C0', fontSize: 36, fontWeight: 'bold', textShadow: '1px 1px 4px rgba(0,0,0,0.15)', margin: 0 }}>
          Shape Matching
        </h1>
        <p style={{ color: '#1976D2', fontSize: 17, margin: 0 }}>Match the shape on the left!</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
          {availableLevels.map((lvl, i) => {
            const colors = ['#42A5F5','#26C6DA','#66BB6A','#FFA726','#AB47BC','#EC407A','#8D6E63','#78909C']
            return (
              <button key={lvl} onClick={() => startLevel(lvl)} style={{
                width: 80, height: 80, borderRadius: 16,
                background: colors[i % colors.length],
                color: '#fff', fontSize: 24, fontWeight: 'bold',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}>
                {lvl}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- Game screen ----
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #E3F2FD 0%, #BBDEFB 60%, #90CAF9 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      gap: 0,
    }}>
      <style>{`
        @keyframes shapeShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-7px); }
          40% { transform: translateX(7px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        @keyframes shapePop {
          0% { transform: scale(1); }
          40% { transform: scale(1.2); }
          70% { transform: scale(0.93); }
          100% { transform: scale(1); }
        }
        @keyframes shapeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shapeReveal {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <BackButton color="#1565C0" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Header bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 70,
        background: 'linear-gradient(90deg, #1565C0, #1976D2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
      }}>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 22, letterSpacing: 1 }}>
          Shape Matching
        </span>
      </div>

      {currentProblem && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          marginTop: 60,
          width: '100%',
          maxWidth: 640,
          padding: '0 16px',
        }}>

          {/* Instruction */}
          <p style={{ color: '#1565C0', fontWeight: 'bold', fontSize: 16, margin: 0 }}>
            Find the matching shape!
          </p>

          {/* Main row: big shape on left + choices on right */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            width: '100%',
          }}>
            {/* Target shape */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 10,
              background: '#fff',
              border: '4px solid #1976D2',
              borderRadius: 24,
              padding: '20px 24px',
              boxShadow: '0 6px 20px rgba(25,118,210,0.25)',
              animation: 'shapeReveal 0.4s ease',
              minWidth: 140,
            }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1976D2', letterSpacing: 1, textTransform: 'uppercase' }}>
                Match this
              </div>
              <ShapeSVG shape={currentProblem.shape} size={110} colorIndex={0} />
              <span style={{ fontWeight: 'bold', fontSize: 16, color: '#1565C0' }}>
                {SHAPE_LABELS[currentProblem.shape]}
              </span>
            </div>

            {/* Arrow */}
            <div style={{ fontSize: 28, color: '#1976D2' }}>→</div>

            {/* 2x2 choice grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              flex: 1,
              maxWidth: 300,
            }}>
              {currentProblem.choices.map((shape, i) => (
                <ShapeChoiceCard
                  key={`${problemIndex}-${i}`}
                  shape={shape}
                  colorIndex={i + 1}
                  state={choiceStates[i] ?? 'idle'}
                  onTap={() => handleChoice(i)}
                />
              ))}
            </div>
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
          <div style={{ display: 'flex', gap: 12 }}>
            {(['circle','star','heart','diamond'] as ShapeName[]).map((s, i) => (
              <ShapeSVG key={s} shape={s} size={52} colorIndex={i} />
            ))}
          </div>
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
