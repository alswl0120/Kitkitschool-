import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestLevel } from '../../utils/levelUtils'

interface CarData {
  label: string
  words: string[]
}

interface LevelData {
  level: number
  cars: CarData[]
  allWords: string[]
}

interface GameData {
  levels: LevelData[]
}

type CardState = 'idle' | 'selected' | 'correct' | 'wrong'

interface WordCard {
  word: string
  state: CardState
  placedInCar: string | null
}

const CAR_COLORS = ['#E57373', '#81C784', '#64B5F6', '#FFB74D', '#BA68C8']
const CAR_HEADER_COLORS = ['#C62828', '#2E7D32', '#1565C0', '#E65100', '#6A1B9A']
const LEVEL_COLORS = ['#E57373', '#81C784', '#64B5F6', '#FFB74D', '#BA68C8', '#4DB6AC', '#F06292', '#A1887F']

export default function SoundTrainPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [levelData, setLevelData] = useState<LevelData | null>(null)
  const [cards, setCards] = useState<WordCard[]>([])
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [carContents, setCarContents] = useState<Record<string, string[]>>({})
  const animTimeouts = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    fetch('/data/games/soundtrain.json')
      .then(r => r.json())
      .then((data: GameData) => {
        const levels = data.levels.map(l => l.level).sort((a, b) => a - b)
        setAvailableLevels(levels)
      })
      .catch(() => setAvailableLevels([1, 2, 3, 4, 5, 6, 7, 8]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    animTimeouts.current.forEach(t => clearTimeout(t))
    animTimeouts.current = []

    fetch('/data/games/soundtrain.json')
      .then(r => r.json())
      .then((data: GameData) => {
        const ld = findClosestLevel(data.levels, lvl) ?? data.levels[0]
        if (!ld) return
        setLevelData(ld)
        setLevel(lvl)
        setShowComplete(false)
        setSelectedWord(null)
        const initialCards: WordCard[] = ld.allWords.map(w => ({
          word: w,
          state: 'idle',
          placedInCar: null,
        }))
        setCards(initialCards)
        const initialCarContents: Record<string, string[]> = {}
        ld.cars.forEach(c => { initialCarContents[c.label] = [] })
        setCarContents(initialCarContents)
        setProgress({ current: 0, max: ld.allWords.length })
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

  useEffect(() => {
    return () => {
      animTimeouts.current.forEach(t => clearTimeout(t))
    }
  }, [])

  const handleWordTap = useCallback((word: string) => {
    setCards(prev => {
      const card = prev.find(c => c.word === word)
      if (!card || card.placedInCar !== null || card.state === 'correct') return prev
      const nowSelected = card.state !== 'selected'
      return prev.map(c => {
        if (c.word === word) return { ...c, state: nowSelected ? 'selected' : 'idle' }
        if (c.state === 'selected') return { ...c, state: 'idle' }
        return c
      })
    })
    setSelectedWord(prev => prev === word ? null : word)
  }, [])

  const handleCarTap = useCallback((carLabel: string) => {
    if (!selectedWord || !levelData) return
    const car = levelData.cars.find(c => c.label === carLabel)
    if (!car) return
    const isCorrect = car.words.includes(selectedWord)
    const word = selectedWord

    if (isCorrect) {
      setCards(prev =>
        prev.map(c =>
          c.word === word ? { ...c, state: 'correct', placedInCar: carLabel } : c
        )
      )
      setCarContents(prev => ({
        ...prev,
        [carLabel]: [...(prev[carLabel] || []), word],
      }))
      setSelectedWord(null)
      setProgress(prev => {
        const next = { current: prev.current + 1, max: prev.max }
        if (next.current >= next.max) {
          const t = setTimeout(() => setShowComplete(true), 600)
          animTimeouts.current.push(t)
        }
        return next
      })
    } else {
      setCards(prev =>
        prev.map(c => c.word === word ? { ...c, state: 'wrong' } : c)
      )
      const t = setTimeout(() => {
        setCards(prev =>
          prev.map(c => c.word === word ? { ...c, state: 'idle' } : c)
        )
        setSelectedWord(null)
      }, 700)
      animTimeouts.current.push(t)
    }
  }, [selectedWord, levelData])

  // Level selector screen
  if (level === 0) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #8D6E63, #5D4037)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        overflow: 'auto',
      }}>
        <BackButton color="#fff" />
        <div style={{ fontSize: 56 }}>🚂</div>
        <h1 style={{
          color: '#fff',
          fontSize: 36,
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.4)',
          margin: 0,
        }}>
          Sound Train
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: 18,
          margin: 0,
          textAlign: 'center',
          padding: '0 20px',
        }}>
          Sort words into the right train cars!
        </p>
        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 520,
          padding: '0 20px',
        }}>
          {availableLevels.map((lvl, i) => (
            <button
              key={lvl}
              onClick={() => startLevel(lvl)}
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: LEVEL_COLORS[i % LEVEL_COLORS.length],
                color: '#fff',
                fontSize: 24,
                fontWeight: 'bold',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!levelData) return null

  const placedCount = cards.filter(c => c.placedInCar !== null).length
  const remainingCards = cards.filter(c => c.placedInCar === null)

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #87CEEB 0%, #B0D4EC 52%, #C8A96E 52%, #8B6914 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <BackButton color="#5D4037" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={placedCount} max={progress.max} />

      {/* Instruction bar */}
      <div style={{
        textAlign: 'center',
        paddingTop: 48,
        paddingBottom: 4,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4E342E',
        textShadow: '1px 1px 2px rgba(255,255,255,0.7)',
        flexShrink: 0,
      }}>
        {selectedWord
          ? `Tap a train car for "${selectedWord}"`
          : 'Tap a word card, then tap the right car!'}
      </div>

      {/* Train area */}
      <div style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
        paddingBottom: 4,
      }}>
        {/* Engine + Cars row */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0,
        }}>
          {/* Engine */}
          <div style={{
            width: 86,
            height: 96,
            background: 'linear-gradient(180deg, #D32F2F, #B71C1C)',
            borderRadius: '12px 12px 4px 4px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '2px 2px 8px rgba(0,0,0,0.4)',
            position: 'relative',
            marginRight: 4,
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 26 }}>🚂</div>
            <div style={{
              position: 'absolute',
              bottom: -10,
              display: 'flex',
              gap: 12,
            }}>
              {[0, 1].map(i => (
                <div key={i} style={{
                  width: 20, height: 20,
                  borderRadius: '50%',
                  background: '#212121',
                  border: '3px solid #616161',
                }} />
              ))}
            </div>
          </div>

          {/* Cars */}
          {levelData.cars.map((car, idx) => (
            <div key={car.label} style={{ display: 'flex', alignItems: 'flex-end' }}>
              {/* Coupler */}
              <div style={{
                width: 10,
                height: 7,
                background: '#795548',
                borderRadius: 2,
                marginBottom: 18,
                flexShrink: 0,
              }} />
              {/* Car body */}
              <div
                onClick={() => handleCarTap(car.label)}
                style={{
                  width: 120,
                  minHeight: 105,
                  background: CAR_COLORS[idx % CAR_COLORS.length],
                  borderRadius: '8px 8px 4px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: selectedWord
                    ? '0 0 0 3px #FFF176, 2px 2px 8px rgba(0,0,0,0.3)'
                    : '2px 2px 8px rgba(0,0,0,0.3)',
                  cursor: selectedWord ? 'pointer' : 'default',
                  position: 'relative',
                  transition: 'box-shadow 0.15s',
                  flexShrink: 0,
                  paddingBottom: 14,
                }}
              >
                {/* Label circle */}
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: CAR_HEADER_COLORS[idx % CAR_HEADER_COLORS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 20,
                  fontWeight: 'bold',
                  marginTop: 7,
                  marginBottom: 5,
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}>
                  {car.label}
                </div>
                {/* Placed words */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 3,
                  justifyContent: 'center',
                  padding: '0 5px',
                }}>
                  {(carContents[car.label] || []).map(w => (
                    <div key={w} style={{
                      background: 'rgba(255,255,255,0.9)',
                      color: CAR_HEADER_COLORS[idx % CAR_HEADER_COLORS.length],
                      borderRadius: 6,
                      padding: '2px 7px',
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}>
                      {w}
                    </div>
                  ))}
                </div>
                {/* Wheels */}
                <div style={{
                  position: 'absolute',
                  bottom: -10,
                  display: 'flex',
                  gap: 38,
                }}>
                  {[0, 1].map(i => (
                    <div key={i} style={{
                      width: 18, height: 18,
                      borderRadius: '50%',
                      background: '#212121',
                      border: '3px solid #616161',
                    }} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Track */}
        <div style={{
          width: '82%',
          height: 13,
          background: 'linear-gradient(180deg, #8D6E63, #5D4037)',
          borderRadius: 4,
          marginTop: 12,
          position: 'relative',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}>
          {Array.from({ length: 13 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${(i / 12) * 90 + 5}%`,
              top: -4,
              width: 7,
              height: 21,
              background: '#6D4C41',
              borderRadius: 2,
              transform: 'translateX(-50%)',
            }} />
          ))}
          <div style={{
            position: 'absolute', top: 2, left: 0, right: 0,
            height: 3, background: '#9E9E9E', borderRadius: 2,
          }} />
          <div style={{
            position: 'absolute', bottom: 2, left: 0, right: 0,
            height: 3, background: '#9E9E9E', borderRadius: 2,
          }} />
        </div>
      </div>

      {/* Word cards area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 16px 12px',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
          alignContent: 'center',
          maxWidth: 720,
        }}>
          {remainingCards.map(card => {
            const isSelected = card.state === 'selected'
            const isWrong = card.state === 'wrong'
            return (
              <button
                key={card.word}
                onClick={() => handleWordTap(card.word)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 14,
                  background: isWrong ? '#F44336' : isSelected ? '#FDD835' : '#FFFFFF',
                  color: isWrong ? '#fff' : isSelected ? '#5D4037' : '#333',
                  fontSize: 18,
                  fontWeight: 'bold',
                  boxShadow: isSelected
                    ? '0 0 0 3px #F57F17, 0 4px 12px rgba(0,0,0,0.3)'
                    : isWrong
                      ? '0 0 0 3px #B71C1C, 0 4px 12px rgba(0,0,0,0.3)'
                      : '0 3px 8px rgba(0,0,0,0.25)',
                  border: 'none',
                  cursor: 'pointer',
                  transform: isSelected ? 'translateY(-4px) scale(1.05)' : 'none',
                  animation: isWrong ? 'shake 0.4s ease' : 'none',
                  transition: isWrong
                    ? 'background 0.1s'
                    : 'transform 0.15s ease, box-shadow 0.15s, background 0.15s',
                }}
              >
                {card.word}
              </button>
            )
          })}
        </div>
      </div>

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          gap: 24,
        }}>
          <div style={{ fontSize: 64 }}>🎉</div>
          <div style={{
            color: '#fff',
            fontSize: 48,
            fontWeight: 'bold',
            textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          }}>
            Great Job!
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => startLevel(level)}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#4CAF50',
                color: '#fff', fontSize: 20, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
              }}
            >
              Play Again
            </button>
            <button
              onClick={() => setLevel(0)}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#2196F3',
                color: '#fff', fontSize: 20, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
              }}
            >
              Other Levels
            </button>
            <button
              onClick={() => isFromShell ? shellBack() : navigate('/')}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#FF5722',
                color: '#fff', fontSize: 20, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
              }}
            >
              Home
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-7px); }
          40%  { transform: translateX(7px); }
          60%  { transform: translateX(-5px); }
          80%  { transform: translateX(5px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
