import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../components/BackButton'
import ProgressBar from '../../components/ProgressBar'
import { useShellParams } from '../../hooks/useShellParams'

// ── Types ───────────────────────────────────────────────────────────────────────

interface QuestionData {
  groups: number[]    // chickens in each row/group
  total: number       // sum of groups
  choices: number[]   // 4 answer choices
  answer: number      // index into choices[]
}

interface LevelData {
  levelIndex: number
  label: string
  description: string
  maxChickens: number
  questions: QuestionData[]
}

// ── Constants ───────────────────────────────────────────────────────────────────

const CORRECT_DELAY_MS = 1200
const WRONG_SHAKE_MS   = 600
const CHICKEN = '🐔'
const REVEAL_DELAY_PER_ROW_MS = 420

// Farm theme colours
const FARM_GREEN      = '#4caf50'
const FARM_GREEN_DARK = '#2e7d32'
const FARM_YELLOW     = '#f9a825'
const FARM_YELLOW_LT  = '#fff9c4'
const FARM_SKY        = '#e3f2fd'
const FARM_GROUND     = '#8d6e63'
const FARM_DIRT       = '#a1887f'

// Firework palette – warm farm colours
const FIREWORK_COLORS = ['#f9a825', '#ef6c00', '#2e7d32', '#e53935', '#1565c0', '#8e24aa']

// Level card colours (one per level)
const LEVEL_CARD_COLORS = [
  { bg: '#e8f5e9', border: '#66bb6a', icon: '#2e7d32' },
  { bg: '#fff9c4', border: '#f9a825', icon: '#e65100' },
  { bg: '#fff3e0', border: '#ef6c00', icon: '#b71c1c' },
]

const LEVEL_ICONS = ['🌱', '🌻', '🏆']

// ── Fireworks overlay ────────────────────────────────────────────────────────────

function FireworksOverlay() {
  const particles = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
    left: `${8 + Math.floor((i * 41 + 13) % 84)}%`,
    top: `${10 + Math.floor((i * 57 + 5) % 65)}%`,
    delay: `${(i % 7) * 75}ms`,
    size: 7 + (i % 5) * 3,
  }))

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20, overflow: 'hidden' }}>
      <style>{`
        @keyframes hc-burst {
          0%   { transform: scale(0) translateY(0);   opacity: 1; }
          60%  { transform: scale(1.5) translateY(-18px); opacity: 0.9; }
          100% { transform: scale(0.1) translateY(-48px); opacity: 0; }
        }
        @keyframes hc-spin {
          0%   { transform: rotate(0deg)   scale(0);   opacity: 1; }
          50%  { transform: rotate(200deg) scale(1.3); opacity: 0.9; }
          100% { transform: rotate(400deg) scale(0);   opacity: 0; }
        }
      `}</style>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: p.id % 3 === 0 ? '50%' : 3,
            background: p.color,
            animation: p.id % 2 === 0
              ? `hc-burst 0.85s ease-out ${p.delay} both`
              : `hc-spin   0.85s ease-out ${p.delay} both`,
          }}
        />
      ))}
      {['⭐', '🌟', '✨', '💫', '🎉', '⭐', '🌟', '✨'].map((s, i) => (
        <div key={`star-${i}`} style={{
          position: 'absolute',
          left: `${6 + i * 11.5}%`,
          top: `${20 + (i % 3) * 22}%`,
          fontSize: 18 + (i % 3) * 5,
          animation: `hc-burst 1s ease-out ${i * 65}ms both`,
          pointerEvents: 'none',
        }}>
          {s}
        </div>
      ))}
    </div>
  )
}

// ── Chicken Row ──────────────────────────────────────────────────────────────────

interface ChickenRowProps {
  count: number
  rowIndex: number
  revealed: boolean
  isLastRevealed: boolean
  runningTotal: number
  totalSoFar: number
}

