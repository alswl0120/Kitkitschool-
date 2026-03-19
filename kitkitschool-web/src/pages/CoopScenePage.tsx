import { useNavigate } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import { useCurriculum } from '../context/CurriculumContext'
import { getBirdIdleSrc, getEggSrc } from '../data/birdMap'
import {
  COOP_DESIGN, NEST_WIDTH_PCT, PANEL_WIDTH_PCT,
  birdTransform, birdSizePct, EGG_WIDTH_PCT, EGG_HEIGHT_PCT,
} from '../data/coopLayout'
import './CoopScenePage.css'

/**
 * CoopScene – Egg course selection screen.
 *
 * C++ layout (2560×1800 design, Cocos Y=0 at bottom):
 *   gridX = L ? 1-(lv%2) : 2+(lv%2)
 *   gridY = 2-(lv/2)  (integer division)
 *   panelPos = Vec2(2560/8*(1+2*gridX), 545*gridY)
 *
 *   Panel:  ANCHOR_MIDDLE_BOTTOM  at panelPos
 *   Nest:   ANCHOR_MIDDLE_BOTTOM  at panelPos + (0, 20)
 *   Bird:   per-type anchor       at panelPos + (0, 120)
 *
 * CSS conversion:
 *   left  = posX / 2560 * 100%
 *   bottom = posY / 1800 * 100%
 *   transform = translate(-anchorX*100%, anchorY*100%)
 */
export default function CoopScenePage() {
  const navigate = useNavigate()
  const { getLevels, isLevelOpen, ratioDayCleared, loading } = useCurriculum()

  if (loading) {
    return <div className="coop-loading">Loading...</div>
  }

  const levels = getLevels('en-US')

  return (
    <div className="coop-root">
      <div className="coop-container">
        <img src={assetUrl('/assets/coopscene/coop_bg.jpg')} alt="" className="coop-bg" draggable={false} />

        <button className="coop-back" onClick={() => navigate('/')}>
          ← Back
        </button>

        {levels.map(level => {
          if (level.numDays === 0) return null

          const lv = level.categoryLevel
          const isL = level.category === 'L'
          const gridX = isL ? 1 - (lv % 2) : 2 + (lv % 2)
          const gridY = 2 - Math.floor(lv / 2)

          // C++ pixel coords (2560×1800, Y from bottom)
          const cx = COOP_DESIGN.width / 8 * (1 + 2 * gridX)
          const cy = 545 * gridY

          // CSS percentages (position)
          const leftPct  = (cx / COOP_DESIGN.width) * 100
          // Add 3% bottom padding so the bottom row is never flush with the screen edge.
          const Y_PAD = 3
          const toBot = (pyRaw: number) => Y_PAD + (pyRaw / COOP_DESIGN.height) * 100
          const panelBotPct = toBot(cy)
          const nestBotPct  = toBot(cy + 20)
          const birdBotPct  = toBot(cy + 120)

          const open = isLevelOpen(level.levelID)
          const ratio = ratioDayCleared(level.levelID)

          let panelImg = isL ? 'coop_woodpanel_english.png' : 'coop_woodpanel_math.png'
          if (lv === 0) panelImg = 'coop_woodpanel_prek.png'
          const nestImg = isL ? 'coop_english_nest.png' : 'coop_math_nest.png'

          // Per-bird sizing and anchor
          const birdSize = birdSizePct(level.category, lv)
          const birdXform = birdTransform(level.category, lv)

          return (
            <div
              key={level.levelID}
              className={`coop-slot ${open ? 'coop-slot--open' : 'coop-slot--locked'}`}
              onClick={() => { if (open) navigate(`/coop/${level.levelID}`) }}
            >
              {/* Bird or Egg at panelPos+(0,120) */}
              {open ? (
                <img
                  src={getBirdIdleSrc(level.category, lv)}
                  alt={level.levelTitle}
                  className="coop-bird-img"
                  style={{
                    left: `${leftPct}%`,
                    bottom: `${birdBotPct}%`,
                    width: `${birdSize.widthPct * 0.8}%`,
                    transform: birdXform,
                  }}
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <img
                  src={getEggSrc(level.category, lv)}
                  alt="egg"
                  className="coop-egg"
                  style={{
                    left: `${leftPct}%`,
                    bottom: `${birdBotPct}%`,
                    width: `${EGG_WIDTH_PCT * 0.8}%`,
                    transform: 'translate(-50%, 5%)',
                  }}
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              )}

              {/* Progress ring (shown on open birds with progress) */}
              {open && ratio > 0 && (
                <div
                  className="coop-progress-ring"
                  style={{
                    left: `${leftPct}%`,
                    bottom: `${birdBotPct}%`,
                    width: `${Math.max(birdSize.widthPct * 0.8, 4)}%`,
                    height: `${Math.max(birdSize.heightPct * 0.8, 5)}%`,
                  }}
                >
                  <svg viewBox="0 0 36 36" className="coop-ring-svg">
                    <path className="coop-ring-bg"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="coop-ring-fill"
                      strokeDasharray={`${ratio * 100}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                </div>
              )}

              {/* Nest – ANCHOR_MIDDLE_BOTTOM at panelPos+(0,20) */}
              <img
                src={assetUrl(`/assets/coopscene/${nestImg}`)}
                alt=""
                className="coop-nest"
                style={{
                  left: `${leftPct}%`,
                  bottom: `${nestBotPct}%`,
                  width: `${NEST_WIDTH_PCT}%`,
                }}
                draggable={false}
              />

              {/* Wood panel – ANCHOR_MIDDLE_BOTTOM at panelPos */}
              <div
                className="coop-panel-wrap"
                style={{
                  left: `${leftPct}%`,
                  bottom: `${panelBotPct}%`,
                  width: `${PANEL_WIDTH_PCT}%`,
                }}
              >
                <img
                  src={assetUrl(`/assets/coopscene/${panelImg}`)}
                  alt=""
                  className="coop-panel-img"
                  draggable={false}
                />
                <span className="coop-panel-label">{level.levelTitle}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
