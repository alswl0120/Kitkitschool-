export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type ItemSlot = 'head' | 'face' | 'neck' | 'wings' | 'effect' | 'coop'

export interface CustomItem {
  id: string
  name: string
  emoji: string
  slot: ItemSlot
  rarity: Rarity
  cost: number        // 0 = gacha only
  levelReq: number
  gachaWeight: number // higher = more likely in gacha
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#78909c',
  rare: '#42a5f5',
  epic: '#ab47bc',
  legendary: '#ffa726',
}

export const RARITY_LEVEL_REQ: Record<Rarity, number> = {
  common: 1,
  rare: 3,
  epic: 5,
  legendary: 7,
}

// XP thresholds per level (index = level-1)
export const XP_LEVELS = [0, 50, 130, 250, 420, 640, 920, 1260, 1660, 2120]

export function getLevelFromXP(xp: number): number {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i]) return i + 1
  }
  return 1
}

export function getXPForNextLevel(level: number): number {
  return XP_LEVELS[level] ?? XP_LEVELS[XP_LEVELS.length - 1]
}

export const GACHA_COST = 10

// ─── All Items ─────────────────────────────────────────────────────────────

export const ALL_ITEMS: CustomItem[] = [
  // ── Head ────────────────────────────────────────────────────────
  { id: 'h_ribbon',      name: 'Ribbon',          emoji: '🎀', slot: 'head', rarity: 'common',    cost: 3,  levelReq: 1, gachaWeight: 18 },
  { id: 'h_flower',      name: 'Flower Crown',    emoji: '🌸', slot: 'head', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 15 },
  { id: 'h_party',       name: 'Party Hat',       emoji: '🎉', slot: 'head', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 15 },
  { id: 'h_graduation',  name: 'Grad Cap',        emoji: '🎓', slot: 'head', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 10 },
  { id: 'h_santa',       name: 'Santa Hat',       emoji: '🎅', slot: 'head', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 10 },
  { id: 'h_witch',       name: 'Witch Hat',       emoji: '🧙', slot: 'head', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 'h_cowboy',      name: 'Cowboy Hat',      emoji: '🤠', slot: 'head', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 'h_flower_hat',  name: 'Bouquet Hat',     emoji: '💐', slot: 'head', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 'h_crown',       name: 'Crown',           emoji: '👑', slot: 'head', rarity: 'epic',      cost: 15, levelReq: 5, gachaWeight: 4  },
  { id: 'h_top_hat',     name: 'Top Hat',         emoji: '🎩', slot: 'head', rarity: 'epic',      cost: 15, levelReq: 5, gachaWeight: 4  },
  { id: 'h_halo',        name: 'Halo',            emoji: '😇', slot: 'head', rarity: 'legendary', cost: 0,  levelReq: 7, gachaWeight: 1  },
  { id: 'h_unicorn',     name: 'Unicorn Horn',    emoji: '🦄', slot: 'head', rarity: 'legendary', cost: 0,  levelReq: 7, gachaWeight: 1  },

  // ── Face ────────────────────────────────────────────────────────
  { id: 'f_glasses',     name: 'Glasses',         emoji: '👓', slot: 'face', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 15 },
  { id: 'f_sunglasses',  name: 'Sunglasses',      emoji: '🕶️', slot: 'face', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 9  },
  { id: 'f_goggles',     name: 'Goggles',         emoji: '🥽', slot: 'face', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 9  },
  { id: 'f_mask',        name: 'Mask',            emoji: '😷', slot: 'face', rarity: 'common',    cost: 3,  levelReq: 1, gachaWeight: 12 },
  { id: 'f_star_eyes',   name: 'Star Eyes',       emoji: '🤩', slot: 'face', rarity: 'epic',      cost: 15, levelReq: 5, gachaWeight: 4  },
  { id: 'f_clown',       name: 'Clown',           emoji: '🤡', slot: 'face', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 7  },

  // ── Neck ────────────────────────────────────────────────────────
  { id: 'n_bowtie',      name: 'Bow Tie',         emoji: '🦋', slot: 'neck', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 14 },
  { id: 'n_scarf',       name: 'Scarf',           emoji: '🧣', slot: 'neck', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 14 },
  { id: 'n_necklace',    name: 'Necklace',        emoji: '💎', slot: 'neck', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 'n_medal',       name: 'Medal',           emoji: '🎖️', slot: 'neck', rarity: 'epic',      cost: 15, levelReq: 5, gachaWeight: 4  },
  { id: 'n_lei',         name: 'Flower Lei',      emoji: '🌺', slot: 'neck', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 9  },
  { id: 'n_tie',         name: 'Necktie',         emoji: '👔', slot: 'neck', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 12 },

  // ── Wings ───────────────────────────────────────────────────────
  { id: 'w_butterfly',   name: 'Butterfly Wings', emoji: '🦋', slot: 'wings', rarity: 'rare',     cost: 12, levelReq: 3, gachaWeight: 8  },
  { id: 'w_angel',       name: 'Angel Wings',     emoji: '👼', slot: 'wings', rarity: 'rare',     cost: 12, levelReq: 3, gachaWeight: 8  },
  { id: 'w_rainbow',     name: 'Rainbow Wings',   emoji: '🌈', slot: 'wings', rarity: 'epic',     cost: 20, levelReq: 5, gachaWeight: 3  },
  { id: 'w_lightning',   name: 'Lightning Wings', emoji: '⚡', slot: 'wings', rarity: 'epic',     cost: 20, levelReq: 5, gachaWeight: 3  },
  { id: 'w_dragon',      name: 'Dragon Wings',    emoji: '🐉', slot: 'wings', rarity: 'legendary',cost: 0,  levelReq: 7, gachaWeight: 1  },
  { id: 'w_fairy',       name: 'Fairy Wings',     emoji: '🧚', slot: 'wings', rarity: 'legendary',cost: 0,  levelReq: 7, gachaWeight: 1  },

  // ── Effect ──────────────────────────────────────────────────────
  { id: 'e_sparkles',    name: 'Sparkles',        emoji: '✨', slot: 'effect', rarity: 'rare',    cost: 12, levelReq: 3, gachaWeight: 8  },
  { id: 'e_fire',        name: 'Fire Aura',       emoji: '🔥', slot: 'effect', rarity: 'epic',    cost: 20, levelReq: 5, gachaWeight: 3  },
  { id: 'e_ice',         name: 'Ice Aura',        emoji: '❄️', slot: 'effect', rarity: 'epic',    cost: 20, levelReq: 5, gachaWeight: 3  },
  { id: 'e_stars',       name: 'Starlight',       emoji: '💫', slot: 'effect', rarity: 'legendary',cost: 0, levelReq: 7, gachaWeight: 1  },
  { id: 'e_rainbow',     name: 'Rainbow Glow',    emoji: '🌟', slot: 'effect', rarity: 'legendary',cost: 0, levelReq: 9, gachaWeight: 1  },
  { id: 'e_music',       name: 'Music',           emoji: '🎵', slot: 'effect', rarity: 'rare',    cost: 10, levelReq: 3, gachaWeight: 7  },

  // ── Coop: Plants ────────────────────────────────────────────────
  { id: 'c_cherry',      name: 'Cherry Blossom',  emoji: '🌸', slot: 'coop', rarity: 'common',    cost: 3,  levelReq: 1, gachaWeight: 14 },
  { id: 'c_sunflower',   name: 'Sunflower',       emoji: '🌻', slot: 'coop', rarity: 'common',    cost: 3,  levelReq: 1, gachaWeight: 14 },
  { id: 'c_cactus',      name: 'Cactus',          emoji: '🌵', slot: 'coop', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 12 },
  { id: 'c_clover',      name: 'Four-Leaf Clover',emoji: '🍀', slot: 'coop', rarity: 'common',    cost: 3,  levelReq: 1, gachaWeight: 14 },
  { id: 'c_mushroom',    name: 'Mushroom',        emoji: '🍄', slot: 'coop', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 9  },
  { id: 'c_bamboo',      name: 'Bamboo',          emoji: '🎋', slot: 'coop', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 8  },
  { id: 'c_tulip',       name: 'Tulip',           emoji: '🌷', slot: 'coop', rarity: 'common',    cost: 3,  levelReq: 1, gachaWeight: 14 },
  { id: 'c_herb',        name: 'Herb',            emoji: '🌿', slot: 'coop', rarity: 'common',    cost: 3,  levelReq: 1, gachaWeight: 12 },

  // ── Coop: Trees ─────────────────────────────────────────────────
  { id: 't_oak',         name: 'Oak Tree',        emoji: '🌳', slot: 'coop', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 9  },
  { id: 't_apple',       name: 'Apple Tree',      emoji: '🍎', slot: 'coop', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 't_palm',        name: 'Palm Tree',       emoji: '🌴', slot: 'coop', rarity: 'epic',      cost: 15, levelReq: 5, gachaWeight: 4  },
  { id: 't_maple',       name: 'Maple Tree',      emoji: '🍁', slot: 'coop', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 't_pine',        name: 'Pine Tree',       emoji: '🌲', slot: 'coop', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 8  },
  { id: 't_cherry_tree', name: 'Cherry Tree',     emoji: '🌺', slot: 'coop', rarity: 'epic',      cost: 15, levelReq: 5, gachaWeight: 4  },

  // ── Coop: Structures ────────────────────────────────────────────
  { id: 's_rocks',       name: 'Stone Wall',      emoji: '🪨', slot: 'coop', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 12 },
  { id: 's_lantern',     name: 'Lantern',         emoji: '🏮', slot: 'coop', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 9  },
  { id: 's_log',         name: 'Log',             emoji: '🪵', slot: 'coop', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 12 },
  { id: 's_fountain',    name: 'Fountain',        emoji: '⛲', slot: 'coop', rarity: 'epic',      cost: 20, levelReq: 5, gachaWeight: 3  },
  { id: 's_bridge',      name: 'Mini Bridge',     emoji: '🌉', slot: 'coop', rarity: 'rare',      cost: 12, levelReq: 3, gachaWeight: 7  },
  { id: 's_tent',        name: 'Tent',            emoji: '⛺', slot: 'coop', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 's_house',       name: 'Little House',    emoji: '🏡', slot: 'coop', rarity: 'epic',      cost: 18, levelReq: 5, gachaWeight: 3  },

  // ── Coop: Sky ───────────────────────────────────────────────────
  { id: 'k_cloud',       name: 'Cloud',           emoji: '☁️', slot: 'coop', rarity: 'common',    cost: 3,  levelReq: 1, gachaWeight: 14 },
  { id: 'k_rainbow',     name: 'Rainbow',         emoji: '🌈', slot: 'coop', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 'k_moon',        name: 'Moon & Stars',    emoji: '🌙', slot: 'coop', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },
  { id: 'k_sun',         name: 'Sun',             emoji: '☀️', slot: 'coop', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 12 },
  { id: 'k_fireworks',   name: 'Fireworks',       emoji: '🎆', slot: 'coop', rarity: 'epic',      cost: 20, levelReq: 5, gachaWeight: 3  },
  { id: 'k_balloon',     name: 'Balloon',         emoji: '🎈', slot: 'coop', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 9  },
  { id: 'k_star',        name: 'Star',            emoji: '⭐', slot: 'coop', rarity: 'common',    cost: 5,  levelReq: 1, gachaWeight: 12 },
  { id: 'k_kite',        name: 'Kite',            emoji: '🪁', slot: 'coop', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 8  },

  // ── Coop: Special ───────────────────────────────────────────────
  { id: 'p_carousel',    name: 'Carousel',        emoji: '🎠', slot: 'coop', rarity: 'epic',      cost: 20, levelReq: 5, gachaWeight: 2  },
  { id: 'p_ferris',      name: 'Ferris Wheel',    emoji: '🎡', slot: 'coop', rarity: 'legendary', cost: 0,  levelReq: 7, gachaWeight: 1  },
  { id: 'p_snowman',     name: 'Snowman',         emoji: '⛄', slot: 'coop', rarity: 'rare',      cost: 10, levelReq: 3, gachaWeight: 7  },
  { id: 'p_butterfly',   name: 'Butterfly',       emoji: '🦋', slot: 'coop', rarity: 'rare',      cost: 8,  levelReq: 3, gachaWeight: 9  },
  { id: 'p_rainbow_arc', name: 'Rainbow Bridge',  emoji: '🌉', slot: 'coop', rarity: 'legendary', cost: 0,  levelReq: 9, gachaWeight: 1  },
]

export const ITEM_MAP: Record<string, CustomItem> = Object.fromEntries(
  ALL_ITEMS.map(item => [item.id, item])
)

export const BIRD_SLOTS: ItemSlot[] = ['head', 'face', 'neck', 'wings', 'effect']
export const COOP_SLOTS: ItemSlot[] = ['coop']
export const MAX_COOP_DECOS = 12

export const SLOT_LABEL: Record<string, string> = {
  head: 'Head',
  face: 'Face',
  neck: 'Neck',
  wings: 'Wings',
  effect: 'Effect',
  coop: 'Coop',
}

export function weightedRandom(items: CustomItem[]): CustomItem | null {
  if (items.length === 0) return null
  const total = items.reduce((s, i) => s + i.gachaWeight, 0)
  let rand = Math.random() * total
  for (const item of items) {
    rand -= item.gachaWeight
    if (rand <= 0) return item
  }
  return items[items.length - 1]
}