function ChickenRow({ count, rowIndex, revealed, isLastRevealed, totalSoFar }: ChickenRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '5px 12px',
      background: revealed
        ? isLastRevealed
          ? 'rgba(249,168,37,0.22)'
          : 'rgba(76,175,80,0.12)'
        : 'rgba(0,0,0,0.07)',
      borderRadius: 14,
      border: isLastRevealed
        ? '2px solid rgba(249,168,37,0.65)'
        : revealed
          ? '2px solid rgba(76,175,80,0.35)'
          : '2px dashed rgba(0,0,0,0.15)',
      transition: 'background 0.3s, border 0.3s',
      opacity: revealed ? 1 : 0.25,
      animation: revealed && isLastRevealed ? 'hc-row-pop 0.35s ease-out' : 'none',
      flexWrap: 'wrap',
      minHeight: 44,
      position: 'relative',
    }}>
      {/* Row number badge */}
      <div style={{
        minWidth: 26,
        height: 26,
        borderRadius: 13,
        background: revealed ? (isLastRevealed ? FARM_YELLOW : FARM_GREEN) : 'rgba(0,0,0,0.15)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.3s',
      }}>
        {rowIndex + 1}
      </div>

      {/* Chicken emojis */}
      {revealed && Array.from({ length: count }).map((_, ci) => (
        <span
          key={ci}
          style={{
            fontSize: 'clamp(18px, 3.5vw, 26px)',
            lineHeight: 1,
            animation: `hc-pop 0.28s ease-out ${ci * 45}ms both`,
            display: 'inline-block',
          }}
        >
          {CHICKEN}
        </span>
      ))}

      {/* Running count label */}
      {revealed && (
        <div style={{
          marginLeft: 'auto',
          paddingLeft: 6,
          color: isLastRevealed ? FARM_YELLOW : FARM_GREEN_DARK,
          fontWeight: 'bold',
          fontSize: 'clamp(13px, 2.5vw, 17px)',
          flexShrink: 0,
          transition: 'color 0.3s',
        }}>
          {count} <span style={{ opacity: 0.55, fontSize: '0.75em' }}>= {totalSoFar}</span>
        </div>
      )}
    </div>
  )
}

// ── Choice Button ────────────────────────────────────────────────────────────────

type ChoiceState = 'idle' | 'correct' | 'wrong'

interface ChoiceButtonProps {
  value: number
  state: ChoiceState
  onClick: () => void
  disabled: boolean
}

function ChoiceButton({ value, state, onClick, disabled }: ChoiceButtonProps) {
  const [pressed, setPressed] = useState(false)

  const bg =
    state === 'correct' ? `linear-gradient(135deg, ${FARM_GREEN_DARK}, ${FARM_GREEN})` :
    state === 'wrong'   ? 'linear-gradient(135deg, #b71c1c, #e53935)' :
    pressed             ? `linear-gradient(135deg, #e65100, ${FARM_YELLOW})` :
                          `linear-gradient(135deg, #e65100, #ef6c00)`

  const border =
    state === 'correct' ? '3px solid #a5d6a7' :
    state === 'wrong'   ? '3px solid #ef9a9a' :
                          '3px solid rgba(255,255,255,0.25)'

  const shadow =
    state === 'correct' ? `0 0 20px rgba(76,175,80,0.55), 0 5px 0 rgba(0,0,0,0.25)` :
    state === 'wrong'   ? '0 0 20px rgba(229,57,53,0.5),  0 5px 0 rgba(0,0,0,0.25)' :
    pressed             ? 'inset 0 3px 8px rgba(0,0,0,0.35)' :
                          '0 5px 0 rgba(0,0,0,0.28), 0 2px 12px rgba(0,0,0,0.2)'

  return (
    <button
      onPointerDown={() => { if (!disabled) setPressed(true) }}
      onPointerUp={() => { setPressed(false); if (!disabled && state === 'idle') onClick() }}
      onPointerLeave={() => setPressed(false)}
      disabled={disabled}
      style={{
        width: 'clamp(72px, 17vw, 108px)',
        height: 'clamp(72px, 17vw, 108px)',
        borderRadius: 22,
        background: bg,
        border,
        color: '#fff',
        fontSize: 'clamp(24px, 5.5vw, 38px)',
        fontWeight: 'bold',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: shadow,
        transform: pressed ? 'translateY(4px) scale(0.94)' : 'translateY(0) scale(1)',
        transition: 'transform 0.08s, box-shadow 0.12s, background 0.15s',
        animation:
          state === 'correct' ? 'hc-correct-bounce 0.45s ease-out' :
          state === 'wrong'   ? 'hc-shake 0.5s ease-out' : 'none',
        userSelect: 'none',
        opacity: disabled && state === 'idle' ? 0.5 : 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {value}
      {/* Subtle inner shine */}
      {state === 'idle' && !pressed && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '40%',
          background: 'rgba(255,255,255,0.12)',
          borderRadius: '22px 22px 0 0',
          pointerEvents: 'none',
        }} />
      )}
    </button>
  )
}

