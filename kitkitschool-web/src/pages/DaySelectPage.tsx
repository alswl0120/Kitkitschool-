import { useParams, useNavigate } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import { useCurriculum } from '../context/CurriculumContext'
import { getBirdIdleSrc } from '../data/birdMap'
import './DaySelectPage.css'

/**
 * DaySelectPage – Session (day) selection grid.
 * Matches C++ DaySelectPopup: 4-column grid of day buttons,
 * with challenge day (last day) logic.
 */
export default function DaySelectPage() {
  const { levelID } = useParams<{ levelID: string }>()
  const navigate = useNavigate()
  const { getLevel, isDayCleared, numDayCleared, isLevelOpen, loading } = useCurriculum()

  if (loading) {
    return <div className="daysel-loading">Loading...</div>
  }

  const level = levelID ? getLevel(levelID) : undefined
  if (!level || !levelID) {
    return (
      <div className="daysel-loading">
        <p>Level not found</p>
        <button onClick={() => navigate('/coop')}>Back to Courses</button>
      </div>
    )
  }

  if (!isLevelOpen(levelID)) {
    return (
      <div className="daysel-loading">
        <p>This course is locked</p>
        <button onClick={() => navigate('/coop')}>Back to Courses</button>
      </div>
    )
  }

  const numCleared = numDayCleared(levelID)
  const isL = level.category === 'L'

  // Panel title image
  let panelImg = isL ? 'daily_window_title_panel_english_.png' : 'daily_window_title_panel_math.png'
  if (level.categoryLevel === 0) panelImg = 'daily_window_title_panel_prek.png'

  return (
    <div className="daysel-root">
      {/* Background */}
      <img
        src={assetUrl('/assets/mainscene/dayselect/daily_bg.jpg')}
        alt=""
        className="daysel-bg"
        draggable={false}
      />

      <div className="daysel-container">
        {/* Back button */}
        <button className="daysel-back" onClick={() => navigate('/coop')}>
          ← Back
        </button>

        {/* Board */}
        <div className="daysel-board">
          <img
            src={assetUrl('/assets/mainscene/dayselect/daily_window_bg.png')}
            alt=""
            className="daysel-board-bg"
            draggable={false}
          />

          {/* Title panel */}
          <div className="daysel-title">
            <img
              src={assetUrl(`/assets/mainscene/dayselect/${panelImg}`)}
              alt=""
              className="daysel-title-panel"
              draggable={false}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span className="daysel-title-label">{level.levelTitle}</span>
          </div>

          {/* Day grid – 4 columns */}
          <div className="daysel-grid">
            {level.days.map((dayCur, i) => {
              const day = dayCur.day
              const cleared = isDayCleared(levelID, day)
              const isLastDay = i === level.days.length - 1
              const isChallenge = isLastDay && level.categoryLevel > 0
              const locked = isLastDay && level.categoryLevel > 0 && !cleared && numCleared < level.numDays - 1

              // Pick the right icon
              let iconFile: string
              if (isChallenge) {
                iconFile = cleared
                  ? 'daily_window_icon_challenge_complete.png'
                  : 'daily_window_icon_challenge.png'
              } else {
                iconFile = cleared
                  ? 'daily_window_icon_todo_complete.png'
                  : 'daily_window_icon_todo.png'
              }

              return (
                <button
                  key={day}
                  className={`daysel-day-btn ${locked ? 'daysel-day-btn--locked' : ''} ${cleared ? 'daysel-day-btn--cleared' : ''}`}
                  disabled={locked}
                  onClick={() => {
                    if (!locked) navigate(`/coop/${levelID}/day/${day}`)
                  }}
                >
                  <img
                    src={assetUrl(`/assets/mainscene/dayselect/${iconFile}`)}
                    alt=""
                    className="daysel-day-icon"
                    draggable={false}
                  />
                  <span className="daysel-day-number">{day}</span>
                  {locked && <div className="daysel-day-lock">🔒</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right side – stage with beam, stump, shadow, bird */}
        <div className="daysel-stage">
          {/* Beam – C++: ANCHOR_TOP_RIGHT at stageSize, behind everything */}
          <img
            src={assetUrl('/assets/mainscene/dayselect/daily_window_beam.png')}
            alt=""
            className="daysel-beam"
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          {/* Treestump */}
          <img
            src={assetUrl('/assets/mainscene/dayselect/daily_treestump.png')}
            alt=""
            className="daysel-treestump"
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          {/* Tree shadow – C++: at (480, 438) in stage */}
          <img
            src={assetUrl('/assets/mainscene/dayselect/daily_treestump_charactershadow.png')}
            alt=""
            className="daysel-treeshadow"
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          {/* Bird */}
          <img
            src={getBirdIdleSrc(level.category, level.categoryLevel)}
            alt="bird"
            className="daysel-bird-img"
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      </div>

      {/* Treetop – C++: added to this (popup), not stage.
        * Position: winSize with ANCHOR_TOP_RIGHT → top-right of viewport */}
      <img
        src={assetUrl('/assets/mainscene/dayselect/daily_treetop.png')}
        alt=""
        className="daysel-treetop"
        draggable={false}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    </div>
  )
}
