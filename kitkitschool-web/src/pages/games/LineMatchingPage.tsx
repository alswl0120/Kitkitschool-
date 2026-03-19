import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineMatchingEngine } from '../../game/linematching/LineMatchingEngine'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

const AVAILABLE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export default function LineMatchingPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<LineMatchingEngine | null>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [showComplete, setShowComplete] = useState(false)

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 1, max: 8 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new LineMatchingEngine(canvas, level)
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
        background: 'linear-gradient(135deg, #FF8A65, #FF5722)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          Line Matching
        </h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 500 }}>
          {AVAILABLE_LEVELS.map((lvl, i) => {
            const colors = ['#FF7043','#EF5350','#AB47BC','#7E57C2','#5C6BC0','#42A5F5',
                           '#26C6DA','#26A69A','#66BB6A','#9CCC65','#FFA726','#8D6E63']
            return (
              <button key={lvl} onClick={() => startLevel(lvl)} style={{
                width: 70, height: 70, borderRadius: 14,
                background: colors[i % colors.length],
                color: '#fff', fontSize: 22, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                border: 'none', cursor: 'pointer',
              }}>
                {lvl}
              </button>
            )
          })}
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
      <BackButton color="#fff" onClick={isFromShell ? shellBack : undefined} />
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
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Play Again</button>
            <button onClick={() => setLevel(0)} style={{
              padding: '12px 32px', borderRadius: 12, background: '#2196F3',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Other Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '12px 32px', borderRadius: 12, background: '#FF5722',
              color: '#fff', fontSize: 20, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
            }}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