// ── Farm Decorations ──────────────────────────────────────────────────────────────

function FarmDecoration() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Sun */}
      <div style={{
        position: 'absolute', top: 14, right: 20,
        fontSize: 'clamp(24px, 4vw, 36px)',
        animation: 'hc-sun-pulse 4s ease-in-out infinite',
      }}>☀️</div>
      {/* Clouds */}
      <div style={{ position: 'absolute', top: 22, left: '18%', fontSize: 'clamp(18px, 3vw, 28px)', opacity: 0.7, animation: 'hc-cloud-drift 20s linear infinite' }}>☁️</div>
      <div style={{ position: 'absolute', top: 38, left: '45%', fontSize: 'clamp(14px, 2.5vw, 22px)', opacity: 0.5, animation: 'hc-cloud-drift 28s linear infinite 4s' }}>☁️</div>
      {/* Fence posts bottom-left */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, background: FARM_GROUND, opacity: 0.35, borderRadius: '4px 4px 0 0' }} />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────────

export default function HundredChickensPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  // Data
  const [allLevels, setAllLevels] = useState<LevelData[]>([])
  const [currentLevel, setCurrentLevel] = useState<LevelData | null>(null)

  // Game state
  const [questionIndex,  setQuestionIndex]  = useState(0)
  const [revealedRows,   setRevealedRows]   = useState(0)   // how many rows are revealed
  const [allRevealed,    setAllRevealed]    = useState(false)
  const [choiceStates,   setChoiceStates]   = useState<ChoiceState[]>(['idle', 'idle', 'idle', 'idle'])
  const [showFireworks,  setShowFireworks]  = useState(false)
  const [showComplete,   setShowComplete]   = useState(false)
  const [inputLocked,    setInputLocked]    = useState(false)

  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revealRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/data/games/hundredchickens.json')
      .then(r => r.json())
      .then(data => setAllLevels(data.levels ?? []))
      .catch(() => setAllLevels([]))
  }, [])

  // ── Auto-start from shell ──────────────────────────────────────────────────────

  useEffect(() => {
    if (shellLevel !== null && allLevels.length > 0 && !currentLevel) {
      const ld = allLevels.find(l => l.levelIndex === shellLevel) ?? allLevels[0]
      startLevel(ld)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellLevel, allLevels])

  // ── Shell complete ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // ── Cleanup ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current)  clearTimeout(timerRef.current)
      if (revealRef.current) clearTimeout(revealRef.current)
    }
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────────

  const startRevealSequence = useCallback((numRows: number) => {
    if (revealRef.current) clearTimeout(revealRef.current)
    setRevealedRows(0)
    setAllRevealed(false)

    let row = 0
    function revealNext() {
      row += 1
      setRevealedRows(row)
      if (row < numRows) {
        revealRef.current = setTimeout(revealNext, REVEAL_DELAY_PER_ROW_MS)
      } else {
        setAllRevealed(true)
      }
    }
    revealRef.current = setTimeout(revealNext, 180)
  }, [])

  const startLevel = useCallback((ld: LevelData) => {
    if (timerRef.current)  clearTimeout(timerRef.current)
    if (revealRef.current) clearTimeout(revealRef.current)
    setCurrentLevel(ld)
    setQuestionIndex(0)
    setChoiceStates(['idle', 'idle', 'idle', 'idle'])
    setShowFireworks(false)
    setShowComplete(false)
    setInputLocked(false)
    startRevealSequence(ld.questions[0].groups.length)
  }, [startRevealSequence])

  function loadQuestion(ld: LevelData, idx: number) {
    setQuestionIndex(idx)
    setChoiceStates(['idle', 'idle', 'idle', 'idle'])
    setShowFireworks(false)
    setInputLocked(false)
    startRevealSequence(ld.questions[idx].groups.length)
  }

  function handleChoiceTap(choiceIdx: number) {
    if (inputLocked || !currentLevel) return
    const q = currentLevel.questions[questionIndex]

    if (choiceIdx === q.answer) {
      // Correct!
      const next = ['idle', 'idle', 'idle', 'idle'] as ChoiceState[]
      next[choiceIdx] = 'correct'
      setChoiceStates(next)
      setShowFireworks(true)
      setInputLocked(true)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setShowFireworks(false)
        const nextIdx = questionIndex + 1
        if (nextIdx >= currentLevel.questions.length) {
          setShowComplete(true)
        } else {
          loadQuestion(currentLevel, nextIdx)
        }
      }, CORRECT_DELAY_MS)
    } else {
      // Wrong – shake and reset
      const next = [...choiceStates] as ChoiceState[]
      next[choiceIdx] = 'wrong'
      setChoiceStates(next)
      setInputLocked(true)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setChoiceStates(['idle', 'idle', 'idle', 'idle'])
        setInputLocked(false)
      }, WRONG_SHAKE_MS)
    }
  }

  // ── Tap-to-reveal-next-row handler ────────────────────────────────────────────

  function handleRevealTap() {
    if (!currentLevel || allRevealed) return
    const numRows = currentLevel.questions[questionIndex].groups.length
    if (revealedRows < numRows) {
      if (revealRef.current) clearTimeout(revealRef.current)
      const next = revealedRows + 1
      setRevealedRows(next)
      if (next >= numRows) setAllRevealed(true)
    }
  }

  // ── Level select screen ───────────────────────────────────────────────────────

  if (!currentLevel) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: `linear-gradient(180deg, ${FARM_SKY} 0%, #c8e6c9 60%, ${FARM_GROUND} 100%)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20,
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <style>{`
          @keyframes hc-title-bob {
            0%,100% { transform: translateY(0) rotate(-1deg); }
            50%      { transform: translateY(-6px) rotate(1deg); }
          }
          @keyframes hc-card-hover {
            0%,100% { transform: translateY(0); }
            50%      { transform: translateY(-4px); }
          }
          @keyframes hc-sun-pulse {
            0%,100% { transform: scale(1);    }
            50%      { transform: scale(1.08); }
          }
          @keyframes hc-cloud-drift {
            0%   { transform: translateX(-10%); }
            100% { transform: translateX(110vw); }
          }
        `}</style>

        <FarmDecoration />
        <BackButton color={FARM_GREEN_DARK} onClick={isFromShell ? shellBack : undefined} />

        {/* Title banner */}
        <div style={{
          background: FARM_YELLOW,
          borderRadius: 24,
          padding: '16px 32px',
          boxShadow: `0 6px 0 ${FARM_GROUND}, 0 8px 24px rgba(0,0,0,0.18)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          border: `3px solid #fff`,
          animation: 'hc-title-bob 3s ease-in-out infinite',
          zIndex: 2,
        }}>
          <div style={{ fontSize: 'clamp(36px, 7vw, 52px)' }}>🐔🐔🐔</div>
          <div style={{
            fontSize: 'clamp(22px, 5vw, 36px)',
            fontWeight: 'bold',
            color: FARM_GREEN_DARK,
            textShadow: '1px 2px 0 rgba(0,0,0,0.12)',
          }}>
            100 Chickens
          </div>
          <div style={{ fontSize: 14, color: FARM_GREEN_DARK, opacity: 0.75 }}>
            Count the chickens in each row!
          </div>
        </div>

        {/* Level cards */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', zIndex: 2 }}>
          {allLevels.map((ld) => {
            const col = LEVEL_CARD_COLORS[ld.levelIndex] ?? LEVEL_CARD_COLORS[0]
            return (
              <button
                key={ld.levelIndex}
                onClick={() => startLevel(ld)}
                style={{
                  width: 130, minHeight: 140,
                  borderRadius: 22,
                  background: col.bg,
                  border: `3px solid ${col.border}`,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8,
                  boxShadow: `0 6px 0 rgba(0,0,0,0.15), 0 2px 12px rgba(0,0,0,0.1)`,
                  transition: 'transform 0.12s, box-shadow 0.12s',
                  padding: '14px 10px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-5px) scale(1.03)'
                  e.currentTarget.style.boxShadow = `0 10px 0 rgba(0,0,0,0.15), 0 4px 18px rgba(0,0,0,0.15)`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = `0 6px 0 rgba(0,0,0,0.15), 0 2px 12px rgba(0,0,0,0.1)`
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px) scale(0.96)' }}
                onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-5px) scale(1.03)' }}
              >
                <span style={{ fontSize: 34 }}>{LEVEL_ICONS[ld.levelIndex]}</span>
                <span style={{ fontSize: 15, fontWeight: 'bold', color: col.icon }}>
                  Level {ld.levelIndex + 1}
                </span>
                <span style={{
                  fontSize: 12, color: col.icon, opacity: 0.8,
                  textAlign: 'center', lineHeight: 1.3,
                }}>
                  {ld.label}
                </span>
                <div style={{
                  display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center',
                }}>
                  {Array.from({ length: Math.min(ld.levelIndex + 2, 5) }).map((_, i) => (
                    <span key={i} style={{ fontSize: 14 }}>{CHICKEN}</span>
                  ))}
                  {ld.levelIndex >= 2 && <span style={{ fontSize: 12, color: col.icon }}>…100</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Game screen ────────────────────────────────────────────────────────────────

  const q             = currentLevel.questions[questionIndex]
  const totalQuestions = currentLevel.questions.length
  const numRows        = q.groups.length

  // Compute running totals for labels
  const runningTotals = q.groups.reduce<number[]>((acc, g) => {
    acc.push((acc[acc.length - 1] ?? 0) + g)
    return acc
  }, [])

  const displayedTotal = revealedRows > 0 ? runningTotals[revealedRows - 1] : 0

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: `linear-gradient(180deg, ${FARM_SKY} 0%, #dcedc8 55%, ${FARM_DIRT} 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      userSelect: 'none',
      position: 'relative',
    }}>
      {/* Keyframe animations */}
      <style>{`
        @keyframes hc-pop {
          0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
          65%  { transform: scale(1.2) rotate(6deg);  opacity: 1; }
          100% { transform: scale(1) rotate(0);       opacity: 1; }
        }
        @keyframes hc-row-pop {
          0%   { transform: scaleX(0.85) scaleY(0.9); opacity: 0.4; }
          70%  { transform: scaleX(1.02) scaleY(1.03); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes hc-correct-bounce {
          0%,100% { transform: scale(1);    }
          40%     { transform: scale(1.28); }
          70%     { transform: scale(0.93); }
        }
        @keyframes hc-shake {
          0%,100% { transform: translateX(0);   }
          20%     { transform: translateX(-9px); }
          40%     { transform: translateX(9px);  }
          60%     { transform: translateX(-6px); }
          80%     { transform: translateX(6px);  }
        }
        @keyframes hc-complete-in {
          0%   { opacity: 0; transform: scale(0.55) rotate(-6deg); }
          70%  { transform: scale(1.04) rotate(1.5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes hc-sun-pulse {
          0%,100% { transform: scale(1);    }
          50%      { transform: scale(1.08); }
        }
        @keyframes hc-cloud-drift {
          0%   { transform: translateX(-10%); }
          100% { transform: translateX(110vw); }
        }
        @keyframes hc-total-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes hc-hint-blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
      `}</style>

      <FarmDecoration />
      <BackButton color={FARM_GREEN_DARK} onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={questionIndex + 1} max={totalQuestions} />

      {/* Question header */}
      <div style={{
        marginTop: 'clamp(38px, 8vw, 56px)',
        padding: '6px 20px',
        background: FARM_YELLOW,
        borderRadius: 14,
        boxShadow: '0 3px 0 rgba(0,0,0,0.15)',
        zIndex: 2,
      }}>
        <span style={{
          color: FARM_GREEN_DARK,
          fontSize: 'clamp(14px, 3vw, 20px)',
          fontWeight: 'bold',
          letterSpacing: 0.5,
        }}>
          How many {CHICKEN} chickens are there?
        </span>
      </div>

      {/* Chicken display area */}
      <div
        onClick={handleRevealTap}
        style={{
          width: '92%',
          maxWidth: 580,
          marginTop: 10,
          background: FARM_YELLOW_LT,
          borderRadius: 20,
          border: `3px solid ${FARM_YELLOW}`,
          boxShadow: '0 4px 18px rgba(0,0,0,0.13)',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          cursor: allRevealed ? 'default' : 'pointer',
          position: 'relative',
          zIndex: 2,
          flexShrink: 0,
          maxHeight: 'clamp(200px, 42vh, 340px)',
          overflowY: 'auto',
        }}
      >
        {q.groups.map((count, ri) => {
          const revealed    = ri < revealedRows
          const isLastReveal = ri === revealedRows - 1
          const total        = runningTotals[ri]
          return (
            <ChickenRow
              key={`${questionIndex}-${ri}`}
              count={count}
              rowIndex={ri}
              revealed={revealed}
              isLastRevealed={isLastReveal}
              runningTotal={total}
              totalSoFar={total}
            />
          )
        })}

        {/* Fireworks inside the display area */}
        {showFireworks && <FireworksOverlay />}
      </div>

      {/* Running total + tap hint */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginTop: 6, zIndex: 2,
      }}>
        {revealedRows > 0 && (
          <div style={{
            background: FARM_GREEN,
            color: '#fff',
            borderRadius: 12,
            padding: '4px 16px',
            fontWeight: 'bold',
            fontSize: 'clamp(16px, 3.5vw, 22px)',
            boxShadow: `0 3px 0 ${FARM_GREEN_DARK}`,
            animation: 'hc-total-pop 0.3s ease-out',
          }}>
            {allRevealed ? '=' : '+'} {displayedTotal}
          </div>
        )}
        {!allRevealed && (
          <div style={{
            color: FARM_GREEN_DARK,
            fontSize: 'clamp(11px, 2.2vw, 15px)',
            fontWeight: 'bold',
            opacity: 0.75,
            animation: 'hc-hint-blink 1.5s ease-in-out infinite',
          }}>
            Tap to reveal next row 👆
          </div>
        )}
        {allRevealed && (
          <div style={{
            color: FARM_GREEN_DARK,
            fontSize: 'clamp(12px, 2.3vw, 16px)',
            fontWeight: 'bold',
            opacity: 0.8,
          }}>
            Now choose the total! 👇
          </div>
        )}
      </div>

      {/* Choice buttons */}
      <div style={{
        display: 'flex',
        gap: 'clamp(10px, 2.5vw, 18px)',
        marginTop: 10,
        padding: '12px 20px',
        background: 'rgba(255,255,255,0.55)',
        borderRadius: 24,
        border: `2px solid ${FARM_YELLOW}`,
        boxShadow: '0 3px 12px rgba(0,0,0,0.1)',
        flexWrap: 'wrap',
        justifyContent: 'center',
        flexShrink: 0,
        zIndex: 2,
      }}>
        {q.choices.map((val, idx) => (
          <ChoiceButton
            key={idx}
            value={val}
            state={choiceStates[idx]}
            onClick={() => handleChoiceTap(idx)}
            disabled={!allRevealed || (inputLocked && choiceStates[idx] === 'idle')}
          />
        ))}
      </div>

      {/* Feedback text */}
      <div style={{
        height: 34, marginTop: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2,
      }}>
        {choiceStates.some(s => s === 'correct') && (
          <span style={{
            color: FARM_GREEN_DARK, fontWeight: 'bold',
            fontSize: 'clamp(16px, 3.5vw, 22px)',
            animation: 'hc-correct-bounce 0.45s ease-out',
          }}>
            Correct! 🎉
          </span>
        )}
        {choiceStates.some(s => s === 'wrong') && !choiceStates.some(s => s === 'correct') && (
          <span style={{
            color: '#c62828', fontWeight: 'bold',
            fontSize: 'clamp(16px, 3.5vw, 22px)',
            animation: 'hc-shake 0.5s ease-out',
          }}>
            Try again! 🔄
          </span>
        )}
        {!allRevealed && !choiceStates.some(s => s !== 'idle') && (
          <span style={{ color: FARM_GREEN, fontWeight: 'bold', fontSize: 13, opacity: 0.7 }}>
            {revealedRows}/{numRows} rows revealed
          </span>
        )}
      </div>

      {/* Completion overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 300, gap: 0,
        }}>
          <FireworksOverlay />
          <div style={{
            background: `linear-gradient(160deg, ${FARM_YELLOW_LT} 0%, #fff 100%)`,
            borderRadius: 28,
            padding: 'clamp(24px, 5vw, 40px) clamp(28px, 6vw, 52px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 16,
            boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
            border: `4px solid ${FARM_YELLOW}`,
            animation: 'hc-complete-in 0.55s ease-out',
            zIndex: 10, position: 'relative',
            maxWidth: '88vw',
          }}>
            <div style={{ fontSize: 'clamp(48px, 10vw, 72px)' }}>🏆</div>
            <div style={{
              color: FARM_GREEN_DARK,
              fontSize: 'clamp(24px, 5.5vw, 40px)',
              fontWeight: 'bold',
              textShadow: `0 0 18px ${FARM_YELLOW}`,
            }}>
              Amazing Job!
            </div>
            <div style={{ fontSize: 'clamp(32px, 6vw, 44px)' }}>
              {'🐔'.repeat(5)}
            </div>
            <div style={{
              color: FARM_GREEN,
              fontSize: 'clamp(14px, 2.8vw, 18px)',
              fontWeight: 'bold',
              textAlign: 'center',
            }}>
              You counted all {totalQuestions} chicken questions!
            </div>
            <div style={{
              display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
              marginTop: 4,
            }}>
              <button
                onClick={() => startLevel(currentLevel)}
                style={{
                  padding: 'clamp(10px,2vw,14px) clamp(18px,3vw,28px)',
                  borderRadius: 14,
                  background: FARM_YELLOW,
                  color: FARM_GREEN_DARK,
                  fontSize: 'clamp(14px, 2.5vw, 18px)',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: `0 5px 0 ${FARM_GROUND}`,
                  transition: 'opacity 0.15s',
                }}
              >
                Play Again
              </button>
              <button
                onClick={() => { setCurrentLevel(null); setShowComplete(false) }}
                style={{
                  padding: 'clamp(10px,2vw,14px) clamp(18px,3vw,28px)',
                  borderRadius: 14,
                  background: FARM_GREEN,
                  color: '#fff',
                  fontSize: 'clamp(14px, 2.5vw, 18px)',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: `0 5px 0 ${FARM_GREEN_DARK}`,
                }}
              >
                Levels
              </button>
              <button
                onClick={() => isFromShell ? shellBack() : navigate('/')}
                style={{
                  padding: 'clamp(10px,2vw,14px) clamp(18px,3vw,28px)',
                  borderRadius: 14,
                  background: '#1565c0',
                  color: '#fff',
                  fontSize: 'clamp(14px, 2.5vw, 18px)',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 5px 0 #0d47a1',
                }}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
