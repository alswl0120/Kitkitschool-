import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TappingEngine } from '../game/TappingEngine'
import ProgressBar from '../components/ProgressBar'
import BackButton from '../components/BackButton'
import { useShellParams } from '../hooks/useShellParams'

export default function TappingGame() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<TappingEngine | null>(null)
  const [level, setLevel] = useState(0) // 0 = level select
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [showComplete, setShowComplete] = useState(false)

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 1, max: lvl === 3 ? 0 : lvl === 1 ? 3 : 10 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new TappingEngine(canvas, level)
    engineRef.current = engine

    engine.onProgressChange = (current, max) => {
      setProgress({ current, max })
    }

    engine.onComplete = () => {
      setShowComplete(true)
    }

    engine.start()

    return () => {
      engine.stop()
    }
  }, [level])

  // Shell auto-start
  useEffect(() => {
    if (shellLevel && level === 0) startLevel(shellLevel)
  }, [shellLevel, level, startLevel])

  // Shell complete
  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // Level select screen
  if (level === 0) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #4FC3F7, #81D4FA)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}>
        <BackButton color="#333" onClick={isFromShell ? shellBack : undefined} />
        <h1 style={{ color: '#fff', fontSize: 42, textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
          Tapping Game
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 18, marginBottom: 10 }}>
          Choose a level
        </p>
        <div style={{ display: 'flex', gap: 24 }}>
          {[1, 2, 3].map(lvl => (
            <button
              key={lvl}
              onClick={() => startLevel(lvl)}
              style={{
                width: 140,
                height: 140,
                borderRadius: 20,
                background: lvl === 1 ? '#4CAF50' : lvl === 2 ? '#FF9800' : '#E91E63',
                color: '#fff',
                fontSize: 28,
                fontWeight: 'bold',
                boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 40 }}>
                {lvl === 1 ? '🎈' : lvl === 2 ? '🎈🎈' : '🫧'}
              </span>
              <span>Level {lvl}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
      />

      {/* UI Overlay */}
      <BackButton color="#333" onClick={isFromShell ? shellBack : undefined} />

      {progress.max > 0 && (
        <ProgressBar current={progress.current} max={progress.max} />
      )}

      {/* Complete overlay */}
      {showComplete && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          gap: 24,
        }}>
          <div style={{
            color: '#fff',
            fontSize: 48,
            fontWeight: 'bold',
            textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
          }}>
            Great Job! 🎉
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button
              onClick={() => startLevel(level)}
              style={{
                padding: '12px 32px',
                borderRadius: 12,
                background: '#4CAF50',
                color: '#fff',
                fontSize: 20,
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              Play Again
            </button>
            <button
              onClick={() => setLevel(0)}
              style={{
                padding: '12px 32px',
                borderRadius: 12,
                background: '#2196F3',
                color: '#fff',
                fontSize: 20,
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              Other Levels
            </button>
            <button
              onClick={() => isFromShell ? shellBack() : navigate('/')}
              style={{
                padding: '12px 32px',
                borderRadius: 12,
                background: '#FF5722',
                color: '#fff',
                fontSize: 20,
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
