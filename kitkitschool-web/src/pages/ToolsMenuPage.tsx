import { useNavigate } from 'react-router-dom'
import { useCurriculum } from '../context/CurriculumContext'
import './ToolsMenuPage.css'

const MENU_ITEMS = [
  {
    path: '/tools/dashboard',
    emoji: '📊',
    title: 'My Progress',
    desc: 'Track your learning progress across all levels',
    color: '#2a3a6a',
    accent: '#4facfe',
  },
  {
    path: '/tools/mybird',
    emoji: '🐦',
    title: 'My Bird & Home',
    desc: 'Customize your bird and decorate your coop!',
    color: '#1a3a1a',
    accent: '#69f0ae',
  },
  {
    path: '/tools/coloring',
    emoji: '🎨',
    title: 'Drawing & Coloring',
    desc: 'Free draw or color in fun pictures!',
    color: '#1a1a3a',
    accent: '#c084fc',
  },
  {
    path: '/tools/abc',
    emoji: '🔤',
    title: 'ABC & 123',
    desc: 'Alphabet and number reference — tap to hear!',
    color: '#2a1a1a',
    accent: '#fbbf24',
  },
]

export default function ToolsMenuPage() {
  const navigate = useNavigate()
  const { totalStars } = useCurriculum()

  return (
    <div className="tmenu-root">
      {/* Header */}
      <div className="tmenu-header">
        <button className="tmenu-back" onClick={() => navigate('/')}>← Back</button>
        <span className="tmenu-title">Tools</span>
        <div className="tmenu-star-badge">
          <span>⭐</span>
          <span className="tmenu-star-num">{totalStars}</span>
        </div>
      </div>

      {/* Menu cards */}
      <div className="tmenu-body">
        <div className="tmenu-grid">
          {MENU_ITEMS.map(item => (
            <div
              key={item.path}
              className="tmenu-card"
              style={{ '--card-bg': item.color, '--card-accent': item.accent } as React.CSSProperties}
              onClick={() => navigate(item.path)}
            >
              <div className="tmenu-card-emoji">{item.emoji}</div>
              <div className="tmenu-card-title">{item.title}</div>
              <div className="tmenu-card-desc">{item.desc}</div>
              <div className="tmenu-card-arrow">→</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
