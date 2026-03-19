import { ITEM_MAP } from '../data/customizationItems'
import BirdSVG from './BirdSVG'
import type { EquippedAccessories } from '../context/CurriculumContext'

// Fixed positions for up to 12 coop decoration slots
const DECO_POSITIONS = [
  { left: '6%',  top: '6%',  size: 32 },   // sky-left
  { left: '42%', top: '3%',  size: 36 },   // sky-center
  { left: '76%', top: '6%',  size: 32 },   // sky-right
  { left: '3%',  top: '38%', size: 34 },   // mid-left-high
  { left: '8%',  top: '62%', size: 36 },   // mid-left-low
  { left: '18%', top: '52%', size: 30 },   // left-inner
  { left: '72%', top: '38%', size: 34 },   // mid-right-high
  { left: '80%', top: '62%', size: 36 },   // mid-right-low
  { left: '68%', top: '52%', size: 30 },   // right-inner
  { left: '28%', top: '76%', size: 30 },   // ground-left
  { left: '56%', top: '80%', size: 30 },   // ground-right
  { left: '42%', top: '83%', size: 28 },   // ground-center
]

interface CoopPreviewProps {
  equipped: EquippedAccessories
  coopDecorations: string[]
  size?: 'sm' | 'md' | 'lg'
}

export default function CoopPreview({ equipped, coopDecorations, size = 'md' }: CoopPreviewProps) {
  const heights: Record<string, number> = { sm: 160, md: 240, lg: 320 }
  const h = heights[size]

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: h,
      borderRadius: 16,
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #87CEEB 0%, #B0E2FF 45%, #7EC850 45%, #5DA832 100%)',
    }}>
      {/* Ground strip */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '42%',
        background: 'linear-gradient(180deg, #7EC850 0%, #4a9020 100%)',
      }} />

      {/* Coop decorations */}
      {coopDecorations.slice(0, 12).map((itemId, idx) => {
        const item = ITEM_MAP[itemId]
        const pos  = DECO_POSITIONS[idx]
        if (!item || !pos) return null
        return (
          <div key={`${itemId}-${idx}`} style={{
            position: 'absolute',
            left: pos.left,
            top: pos.top,
            fontSize: pos.size,
            lineHeight: 1,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            userSelect: 'none',
          }}>
            {item.emoji}
          </div>
        )
      })}

      {/* Bird centered */}
      <div style={{
        position: 'absolute',
        bottom: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        <BirdSVG equipped={equipped} size={size === 'sm' ? 70 : size === 'md' ? 110 : 150} />
      </div>

      {/* Empty hint */}
      {coopDecorations.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '12%', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}>
          Add items to decorate!
        </div>
      )}
    </div>
  )
}
