export interface ShopTheme {
  id: string
  name: string
  emoji: string
  cost: number
  bg1: string    // main background
  bg2: string    // header / card background
  accent: string // accent color
  bar: string    // progress bar gradient
}

export const SHOP_THEMES: ShopTheme[] = [
  {
    id: 'default',
    name: 'Classic',
    emoji: '🌑',
    cost: 0,
    bg1: '#1e2233',
    bg2: '#2a3050',
    accent: '#4facfe',
    bar: 'linear-gradient(90deg, #4facfe, #00c6fb)',
  },
  {
    id: 'forest',
    name: 'Forest',
    emoji: '🌿',
    cost: 5,
    bg1: '#0f1f10',
    bg2: '#1a3320',
    accent: '#4caf50',
    bar: 'linear-gradient(90deg, #4caf50, #8bc34a)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    cost: 10,
    bg1: '#2a1205',
    bg2: '#3d2010',
    accent: '#ff6b35',
    bar: 'linear-gradient(90deg, #ff6b35, #ffd700)',
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    emoji: '🌌',
    cost: 15,
    bg1: '#08041e',
    bg2: '#14093a',
    accent: '#a855f7',
    bar: 'linear-gradient(90deg, #a855f7, #ec4899)',
  },
  {
    id: 'candy',
    name: 'Candy',
    emoji: '🍭',
    cost: 25,
    bg1: '#2a0518',
    bg2: '#420d2a',
    accent: '#f472b6',
    bar: 'linear-gradient(90deg, #f472b6, #fb923c)',
  },
]
