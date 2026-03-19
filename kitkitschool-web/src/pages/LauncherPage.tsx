import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { assetUrl } from '../utils/assetPath'
import { useCurriculum } from '../context/CurriculumContext'
import { resolveGameRoute } from '../data/gameRouteMap'

export default function LauncherPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { getLevel, loading } = useCurriculum()

  // External shell integration: if shell params are present in root URL,
  // resolve the game route and navigate directly to the game.
  useEffect(() => {
    if (loading) return
    const from = searchParams.get('from')
    const levelID = searchParams.get('levelID')
    const day = searchParams.get('day')
    const gameIndex = searchParams.get('gameIndex')

    if (from !== 'shell' || !levelID || !day || !gameIndex) return

    const level = getLevel(levelID)
    if (!level) return

    const dayNum = parseInt(day, 10)
    const gameIdx = parseInt(gameIndex, 10)
    const dayCur = level.days.find(d => d.day === dayNum)
    if (!dayCur) return

    const game = dayCur.games[gameIdx]
    if (!game) return

    const route = resolveGameRoute(game.gameName, game.gameLevel, game.gameParam)
    if (!route) return

    const separator = route.includes('?') ? '&' : '?'
    navigate(`${route}${separator}from=shell&levelID=${levelID}&day=${day}&gameIndex=${gameIndex}`, { replace: true })
  }, [loading, searchParams, getLevel, navigate])


  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#2B2E33',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top Bar - matches launcher_topbar.png background */}
      <div style={{
        height: 56,
        backgroundImage: `url(${assetUrl('/assets/launcher/launcher_topbar.png')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }}>
        <span style={{
          color: '#878787',
          fontSize: 28,
          fontFamily: 'TodoMainCurly, sans-serif',
        }}>
          Kitkit School
        </span>
        {/* Settings icon - top right → Admin page */}
        <img
          src={assetUrl('/assets/launcher/launcher_icon_setting_normal.png')}
          alt="Settings"
          onClick={() => navigate('/admin')}
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            height: 28,
            opacity: 0.6,
            cursor: 'pointer',
          }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>

      {/* Main Content - 30dp margin, horizontal layout */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        padding: 24,
        gap: 24,
        minHeight: 0,
      }}>
        {/* Left: Game Button - 780dp width proportional (~62% of content) */}
        <div
          onClick={() => navigate('/coop')}
          style={{
            position: 'relative',
            flex: '0 0 62%',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {/* Shadow layer */}
          <img
            src={assetUrl('/assets/launcher/launcher_mode_game_shadow.png')}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'fill',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          {/* Main button image */}
          <img
            src={assetUrl('/assets/launcher/launcher_mode_game.png')}
            alt="Game"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              marginBottom: 3,
            }}
            onError={(e) => {
              e.currentTarget.parentElement!.style.background = '#4CAF50'
              e.currentTarget.style.display = 'none'
            }}
          />
          {/* Logo - centered */}
          <img
            src={assetUrl('/assets/launcher/launcher_kitkitschool_logo.png')}
            alt="Kitkit School"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '40%',
              maxHeight: '30%',
              objectFit: 'contain',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          {/* START text at bottom center */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <img
              src={assetUrl('/assets/launcher/launcher_icon_game.png')}
              alt=""
              style={{ height: 24 }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span style={{
              color: '#fff',
              fontSize: 24,
              fontFamily: 'TodoMainCurly, sans-serif',
            }}>
              START
            </span>
          </div>
        </div>

        {/* Right Column - Library (509dp) + Tools (remaining) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          minWidth: 0,
        }}>
          {/* Library Button - height ~60% of column */}
          <div
            onClick={() => navigate('/library')}
            style={{
              position: 'relative',
              flex: '0 0 55%',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {/* Shadow */}
            <img
              src={assetUrl('/assets/launcher/launcher_mode_library_shadow.png')}
              alt=""
              style={{
                position: 'absolute',
                top: 3,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
              }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            {/* Main image */}
            <img
              src={assetUrl('/assets/launcher/launcher_mode_library.png')}
              alt="Library"
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                marginBottom: 3,
              }}
              onError={(e) => {
                e.currentTarget.parentElement!.style.background = '#2196F3'
                e.currentTarget.style.display = 'none'
              }}
            />
            {/* Icon + Label centered */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}>
              <img
                src={assetUrl('/assets/launcher/launcher_icon_library.png')}
                alt=""
                style={{ height: 40, objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span style={{
                color: '#fff',
                fontSize: 24,
                fontFamily: 'TodoMainCurly, sans-serif',
              }}>
                Library
              </span>
            </div>
          </div>

          {/* Tools Button - remaining height */}
          <div
            onClick={() => navigate('/tools')}
            style={{
              position: 'relative',
              flex: 1,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {/* Shadow */}
            <img
              src={assetUrl('/assets/launcher/launcher_mode_tool_shadow.png')}
              alt=""
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
              }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            {/* Main image */}
            <img
              src={assetUrl('/assets/launcher/launcher_mode_tool.png')}
              alt="Tools"
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                marginBottom: 3,
              }}
              onError={(e) => {
                e.currentTarget.parentElement!.style.background = '#FF9800'
                e.currentTarget.style.display = 'none'
              }}
            />
            {/* Icon + Label centered */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}>
              <img
                src={assetUrl('/assets/launcher/launcher_icon_tool.png')}
                alt=""
                style={{ height: 40, objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span style={{
                color: '#fff',
                fontSize: 24,
                fontFamily: 'TodoMainCurly, sans-serif',
              }}>
                Tools
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
