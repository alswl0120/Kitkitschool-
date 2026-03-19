import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FishTankEngine } from '../../game/fishtank/FishTankEngine'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

const BUTTON_COLORS = ['#FF6B6B','#4ECDC4','#FFD93D','#6BCB77','#4D96FF','#FF8E53','#C084FC','#F472B6','#38BDF8','#34D399']

export default function FishTankPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<FishTankEngine | null>(null)
  const [level, setLevel] = useState(0)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => {
    fetch('/data/games/fishtank.json')
      .then(r => r.json())
      .then(data => {
        const lvls = data.levels.map((l: { level: number }) => l.level).sort((a: number, b: number) => a - b)
        setAvailableLevels(lvls)
      })
      .catch(() => setAvailableLevels([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 1, max: 5 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new FishTankEngine(canvas, level)
    engineRef.current = engine

    engine.onProgressChange = (current, max) => setProgress({ current, max })
    engine.onComplete = () => setShowComplete(true)
    engine.start()
    return () => engine.stop()
  }, [level])

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

  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #0093E9, #80D0C7)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          Fish Tank
        </h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {availableLevels.map((lvl, idx) => (
            <button key={lvl} onClick={() => startLevel(lvl)} style={{
              width: 80, height: 80, borderRadius: 16,
              background: BUTTON_COLORS[idx % BUTTON_COLORS.length],
              color: '#fff', fontSize: 24, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}>
              {lvl}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%', touchAction: 'none',
      }} />
      <BackButton color="#333" onClick={isFromShell ? shellBack : undefined} />
      <ProgressBar current={progress.current} max={progress.max} />
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 200, gap: 24,
        }}>
          <div style={{ color: '#fff', fontSize: 48, fontWeight: 'bold', textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
            Great Job!
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button onClick={() => startLevel(level)} style={{
              padding: '12px 32px', borderRadius: 12, background: '#4CAF50',
              color: '#fff', fontSize: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>Play Again</button>
            <button onClick={() => setLevel(0)} style={{
              padding: '12px 32px', borderRadius: 12, background: '#2196F3',
              color: '#fff', fontSize: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>Other Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '12px 32px', borderRadius: 12, background: '#FF5722',
              color: '#fff', fontSize: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
