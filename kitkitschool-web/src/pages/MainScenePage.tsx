import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import { useCurriculum } from '../context/CurriculumContext'
import { resolveGameRoute, gameRouteMap } from '../data/gameRouteMap'
import { getBirdIdleSrc } from '../data/birdMap'
import { useState, useEffect, useCallback, useRef } from 'react'
import GameCompletePopup from '../components/GameCompletePopup'
import DayCompletePopup from '../components/DayCompletePopup'
import './MainScenePage.css'

const STARS_PER_GAME = 1
const BONUS_STARS_PER_DAY = 3

export default function MainScenePage() {
  const { levelID, day: dayStr } = useParams<{ levelID: string; day: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    getLevel, isGameCleared, setGameCleared, checkAndSetDayCleared,
    totalStars, addStars, loading,
  } = useCurriculum()

  const [toast, setToast] = useState<string | null>(null)
  const [showGamePopup, setShowGamePopup] = useState(false)
  const [showDayPopup, setShowDayPopup] = useState(false)
  const [pendingGameIndex, setPendingGameIndex] = useState<number | null>(null)
  const rewardProcessedRef = useRef(false)

  const day = dayStr ? parseInt(dayStr, 10) : 0

  // Detect return from game with justCleared param
  useEffect(() => {
    if (rewardProcessedRef.current) return  // StrictMode double-fire guard
    const justCleared = searchParams.get('justCleared')
    if (justCleared === null) return

    const idx = parseInt(justCleared, 10)
    if (isNaN(idx) || !levelID || day === 0) return

    rewardProcessedRef.current = true

    // Mark cleared & add stars only if not already cleared
    if (!isGameCleared(levelID, day, idx)) {
      setGameCleared(levelID, day, idx)
      addStars(STARS_PER_GAME)
    }

    setPendingGameIndex(idx)
    setShowGamePopup(true)

    // Clean URL immediately
    setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount

  const handleGamePopupClose = useCallback(() => {
    setShowGamePopup(false)
    if (levelID && day > 0) {
      const dayCleared = checkAndSetDayCleared(levelID, day)
      if (dayCleared) {
        addStars(BONUS_STARS_PER_DAY)
        setShowDayPopup(true)
      }
    }
    setPendingGameIndex(null)
  }, [levelID, day, checkAndSetDayCleared, addStars])

  const handleDayPopupClose = useCallback(() => {
    setShowDayPopup(false)
  }, [])

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

  let panelImg = isL ? 'panel_english.png' : 'panel_math.png'
  if (level.categoryLevel === 0) panelImg = 'panel_prek.png'

  function getGameIconSrc(gameName: string): string {
    return assetUrl(`/assets/icons/game_icon_${gameName.toLowerCase()}.png`)
  }

  function handleGameClick(gameIndex: number) {
    const game = dayCur!.games[gameIndex]
    const route = resolveGameRoute(game.gameName, game.gameLevel, game.gameParam)

    if (route === null) {
      setToast(`"${game.gameName}" coming soon!`)
      setTimeout(() => setToast(null), 2000)
      return
    }

    const separator = route.includes('?') ? '&' : '?'
    const shellParams = `from=shell&levelID=${levelID}&day=${day}&gameIndex=${gameIndex}`
    navigate(`${route}${separator}${shellParams}`)
  }

  return (
    <div className="main-root">
      {/* Sky background */}
      <div className="main-sky">
        <img src={assetUrl('/assets/mainscene/main_bg_sky.png')} alt="" className="main-sky-img" draggable={false} />
        <img src={assetUrl('/assets/mainscene/cloud_day_1.png')} alt="" className="main-cloud main-cloud-1" draggable={false} />
        <img src={assetUrl('/assets/mainscene/cloud_day_2.png')} alt="" className="main-cloud main-cloud-2" draggable={false} />
        <img src={assetUrl('/assets/mainscene/cloud_day_3.png')} alt="" className="main-cloud main-cloud-3" draggable={false} />
      </div>

      {/* Grass ground */}
      <img src={assetUrl('/assets/mainscene/day_grass_ground.png')} alt="" className="main-grass" draggable={false} />

      {/* Leaves */}
      <img src={assetUrl('/assets/mainscene/main_leaves_left.png')}  alt="" className="main-leaves-left"  draggable={false} />
      <img src={assetUrl('/assets/mainscene/main_leaves_right.png')} alt="" className="main-leaves-right" draggable={false} />

      {/* Back button */}
      <button className="main-back" onClick={() => navigate(`/coop/${levelID}`)}>
        ← Back
      </button>

      {/* ⭐ Star counter */}
      <div className="main-star-counter">
        <span className="main-star-icon">⭐</span>
        <span className="main-star-total">{totalStars}</span>
      </div>

      {/* Top panel */}
      <div className="main-panel-bar">
        <img
          src={assetUrl(`/assets/mainscene/${panelImg}`)}
          alt="" className="main-panel-img" draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <span className="main-panel-label">{level.levelTitle}</span>

        <div className="main-panel-day">
          <img
            src={assetUrl('/assets/mainscene/panel_day.png')}
            alt="" className="main-day-img" draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <span className="main-day-label">{day}</span>
        </div>
      </div>

      {/* Bird */}
      <div className="main-bird">
        <img
          src={getBirdIdleSrc(level.category, level.categoryLevel)}
          alt="bird" className="main-bird-img" draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <img
          src={assetUrl('/assets/mainscene/character_shadow.png')}
          alt="" className="main-bird-shadow" draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>

      {/* Game icons row */}
      <div className="main-icons-row">
        {dayCur.games.map((game, idx) => {
          const cleared = isGameCleared(levelID, day, idx)
          const justGotCleared = idx === pendingGameIndex
          const isEggQuiz = game.gameName.startsWith('EggQuiz')
          const hasRoute = gameRouteMap[game.gameName] !== undefined && gameRouteMap[game.gameName] !== null
          const isSpecial = game.gameName === 'Video' || game.gameName === 'Book' || game.gameName === 'BookWithQuiz'

          return (
            <div
              key={idx}
              className={`main-game-icon ${!hasRoute && !isSpecial ? 'main-game-icon--disabled' : ''} ${justGotCleared ? 'main-game-icon--just-cleared' : ''}`}
              onClick={() => handleGameClick(idx)}
            >
              <img src={assetUrl('/assets/icons/game_icon_frame_shadow.png')} alt="" className="main-icon-shadow" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} />
              <img
                src={getGameIconSrc(game.gameName)} alt={game.gameName}
                className="main-icon-img" draggable={false}
                onError={(e) => { e.currentTarget.src = assetUrl('/assets/icons/game_icon_frame_shadow.png') }}
              />
              <img
                src={isEggQuiz
                  ? assetUrl('/assets/icons/game_icon_frame_eggquiz.png')
                  : assetUrl('/assets/icons/game_icon_frame.png')
                }
                alt="" className="main-icon-frame" draggable={false}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />

              {!isEggQuiz && game.gameName !== 'Book' && game.gameName !== 'Comprehension' && !cleared && (
                <div className="main-icon-level-badge">
                  <img src={assetUrl('/assets/icons/game_level_circle.png')} alt="" className="main-level-circle" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  <span className="main-level-number">{game.gameLevel}</span>
                </div>
              )}

              {cleared && (
                <img
                  src={assetUrl('/assets/icons/game_icon_frame_completed.png')}
                  alt="✓" className="main-icon-completed" draggable={false}
                  onError={(e) => {
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

              {!hasRoute && !isSpecial && (
                <span className="main-icon-name">{game.gameName}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Toast */}
      {toast && <div className="main-toast">{toast}</div>}

      {/* Game complete popup */}
      {showGamePopup && (
        <GameCompletePopup starsEarned={STARS_PER_GAME} onClose={handleGamePopupClose} />
      )}

      {/* Day complete popup */}
      {showDayPopup && (
        <DayCompletePopup day={day} bonusStars={BONUS_STARS_PER_DAY} onClose={handleDayPopupClose} />
      )}
    </div>
  )
}
