import { assetUrl } from '../utils/assetPath'

interface ProgressBarProps {
  current: number
  max: number
}

// Original C++ sizes: dot 46x48 game pixels, margin 10px, game resolution 2560x1800
// Scale to viewport: 46/2560 ≈ 1.8vw
const DOT_SIZE_VW = 1.8     // vw units
const DOT_MARGIN_VW = 0.4   // 10/2560 ≈ 0.4vw

export default function ProgressBar({ current, max }: ProgressBarProps) {
  const dots = []
  for (let i = 0; i < max; i++) {
    const isCompleted = i < current - 1
    const isCurrent = i === current - 1
    const src = isCompleted
      ? assetUrl('/assets/tapping/wm_progress_completed.png')
      : isCurrent
        ? assetUrl('/assets/tapping/wm_progress_level_current.png')
        : assetUrl('/assets/tapping/wm_progress_level.png')

    dots.push(
      <img
        key={i}
        src={src}
        alt=""
        style={{
          width: `${DOT_SIZE_VW}vw`,
          height: `${DOT_SIZE_VW}vw`,
          margin: `0 ${DOT_MARGIN_VW}vw`,
        }}
      />
    )
  }

  return (
    <div style={{
      position: 'absolute',
      top: '0.9vw',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      zIndex: 50,
    }}>
      {dots}
    </div>
  )
}
