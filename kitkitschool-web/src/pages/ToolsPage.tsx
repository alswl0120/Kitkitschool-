import { useNavigate } from 'react-router-dom'
import { useCurriculum } from '../context/CurriculumContext'
import { getBirdIdleSrc } from '../data/birdMap'
import { assetUrl } from '../utils/assetPath'
import { SHOP_THEMES } from '../data/shopThemes'
import './ToolsPage.css'

export default function ToolsPage() {
  const navigate = useNavigate()
  const {
    getLevels, totalStars, numDayCleared, ratioDayCleared,
    data, resetProgress, loading, equippedTheme,
  } = useCurriculum()

  const theme = SHOP_THEMES.find(t => t.id === equippedTheme) ?? SHOP_THEMES[0]

  if (loading) {
    return <div className="tools-loading">Loading...</div>
  }

  const levels = getLevels('en-US').filter(l => l.categoryLevel <= 4)
  const literacy = levels.filter(l => l.category === 'L').sort((a, b) => a.categoryLevel - b.categoryLevel)
  const math    = levels.filter(l => l.category === 'M').sort((a, b) => a.categoryLevel - b.categoryLevel)

  // Global stats
  const totalDays  = data?.levels.reduce((s, l) => s + l.numDays, 0) ?? 0
  const clearedDays = levels.reduce((s, l) => s + numDayCleared(l.levelID), 0)
  const totalGames  = data?.levels.reduce((s, l) => s + l.days.reduce((d, day) => d + day.numGames, 0), 0) ?? 0
  const overallPct  = totalDays > 0 ? Math.round((clearedDays / totalDays) * 100) : 0

  return (
    <div
      className="tools-root"
      style={{
        '--theme-bg1': theme.bg1,
        '--theme-bg2': theme.bg2,
        '--theme-accent': theme.accent,
        '--theme-bar': theme.bar,
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="tools-header">
        <button className="tools-back" onClick={() => navigate('/tools')}>← Back</button>
        <span className="tools-title">My Progress</span>
        <div className="tools-star-badge">
          <span>⭐</span>
          <span className="tools-star-num">{totalStars}</span>
        </div>
      </div>

      <div className="tools-body">
        {/* Summary cards */}
        <div className="tools-summary">
          <div className="tools-card tools-card--overall">
            <div className="tools-card-value">{overallPct}%</div>
            <div className="tools-card-label">Overall</div>
            <div className="tools-overall-bar">
              <div className="tools-overall-fill" style={{ width: `${overallPct}%` }} />
            </div>
          </div>
          <div className="tools-card">
            <div className="tools-card-value">{clearedDays}</div>
            <div className="tools-card-label">Days Done</div>
            <div className="tools-card-sub">of {totalDays}</div>
          </div>
          <div className="tools-card">
            <div className="tools-card-value">{totalStars}</div>
            <div className="tools-card-label">Stars</div>
            <div className="tools-card-sub">collected</div>
          </div>
          <div className="tools-card">
            <div className="tools-card-value">{totalGames}</div>
            <div className="tools-card-label">Games</div>
            <div className="tools-card-sub">total</div>
          </div>
        </div>

        {/* Level breakdown */}
        <div className="tools-sections">
          <LevelSection title="📖 English" levels={literacy} numDayCleared={numDayCleared} ratioDayCleared={ratioDayCleared} />
          <LevelSection title="🔢 Math"    levels={math}     numDayCleared={numDayCleared} ratioDayCleared={ratioDayCleared} />
        </div>

        {/* Reset button */}
        <div className="tools-footer">
          <button
            className="tools-reset-btn"
            onClick={() => {
              if (window.confirm('Reset all progress? Stars will also be cleared.')) {
                resetProgress()
              }
            }}
          >
            🔄 Reset Progress
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-component ──────────────────────────────────────────────────────────

interface LevelSectionProps {
  title: string
  levels: ReturnType<ReturnType<typeof useCurriculum>['getLevels']>
  numDayCleared: (id: string) => number
  ratioDayCleared: (id: string) => number
}

function LevelSection({ title, levels, numDayCleared, ratioDayCleared }: LevelSectionProps) {
  if (levels.length === 0) return null
  return (
    <div className="tools-section">
      <div className="tools-section-title">{title}</div>
      <div className="tools-level-list">
        {levels.map(level => {
          const ratio   = ratioDayCleared(level.levelID)
          const cleared = numDayCleared(level.levelID)
          const pct     = Math.round(ratio * 100)
          const done    = pct === 100

          return (
            <div key={level.levelID} className={`tools-level-row ${done ? 'tools-level-row--done' : ''}`}>
              {/* Bird icon */}
              <img
                src={getBirdIdleSrc(level.category, level.categoryLevel)}
                alt=""
                className="tools-level-bird"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />

              {/* Name + bar */}
              <div className="tools-level-info">
                <div className="tools-level-name">
                  {level.levelTitle}
                  {done && <span className="tools-done-badge">✓</span>}
                </div>
                <div className="tools-bar-track">
                  <div
                    className={`tools-bar-fill ${done ? 'tools-bar-fill--done' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Day count */}
              <div className="tools-level-stat">
                <span className="tools-level-pct">{pct}%</span>
                <span className="tools-level-days">{cleared}/{level.numDays} days</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
