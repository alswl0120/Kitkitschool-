export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Color {
  r: number
  g: number
  b: number
}

export const BALLOON_COLORS: Color[] = [
  { r: 240, g: 58, b: 58 },
  { r: 240, g: 95, b: 165 },
  { r: 240, g: 200, b: 58 },
  { r: 250, g: 115, b: 60 },
  { r: 110, g: 190, b: 70 },
  { r: 110, g: 40, b: 130 },
]

export const POP_LABEL_COLORS = [
  { r: 247, g: 233, b: 133 },
  { r: 140, g: 255, b: 250 },
  { r: 255, g: 200, b: 230 },
  { r: 100, g: 252, b: 154 },
]

// Balloon size at each inflation stage (index 0 = stage 1)
export const BALLOON_SIZES: [number, number][] = [
  [180, 210],
  [210, 210],
  [270, 270],
  [290, 330],
  [340, 390],
  [385, 445],
  [445, 515],
  [530, 600],
  [625, 705],
  [770, 860],
]

// Virtual game resolution (from C++ source)
export const GAME_WIDTH = 2560
export const GAME_HEIGHT = 1800

// Placement areas per level
export const AREA_1: Rect = { x: 1280 - 500, y: 500, width: 1000, height: 500 }
export const AREA_2: Rect = { x: 1280 - 1000, y: 300, width: 2000, height: 1000 }
export const AREA_3: Rect = { x: 1280 - 1000, y: 300, width: 2000, height: 1200 }

export interface LevelConfig {
  balloonCount: number
  maxTap: number
  goalPops: number
  area: Rect
  isBubble: boolean
}

export const LEVELS: LevelConfig[] = [
  { balloonCount: 1, maxTap: 10, goalPops: 3, area: AREA_1, isBubble: false },
  { balloonCount: 5, maxTap: 10, goalPops: 10, area: AREA_2, isBubble: false },
  { balloonCount: 6, maxTap: 1, goalPops: 100, area: AREA_3, isBubble: true },
]
