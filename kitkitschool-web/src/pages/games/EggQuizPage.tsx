import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EggQuizEngine } from '../../game/eggquiz/EggQuizEngine'
// Progress bar is rendered in-engine (drawProgressBar)
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

type Category = 'L' | 'M'

const LEVELS = Array.from({ length: 9 }, (_, i) => i + 1)

export default function EggQuizPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [showComplete, setShowComplete] = useState(false)

  // Parse category from URL params
  useEffect(() => {
    const cat = searchParams.get('category')
    if (cat === 'L' || cat === 'M') setCategory(cat)
    const lvl = searchParams.get('level')
    if (lvl) {
      setLevel(parseInt(lvl))
      if (!cat) setCategory('L')
    }
  }, [searchParams])

  const startLevel = useCallback((cat: Category, lvl: number) => {
    setCategory(cat)
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 1, max: 10 })
  }, [])

  // Engine lifecycle
  useEffect(() => {
    if (level === 0 || !category) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new EggQuizEngine(canvas, level, category)
    engine.onProgressChange = (current, max) => setProgress({ current, max })
    engine.onComplete = () => setShowComplete(true)
    engine.start()
    return () => engine.stop()
  }, [level, category])

  // Shell integration
  useEffect(() => {
    if (shellLevel && level === 0) {
      const cat = (searchParams.get('category') as Category) || 'L'
      startLevel(cat, shellLevel)
    }
  }, [shellLevel, level, startLevel, searchParams])

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  // ─── Category Selection ───
  if (!category) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 32,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 42, fontFamily: 'TodoMainCurly, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          Egg Quiz
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20 }}>Choose a category</p>
        <div style={{ display: 'flex', gap: 24 }}>
          <button onClick={() => setCategory('L')} style={{
            width: 220, height: 160, borderRadius: 24,
            background: 'linear-gradient(135deg, #43A047, #66BB6A)',
            color: '#fff', fontSize: 28, fontWeight: 'bold',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 48 }}>📖</span>
            Literacy
          </button>
          <button onClick={() => setCategory('M')} style={{
            width: 220, height: 160, borderRadius: 24,
            background: 'linear-gradient(135deg, #1E88E5, #42A5F5)',
            color: '#fff', fontSize: 28, fontWeight: 'bold',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 48 }}>🔢</span>
            Math
          </button>
        </div>
      </div>
    )
  }

  // ─── Level Selection ───
  if (level === 0) {
    const grad = category === 'L' ? ['#43A047', '#66BB6A'] : ['#1E88E5', '#42A5F5']
    const colors = category === 'L'
      ? ['#A5D6A7','#81C784','#66BB6A','#4CAF50','#43A047','#388E3C','#2E7D32','#1B5E20','#004D40']
      : ['#90CAF9','#64B5F6','#42A5F5','#2196F3','#1E88E5','#1976D2','#1565C0','#0D47A1','#01579B']

    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <BackButton color="#fff" onClick={() => setCategory(null)} />
        <h1 style={{ color: '#fff', fontSize: 36, fontFamily: 'TodoMainCurly, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          {category === 'L' ? 'Literacy' : 'Math'} - Select Level
        </h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600, padding: '0 20px' }}>
          {LEVELS.map(lvl => (
            <button key={lvl} onClick={() => startLevel(category, lvl)} style={{
              width: 90, height: 90, borderRadius: 18,
              background: colors[(lvl - 1) % colors.length],
              color: '#fff', fontSize: 28, fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              border: 'none', cursor: 'pointer',
            }}>
              {lvl}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ─── Game Screen ───
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%', touchAction: 'none',
      }} />
      <BackButton color="#333" onClick={isFromShell ? shellBack : () => setLevel(0)} />
      {/* Progress bar is drawn in-engine */}
      {showComplete && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 200, gap: 24,
        }}>
          <div style={{ color: '#fff', fontSize: 48, fontWeight: 'bold', fontFamily: 'TodoMainCurly, sans-serif', textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
            Quiz Complete!
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button onClick={() => startLevel(category, level)} style={{
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
