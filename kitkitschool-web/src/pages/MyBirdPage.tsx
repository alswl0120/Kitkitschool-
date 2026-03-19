import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurriculum } from '../context/CurriculumContext'
import type { EquippedAccessories } from '../context/CurriculumContext'
import BirdSVG from '../components/BirdSVG'
import CoopPreview from '../components/CoopPreview'
import {
  ALL_ITEMS, ITEM_MAP, RARITY_COLOR, RARITY_LABEL, RARITY_LEVEL_REQ,
  GACHA_COST, MAX_COOP_DECOS, SLOT_LABEL, BIRD_SLOTS,
  getLevelFromXP, getXPForNextLevel, XP_LEVELS,
  type CustomItem, type ItemSlot,
} from '../data/customizationItems'
import './MyBirdPage.css'

type MainTab = 'shop' | 'inventory'
type ShopTab = 'bird' | 'coop' | 'gacha'

// ─── Helpers ─────────────────────────────────────────────────────────

function RarityBadge({ rarity }: { rarity: CustomItem['rarity'] }) {
  return (
    <span className="mb-rarity" style={{ background: RARITY_COLOR[rarity] }}>
      {RARITY_LABEL[rarity]}
    </span>
  )
}

function LevelBadge({ level }: { level: number }) {
  if (level <= 1) return null
  return <span className="mb-level-req">Lv.{level}+</span>
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function MyBirdPage() {
  const navigate = useNavigate()
  const {
    totalStars, playerXP,
    inventory, equippedAccessories, coopDecorations,
    buyItem, gachaPull, equipAccessory, toggleCoopDeco,
  } = useCurriculum()

  const [mainTab, setMainTab] = useState<MainTab>('shop')
  const [shopTab, setShopTab] = useState<ShopTab>('bird')
  const [gachaResult, setGachaResult] = useState<CustomItem | null>(null)
  const [gachaAnim, setGachaAnim] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const playerLevel = getLevelFromXP(playerXP)
  const currentXP   = playerXP
  const nextLevelXP = getXPForNextLevel(playerLevel)
  const prevLevelXP = XP_LEVELS[playerLevel - 1] ?? 0
  const xpPct = nextLevelXP > prevLevelXP
    ? Math.round(((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100)
    : 100

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function handleBuy(item: CustomItem) {
    if (inventory.includes(item.id)) { showToast('Already owned!'); return }
    if (playerLevel < item.levelReq) { showToast(`Level ${item.levelReq}+ required`); return }
    if (item.cost === 0) { showToast('Gacha only'); return }
    if (totalStars < item.cost) { showToast('Not enough stars'); return }
    const ok = buyItem(item.id)
    if (ok) showToast(`${item.emoji} ${item.name} purchased!`)
  }

  function handleGacha() {
    if (totalStars < GACHA_COST) { showToast('Not enough stars'); return }
    setGachaAnim(true)
    setTimeout(() => {
      const id = gachaPull()
      if (id) {
        setGachaResult(ITEM_MAP[id])
      } else {
        showToast('You own all items!')
        setGachaAnim(false)
      }
    }, 600)
  }

  function handleEquip(item: CustomItem) {
    if (item.slot === 'coop') {
      if (coopDecorations.length >= MAX_COOP_DECOS && !coopDecorations.includes(item.id)) {
        showToast(`Max ${MAX_COOP_DECOS} decorations in coop`)
        return
      }
      toggleCoopDeco(item.id)
    } else {
      const slot = item.slot as keyof EquippedAccessories
      const current = equippedAccessories[slot]
      equipAccessory(slot, current === item.id ? null : item.id)
    }
  }

  function isEquipped(item: CustomItem): boolean {
    if (item.slot === 'coop') return coopDecorations.includes(item.id)
    return equippedAccessories[item.slot as keyof EquippedAccessories] === item.id
  }

  const birdItems = ALL_ITEMS.filter(i => BIRD_SLOTS.includes(i.slot))
  const coopItems = ALL_ITEMS.filter(i => i.slot === 'coop')

  return (
    <div className="mb-root">
      {/* ── Header ─────────────────────────────────── */}
      <div className="mb-header">
        <button className="mb-back" onClick={() => navigate('/tools')}>← Back</button>
        <span className="mb-title">🐦 My Bird & Home</span>
        <div className="mb-header-right">
          <div className="mb-level-badge">Lv.{playerLevel}</div>
          <div className="mb-star-badge">⭐ {totalStars}</div>
        </div>
      </div>

      {/* ── XP bar ─────────────────────────────────── */}
      <div className="mb-xp-bar-wrap">
        <div className="mb-xp-bar-track">
          <div className="mb-xp-bar-fill" style={{ width: `${xpPct}%` }} />
        </div>
        <span className="mb-xp-label">{currentXP} / {nextLevelXP} XP</span>
      </div>

      {/* ── Preview panels ─────────────────────────── */}
      <div className="mb-preview-row">
        <div className="mb-bird-panel">
          <div className="mb-panel-label">My Bird</div>
          <BirdSVG equipped={equippedAccessories} size={160} />
          <div className="mb-equipped-slots">
            {BIRD_SLOTS.map(slot => {
              const itemId = equippedAccessories[slot as keyof EquippedAccessories]
              const item   = itemId ? ITEM_MAP[itemId] : null
              return (
                <div key={slot} className="mb-slot-chip" title={SLOT_LABEL[slot]}>
                  <span className="mb-slot-label">{SLOT_LABEL[slot]}</span>
                  <span className="mb-slot-value">{item ? item.emoji : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mb-coop-panel">
          <div className="mb-panel-label">Coop ({coopDecorations.length}/{MAX_COOP_DECOS})</div>
          <CoopPreview equipped={equippedAccessories} coopDecorations={coopDecorations} size="md" />
        </div>
      </div>

      {/* ── Main tabs ──────────────────────────────── */}
      <div className="mb-tab-bar">
        <button className={`mb-tab ${mainTab === 'shop' ? 'mb-tab--active' : ''}`} onClick={() => setMainTab('shop')}>🛍 Shop</button>
        <button className={`mb-tab ${mainTab === 'inventory' ? 'mb-tab--active' : ''}`} onClick={() => setMainTab('inventory')}>🎒 Inventory ({inventory.length})</button>
      </div>

      {/* ── Shop ───────────────────────────────────── */}
      {mainTab === 'shop' && (
        <div className="mb-panel">
          <div className="mb-subtab-bar">
            <button className={`mb-subtab ${shopTab === 'bird' ? 'mb-subtab--active' : ''}`} onClick={() => setShopTab('bird')}>🐦 Bird Accessories</button>
            <button className={`mb-subtab ${shopTab === 'coop' ? 'mb-subtab--active' : ''}`} onClick={() => setShopTab('coop')}>🏡 Coop Decor</button>
            <button className={`mb-subtab ${shopTab === 'gacha' ? 'mb-subtab--active' : ''}`} onClick={() => setShopTab('gacha')}>🎰 Gacha</button>
          </div>

          {shopTab !== 'gacha' && (
            <div className="mb-item-grid">
              {(shopTab === 'bird' ? birdItems : coopItems).map(item => {
                const owned   = inventory.includes(item.id)
                const locked  = playerLevel < item.levelReq
                const noStars = totalStars < item.cost && !owned
                const gachaOnly = item.cost === 0
                return (
                  <div key={item.id} className={`mb-item-card ${owned ? 'mb-item-card--owned' : ''} ${locked ? 'mb-item-card--locked' : ''}`}>
                    <div className="mb-item-emoji">{item.emoji}</div>
                    <div className="mb-item-name">{item.name}</div>
                    <RarityBadge rarity={item.rarity} />
                    <LevelBadge level={item.levelReq} />
                    <div className="mb-item-action">
                      {owned ? (
                        <span className="mb-btn mb-btn--owned">Owned</span>
                      ) : locked ? (
                        <span className="mb-btn mb-btn--locked">Lv.{item.levelReq}+</span>
                      ) : gachaOnly ? (
                        <span className="mb-btn mb-btn--gacha">Gacha Only</span>
                      ) : (
                        <button
                          className={`mb-btn mb-btn--buy ${noStars ? 'mb-btn--disabled' : ''}`}
                          onClick={() => handleBuy(item)}
                          disabled={noStars}
                        >
                          ⭐ {item.cost}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {shopTab === 'gacha' && (
            <GachaPanel
              totalStars={totalStars}
              result={gachaResult}
              anim={gachaAnim}
              onPull={handleGacha}
              onClose={() => { setGachaResult(null); setGachaAnim(false) }}
            />
          )}
        </div>
      )}

      {/* ── Inventory ──────────────────────────────── */}
      {mainTab === 'inventory' && (
        <div className="mb-panel">
          {inventory.length === 0 ? (
            <div className="mb-empty">No items yet. Buy from the shop or try your luck with Gacha!</div>
          ) : (
            <>
              <InventorySection
                title="🐦 Bird Accessories"
                items={inventory.map(id => ITEM_MAP[id]).filter(i => i && BIRD_SLOTS.includes(i.slot))}
                isEquipped={isEquipped}
                onEquip={handleEquip}
              />
              <InventorySection
                title="🏡 Coop Decor"
                items={inventory.map(id => ITEM_MAP[id]).filter(i => i && i.slot === 'coop')}
                isEquipped={isEquipped}
                onEquip={handleEquip}
              />
            </>
          )}
        </div>
      )}

      {/* ── Toast ──────────────────────────────────── */}
      {toast && <div className="mb-toast">{toast}</div>}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────

function InventorySection({ title, items, isEquipped, onEquip }: {
  title: string
  items: CustomItem[]
  isEquipped: (item: CustomItem) => boolean
  onEquip: (item: CustomItem) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-inv-section">
      <div className="mb-inv-title">{title}</div>
      <div className="mb-item-grid">
        {items.map(item => {
          const equipped = isEquipped(item)
          return (
            <div key={item.id} className={`mb-item-card ${equipped ? 'mb-item-card--equipped' : ''}`}>
              <div className="mb-item-emoji">{item.emoji}</div>
              <div className="mb-item-name">{item.name}</div>
              <RarityBadge rarity={item.rarity} />
              {item.slot !== 'coop' && (
                <div className="mb-slot-tag">{SLOT_LABEL[item.slot]}</div>
              )}
              <div className="mb-item-action">
                <button
                  className={`mb-btn ${equipped ? 'mb-btn--unequip' : 'mb-btn--equip'}`}
                  onClick={() => onEquip(item)}
                >
                  {item.slot === 'coop'
                    ? (equipped ? 'Remove' : 'Place')
                    : (equipped ? 'Unequip' : 'Equip')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GachaPanel({ totalStars, result, anim, onPull, onClose }: {
  totalStars: number
  result: CustomItem | null
  anim: boolean
  onPull: () => void
  onClose: () => void
}) {
  const PROBS: Array<{ rarity: CustomItem['rarity']; pct: string }> = [
    { rarity: 'common', pct: '~60%' },
    { rarity: 'rare', pct: '~30%' },
    { rarity: 'epic', pct: '~8%' },
    { rarity: 'legendary', pct: '~2%' },
  ]

  return (
    <div className="mb-gacha">
      {!result && !anim && (
        <>
          <div className="mb-gacha-egg">🥚</div>
          <div className="mb-gacha-desc">Crack the egg to get a random item!</div>
          <div className="mb-gacha-probs">
            {PROBS.map(p => (
              <span key={p.rarity} className="mb-gacha-prob" style={{ color: RARITY_COLOR[p.rarity] }}>
                {RARITY_LABEL[p.rarity]} {p.pct}
              </span>
            ))}
          </div>
          <button
            className={`mb-gacha-btn ${totalStars < GACHA_COST ? 'mb-gacha-btn--disabled' : ''}`}
            onClick={onPull}
            disabled={totalStars < GACHA_COST}
          >
            🎰 Pull Gacha (⭐ {GACHA_COST})
          </button>
        </>
      )}

      {anim && !result && (
        <div className="mb-gacha-spin">
          <div className="mb-gacha-egg mb-gacha-egg--spin">🥚</div>
          <div className="mb-gacha-desc">Hatching...</div>
        </div>
      )}

      {result && (
        <div className="mb-gacha-result">
          <div className="mb-gacha-result-emoji">{result.emoji}</div>
          <div className="mb-gacha-result-name">{result.name}</div>
          <RarityBadge rarity={result.rarity} />
          <div className="mb-gacha-desc">You got it!</div>
          <button className="mb-gacha-btn" onClick={onClose}>OK</button>
        </div>
      )}
    </div>
  )
}
