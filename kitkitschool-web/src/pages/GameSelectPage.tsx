import { useNavigate } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'

interface GameItem {
  name: string
  path: string
  icon: string
  color: string
}

const GAMES: GameItem[] = [
  { name: 'Tapping', path: '/game/tapping', icon: '👆', color: '#4CAF50' },
  { name: 'Letter Trace', path: '/game/lettertrace', icon: '✏️', color: '#FF7043' },
  { name: 'Number Trace', path: '/game/numbertrace', icon: '🔢', color: '#AB47BC' },
  { name: 'Word Trace', path: '/game/wordtrace', icon: '📝', color: '#5C6BC0' },
  { name: 'Tutorial Trace', path: '/game/tutorialtrace', icon: '🎓', color: '#78909C' },
  { name: 'Letter Matching', path: '/game/lettermatching', icon: '🔤', color: '#29B6F6' },
  { name: 'Number Matching', path: '/game/numbermatching', icon: '🔢', color: '#26A69A' },
  { name: 'Find The Match', path: '/game/findthematch', icon: '🃏', color: '#EF5350' },
  { name: 'Spelling', path: '/game/spelling', icon: '📖', color: '#66BB6A' },
  { name: 'Old Spelling', path: '/game/oldspelling', icon: '📜', color: '#8D6E63' },
  { name: 'Counting', path: '/game/counting', icon: '🧮', color: '#FFA726' },
  { name: 'Star Fall', path: '/game/starfall', icon: '⭐', color: '#FFEE58' },
  { name: 'Moving Insects', path: '/game/movinginsects', icon: '🐛', color: '#9CCC65' },
  { name: 'Fish Tank', path: '/game/fishtank', icon: '🐟', color: '#42A5F5' },
  { name: 'Egg Quiz', path: '/game/eggquiz', icon: '🥚', color: '#FFCC80' },
  { name: 'Double Digit', path: '/game/doubledigit', icon: '➕', color: '#7E57C2' },
  { name: 'Equation Maker', path: '/game/equationmaker', icon: '🧪', color: '#EC407A' },
  { name: 'Hundred Puzzle', path: '/game/hundredpuzzle', icon: '💯', color: '#26C6DA' },
  { name: 'Animal Puzzle', path: '/game/animalpuzzle', icon: '🦁', color: '#FFA000' },
  { name: 'Wooden Puzzles', path: '/game/woodenpuzzles', icon: '🧩', color: '#A1887F' },
  { name: 'Word Machine', path: '/game/wordmachine', icon: '⚙️', color: '#78909C' },
  { name: 'Sentence Maker', path: '/game/sentencemaker', icon: '📃', color: '#4DB6AC' },
  { name: 'Comprehension', path: '/game/comprehensiontest', icon: '📚', color: '#7986CB' },
  { name: 'Digital Quiz', path: '/game/digitalquiz', icon: '💻', color: '#4DD0E1' },
  { name: 'Missing Number', path: '/game/missingnumber', icon: '🔢', color: '#81D4FA' },
  { name: 'Alphabet Puzzle', path: '/game/alphabetpuzzle', icon: '🔠', color: '#8D6E63' },
  { name: 'Number Puzzle', path: '/game/numberpuzzle', icon: '🔢', color: '#5C6BC0' },
  { name: 'Comp Matching', path: '/game/compmatching', icon: '🔗', color: '#7986CB' },
  { name: 'Line Matching', path: '/game/linematching', icon: '📐', color: '#FF8A65' },
  { name: 'What Is This?', path: '/game/whatisthis', icon: '❓', color: '#42A5F5' },
  { name: 'Sentence Bridge', path: '/game/sentencebridge', icon: '🌉', color: '#4DB6AC' },
  { name: 'Pattern Train', path: '/game/patterntrain', icon: '🚂', color: '#FF8A65' },
]

export default function GameSelectPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#2B2E33',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top Bar */}
      <div style={{
        height: 56,
        backgroundImage: `url(${assetUrl('/assets/launcher/launcher_topbar.png')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        position: 'relative',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        paddingLeft: 16,
      }}>
        {/* Back button */}
        <div
          onClick={() => navigate('/')}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            borderRadius: 8,
          }}
        >
          <span style={{
            color: '#878787',
            fontSize: 24,
          }}>
            ◀
          </span>
        </div>
        <span style={{
          color: '#878787',
          fontSize: 28,
          fontFamily: 'TodoMainCurly, sans-serif',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}>
          Choose a Game
        </span>
      </div>

      {/* Game Grid */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px 24px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 16,
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          {GAMES.map((game) => (
            <div
              key={game.path}
              onClick={() => navigate(game.path)}
              style={{
                cursor: 'pointer',
                background: game.color,
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                aspectRatio: '1',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)'
              }}
            >
              {/* Semi-transparent overlay for depth */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.1) 100%)',
                borderRadius: 16,
              }} />
              <span style={{ fontSize: 40, position: 'relative', zIndex: 1 }}>
                {game.icon}
              </span>
              <span style={{
                color: '#fff',
                fontSize: 14,
                fontFamily: 'TodoMainCurly, sans-serif',
                marginTop: 8,
                textAlign: 'center',
                padding: '0 8px',
                position: 'relative',
                zIndex: 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}>
                {game.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
