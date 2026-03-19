import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

// ---- Types ----
type ShapeName = 'circle' | 'square' | 'triangle' | 'star' | 'rectangle' | 'diamond'

interface Round {
  target: ShapeName
  shapes: ShapeName[]
  correctCount: number
}

interface LevelData {
  levelIndex: number
  rounds: Round[]
}

interface GameData {
  levels: LevelData[]
}

// ---- Constants ----
const SHAPE_COLORS: string[] = [
  '#FF4B6E', // coral-red
  '#FF9F1C', // warm orange
  '#2EC4B6', // teal
  '#7B2FBE', // purple
  '#06D6A0', // mint green
  '#3A86FF', // bright blue
]

const SHAPE_LABELS: Record<ShapeName, string> = {
  circle:    'Circle',
  square:    'Square',
  triangle:  'Triangle',
  star:      'Star',
  rectangle: 'Rectangle',
  diamond:   'Diamond',
}

// Each floating shape has a unique slot across 3 columns x 2 rows
const SLOT_POSITIONS: { col: number; row: number }[] = [
  { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
  { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
]

// ---- SVG Shapes ----
function ShapeSVG({
  shape,
  size = 80,
  color,
}: {
  shape: ShapeName
  size?: number
  color: string
}) {
  const cx = size / 2
  const cy = size / 2
  const r  = size * 0.42
  const sw = Math.max(2, size * 0.055)

  switch (shape) {
    case 'circle':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth={sw} />
        </svg>
      )
    case 'square': {
      const pad = size * 0.1
      const s   = size - pad * 2
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect x={pad} y={pad} width={s} height={s} rx={size * 0.08}
            fill={color} stroke="#fff" strokeWidth={sw} />
        </svg>
      )
    }
    case 'triangle': {
      const pts = [
        `${cx},${size * 0.07}`,
        `${size * 0.05},${size * 0.93}`,
        `${size * 0.95},${size * 0.93}`,
      ].join(' ')
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={pts} fill={color} stroke="#fff" strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      )
    }
    case 'star': {
      const outerR = size * 0.44
      const innerR = size * 0.18
      const pts: string[] = []
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2
        const rad   = i % 2 === 0 ? outerR : innerR
        pts.push(`${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`)
      }
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={pts.join(' ')} fill={color} stroke="#fff" strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      )
    }
    case 'rectangle': {
      const padX = size * 0.06
      const padY = size * 0.22
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect x={padX} y={padY}
            width={size - padX * 2} height={size - padY * 2}
            rx={size * 0.06}
            fill={color} stroke="#fff" strokeWidth={sw} />
        </svg>
      )
    }
    case 'diamond': {
      const pts = [
        `${cx},${size * 0.06}`,
        `${size * 0.94},${cy}`,
        `${cx},${size * 0.94}`,
        `${size * 0.06},${cy}`,
      ].join(' ')
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={pts} fill={color} stroke="#fff" strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      )
    }
    default:
      return <svg width={size} height={size} />
  }
}

// ---- Floating Shape Tile ----
type TileState = 'floating' | 'correct' | 'wrong' | 'gone'

