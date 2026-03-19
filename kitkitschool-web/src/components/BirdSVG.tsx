import type { EquippedAccessories } from '../context/CurriculumContext'
import { ITEM_MAP } from '../data/customizationItems'

const EFFECT_GLOW: Record<string, string> = {
  e_sparkles: '#fff176',
  e_fire:     '#ff6d00',
  e_ice:      '#80d8ff',
  e_stars:    '#ffd740',
  e_rainbow:  '#ea80fc',
  e_music:    '#69f0ae',
}

interface BirdSVGProps {
  equipped: EquippedAccessories
  size?: number
}

export default function BirdSVG({ equipped, size = 200 }: BirdSVGProps) {
  const headItem   = equipped.head   ? ITEM_MAP[equipped.head]   : null
  const faceItem   = equipped.face   ? ITEM_MAP[equipped.face]   : null
  const neckItem   = equipped.neck   ? ITEM_MAP[equipped.neck]   : null
  const wingsItem  = equipped.wings  ? ITEM_MAP[equipped.wings]  : null
  const effectItem = equipped.effect ? ITEM_MAP[equipped.effect] : null
  const glowColor  = effectItem ? (EFFECT_GLOW[effectItem.id] ?? '#fff176') : null

  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={size * 1.1}
      style={{ overflow: 'visible' }}
    >
      {/* ── Effect glow (behind everything) ─────────── */}
      {glowColor && (
        <ellipse cx="100" cy="140" rx="80" ry="70" fill={glowColor} opacity="0.18">
          <animate attributeName="opacity" values="0.12;0.24;0.12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="rx" values="78;86;78" dur="2s" repeatCount="indefinite" />
        </ellipse>
      )}

      {/* ── Wings accessory (behind body) ──────────── */}
      {wingsItem && (
        <>
          <text x="5"   y="162" fontSize="46" style={{ userSelect: 'none' }}>{wingsItem.emoji}</text>
          <text x="148" y="162" fontSize="46" style={{ userSelect: 'none', transform: 'scaleX(-1)', transformOrigin: '175px 140px' }}>{wingsItem.emoji}</text>
        </>
      )}

      {/* ── Bird body ──────────────────────────────── */}
      {/* Body */}
      <ellipse cx="100" cy="150" rx="54" ry="47" fill="#FFB347" />
      {/* Belly highlight */}
      <ellipse cx="100" cy="157" rx="36" ry="30" fill="#FFE0A0" />
      {/* Left wing */}
      <ellipse cx="43"  cy="149" rx="20" ry="37" fill="#FF9A00" transform="rotate(-18 43 149)" />
      {/* Right wing */}
      <ellipse cx="157" cy="149" rx="20" ry="37" fill="#FF9A00" transform="rotate(18 157 149)" />
      {/* Head */}
      <circle cx="100" cy="72" r="44" fill="#FFB347" />
      {/* Head sheen */}
      <ellipse cx="88" cy="55" rx="14" ry="10" fill="#FFD580" opacity="0.5" transform="rotate(-20 88 55)" />
      {/* Beak */}
      <polygon points="142,66 168,74 142,82" fill="#FF7700" />
      <line x1="142" y1="74" x2="168" y2="74" stroke="#E06000" strokeWidth="1.5" />
      {/* Left eye */}
      <circle cx="80"  cy="64" r="11" fill="white" />
      <circle cx="83"  cy="64" r="6"  fill="#222" />
      <circle cx="82"  cy="61" r="2"  fill="white" />
      {/* Right eye */}
      <circle cx="116" cy="64" r="11" fill="white" />
      <circle cx="119" cy="64" r="6"  fill="#222" />
      <circle cx="118" cy="61" r="2"  fill="white" />
      {/* Left foot */}
      <line x1="83"  y1="193" x2="68"  y2="212" stroke="#FF7700" strokeWidth="4" strokeLinecap="round" />
      <line x1="68"  y1="212" x2="55"  y2="218" stroke="#FF7700" strokeWidth="3" strokeLinecap="round" />
      <line x1="68"  y1="212" x2="65"  y2="220" stroke="#FF7700" strokeWidth="3" strokeLinecap="round" />
      <line x1="68"  y1="212" x2="78"  y2="219" stroke="#FF7700" strokeWidth="3" strokeLinecap="round" />
      {/* Right foot */}
      <line x1="117" y1="193" x2="132" y2="212" stroke="#FF7700" strokeWidth="4" strokeLinecap="round" />
      <line x1="132" y1="212" x2="119" y2="218" stroke="#FF7700" strokeWidth="3" strokeLinecap="round" />
      <line x1="132" y1="212" x2="130" y2="220" stroke="#FF7700" strokeWidth="3" strokeLinecap="round" />
      <line x1="132" y1="212" x2="142" y2="218" stroke="#FF7700" strokeWidth="3" strokeLinecap="round" />

      {/* ── Face accessory (over eyes) ──────────────── */}
      {faceItem && (
        <text x="100" y="74" textAnchor="middle" fontSize="30" style={{ userSelect: 'none' }}>
          {faceItem.emoji}
        </text>
      )}

      {/* ── Neck accessory ──────────────────────────── */}
      {neckItem && (
        <text x="100" y="124" textAnchor="middle" fontSize="28" style={{ userSelect: 'none' }}>
          {neckItem.emoji}
        </text>
      )}

      {/* ── Head accessory (on top of head) ─────────── */}
      {headItem && (
        <text x="100" y="20" textAnchor="middle" fontSize="38" style={{ userSelect: 'none' }}>
          {headItem.emoji}
        </text>
      )}

      {/* ── Effect particles (foreground) ──────────── */}
      {effectItem && (
        <>
          <text x="10"  y="32"  fontSize="18" opacity="0.9" style={{ userSelect: 'none' }}>{effectItem.emoji}</text>
          <text x="168" y="32"  fontSize="18" opacity="0.9" style={{ userSelect: 'none' }}>{effectItem.emoji}</text>
          <text x="10"  y="205" fontSize="18" opacity="0.7" style={{ userSelect: 'none' }}>{effectItem.emoji}</text>
          <text x="168" y="205" fontSize="18" opacity="0.7" style={{ userSelect: 'none' }}>{effectItem.emoji}</text>
        </>
      )}
    </svg>
  )
}
