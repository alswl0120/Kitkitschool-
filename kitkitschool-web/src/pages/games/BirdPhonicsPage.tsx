import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'
import { findClosestLevel } from '../../utils/levelUtils'

interface LevelData {
  level: number
  pattern: string
  feedWords: string[]
  decoys: string[]
  allWords: string[]
}

interface GameData {
  levels: LevelData[]
}

type CardState = 'idle' | 'flying' | 'eaten' | 'wrong'

interface WordCard {
  word: string
  state: CardState
  isFeedWord: boolean
}

const LEVEL_COLORS = [
  '#42A5F5', '#26C6DA', '#66BB6A', '#FFCA28',
  '#FFA726', '#EC407A', '#AB47BC', '#26A69A',
  '#78909C', '#EF5350',
]

const BIRD_STATES = {
  idle: '🐦',
  eating: '😋',
  happy: '🤩',
}

export default function BirdPhonicsPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()

  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [levelData, setLevelData] = useState<LevelData | null>(null)
  const [cards, setCards] = useState<WordCard[]>([])
  const [hearts, setHearts] = useState(3)
  const [showComplete, setShowComplete] = useState(false)
  const [showFail, setShowFail] = useState(false)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [birdState, setBirdState] = useState<'idle' | 'eating' | 'happy'>('idle')
  const [flyingWord, setFlyingWord] = useState<string | null>(null)
  const animTimeouts = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    fetch('/data/games/birdphonics.json')
      .then(r => r.json())
      .then((data: GameData) => {
        const levels = data.levels.map(l => l.level).sort((a, b) => a - b)
        setAvailableLevels(levels)
      })
      .catch(() => setAvailableLevels([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    animTimeouts.current.forEach(t => clearTimeout(t))
    animTimeouts.current = []

    fetch('/data/games/birdphonics.json')
      .then(r => r.json())
      .then((data: GameData) => {
        const ld = findClosestLevel(data.levels, lvl) ?? data.levels[0]
        if (!ld) return
        setLevelData(ld)
        setLevel(lvl)
        setShowComplete(false)
        setShowFail(false)
        setHearts(3)
        setBirdState('idle')
        setFlyingWord(null)
        const shuffled = [...ld.allWords].sort(() => Math.random() - 0.5)
        const initialCards: WordCard[] = shuffled.map(w => ({
          word: w,
          state: 'idle',
          isFeedWord: ld.feedWords.includes(w),
        }))
        setCards(initialCards)
        setProgress({ current: 0, max: ld.feedWords.length })
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
    if (!levelData) return
    const card = cards.find(c => c.word === word)
    if (!card || card.state !== 'idle') return

    if (card.isFeedWord) {
      // Correct: fly to bird
      setFlyingWord(word)
      setCards(prev => prev.map(c => c.word === word ? { ...c, state: 'flying' } : c))
      setBirdState('eating')

      const t1 = setTimeout(() => {
        setCards(prev => prev.map(c => c.word === word ? { ...c, state: 'eaten' } : c))
        setFlyingWord(null)
        setBirdState('happy')
        setProgress(prev => {
          const next = { current: prev.current + 1, max: prev.max }
          if (next.current >= next.max) {
            const t2 = setTimeout(() => {
              setShowComplete(true)
              setBirdState('happy')
            }, 800)
            animTimeouts.current.push(t2)
          }
          return next
        })
        const t3 = setTimeout(() => setBirdState('idle'), 800)
        animTimeouts.current.push(t3)
      }, 600)
      animTimeouts.current.push(t1)
    } else {
      // Wrong: shake card, lose heart
      setCards(prev => prev.map(c => c.word === word ? { ...c, state: 'wrong' } : c))
      const t1 = setTimeout(() => {
        setCards(prev => prev.map(c => c.word === word ? { ...c, state: 'idle' } : c))
      }, 700)
      animTimeouts.current.push(t1)

      setHearts(prev => {
        const next = prev - 1
        if (next <= 0) {
          const t2 = setTimeout(() => setShowFail(true), 500)
          animTimeouts.current.push(t2)
        }
        return next
      })
    }
  }, [cards, levelData])

  // Level selector
  if (level === 0) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #29B6F6, #0288D1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        overflow: 'auto',
      }}>
        <BackButton color="#fff" />
        <div style={{ fontSize: 60 }}>🐦</div>
        <h1 style={{
          color: '#fff',
          fontSize: 36,
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.4)',
          margin: 0,
        }}>
          Bird Phonics
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: 18,
          margin: 0,
          textAlign: 'center',
          padding: '0 20px',
        }}>
          Feed the bird the right words!
        </p>
        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 560,
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

  const activeCards = cards.filter(c => c.state !== 'eaten')

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #87CEEB 0%, #B3E5FC 60%, #E8F5E9 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <BackButton color="#01579B" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />

      {/* Hearts row */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        paddingTop: 12,
        paddingRight: 20,
        gap: 6,
        flexShrink: 0,
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            fontSize: 28,
            opacity: i < hearts ? 1 : 0.25,
            transition: 'opacity 0.3s',
          }}>
            ❤️
          </span>
        ))}
      </div>

      {/* Bird section */}
      <div style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 4,
        paddingBottom: 8,
      }}>
        {/* Target pattern label */}
        <div style={{
          background: 'rgba(255,255,255,0.85)',
          borderRadius: 16,
          padding: '8px 22px',
          marginBottom: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 18, fontWeight: 'bold', color: '#01579B' }}>
            Feed me{' '}
          </span>
          <span style={{
            fontSize: 22,
            fontWeight: 'bold',
            color: '#D32F2F',
            background: '#FFEB3B',
            padding: '2px 10px',
            borderRadius: 8,
          }}>
            -{levelData.pattern}
          </span>
          <span style={{ fontSize: 18, fontWeight: 'bold', color: '#01579B' }}>
            {' '}words!
          </span>
        </div>

        {/* Bird */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{
            fontSize: 80,
            lineHeight: 1,
            transition: 'transform 0.2s',
            transform: birdState === 'eating' ? 'scale(1.15)' : birdState === 'happy' ? 'scale(1.1) rotate(-5deg)' : 'scale(1)',
            filter: birdState === 'happy' ? 'drop-shadow(0 0 12px #FFD700)' : 'none',
          }}>
            {BIRD_STATES[birdState]}
          </div>
          {/* Flying word animation */}
          {flyingWord && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 18,
              fontWeight: 'bold',
              color: '#fff',
              background: '#4CAF50',
              borderRadius: 10,
              padding: '4px 12px',
              animation: 'flyUp 0.6s ease forwards',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}>
              {flyingWord}
            </div>
          )}
        </div>

        {/* Branch */}
        <div style={{
          width: 200,
          height: 14,
          background: 'linear-gradient(180deg, #8D6E63, #5D4037)',
          borderRadius: 7,
          boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
          marginTop: 4,
        }} />
      </div>

      {/* Word bubbles */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 16px 16px',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          alignContent: 'center',
          maxWidth: 660,
        }}>
          {activeCards.map(card => {
            const isWrong = card.state === 'wrong'
            const isFlying = card.state === 'flying'
            return (
              <button
                key={card.word}
                onClick={() => handleWordTap(card.word)}
                disabled={isFlying}
                style={{
                  padding: '12px 22px',
                  borderRadius: 40,
                  background: isWrong
                    ? '#F44336'
                    : isFlying
                      ? '#A5D6A7'
                      : 'rgba(255,255,255,0.92)',
                  color: isWrong ? '#fff' : '#1A237E',
                  fontSize: 20,
                  fontWeight: 'bold',
                  boxShadow: isWrong
                    ? '0 0 0 3px #B71C1C, 0 4px 14px rgba(0,0,0,0.25)'
                    : '0 4px 14px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.5)',
                  border: '2px solid rgba(255,255,255,0.7)',
                  cursor: isFlying ? 'default' : 'pointer',
                  animation: isWrong ? 'shake 0.4s ease' : 'none',
                  transition: isWrong ? 'background 0.1s' : 'transform 0.1s, box-shadow 0.1s',
                  transform: isFlying ? 'scale(0.9) translateY(-4px)' : 'scale(1)',
                  opacity: isFlying ? 0.6 : 1,
                }}
              >
                {card.word}
              </button>
            )
          })}
        </div>
      </div>

      {/* Level complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,100,200,0.55)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          gap: 20,
        }}>
          <div style={{ fontSize: 72 }}>🎉</div>
          <div style={{
            color: '#fff',
            fontSize: 48,
            fontWeight: 'bold',
            textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          }}>
            Amazing!
          </div>
          <div style={{ fontSize: 28, color: '#FFD700' }}>★★★</div>
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

      {/* Fail overlay */}
      {showFail && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(120,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          gap: 20,
        }}>
          <div style={{ fontSize: 64 }}>😢</div>
          <div style={{
            color: '#fff',
            fontSize: 40,
            fontWeight: 'bold',
            textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          }}>
            Try Again!
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => startLevel(level)}
              style={{
                padding: '12px 28px', borderRadius: 12, background: '#FF9800',
                color: '#fff', fontSize: 20, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
              }}
            >
              Retry
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
          20%  { transform: translateX(-8px); }
          40%  { transform: translateX(8px); }
          60%  { transform: translateX(-6px); }
          80%  { transform: translateX(6px); }
          100% { transform: translateX(0); }
        }
        @keyframes flyUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-90px) scale(0.6); }
        }
      `}</style>
    </div>
  )
}
