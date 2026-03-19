import { useEffect, useState } from 'react'
import { assetUrl } from '../utils/assetPath'
import './DayCompletePopup.css'

interface Props {
  day: number
  bonusStars?: number   // extra stars for completing the day (default 3)
  onClose: () => void
}

export default function DayCompletePopup({ day, bonusStars = 3, onClose }: Props) {
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('idle'), 300)
    const t2 = setTimeout(() => setPhase('exit'), 3500)
    const t3 = setTimeout(() => onClose(), 3900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onClose])

  return (
    <div
      className={`dcp-overlay dcp-overlay--${phase}`}
      onClick={() => { setPhase('exit'); setTimeout(onClose, 400) }}
    >
      <div className={`dcp-card dcp-card--${phase}`}>
        {/* Stars row */}
        <div className="dcp-stars-row">
          {Array.from({ length: bonusStars }).map((_, i) => (
            <span key={i} className="dcp-star" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>⭐</span>
          ))}
        </div>

        {/* Done image */}
        <img
          src={assetUrl('/assets/common/completepopup/game_effect_done_touch.png')}
          alt="Day Complete!"
          className="dcp-done-img"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />

        {/* Label */}
        <div className="dcp-label">Day {day} Complete!</div>

        {/* Bonus badge */}
        <div className="dcp-bonus">
          <span className="dcp-bonus-icon">⭐</span>
          <span className="dcp-bonus-text">+{bonusStars} Bonus Stars!</span>
        </div>

        {/* Glow particles */}
        <img
          src={assetUrl('/assets/common/completepopup/game_effect_glow.png')}
          alt=""
          className="dcp-glow"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <img
            key={i}
            src={assetUrl('/assets/common/completepopup/game_effect_sparkle_1.png')}
            alt=""
            className={`dcp-sparkle dcp-sparkle--${i}`}
            draggable={false}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ))}
      </div>
    </div>
  )
}
