import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

// ---- Types ----
type CompSymbol = '<' | '=' | '>'

interface Question {
  left:   number
  right:  number
  answer: CompSymbol
}

interface LevelData {
  levelIndex: number
  questions:  Question[]
}

interface GameData {
  levels: LevelData[]
}

// ---- Theme ----
const PURPLE  = '#7B2FBE'
const PURPLE2 = '#9B59B6'
const LAVENDER= '#E9D5FF'
const LAVENDER2='#F3E5F5'
const DARK    = '#3B0764'
const CORRECT_COLOR = '#06D6A0'
const WRONG_COLOR   = '#EF4444'

// ---- Dot visualisation (level 2 only, up to 20 dots) ----
function DotGroup({ count, color }: { count: number; color: string }) {
  // Up to 20 dots arranged in rows of 5
  const dots = Math.min(count, 20)
  const rows: number[][] = []
  let remaining = dots
  while (remaining > 0) {
    const take = Math.min(5, remaining)
    rows.push(Array(take).fill(0))
    remaining -= take
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 5 }}>
          {row.map((_, di) => (
            <div key={di} style={{
              width: 16, height: 16, borderRadius: '50%',
              background: color,
              boxShadow: `0 2px 5px ${color}88`,
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ---- Number display card ----
function NumberCard({
  value,
  side,
  levelIndex,
  cardState,
}: {
  value:      number
  side:       'left' | 'right'
  levelIndex: number
  cardState:  'idle' | 'correct' | 'wrong'
}) {
  const borderColor =
    cardState === 'correct' ? CORRECT_COLOR :
    cardState === 'wrong'   ? WRONG_COLOR   :
    PURPLE

  const bg =
    cardState === 'correct' ? '#D1FAF0' :
    cardState === 'wrong'   ? '#FEE2E2' :
    '#fff'

  const dotColor = side === 'left' ? PURPLE : '#3A86FF'

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            10,
      minWidth:       130,
      minHeight:      150,
      padding:        '20px 24px',
      borderRadius:   24,
      border:         `4px solid ${borderColor}`,
      background:     bg,
      boxShadow:      cardState !== 'idle'
        ? `0 8px 24px ${borderColor}55`
        : '0 4px 14px rgba(123,47,190,0.15)',
      animation:
        cardState === 'wrong'   ? 'eglShake 0.36s ease' :
        cardState === 'correct' ? 'eglPop 0.4s ease'   : 'none',
      transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
    }}>
      <span style={{
        fontSize:   levelIndex === 3 ? 52 : 58,
        fontWeight: 900,
        color:      cardState === 'correct' ? CORRECT_COLOR :
                    cardState === 'wrong'   ? WRONG_COLOR   : DARK,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      {levelIndex === 2 && (
        <DotGroup count={value} color={dotColor} />
      )}
    </div>
  )
}

// ---- Symbol Button ----
function SymbolButton({
  symbol,
  state,
  onTap,
}: {
  symbol:  CompSymbol
  state:   'idle' | 'correct' | 'wrong'
  onTap:   () => void
}) {
  const label: Record<CompSymbol, string> = {
    '<': 'Less Than',
    '=': 'Equal',
    '>': 'Greater Than',
  }

  const bg =
    state === 'correct' ? `linear-gradient(135deg,${CORRECT_COLOR},#059669)` :
    state === 'wrong'   ? `linear-gradient(135deg,${WRONG_COLOR},#DC2626)`   :
    `linear-gradient(135deg,${PURPLE},${PURPLE2})`

  return (
    <button
      onClick={onTap}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        width:          100,
        height:         100,
        borderRadius:   20,
        border:         'none',
        background:     bg,
        cursor:         'pointer',
        boxShadow:
          state === 'correct' ? `0 6px 18px ${CORRECT_COLOR}88` :
          state === 'wrong'   ? `0 6px 18px ${WRONG_COLOR}88`   :
          '0 5px 16px rgba(123,47,190,0.35)',
        animation:
          state === 'wrong'   ? 'eglShake 0.36s ease' :
          state === 'correct' ? 'eglPop 0.4s ease'   : 'none',
        transition:     'box-shadow 0.15s',
        userSelect:     'none',
        WebkitUserSelect: 'none',
        gap:            4,
      }}
    >
      <span style={{ color: '#fff', fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
        {symbol}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>
        {label[symbol]}
      </span>
    </button>
  )
}

// ---- Stars decoration ----
function StarsBg() {
  const stars = [
    { top: '5%',  left: '8%',  size: 10, opacity: 0.25, delay: 0 },
    { top: '12%', left: '80%', size: 8,  opacity: 0.2,  delay: 1.1 },
    { top: '35%', left: '92%', size: 6,  opacity: 0.18, delay: 0.7 },
    { top: '60%', left: '3%',  size: 9,  opacity: 0.22, delay: 1.5 },
    { top: '78%', left: '88%', size: 7,  opacity: 0.2,  delay: 0.4 },
    { top: '88%', left: '40%', size: 5,  opacity: 0.15, delay: 1.9 },
  ]
  return (
    <>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', top: s.top, left: s.left,
          opacity: s.opacity, pointerEvents: 'none', zIndex: 0,
          animation: `eglTwinkle ${2.8 + s.delay}s ease-in-out ${s.delay}s infinite`,
        }}>
          <svg width={s.size * 2} height={s.size * 2} viewBox="0 0 20 20">
            <polygon
              points="10,1 12.9,7 19.5,7.6 14.6,12 16.2,18.5 10,15 3.8,18.5 5.4,12 0.5,7.6 7.1,7"
              fill={LAVENDER}
            />
          </svg>
        </div>
      ))}
    </>
  )
}

