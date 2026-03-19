import { useEffect, useState } from 'react'
import { assetUrl } from '../utils/assetPath'
import './GameCompletePopup.css'

interface Props {
  starsEarned?: number   // how many stars this game gives (default 1)
  onClose: () => void
}

export default function GameCompletePopup({ starsEarned = 1, onClose }: Props) {
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter')

  useEffect(() => {
    // enter → idle after 300ms
    const t1 = setTimeout(() => setPhase('idle'), 300)
    // auto-close after 2.4s
    const t2 = setTimeout(() => setPhase('exit'), 2400)
    const t3 = setTimeout(() => onClose(), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onClose])

  return (
    <div className={`gcp-overlay gcp-overlay--${phase}`} onClick={() => { setPhase('exit'); setTimeout(onClose, 400) }}>
      <div className={`gcp-card gcp-card--${phase}`}>
        {/* Rotating sparkle rings */}
        <img
          src={assetUrl('/assets/common/completepopup/game_effect_rotatingleft.png')}
          alt=""
          className="gcp-ring gcp-ring--left"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <img
          src={assetUrl('/assets/common/completepopup/game_effect_rotatingright.png')}
          alt=""
          className="gcp-ring gcp-ring--right"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />

        {/* Glow behind medal */}
        <img
          src={assetUrl('/assets/common/completepopup/game_effect_glow.png')}
          alt=""
          className="gcp-glow"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />

        {/* Star medal */}
        <img
          src={assetUrl('/assets/common/completepopup/game_effect_starmedal.png')}
          alt="Star"
          className="gcp-medal"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />

        {/* Sparkle particles */}
        {[1, 2, 3, 4].map(i => (
          <img
            key={i}
            src={assetUrl('/assets/common/completepopup/game_effect_sparkle_1.png')}
            alt=""
            className={`gcp-sparkle gcp-sparkle--${i}`}
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ))}

        {/* Done text */}
        <img
          src={assetUrl('/assets/common/completepopup/game_effect_done_normal.png')}
          alt="Done!"
          className="gcp-done"
          draggable={false}
          onError={(e) => { e.currentTarget.textContent = 'Done!'; e.currentTarget.className += ' gcp-done-fallback' }}
        />

        {/* Stars earned badge */}
        <div className="gcp-stars-badge">
          <span className="gcp-stars-icon">⭐</span>
          <span className="gcp-stars-count">+{starsEarned}</span>
        </div>
      </div>
    </div>
  )
}
