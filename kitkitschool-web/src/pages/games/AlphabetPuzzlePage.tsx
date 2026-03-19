import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { WoodPieceEngine } from '../../game/woodpiece/WoodPieceEngine'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

const LEVELS = [1, 2] // 1=Capital, 2=Lowercase

export default function AlphabetPuzzlePage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [showComplete, setShowComplete] = useState(false)

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 0, max: 26 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new WoodPieceEngine(canvas, 'alphabetpuzzle', level)
    engine.onProgressChange = (current, max) => setProgress({ current, max })
    engine.onComplete = () => setShowComplete(true)
    engine.start()
    return () => engine.stop()
  }, [level])

  useEffect(() => {
    if (shellLevel && level === 0) startLevel(shellLevel)
  }, [shellLevel, level, startLevel])

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #8D6E63, #5D4037)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 36, textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>
          Alphabet Puzzle
        </h1>
        <div style={{ display: 'flex', gap: 16 }}>
          {LEVELS.map(lvl => (
            <button key={lvl} onClick={() => startLevel(lvl)} style={{
              width: 220, height: 120, borderRadius: 20,
              background: lvl === 1 ? '#FF7043' : '#26A69A',
              color: '#fff', fontSize: 24, fontWeight: 'bold',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
              border: 'none', cursor: 'pointer',
            }}>
              {lvl === 1 ? 'A B C (Capital)' : 'a b c (Lowercase)'}
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
      <BackButton color="#fff" onClick={isFromShell ? shellBack : () => setLevel(0)} />
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
              border: 'none', cursor: 'pointer',
            }}>Play Again</button>
            <button onClick={() => setLevel(0)} style={{
              padding: '12px 32px', borderRadius: 12, background: '#2196F3',
              color: '#fff', fontSize: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: 'none', cursor: 'pointer',
            }}>Other Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')} style={{
              padding: '12px 32px', borderRadius: 12, background: '#FF5722',
              color: '#fff', fontSize: 20, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: 'none', cursor: 'pointer',
            }}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