// ---- Main Page ----
export default function EqualsGreatLessPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [gameData, setGameData]           = useState<GameData | null>(null)
  const [level, setLevel]                 = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])

  // In-game state
  const [questions, setQuestions]         = useState<Question[]>([])
  const [qIndex, setQIndex]               = useState(0)
  const [cardState, setCardState]         = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [btnStates, setBtnStates]         = useState<Record<CompSymbol, 'idle' | 'correct' | 'wrong'>>({
    '<': 'idle', '=': 'idle', '>': 'idle',
  })
  const [showComplete, setShowComplete]   = useState(false)
  const [progress, setProgress]           = useState({ current: 0, max: 8 })
  const [feedbackText, setFeedbackText]   = useState<string | null>(null)

  const lockedRef = useRef(false)

  // ---- Fetch ----
  useEffect(() => {
    fetch('/data/games/equalsgreatless.json')
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

  // ---- Load level ----
  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setQIndex(0)
    setShowComplete(false)
    setCardState('idle')
    setBtnStates({ '<': 'idle', '=': 'idle', '>': 'idle' })
    setFeedbackText(null)
    lockedRef.current = false
  }, [])

  useEffect(() => {
    if (!gameData || level === 0) return
    const found = gameData.levels.find(l => l.levelIndex === level)
    const qs = found ? found.questions : []
    setQuestions(qs)
    setProgress({ current: 1, max: qs.length })
    setQIndex(0)
    setCardState('idle')
    setBtnStates({ '<': 'idle', '=': 'idle', '>': 'idle' })
    setFeedbackText(null)
    lockedRef.current = false
  }, [gameData, level])

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  const currentQ = questions[qIndex]

  // ---- Handle answer ----
  const handleSymbol = useCallback((sym: CompSymbol) => {
    if (lockedRef.current || !currentQ) return
    lockedRef.current = true

    const isCorrect = sym === currentQ.answer

    if (isCorrect) {
      setCardState('correct')
      setBtnStates(prev => ({ ...prev, [sym]: 'correct' }))
      setFeedbackText('Correct!')

      setTimeout(() => {
        setFeedbackText(null)
        const next = qIndex + 1
        if (next >= questions.length) {
          setShowComplete(true)
        } else {
          setQIndex(next)
          setProgress({ current: next + 1, max: questions.length })
          setCardState('idle')
          setBtnStates({ '<': 'idle', '=': 'idle', '>': 'idle' })
          lockedRef.current = false
        }
      }, 800)
    } else {
      setCardState('wrong')
      setBtnStates(prev => ({ ...prev, [sym]: 'wrong' }))
      setFeedbackText('Try again!')

      setTimeout(() => {
        setCardState('idle')
        setBtnStates({ '<': 'idle', '=': 'idle', '>': 'idle' })
        setFeedbackText(null)
        lockedRef.current = false
      }, 650)
    }
  }, [currentQ, qIndex, questions])

  const levelIndex = level  // alias for clarity inside JSX

  // ========== LEVEL SELECT ==========
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: `linear-gradient(160deg, ${DARK} 0%, #4A1281 50%, #7B2FBE 100%)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <style>{`
          @keyframes eglShake {
            0%,100% { transform: translateX(0); }
            20%     { transform: translateX(-8px); }
            40%     { transform: translateX(8px); }
            60%     { transform: translateX(-5px); }
            80%     { transform: translateX(5px); }
          }
          @keyframes eglPop {
            0%   { transform: scale(1); }
            40%  { transform: scale(1.22); }
            70%  { transform: scale(0.93); }
            100% { transform: scale(1); }
          }
          @keyframes eglTwinkle {
            0%,100% { transform: scale(1);   opacity: 0.2; }
            50%     { transform: scale(1.4); opacity: 0.55; }
          }
          @keyframes eglFloat {
            0%,100% { transform: translateY(0); }
            50%     { transform: translateY(-8px); }
          }
          @keyframes eglBounce {
            0%,100% { transform: translateY(0) scale(1); }
            50%     { transform: translateY(-6px) scale(1.05); }
          }
        `}</style>

        <BackButton color={LAVENDER} />
        <StarsBg />

        {/* Symbol preview */}
        <div style={{
          display: 'flex', gap: 16, alignItems: 'center',
          animation: 'eglFloat 3s ease-in-out infinite',
          zIndex: 10,
        }}>
          {(['<','=','>'] as CompSymbol[]).map(sym => (
            <div key={sym} style={{
              width: 60, height: 60, borderRadius: 14,
              background: `linear-gradient(135deg,${PURPLE},${PURPLE2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
            }}>
              <span style={{ color: '#fff', fontSize: 30, fontWeight: 900 }}>{sym}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', zIndex: 10 }}>
          <h1 style={{
            color: '#fff', fontSize: 38, fontWeight: 900,
            margin: 0, textShadow: `2px 3px 10px ${DARK}`,
            letterSpacing: 0.5,
          }}>
            Greater, Equal, Less
          </h1>
          <p style={{ color: LAVENDER, fontSize: 16, margin: '8px 0 0', fontWeight: 600 }}>
            Compare the numbers and pick the right symbol!
          </p>
        </div>

        {/* Level buttons */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', zIndex: 10 }}>
          {availableLevels.map((lvl, i) => {
            const subtitles = ['1 – 10', '1 – 20', '1 – 100']
            const bgs = [
              `linear-gradient(135deg,#9B59B6,#8E44AD)`,
              `linear-gradient(135deg,#8E44AD,#6C3483)`,
              `linear-gradient(135deg,#6C3483,#4A235A)`,
            ]
            return (
              <button key={lvl} onClick={() => startLevel(lvl)} style={{
                width: 110, height: 110, borderRadius: 22,
                background: bgs[i % bgs.length],
                border: '3px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0,0,0,0.38)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                animation: `eglBounce ${2.5 + i * 0.4}s ease-in-out infinite`,
              }}>
                <span style={{ color: '#fff', fontSize: 28, fontWeight: 900 }}>{lvl}</span>
                <span style={{ color: LAVENDER, fontSize: 11, fontWeight: 700 }}>{subtitles[i]}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ========== GAME SCREEN ==========
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: `linear-gradient(160deg, ${DARK} 0%, #4A1281 60%, #7B2FBE 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      gap: 0,
    }}>
      <style>{`
        @keyframes eglShake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-8px); }
          40%     { transform: translateX(8px); }
          60%     { transform: translateX(-5px); }
          80%     { transform: translateX(5px); }
        }
        @keyframes eglPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.22); }
          70%  { transform: scale(0.93); }
          100% { transform: scale(1); }
        }
        @keyframes eglTwinkle {
          0%,100% { transform: scale(1);   opacity: 0.2; }
          50%     { transform: scale(1.4); opacity: 0.55; }
        }
        @keyframes feedbackZoom {
          0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 0; }
          35%  { transform: translate(-50%,-50%) scale(1.2); opacity: 1; }
          70%  { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.1); opacity: 0; }
        }
        @keyframes headerSlideDown {
          0%   { transform: translateY(-80px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <BackButton color={LAVENDER} onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />
      <StarsBg />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 66,
        background: 'rgba(59,7,100,0.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 3px 16px rgba(0,0,0,0.4)',
        animation: 'headerSlideDown 0.4s ease',
        zIndex: 30,
      }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: 1.2 }}>
          Greater, Equal, Less
        </span>
      </div>

      {currentQ && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 30,
          marginTop: 60,
          zIndex: 10,
          width: '100%', maxWidth: 620, padding: '0 16px',
        }}>

          {/* Instruction */}
          <p style={{
            color: LAVENDER, fontWeight: 700, fontSize: 15,
            margin: 0, letterSpacing: 0.5,
          }}>
            Which symbol goes in the middle?
          </p>

          {/* Numbers row */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 20,
            width: '100%',
          }}>
            <NumberCard
              value={currentQ.left}
              side="left"
              levelIndex={levelIndex}
              cardState={cardState}
            />

            {/* Mystery box */}
            <div style={{
              width:          80,
              height:         80,
              borderRadius:   18,
              border:         `3px dashed ${LAVENDER}88`,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'rgba(255,255,255,0.07)',
              flexShrink:     0,
            }}>
              <span style={{ color: LAVENDER, fontSize: 32, fontWeight: 900, opacity: 0.5 }}>?</span>
            </div>

            <NumberCard
              value={currentQ.right}
              side="right"
              levelIndex={levelIndex}
              cardState={cardState}
            />
          </div>

          {/* Symbol buttons */}
          <div style={{
            display: 'flex', gap: 18, alignItems: 'center',
            justifyContent: 'center',
          }}>
            {(['<', '=', '>'] as CompSymbol[]).map(sym => (
              <SymbolButton
                key={sym}
                symbol={sym}
                state={btnStates[sym]}
                onTap={() => handleSymbol(sym)}
              />
            ))}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', gap: 20,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '8px 20px',
          }}>
            {([
              { sym: '<', desc: 'Less than' },
              { sym: '=', desc: 'Equal to' },
              { sym: '>', desc: 'Greater than' },
            ] as { sym: CompSymbol; desc: string }[]).map(({ sym, desc }) => (
              <div key={sym} style={{ textAlign: 'center' }}>
                <div style={{ color: LAVENDER, fontSize: 18, fontWeight: 900 }}>{sym}</div>
                <div style={{ color: '#C4B5FD', fontSize: 10, fontWeight: 600 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback flash */}
      {feedbackText && (
        <div style={{
          position:    'absolute', top: '50%', left: '50%',
          transform:   'translate(-50%,-50%)',
          zIndex:      150,
          pointerEvents: 'none',
          animation:   'feedbackZoom 0.85s ease forwards',
          fontSize:    50,
          fontWeight:  900,
          color:       feedbackText === 'Correct!' ? CORRECT_COLOR : WRONG_COLOR,
          textShadow:  '2px 4px 12px rgba(0,0,0,0.4)',
          whiteSpace:  'nowrap',
        }}>
          {feedbackText === 'Correct!' ? '✓ Correct!' : '✗ Try again!'}
        </div>
      )}

      {/* Completion overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(59,7,100,0.80)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 20,
          backdropFilter: 'blur(8px)',
        }}>
          {/* Symbol badges */}
          <div style={{ display: 'flex', gap: 16 }}>
            {(['<','=','>'] as CompSymbol[]).map((sym, i) => (
              <div key={sym} style={{
                width: 64, height: 64, borderRadius: 16,
                background: [
                  `linear-gradient(135deg,#FF9F1C,#e67e22)`,
                  `linear-gradient(135deg,${CORRECT_COLOR},#059669)`,
                  `linear-gradient(135deg,#3A86FF,#1565C0)`,
                ][i],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
              }}>
                <span style={{ color: '#fff', fontSize: 30, fontWeight: 900 }}>{sym}</span>
              </div>
            ))}
          </div>

          <div style={{
            color: '#fff', fontSize: 46, fontWeight: 900,
            textShadow: '2px 4px 14px rgba(0,0,0,0.5)',
          }}>
            Well Done!
          </div>
          <div style={{ color: LAVENDER, fontSize: 17, fontWeight: 700 }}>
            You answered all questions correctly!
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '13px 30px', borderRadius: 14,
              background: `linear-gradient(135deg,${CORRECT_COLOR},#059669)`,
              color: '#fff', fontSize: 18, fontWeight: 800,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 5px 16px rgba(0,0,0,0.35)',
            }}>Play Again</button>
            <button onClick={() => { setLevel(0); setShowComplete(false) }} style={{
              padding: '13px 30px', borderRadius: 14,
              background: `linear-gradient(135deg,${PURPLE},#6C3483)`,
              color: '#fff', fontSize: 18, fontWeight: 800,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 5px 16px rgba(0,0,0,0.35)',
            }}>Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '13px 30px', borderRadius: 14,
              background: 'linear-gradient(135deg,#EF4444,#DC2626)',
              color: '#fff', fontSize: 18, fontWeight: 800,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 5px 16px rgba(0,0,0,0.35)',
            }}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
