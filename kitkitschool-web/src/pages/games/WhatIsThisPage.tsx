import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { WhatIsThisEngine } from '../../game/whatisthis/WhatIsThisEngine'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

export default function WhatIsThisPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<WhatIsThisEngine | null>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [showComplete, setShowComplete] = useState(false)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])

  // Discover available levels from TSV
  useEffect(() => {
    fetch('/data/games/whatisthis/whatisthis.tsv')
      .then(r => r.text())
      .then(text => {
        const levels = new Set<number>()
        const lines = text.split('\n')
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split('\t')
          if (cols.length > 1) {
            const lv = parseInt(cols[1])
            if (!isNaN(lv)) levels.add(lv)
          }
        }
        setAvailableLevels(Array.from(levels).sort((a, b) => a - b))
      })
      .catch(() => {
        setAvailableLevels(Array.from({ length: 19 }, (_, i) => i + 1))
      })
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 0, max: 1 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new WhatIsThisEngine(canvas, level)
    engineRef.current = engine

    engine.onProgressChange = (current, max) => setProgress({ current, max })
    engine.onComplete = () => setShowComplete(true)

    engine.loadData().then(() => {
      engine.start()
      engine.startGame()
    })

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
        background: 'linear-gradient(135deg, #87CEEB, #4A90D9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          What Is This?
        </h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600, padding: '0 20px' }}>
          {availableLevels.map((lvl, i) => {
            const colors = ['#4CAF50','#2196F3','#FF9800','#9C27B0','#E91E63','#00BCD4','#795548','#607D8B','#FF5722','#3F51B5']
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
