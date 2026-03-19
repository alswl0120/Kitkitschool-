import { useNavigate } from 'react-router-dom'
import { useCurriculum } from '../context/CurriculumContext'
import { SHOP_THEMES } from '../data/shopThemes'
import './ShopPage.css'

export default function ShopPage() {
  const navigate = useNavigate()
  const { totalStars, unlockedThemes, equippedTheme, purchaseTheme, equipTheme } = useCurriculum()

  function handleThemeClick(themeId: string, cost: number) {
    const owned = unlockedThemes.includes(themeId)
    if (owned) {
      equipTheme(themeId)
    } else {
      if (totalStars < cost) return
      purchaseTheme(themeId, cost)
    }
  }

  return (
    <div className="shop-root">
      {/* Header */}
      <div className="shop-header">
        <button className="shop-back" onClick={() => navigate('/tools')}>← Back</button>
        <span className="shop-title">⭐ Star Shop</span>
        <div className="shop-star-badge">
          <span>⭐</span>
          <span className="shop-star-num">{totalStars}</span>
        </div>
      </div>

      <div className="shop-body">
        <p className="shop-desc">Spend your stars to unlock new color themes for the dashboard!</p>

        <div className="shop-grid">
          {SHOP_THEMES.map(theme => {
            const owned = unlockedThemes.includes(theme.id)
            const equipped = equippedTheme === theme.id
            const canAfford = totalStars >= theme.cost

            return (
              <div
                key={theme.id}
                className={`shop-card ${equipped ? 'shop-card--equipped' : ''} ${!owned && !canAfford ? 'shop-card--locked' : ''}`}
                onClick={() => handleThemeClick(theme.id, theme.cost)}
              >
                {/* Color preview */}
                <div className="shop-preview" style={{ background: theme.bg1 }}>
                  <div className="shop-preview-bar" style={{ background: theme.bg2 }} />
                  <div className="shop-preview-card" style={{ background: theme.bg2 }}>
                    <div className="shop-preview-fill" style={{ background: theme.bar }} />
                  </div>
                  <div className="shop-preview-dot" style={{ background: theme.accent }} />
                </div>

                {/* Info */}
                <div className="shop-card-info">
                  <span className="shop-card-emoji">{theme.emoji}</span>
                  <span className="shop-card-name">{theme.name}</span>
                </div>

                {/* Action */}
                <div className="shop-card-action">
                  {equipped ? (
                    <span className="shop-btn shop-btn--equipped">✓ Equipped</span>
                  ) : owned ? (
                    <span className="shop-btn shop-btn--owned">Equip</span>
                  ) : (
                    <span className={`shop-btn shop-btn--buy ${!canAfford ? 'shop-btn--disabled' : ''}`}>
                      ⭐ {theme.cost}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
