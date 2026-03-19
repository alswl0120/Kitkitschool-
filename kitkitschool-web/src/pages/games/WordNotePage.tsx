import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestDictLevel } from '../../utils/levelUtils'

interface WordEntry {
  word: string
  hint: string
  letters: string[]
}

interface WordNoteData {
  levels: Record<string, WordEntry[]>
}

type SlotState = string | null
type CheckResult = 'idle' | 'correct' | 'wrong'

const NOTE_COLORS = [
  '#FFF9C4', '#FFECB3', '#F8BBD0', '#E1BEE7',
  '#B3E5FC', '#C8E6C9', '#FFE0B2', '#F0F4C3',
]

const LEVEL_COLORS = [
  '#7B1FA2', '#8E24AA', '#9C27B0', '#AB47BC',
  '#7E57C2', '#5C6BC0', '#3949AB', '#283593',
]

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function WordNotePage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [words, setWords] = useState<WordEntry[]>([])

  // gameplay state
  const [wordIndex, setWordIndex] = useState(0)
  const [slots, setSlots] = useState<SlotState[]>([])
  const [pool, setPool] = useState<Array<{ letter: string; id: number; used: boolean }>>([])
  const [checkResult, setCheckResult] = useState<CheckResult>('idle')
  const [shake, setShake] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [showComplete, setShowComplete] = useState(false)

  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const idCounter = useRef(0)

  useEffect(() => {
    fetch('/data/games/wordnote.json')
      .then(r => r.json())
      .then((data: WordNoteData) => {
        const keys = Object.keys(data.levels).map(Number).sort((a, b) => a - b)
        setAvailableLevels(keys)
      })
      .catch(() => {})
  }, [])

  const buildPool = (letters: string[]) => {
    return shuffleArray(letters).map(letter => ({
      letter,
      id: ++idCounter.current,
      used: false,
    }))
  }

  const loadWord = useCallback((entry: WordEntry, wIndex: number, total: number) => {
    setSlots(new Array(entry.word.length).fill(null))
    setPool(buildPool(entry.letters))
    setCheckResult('idle')
    setShake(false)
    setCelebrate(false)
    setProgress({ current: wIndex, max: total })
  }, [])

  const startLevel = useCallback((lvl: number) => {
    fetch('/data/games/wordnote.json')
      .then(r => r.json())
      .then((data: WordNoteData) => {
        const levelWords: WordEntry[] = findClosestDictLevel(data.levels, lvl) ?? []
        setWords(levelWords)
        setLevel(lvl)
        setWordIndex(0)
        setShowComplete(false)
        if (levelWords.length > 0) {
          loadWord(levelWords[0], 0, levelWords.length)
        }
      })
      .catch(() => {})
  }, [loadWord])

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

  const currentEntry = words[wordIndex]

  const handleLetterTap = (id: number) => {
    if (checkResult !== 'idle') return

    const tappedItem = pool.find(p => p.id === id)
    if (!tappedItem || tappedItem.used) return

    // Find first empty slot
    const emptyIndex = slots.findIndex(s => s === null)
    if (emptyIndex === -1) return

    const newSlots = [...slots]
    newSlots[emptyIndex] = String(id)

    const newPool = pool.map(p => p.id === id ? { ...p, used: true } : p)
    setSlots(newSlots)
    setPool(newPool)

    // Auto-check when all slots are filled
    const allFilled = newSlots.every(s => s !== null)
    if (allFilled) {
      const spelled = newSlots.map(s => {
        const item = newPool.find(p => p.id === Number(s))
        return item ? item.letter : ''
      }).join('')

      if (spelled === currentEntry.word) {
        setCheckResult('correct')
        setCelebrate(true)
        setProgress(p => ({ ...p, current: p.current + 1 }))
        setTimeout(() => {
          setCelebrate(false)
          const next = wordIndex + 1
          if (next < words.length) {
            setWordIndex(next)
            loadWord(words[next], next, words.length)
          } else {
            setShowComplete(true)
          }
        }, 1200)
      } else {
        setCheckResult('wrong')
        setShake(true)
        setTimeout(() => {
          setShake(false)
          setCheckResult('idle')
          setSlots(new Array(currentEntry.word.length).fill(null))
          setPool(buildPool(currentEntry.letters))
        }, 800)
      }
    }
  }

  const handleSlotTap = (slotIndex: number) => {
    if (checkResult !== 'idle') return
    if (slots[slotIndex] === null) return

    const removedId = Number(slots[slotIndex])
    const newSlots = [...slots]
    newSlots[slotIndex] = null
    const newPool = pool.map(p => p.id === removedId ? { ...p, used: false } : p)
    setSlots(newSlots)
    setPool(newPool)
  }

  // Level select screen
  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #4A148C, #7B1FA2)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" />
        <div style={{ fontSize: 52 }}>♪</div>
        <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.3)', margin: 0 }}>
          Word Note
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, margin: 0 }}>Spell the words!</p>
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

  if (!currentEntry) return null

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(160deg, #F3E5F5 0%, #E8EAF6 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <BackButton color="#7B1FA2" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Music note decorations */}
      <div style={{ position: 'absolute', top: 60, left: 20, fontSize: 28, opacity: 0.2, pointerEvents: 'none' }}>♩</div>
      <div style={{ position: 'absolute', top: 80, right: 30, fontSize: 36, opacity: 0.2, pointerEvents: 'none' }}>♪</div>
      <div style={{ position: 'absolute', bottom: 160, left: 30, fontSize: 32, opacity: 0.15, pointerEvents: 'none' }}>♫</div>
      <div style={{ position: 'absolute', bottom: 140, right: 20, fontSize: 28, opacity: 0.15, pointerEvents: 'none' }}>♬</div>

      {/* Header */}
      <div style={{
        width: '100%',
        background: 'linear-gradient(90deg, #7B1FA2, #4A148C)',
        padding: '48px 24px 14px',
        textAlign: 'center',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          Level {level} — Word {wordIndex + 1} of {words.length}
        </div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
          ♪ Word Note ♪
        </div>
      </div>

      {/* Hint emoji */}
      <div style={{
        marginTop: 20,
        fontSize: 80,
        lineHeight: 1,
        filter: celebrate ? 'drop-shadow(0 0 20px gold)' : 'none',
        transition: 'filter 0.3s',
      }}>
        {currentEntry.hint}
      </div>

      {/* Blank slots */}
      <div style={{
        display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center',
        padding: '0 16px',
        animation: shake ? 'shake 0.4s ease' : 'none',
      }}>
        {slots.map((slotId, i) => {
          const item = slotId !== null ? pool.find(p => p.id === Number(slotId)) : null
          const isCorrectSlot = checkResult === 'correct'
          const isWrongSlot = checkResult === 'wrong' && slotId !== null

          return (
            <div
              key={i}
              onClick={() => handleSlotTap(i)}
              style={{
                width: 52, height: 58,
                borderRadius: 12,
                background: item
                  ? isCorrectSlot ? '#E8F5E9' : isWrongSlot ? '#FFEBEE' : '#fff'
                  : 'rgba(123,31,162,0.08)',
                border: item
                  ? isCorrectSlot ? '2px solid #4CAF50' : isWrongSlot ? '2px solid #F44336' : '2px solid #9C27B0'
                  : '2px dashed #CE93D8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 'bold',
                color: isCorrectSlot ? '#2E7D32' : isWrongSlot ? '#C62828' : '#4A148C',
                cursor: item ? 'pointer' : 'default',
                boxShadow: item ? '0 3px 10px rgba(123,31,162,0.2)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {item ? item.letter.toUpperCase() : ''}
            </div>
          )
        })}
      </div>

      {/* Feedback label */}
      <div style={{
        marginTop: 12, height: 28,
        fontSize: 16, fontWeight: 'bold',
        color: checkResult === 'correct' ? '#2E7D32' : checkResult === 'wrong' ? '#C62828' : 'transparent',
      }}>
        {checkResult === 'correct' ? '✓ Correct!' : checkResult === 'wrong' ? '✗ Try again!' : '.'}
      </div>

      {/* Letter pool */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap',
        justifyContent: 'center',
        padding: '8px 24px',
        marginTop: 8,
        maxWidth: 520,
      }}>
        {pool.map((item, i) => (
          <button
            key={item.id}
            onClick={() => handleLetterTap(item.id)}
            disabled={item.used || checkResult !== 'idle'}
            style={{
              width: 56, height: 64,
              borderRadius: 12,
              background: item.used ? 'rgba(0,0,0,0.08)' : NOTE_COLORS[i % NOTE_COLORS.length],
              border: item.used ? '2px solid rgba(0,0,0,0.1)' : '2px solid rgba(0,0,0,0.15)',
              fontSize: 24, fontWeight: 'bold',
              color: item.used ? 'rgba(0,0,0,0.2)' : '#212121',
              cursor: item.used ? 'default' : 'pointer',
              boxShadow: item.used ? 'none' : '0 4px 10px rgba(0,0,0,0.15)',
              transform: item.used ? 'scale(0.92)' : 'scale(1)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {item.letter.toUpperCase()}
          </button>
        ))}
      </div>

      {/* CSS keyframes for shake via style tag */}
      <style>{`
        @keyframes shake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-8px); }
          40%  { transform: translateX(8px); }
          60%  { transform: translateX(-6px); }
          80%  { transform: translateX(6px); }
          100% { transform: translateX(0); }
        }
      `}</style>

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 18,
        }}>
          <div style={{ fontSize: 64 }}>🎵</div>
          <div style={{ color: '#fff', fontSize: 42, fontWeight: 'bold', textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
            Amazing!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20 }}>
            You spelled all the words!
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '12px 28px', borderRadius: 12, background: '#4CAF50',
              color: '#fff', fontSize: 18, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Play Again</button>
            <button onClick={() => setLevel(0)} style={{
              padding: '12px 28px', borderRadius: 12, background: '#9C27B0',
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
