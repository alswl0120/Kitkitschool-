import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../components/BackButton'
import ProgressBar from '../../components/ProgressBar'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestLevel } from '../../utils/levelUtils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Worksheet {
  id: number
  verticalWords: string[]
  horizontalWords: string[]
}

interface Level {
  level: number
  worksheets: Worksheet[]
}

interface WordCard {
  id: string        // unique id
  word: string
  correctZone: 'vertical' | 'horizontal'
}

interface PlacedCard {
  slotIndex: number
  zone: 'vertical' | 'horizontal'
  card: WordCard
}

// ─── Shuffle helper ───────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Build cards from a worksheet ────────────────────────────────────────────

function buildCards(ws: Worksheet): WordCard[] {
  const vCards: WordCard[] = ws.verticalWords.map((w, i) => ({
    id: `v-${i}-${w}`,
    word: w,
    correctZone: 'vertical',
  }))
  const hCards: WordCard[] = ws.horizontalWords.map((w, i) => ({
    id: `h-${i}-${w}`,
    word: w,
    correctZone: 'horizontal',
  }))
  return shuffle([...vCards, ...hCards])
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const COLORS = {
  verticalBg: '#FFD119',
  verticalHeader: '#E6A800',
  horizontalBg: '#FFEABF',
  horizontalHeader: '#F5C842',
  pageBg: '#FFF8E8',
  cardBorder: '#B0C4DE',
  cardBg: '#FFFFFF',
  correctBorder: '#4CAF50',
  wrongBorder: '#F44336',
  slotBg: 'rgba(255,255,255,0.55)',
  slotBorder: '#CCC',
  draggingBg: '#E3F2FD',
  draggingBorder: '#1976D2',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SlotProps {
  index: number
  zone: 'vertical' | 'horizontal'
  placed: PlacedCard | null
  isOver: boolean
  flashState: 'idle' | 'correct' | 'wrong'
}

function Slot({ index, zone, placed, isOver, flashState }: SlotProps) {
  const borderColor =
    flashState === 'correct' ? COLORS.correctBorder :
    flashState === 'wrong' ? COLORS.wrongBorder :
    isOver ? '#1976D2' : COLORS.slotBorder

  const bgColor =
    flashState === 'correct' ? '#E8F5E9' :
    flashState === 'wrong' ? '#FFEBEE' :
    isOver ? '#E3F2FD' : COLORS.slotBg

  return (
    <div
      data-slot="true"
      data-slot-zone={zone}
      data-slot-index={index}
      style={{
        width: '100%',
        minHeight: 52,
        borderRadius: 12,
        border: `2.5px ${flashState === 'correct' ? 'solid' : isOver ? 'dashed' : 'dashed'} ${borderColor}`,
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        boxShadow: isOver ? '0 0 0 3px rgba(25,118,210,0.2)' : 'none',
      }}
    >
      {placed ? (
        <span style={{
          fontSize: 22,
          fontWeight: 'bold',
          color: flashState === 'correct' ? '#2E7D32' : flashState === 'wrong' ? '#C62828' : '#333',
          textTransform: 'uppercase',
          letterSpacing: 2,
          userSelect: 'none',
        }}>
          {placed.card.word}
        </span>
      ) : (
        <span style={{ fontSize: 13, color: '#AAA', letterSpacing: 1 }}>drop here</span>
      )}
    </div>
  )
}

interface CardProps {
  card: WordCard
  onPointerDown: (e: React.PointerEvent, card: WordCard) => void
  isDragging: boolean
  disabled: boolean
}

function Card({ card, onPointerDown, isDragging, disabled }: CardProps) {
  return (
    <div
      onPointerDown={disabled ? undefined : e => onPointerDown(e, card)}
      style={{
        padding: '10px 20px',
        borderRadius: 12,
        background: isDragging ? COLORS.draggingBg : COLORS.cardBg,
        border: `2.5px solid ${isDragging ? COLORS.draggingBorder : COLORS.cardBorder}`,
        fontSize: 22,
        fontWeight: 'bold',
        color: disabled ? '#AAA' : '#333',
        textTransform: 'uppercase',
        letterSpacing: 2,
        cursor: disabled ? 'default' : 'grab',
        userSelect: 'none',
        opacity: isDragging ? 0.5 : disabled ? 0.35 : 1,
        boxShadow: isDragging
          ? '0 8px 24px rgba(25,118,210,0.25)'
          : '0 3px 8px rgba(0,0,0,0.12)',
        transition: 'box-shadow 0.15s, opacity 0.15s',
        pointerEvents: disabled ? 'none' : 'auto',
        touchAction: 'none',
      }}
    >
      {card.word}
    </div>
  )
}

// ─── Main Game Component ──────────────────────────────────────────────────────

interface DragState {
  card: WordCard
  x: number
  y: number
}

interface GameProps {
  worksheet: Worksheet
  worksheetIndex: number
  totalWorksheets: number
  onComplete: () => void
}

function WordMatrixGame({ worksheet, worksheetIndex, totalWorksheets, onComplete }: GameProps) {
  const [cards, setCards] = useState<WordCard[]>(() => buildCards(worksheet))
  const [placed, setPlaced] = useState<Map<string, PlacedCard>>(new Map()) // key: `${zone}-${index}`
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null)
  const [flashStates, setFlashStates] = useState<Map<string, 'idle' | 'correct' | 'wrong'>>(new Map())
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Reset when worksheet changes
  useEffect(() => {
    setCards(buildCards(worksheet))
    setPlaced(new Map())
    setDragging(null)
    setHoveredSlot(null)
    setFlashStates(new Map())
  }, [worksheet])

  const slotKey = (zone: 'vertical' | 'horizontal', index: number) => `${zone}-${index}`

  const placedCardIds = new Set([...placed.values()].map(p => p.card.id))
  const unplacedCards = cards.filter(c => !placedCardIds.has(c.id))

  // Check completion
  useEffect(() => {
    const vCount = worksheet.verticalWords.length
    const hCount = worksheet.horizontalWords.length
    const total = vCount + hCount
    if (placed.size < total) return

    // Check all correct
    let allCorrect = true
    placed.forEach(p => {
      if (p.card.correctZone !== p.zone) allCorrect = false
    })
    if (allCorrect && placed.size === total) {
      setTimeout(onComplete, 600)
    }
  }, [placed, worksheet, onComplete])

  const flash = useCallback((key: string, state: 'correct' | 'wrong') => {
    const existing = flashTimers.current.get(key)
    if (existing) clearTimeout(existing)

    setFlashStates(prev => new Map(prev).set(key, state))
    const t = setTimeout(() => {
      setFlashStates(prev => {
        const next = new Map(prev)
        next.set(key, 'idle')
        return next
      })
      flashTimers.current.delete(key)
    }, 700)
    flashTimers.current.set(key, t)
  }, [])

  const handleDropOnSlot = useCallback((card: WordCard, zone: 'vertical' | 'horizontal', index: number) => {
    const key = slotKey(zone, index)

    // Check if slot already occupied
    if (placed.has(key)) return

    const isCorrect = card.correctZone === zone

    if (isCorrect) {
      setPlaced(prev => {
        const next = new Map(prev)
        next.set(key, { slotIndex: index, zone, card })
        return next
      })
      flash(key, 'correct')
    } else {
      // Wrong zone: show flash but don't place
      flash(key, 'wrong')
    }
  }, [placed, flash])

  const handlePointerDown = useCallback((e: React.PointerEvent, card: WordCard) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging({ card, x: e.clientX, y: e.clientY })
    setHoveredSlot(null)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    e.preventDefault()
    setDragging(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)

    // Detect which slot is under the pointer for hover highlight
    const els = document.elementsFromPoint(e.clientX, e.clientY)
    const slotEl = els.find(el => el.getAttribute('data-slot') === 'true')
    if (slotEl) {
      const zone = slotEl.getAttribute('data-slot-zone') as 'vertical' | 'horizontal'
      const index = Number(slotEl.getAttribute('data-slot-index'))
      setHoveredSlot(slotKey(zone, index))
    } else {
      setHoveredSlot(null)
    }
  }, [dragging])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    e.preventDefault()

    const els = document.elementsFromPoint(e.clientX, e.clientY)
    const slotEl = els.find(el => el.getAttribute('data-slot') === 'true')
    if (slotEl) {
      const zone = slotEl.getAttribute('data-slot-zone') as 'vertical' | 'horizontal'
      const index = Number(slotEl.getAttribute('data-slot-index'))
      handleDropOnSlot(dragging.card, zone, index)
    }

    setDragging(null)
    setHoveredSlot(null)
  }, [dragging, handleDropOnSlot])

  const vCount = worksheet.verticalWords.length
  const hCount = worksheet.horizontalWords.length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        width: '100%',
        maxWidth: 780,
        margin: '0 auto',
        padding: '0 16px',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Ghost element that follows the pointer during drag */}
      {dragging && (
        <div
          style={{
            position: 'fixed',
            left: dragging.x - 40,
            top: dragging.y - 26,
            zIndex: 9999,
            pointerEvents: 'none',
            padding: '10px 20px',
            borderRadius: 12,
            background: COLORS.draggingBg,
            border: `2.5px solid ${COLORS.draggingBorder}`,
            fontSize: 22,
            fontWeight: 'bold',
            color: '#333',
            textTransform: 'uppercase',
            letterSpacing: 2,
            userSelect: 'none',
            opacity: 0.9,
            boxShadow: '0 8px 24px rgba(25,118,210,0.35)',
            cursor: 'grabbing',
          }}
        >
          {dragging.card.word}
        </div>
      )}

      {/* Worksheet indicator */}
      <div style={{
        fontSize: 15,
        color: '#888',
        fontWeight: 600,
        letterSpacing: 1,
      }}>
        Puzzle {worksheetIndex + 1} of {totalWorksheets}
      </div>

      {/* Two-column drop zones */}
      <div style={{
        display: 'flex',
        gap: 20,
        width: '100%',
        alignItems: 'flex-start',
      }}>
        {/* Vertical Words column */}
        <div style={{
          flex: 1,
          background: COLORS.verticalBg,
          borderRadius: 18,
          padding: '16px 14px 20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            textAlign: 'center',
            fontWeight: 800,
            fontSize: 17,
            color: '#7A5500',
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
            <span style={{ fontSize: 20 }}>↕</span>
            Vertical Words
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: vCount }, (_, i) => {
              const key = slotKey('vertical', i)
              return (
                <Slot
                  key={key}
                  index={i}
                  zone="vertical"
                  placed={placed.get(key) ?? null}
                  isOver={hoveredSlot === key}
                  flashState={flashStates.get(key) ?? 'idle'}
                />
              )
            })}
          </div>
        </div>

        {/* Horizontal Words column */}
        <div style={{
          flex: 1,
          background: COLORS.horizontalBg,
          borderRadius: 18,
          padding: '16px 14px 20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            textAlign: 'center',
            fontWeight: 800,
            fontSize: 17,
            color: '#7A5500',
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
            <span style={{ fontSize: 20 }}>↔</span>
            Horizontal Words
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: hCount }, (_, i) => {
              const key = slotKey('horizontal', i)
              return (
                <Slot
                  key={key}
                  index={i}
                  zone="horizontal"
                  placed={placed.get(key) ?? null}
                  isOver={hoveredSlot === key}
                  flashState={flashStates.get(key) ?? 'idle'}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Word card bank */}
      <div style={{
        width: '100%',
        background: 'rgba(255,255,255,0.7)',
        borderRadius: 18,
        padding: '16px 20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
        border: '2px solid #EEE',
      }}>
        <div style={{
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: '#999',
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          marginBottom: 12,
        }}>
          Word Cards — Drag to the correct column
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          minHeight: 58,
        }}>
          {cards.map(card => (
            <Card
              key={card.id}
              card={card}
              onPointerDown={handlePointerDown}
              isDragging={dragging?.card.id === card.id}
              disabled={placedCardIds.has(card.id)}
            />
          ))}
          {unplacedCards.length === 0 && (
            <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: 18 }}>
              All words placed!
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function WordMatrixPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [worksheets, setWorksheets] = useState<Worksheet[]>([])
  const [worksheetIndex, setWorksheetIndex] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  const [progress, setProgress] = useState({ current: 1, max: 1 })

  // Load level data from JSON
  useEffect(() => {
    fetch('/data/games/wordmatrix.json')
      .then(r => r.json())
      .then((data: { levels: Level[] }) => {
        const levels = (data.levels || []).map(l => l.level).sort((a, b) => a - b)
        setAvailableLevels(levels.length > 0 ? levels : [1, 2, 3])
      })
      .catch(() => setAvailableLevels([1, 2, 3]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    fetch('/data/games/wordmatrix.json')
      .then(r => r.json())
      .then((data: { levels: Level[] }) => {
        const found = findClosestLevel(data.levels, lvl) ?? data.levels[0]
        const wss = found?.worksheets ?? []
        setWorksheets(wss)
        setWorksheetIndex(0)
        setProgress({ current: 1, max: wss.length })
        setLevel(lvl)
        setShowComplete(false)
      })
      .catch(() => {
        setWorksheets([])
        setLevel(lvl)
        setShowComplete(false)
      })
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

  const handleWorksheetComplete = useCallback(() => {
    const nextIndex = worksheetIndex + 1
    if (nextIndex >= worksheets.length) {
      setShowComplete(true)
    } else {
      setWorksheetIndex(nextIndex)
      setProgress({ current: nextIndex + 1, max: worksheets.length })
    }
  }, [worksheetIndex, worksheets])

  // ── Level select screen ───────────────────────────────────────────────────

  if (level === 0) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #FFD119 0%, #FFA726 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
      }}>
        <BackButton color="#fff" />

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 42,
            fontWeight: 900,
            color: '#fff',
            textShadow: '2px 3px 8px rgba(0,0,0,0.25)',
            letterSpacing: 2,
          }}>
            Word Matrix
          </div>
          <div style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.85)',
            marginTop: 6,
            fontWeight: 600,
          }}>
            Sort words into Vertical & Horizontal columns
          </div>
        </div>

        {/* Level buttons */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {availableLevels.map(lvl => (
            <button
              key={lvl}
              onClick={() => startLevel(lvl)}
              style={{
                width: 80,
                height: 80,
                borderRadius: 18,
                background: '#fff',
                color: '#E65100',
                fontSize: 26,
                fontWeight: 900,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Game screen ───────────────────────────────────────────────────────────

  const currentWorksheet = worksheets[worksheetIndex]

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      background: COLORS.pageBg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 64,
      paddingBottom: 32,
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      <BackButton color="#888" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Level badge */}
      <div style={{
        position: 'absolute',
        top: 18,
        right: 20,
        background: '#FFD119',
        color: '#7A5500',
        fontWeight: 800,
        fontSize: 14,
        padding: '4px 14px',
        borderRadius: 20,
        letterSpacing: 1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        Level {level}
      </div>

      {/* Title row */}
      <div style={{
        fontSize: 26,
        fontWeight: 900,
        color: '#7A5500',
        marginBottom: 20,
        letterSpacing: 1,
      }}>
        Word Matrix
      </div>

      {currentWorksheet && (
        <WordMatrixGame
          key={`${level}-${worksheetIndex}`}
          worksheet={currentWorksheet}
          worksheetIndex={worksheetIndex}
          totalWorksheets={worksheets.length}
          onComplete={handleWorksheetComplete}
        />
      )}

      {/* Completion overlay */}
      {showComplete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300,
          gap: 28,
        }}>
          {/* Celebration card */}
          <div style={{
            background: '#fff',
            borderRadius: 28,
            padding: '40px 56px',
            textAlign: 'center',
            boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
            <div style={{
              fontSize: 38,
              fontWeight: 900,
              color: '#E65100',
              letterSpacing: 1,
              marginBottom: 6,
            }}>
              Great Job!
            </div>
            <div style={{ fontSize: 17, color: '#888', marginBottom: 28 }}>
              You sorted all the words correctly!
            </div>

            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => startLevel(level)}
                style={{
                  padding: '12px 28px',
                  borderRadius: 14,
                  background: '#4CAF50',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(76,175,80,0.4)',
                }}
              >
                Play Again
              </button>
              <button
                onClick={() => setLevel(0)}
                style={{
                  padding: '12px 28px',
                  borderRadius: 14,
                  background: '#2196F3',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(33,150,243,0.4)',
                }}
              >
                Other Levels
              </button>
              <button
                onClick={() => isFromShell ? shellBack() : navigate('/')}
                style={{
                  padding: '12px 28px',
                  borderRadius: 14,
                  background: '#FF5722',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255,87,34,0.4)',
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
