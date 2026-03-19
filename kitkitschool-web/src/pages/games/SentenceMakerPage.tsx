import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SentenceMakerEngine } from '../../game/sentencemaker/SentenceMakerEngine'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

export default function SentenceMakerPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SentenceMakerEngine | null>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [showComplete, setShowComplete] = useState(false)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])

  useEffect(() => {
    fetch('/data/games/sentencemaker.json')
      .then(r => r.json())
      .then(data => {
        const levels = data.levels.map((l: { level: number }) => l.level).sort((a: number, b: number) => a - b)
        setAvailableLevels(levels)
      })
      .catch(() => setAvailableLevels([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 1, max: 10 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new SentenceMakerEngine(canvas, level)
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
        background: 'linear-gradient(135deg, #ee9ca7, #ffdde1)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#333" />
        <h1 style={{ color: '#333', fontSize: 36, textShadow: '1px 1px 2px rgba(0,0,0,0.1)' }}>
          Sentence Maker
        </h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 }}>
          {availableLevels.map((lvl, i) => {
            const colors = ['#FF8A65','#FFB74D','#FFD54F','#AED581','#4DB6AC','#4FC3F7','#7986CB','#BA68C8','#F06292','#A1887F','#90A4AE','#CE93D8','#80CBC4','#FFAB91','#B39DDB']
            return (
              <button key={lvl} onClick={() => startLevel(lvl)} style={{
                width: 80, height: 80, borderRadius: 16,
                background: colors[i % colors.length],
                color: '#fff', fontSize: 24, fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
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
