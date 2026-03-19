import { useParams, useNavigate } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import { useCurriculum } from '../context/CurriculumContext'
import { resolveGameRoute, gameRouteMap } from '../data/gameRouteMap'
import { getBirdIdleSrc } from '../data/birdMap'
import { useState } from 'react'
import './MainScenePage.css'

/**
 * MainScenePage – Daily game session screen.
 * Matches C++ MainScene: sky background, clouds, grass, leaves, game icon row.
 */
export default function MainScenePage() {
  const { levelID, day: dayStr } = useParams<{ levelID: string; day: string }>()
  const navigate = useNavigate()
  const { getLevel, isGameCleared, checkAndSetDayCleared, loading } = useCurriculum()
  const [toast, setToast] = useState<string | null>(null)

  const day = dayStr ? parseInt(dayStr, 10) : 0

  if (loading) {
    return <div className="main-loading">Loading...</div>
  }

  const level = levelID ? getLevel(levelID) : undefined
  const dayCur = level?.days.find(d => d.day === day)
  if (!level || !dayCur || !levelID) {
    return (
      <div className="main-loading">
        <p>Day not found</p>
        <button onClick={() => navigate('/coop')}>Back to Courses</button>
      </div>
    )
  }

  const isL = level.category === 'L'

  // Panel title
  let panelImg = isL ? 'panel_english.png' : 'panel_math.png'
  if (level.categoryLevel === 0) panelImg = 'panel_prek.png'

  // Resolve game icon filename
  function getGameIconSrc(gameName: string): string {
    // Try the standard naming: game_icon_{lowercase}.png
    const lower = gameName.toLowerCase()
    return assetUrl(`/assets/icons/game_icon_${lower}.png`)
  }

  // Handle game click
  function handleGameClick(gameIndex: number) {
    const game = dayCur!.games[gameIndex]
    const route = resolveGameRoute(game.gameName, game.gameLevel, game.gameParam)

    if (route === null) {
      // Game not ported
      setToast(`"${game.gameName}" coming soon!`)
      setTimeout(() => setToast(null), 2000)
      return
    }

    // Navigate to game with shell return info
    const separator = route.includes('?') ? '&' : '?'
    const shellParams = `from=shell&levelID=${levelID}&day=${day}&gameIndex=${gameIndex}`

    // For games that already have level param, use as-is
    navigate(`${route}${separator}${shellParams}`)
  }

  return (
    <div className="main-root">
      {/* Sky background */}
      <div className="main-sky">
        <img
          src={assetUrl('/assets/mainscene/main_bg_sky.png')}
          alt=""
          className="main-sky-img"
          draggable={false}
        />

        {/* Animated clouds */}
        <img src={assetUrl('/assets/mainscene/cloud_day_1.png')} alt="" className="main-cloud main-cloud-1" draggable={false} />
        <img src={assetUrl('/assets/mainscene/cloud_day_2.png')} alt="" className="main-cloud main-cloud-2" draggable={false} />
        <img src={assetUrl('/assets/mainscene/cloud_day_3.png')} alt="" className="main-cloud main-cloud-3" draggable={false} />
      </div>

      {/* Grass ground */}
      <img
        src={assetUrl('/assets/mainscene/day_grass_ground.png')}
        alt=""
        className="main-grass"
        draggable={false}
      />

      {/* Leaves border */}
      <img
        src={assetUrl('/assets/mainscene/main_leaves_left.png')}
        alt=""
        className="main-leaves-left"
        draggable={false}
      />
      <img
        src={assetUrl('/assets/mainscene/main_leaves_right.png')}
        alt=""
        className="main-leaves-right"
        draggable={false}
      />

      {/* Back button – independent of panel */}
      <button className="main-back" onClick={() => navigate(`/coop/${levelID}`)}>
        ← Back
      </button>

      {/* Top panel – C++ panelNode 670×162 at ANCHOR_MIDDLE_TOP */}
      <div className="main-panel-bar">
        {/* Panel background */}
        <img
          src={assetUrl(`/assets/mainscene/${panelImg}`)}
          alt=""
          className="main-panel-img"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <span className="main-panel-label">{level.levelTitle}</span>

        {/* Day panel – positioned within panelNode at (626, 60) */}
        <div className="main-panel-day">
          <img
            src={assetUrl('/assets/mainscene/panel_day.png')}
            alt=""
            className="main-day-img"
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <span className="main-day-label">{day}</span>
        </div>
      </div>

      {/* Bird character – center (C++ birdPos = Vec2(designSize.width/2, 600)) */}
      <div className="main-bird">
        <img
          src={getBirdIdleSrc(level.category, level.categoryLevel)}
          alt="bird"
          className="main-bird-img"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <img
          src={assetUrl('/assets/mainscene/character_shadow.png')}
          alt=""
          className="main-bird-shadow"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>

      {/* Game icons row – bottom */}
      <div className="main-icons-row">
        {dayCur.games.map((game, idx) => {
          const cleared = isGameCleared(levelID, day, idx)
          const isEggQuiz = game.gameName.startsWith('EggQuiz')
          const hasRoute = gameRouteMap[game.gameName] !== undefined && gameRouteMap[game.gameName] !== null
          const isSpecial = game.gameName === 'Video' || game.gameName === 'Book' || game.gameName === 'BookWithQuiz'

          return (
            <div
              key={idx}
              className={`main-game-icon ${!hasRoute && !isSpecial ? 'main-game-icon--disabled' : ''}`}
              onClick={() => handleGameClick(idx)}
            >
              {/* Shadow */}
              <img
                src={assetUrl('/assets/icons/game_icon_frame_shadow.png')}
                alt=""
                className="main-icon-shadow"
                draggable={false}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />

              {/* Game icon */}
              <img
                src={getGameIconSrc(game.gameName)}
                alt={game.gameName}
                className="main-icon-img"
                draggable={false}
                onError={(e) => {
                  // Fallback: show the frame shadow as placeholder
                  e.currentTarget.src = assetUrl('/assets/icons/game_icon_frame_shadow.png')
                }}
              />

              {/* Frame */}
              <img
                src={isEggQuiz
                  ? assetUrl('/assets/icons/game_icon_frame_eggquiz.png')
                  : assetUrl('/assets/icons/game_icon_frame.png')
                }
                alt=""
                className="main-icon-frame"
                draggable={false}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />

              {/* Level badge (not for EggQuiz, Book, Comprehension) */}
              {!isEggQuiz && game.gameName !== 'Book' && game.gameName !== 'Comprehension' && !cleared && (
                <div className="main-icon-level-badge">
                  <img
                    src={assetUrl('/assets/icons/game_level_circle.png')}
                    alt=""
                    className="main-level-circle"
                    draggable={false}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  <span className="main-level-number">{game.gameLevel}</span>
                </div>
              )}

              {/* Completed checkmark */}
              {cleared && (
                <img
                  src={assetUrl('/assets/icons/game_icon_frame_completed.png')}
                  alt="✓"
                  className="main-icon-completed"
                  draggable={false}
                  onError={(e) => {
                    // Fallback: show a simple checkmark
                    e.currentTarget.style.display = 'none'
                    const parent = e.currentTarget.parentElement
                    if (parent) {
                      const check = document.createElement('div')
                      check.className = 'main-icon-check-fallback'
                      check.textContent = '✓'
                      parent.appendChild(check)
                    }
                  }}
                />
              )}

              {/* Game name (fallback label) */}
              {!hasRoute && !isSpecial && (
                <span className="main-icon-name">{game.gameName}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Debug: Clear all games button */}
      <button
        className="main-debug-clear"
        onClick={() => {
          for (let i = 0; i < dayCur.games.length; i++) {
            // Simulate clearing via context
          }
          checkAndSetDayCleared(levelID, day)
        }}
        style={{ display: 'none' }}
      >
        Debug: Clear All
      </button>

      {/* Toast notification */}
      {toast && (
        <div className="main-toast">{toast}</div>
      )}
    </div>
  )
}