function FloatingShapeTile({
  shape,
  color,
  slotIndex,
  tileState,
  onTap,
}: {
  shape: ShapeName
  color: string
  slotIndex: number
  tileState: TileState
  onTap: () => void
}) {
  const { col, row } = SLOT_POSITIONS[slotIndex]

  const colWidth  = 100 / 3
  const rowHeight = 42  // % of the play area (two rows inside ~84vh)

  const leftBase = col * colWidth + colWidth / 2
  const topBase  = row * rowHeight + rowHeight / 2

  // Unique float offset per slot so shapes bob at different phases
  const floatDuration = 2.2 + slotIndex * 0.28
  const floatDelay    = -(slotIndex * 0.44)

  const isGone    = tileState === 'gone'
  const isCorrect = tileState === 'correct'
  const isWrong   = tileState === 'wrong'

  return (
    <div
      onClick={isGone ? undefined : onTap}
      style={{
        position:  'absolute',
        left:      `${leftBase}%`,
        top:       `${topBase}%`,
        transform: 'translate(-50%, -50%)',
        zIndex:    10,
        cursor:    isGone ? 'default' : 'pointer',
        opacity:   isGone ? 0 : 1,
        transition: isGone ? 'opacity 0.3s ease' : undefined,
        animation: isGone || isCorrect || isWrong
          ? (isCorrect ? 'airPop 0.4s ease forwards' : isWrong ? 'airShake 0.35s ease' : 'none')
          : `airBob ${floatDuration}s ease-in-out ${floatDelay}s infinite`,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div
        style={{
          background:   isCorrect ? '#C8F7DC' : isWrong ? '#FFDDE1' : 'rgba(255,255,255,0.82)',
          borderRadius: '50%',
          padding:      12,
          boxShadow:    isCorrect
            ? '0 0 0 5px #2EC4B6, 0 8px 24px rgba(0,0,0,0.18)'
            : isWrong
            ? '0 0 0 5px #FF4B6E, 0 8px 24px rgba(0,0,0,0.18)'
            : '0 6px 20px rgba(0,0,0,0.14)',
          border: '3px solid rgba(255,255,255,0.7)',
          transition:  'box-shadow 0.15s, background 0.15s',
        }}
      >
        <ShapeSVG shape={shape} size={72} color={color} />
      </div>
      <div style={{
        textAlign:  'center',
        marginTop:  4,
        fontWeight: 'bold',
        fontSize:   12,
        color:      '#1a3a5c',
        textShadow: '0 1px 3px rgba(255,255,255,0.8)',
        letterSpacing: 0.5,
      }}>
        {SHAPE_LABELS[shape]}
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function AirShapesPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [gameData, setGameData]           = useState<GameData | null>(null)
  const [level, setLevel]                 = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])

  // In-game state
  const [roundIndex, setRoundIndex]       = useState(0)
  const [currentRound, setCurrentRound]   = useState<Round | null>(null)
  const [tileStates, setTileStates]       = useState<TileState[]>([])
  const [score, setScore]                 = useState(0)        // correct taps so far this round
  const [needed, setNeeded]               = useState(0)        // how many correct taps needed
  const [showComplete, setShowComplete]   = useState(false)
  const [progress, setProgress]           = useState({ current: 0, max: 8 })
  const [roundFeedback, setRoundFeedback] = useState<'none' | 'great' | 'try'>('none')

  const lockedRef       = useRef(false)
  const correctSoFarRef = useRef(0)

  // ---- Fetch data ----
  useEffect(() => {
    fetch('/data/games/airshapes.json')
      .then(r => r.json())
      .then((data: GameData) => {
        setGameData(data)
        setAvailableLevels(data.levels.map(l => l.levelIndex).sort((a, b) => a - b))
      })
      .catch(() => setAvailableLevels([]))
  }, [])

  // ---- Shell auto-start ----
  useEffect(() => {
    if (shellLevel && level === 0) startLevel(shellLevel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellLevel])

  // ---- When level selected, load round 0 ----
  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setRoundIndex(0)
    setScore(0)
    setShowComplete(false)
    setRoundFeedback('none')
    lockedRef.current = false
  }, [])

  // ---- When roundIndex or level changes, apply the new round ----
  useEffect(() => {
    if (!gameData || level === 0) return
    const found = gameData.levels.find(l => l.levelIndex === level)
    if (!found) return
    const round = found.rounds[roundIndex]
    if (!round) return
    setCurrentRound(round)
    setTileStates(round.shapes.map(() => 'floating'))
    setNeeded(round.correctCount)
    correctSoFarRef.current = 0
    lockedRef.current = false
    setRoundFeedback('none')
    setProgress({ current: roundIndex + 1, max: found.rounds.length })
  }, [gameData, level, roundIndex])

  // ---- Shell complete ----
  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // ---- Assign stable colors per shape type for this round ----
  const shapeColorMap = useCallback((shape: ShapeName): string => {
    const idx = (['circle','square','triangle','star','rectangle','diamond'] as ShapeName[]).indexOf(shape)
    return SHAPE_COLORS[idx % SHAPE_COLORS.length]
  }, [])

  // ---- Handle tap ----
  const handleTap = useCallback((tileIndex: number) => {
    if (lockedRef.current || !currentRound) return
    const tappedShape = currentRound.shapes[tileIndex]

    if (tappedShape === currentRound.target) {
      // Correct!
      setTileStates(prev => prev.map((s, i) => i === tileIndex ? 'correct' : s))

      correctSoFarRef.current += 1
      const newScore = correctSoFarRef.current

      // After short pop animation, mark tile gone
      setTimeout(() => {
        setTileStates(prev => prev.map((s, i) => i === tileIndex ? 'gone' : s))
      }, 420)

      if (newScore >= currentRound.correctCount) {
        // Round complete
        lockedRef.current = true
        setScore(s => s + newScore)
        setRoundFeedback('great')

        setTimeout(() => {
          setRoundFeedback('none')
          const found = gameData?.levels.find(l => l.levelIndex === level)
          if (!found) return
          const nextRound = roundIndex + 1
          if (nextRound >= found.rounds.length) {
            setShowComplete(true)
          } else {
            setRoundIndex(nextRound)
          }
        }, 900)
      }
    } else {
      // Wrong – shake, no lock
      setTileStates(prev => prev.map((s, i) => i === tileIndex ? 'wrong' : s))
      setTimeout(() => {
        setTileStates(prev => prev.map((s, i) => i === tileIndex && s === 'wrong' ? 'floating' : s))
      }, 380)
    }
  }, [currentRound, gameData, level, roundIndex])

  // ---- Clouds (decorative) ----
  const clouds = [
    { top: '8%',  left: '5%',  scale: 1.2,  opacity: 0.5, speed: 22 },
    { top: '22%', left: '60%', scale: 0.8,  opacity: 0.4, speed: 28 },
    { top: '55%', left: '15%', scale: 1.0,  opacity: 0.35, speed: 18 },
    { top: '70%', left: '72%', scale: 0.65, opacity: 0.3, speed: 32 },
  ]

  // ========== LEVEL SELECT ==========
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(160deg, #87CEEB 0%, #B0E2FF 50%, #E0F4FF 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <style>{`
          @keyframes airBob {
            0%,100% { transform: translate(-50%,-50%) translateY(0px); }
            50%      { transform: translate(-50%,-50%) translateY(-14px); }
          }
          @keyframes airPop {
            0%   { transform: scale(1); }
            40%  { transform: scale(1.35); }
            70%  { transform: scale(0.9); }
            100% { transform: scale(0); opacity: 0; }
          }
          @keyframes airShake {
            0%,100% { transform: translateX(0); }
            20%     { transform: translateX(-8px); }
            40%     { transform: translateX(8px); }
            60%     { transform: translateX(-5px); }
            80%     { transform: translateX(5px); }
          }
          @keyframes cloudDrift {
            0%   { transform: translateX(0); }
            50%  { transform: translateX(18px); }
            100% { transform: translateX(0); }
          }
          @keyframes levelBounce {
            0%,100% { transform: translateY(0) scale(1); }
            50%     { transform: translateY(-6px) scale(1.06); }
          }
          @keyframes titleFloat {
            0%,100% { transform: translateY(0); }
            50%     { transform: translateY(-8px); }
          }
        `}</style>

        <BackButton color="#1a5276" />

        {/* Clouds */}
        {clouds.map((c, i) => (
          <div key={i} style={{
            position: 'absolute', top: c.top, left: c.left,
            opacity: c.opacity, pointerEvents: 'none',
            transform: `scale(${c.scale})`,
            animation: `cloudDrift ${c.speed}s ease-in-out infinite`,
          }}>
            <svg width="90" height="50" viewBox="0 0 90 50">
              <ellipse cx="45" cy="34" rx="40" ry="18" fill="white"/>
              <ellipse cx="28" cy="28" rx="20" ry="16" fill="white"/>
              <ellipse cx="60" cy="26" rx="22" ry="15" fill="white"/>
            </svg>
          </div>
        ))}

        {/* Title row with sample shapes */}
        <div style={{
          display: 'flex', gap: 14, alignItems: 'center',
          animation: 'titleFloat 3s ease-in-out infinite',
        }}>
          <ShapeSVG shape="circle"   size={46} color="#FF4B6E" />
          <ShapeSVG shape="star"     size={46} color="#FF9F1C" />
          <ShapeSVG shape="triangle" size={46} color="#2EC4B6" />
          <ShapeSVG shape="diamond"  size={46} color="#7B2FBE" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            color: '#1a3a5c', fontSize: 40, fontWeight: 900,
            margin: 0, textShadow: '2px 3px 0 rgba(255,255,255,0.6)',
            letterSpacing: 1,
          }}>
            Air Shapes
          </h1>
          <p style={{ color: '#2874A6', fontSize: 17, margin: '8px 0 0', fontWeight: 600 }}>
            Tap all the shapes that match the target!
          </p>
        </div>

        {/* Level buttons */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {availableLevels.map((lvl, i) => {
            const gradients = [
              'linear-gradient(135deg,#42A5F5,#1E88E5)',
              'linear-gradient(135deg,#26C6DA,#00ACC1)',
              'linear-gradient(135deg,#AB47BC,#8E24AA)',
            ]
            const labelColors = ['#E3F2FD','#E0F7FA','#F3E5F5']
            return (
              <button key={lvl} onClick={() => startLevel(lvl)} style={{
                width: 100, height: 100, borderRadius: 20,
                background: gradients[i % gradients.length],
                border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                animation: `levelBounce ${2.4 + i * 0.4}s ease-in-out infinite`,
              }}>
                <span style={{ color: '#fff', fontSize: 30, fontWeight: 900 }}>{lvl}</span>
                <span style={{
                  color: labelColors[i % labelColors.length],
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                }}>LEVEL</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ========== GAME SCREEN ==========
  const targetColor = currentRound ? shapeColorMap(currentRound.target) : '#2EC4B6'

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(180deg, #87CEEB 0%, #B0E2FF 40%, #D6EFFF 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes airBob {
          0%,100% { transform: translate(-50%,-50%) translateY(0px); }
          50%      { transform: translate(-50%,-50%) translateY(-14px); }
        }
        @keyframes airPop {
          0%   { transform: scale(1); opacity: 1; }
          40%  { transform: scale(1.35); opacity: 1; }
          70%  { transform: scale(0.9); opacity: 0.6; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes airShake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-8px); }
          40%     { transform: translateX(8px); }
          60%     { transform: translateX(-5px); }
          80%     { transform: translateX(5px); }
        }
        @keyframes cloudDrift {
          0%   { transform: translateX(0); }
          50%  { transform: translateX(18px); }
          100% { transform: translateX(0); }
        }
        @keyframes feedbackPop {
          0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0; }
          40%  { transform: translate(-50%,-50%) scale(1.15); opacity: 1; }
          80%  { transform: translate(-50%,-50%) scale(0.97); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 0; }
        }
        @keyframes headerSlide {
          0%   { transform: translateY(-80px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Back + Progress */}
      <BackButton color="#1a3a5c" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Header bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 66,
        background: 'linear-gradient(90deg, #1565C0cc, #1976D2cc)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
        animation: 'headerSlide 0.4s ease',
        zIndex: 30,
      }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: 1.2 }}>
          Air Shapes
        </span>
      </div>

      {/* Decorative clouds */}
      {clouds.map((c, i) => (
        <div key={i} style={{
          position: 'absolute', top: c.top, left: c.left,
          opacity: c.opacity, pointerEvents: 'none',
          transform: `scale(${c.scale})`,
          animation: `cloudDrift ${c.speed}s ease-in-out infinite`,
          zIndex: 1,
        }}>
          <svg width="90" height="50" viewBox="0 0 90 50">
            <ellipse cx="45" cy="34" rx="40" ry="18" fill="white"/>
            <ellipse cx="28" cy="28" rx="20" ry="16" fill="white"/>
            <ellipse cx="60" cy="26" rx="22" ry="15" fill="white"/>
          </svg>
        </div>
      ))}

      {/* Target shape card */}
      {currentRound && (
        <div style={{
          position: 'absolute', top: 80, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.88)',
          border: `3px solid ${targetColor}`,
          borderRadius: 20,
          padding: '10px 20px',
          boxShadow: `0 6px 20px ${targetColor}44`,
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#5D6D7E',
              letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
            }}>
              Find the
            </div>
            <ShapeSVG shape={currentRound.target} size={54} color={targetColor} />
            <div style={{
              fontSize: 14, fontWeight: 800, color: targetColor, marginTop: 4,
            }}>
              {SHAPE_LABELS[currentRound.target]}
            </div>
          </div>
          <div style={{
            width: 2, height: 64, background: `${targetColor}44`, borderRadius: 2,
          }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7F8C8D', letterSpacing: 0.8 }}>
              Tap
            </div>
            <div style={{
              fontSize: 34, fontWeight: 900,
              color: targetColor,
              lineHeight: 1.1,
            }}>
              {currentRound.correctCount - (correctSoFarRef.current >= currentRound.correctCount ? currentRound.correctCount : correctSoFarRef.current)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7F8C8D' }}>more</div>
          </div>
        </div>
      )}

      {/* Floating shapes play area */}
      <div style={{
        position: 'absolute',
        top: 200, left: 0, right: 0, bottom: 0,
        zIndex: 10,
      }}>
        {currentRound && currentRound.shapes.map((shape, i) => (
          <FloatingShapeTile
            key={`${roundIndex}-${i}`}
            shape={shape}
            color={shapeColorMap(shape)}
            slotIndex={i}
            tileState={tileStates[i] ?? 'floating'}
            onTap={() => handleTap(i)}
          />
        ))}
      </div>

      {/* Round feedback flash */}
      {roundFeedback !== 'none' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 150,
          pointerEvents: 'none',
          animation: 'feedbackPop 0.9s ease forwards',
          fontSize: 52, fontWeight: 900,
          color: roundFeedback === 'great' ? '#06D6A0' : '#FF4B6E',
          textShadow: '2px 4px 10px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
        }}>
          {roundFeedback === 'great' ? '🌟 Great!' : 'Try again!'}
        </div>
      )}

      {/* Completion overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,20,60,0.60)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 20,
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {(['circle','star','triangle','diamond'] as ShapeName[]).map((s, i) => (
              <ShapeSVG key={s} shape={s} size={54} color={SHAPE_COLORS[i]} />
            ))}
          </div>
          <div style={{
            color: '#fff', fontSize: 46, fontWeight: 900,
            textShadow: '2px 4px 12px rgba(0,0,0,0.5)',
          }}>
            Amazing!
          </div>
          <div style={{ color: '#B0E2FF', fontSize: 18, fontWeight: 700 }}>
            You found all the shapes!
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '13px 30px', borderRadius: 14,
              background: 'linear-gradient(135deg,#06D6A0,#2EC4B6)',
              color: '#fff', fontSize: 18, fontWeight: 800,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 5px 14px rgba(0,0,0,0.3)',
            }}>Play Again</button>
            <button onClick={() => { setLevel(0); setShowComplete(false) }} style={{
              padding: '13px 30px', borderRadius: 14,
              background: 'linear-gradient(135deg,#3A86FF,#1565C0)',
              color: '#fff', fontSize: 18, fontWeight: 800,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 5px 14px rgba(0,0,0,0.3)',
            }}>Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '13px 30px', borderRadius: 14,
              background: 'linear-gradient(135deg,#FF4B6E,#C0392B)',
              color: '#fff', fontSize: 18, fontWeight: 800,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 5px 14px rgba(0,0,0,0.3)',
            }}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
