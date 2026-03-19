import { assetUrl } from '../utils/assetPath'

/**
 * Maps category + categoryLevel to the bird sprite folder name.
 * From Bird.cpp loadAnimation() mapping.
 */
const BIRD_TYPE_MAP: Record<string, string> = {
  'L_0': 'bird1',   // BIRD_L0 - Literacy PreSchool
  'M_0': 'bird2',   // BIRD_M0 - Math PreSchool
  'L_1': 'bird5',   // BIRD_L1 - English 1
  'L_2': 'bird4',   // BIRD_L2 - English 2
  'L_3': 'bird3',   // BIRD_L3 - English 3
  'L_4': 'bird6',   // BIRD_L4 - English 4
  'L_5': 'bird7',   // BIRD_L5 - English 5
  'L_6': 'bird13',
  'L_7': 'bird14',
  'L_8': 'bird15',
  'L_9': 'bird16',
  'L_10': 'bird17', // Special Course
  'M_1': 'bird8',   // BIRD_M1 - Math 1
  'M_2': 'bird9',   // BIRD_M2 - Math 2
  'M_3': 'bird11',  // BIRD_M3 - Math 3
  'M_4': 'bird10',  // BIRD_M4 - Math 4
  'M_5': 'bird12',  // BIRD_M5 - Math 5
  'M_6': 'bird18',
  'M_7': 'bird19',
  'M_8': 'bird20',
  'M_9': 'bird21',
  'M_10': 'bird22', // Special Course
}

/**
 * Get the idle bird image path for a given category + categoryLevel.
 */
export function getBirdIdleSrc(category: string, categoryLevel: number): string {
  const key = `${category}_${categoryLevel}`
  const birdFolder = BIRD_TYPE_MAP[key] || 'bird1'
  return assetUrl(`/assets/birdanimation/${birdFolder}_idle.png`)
}

/**
 * Get the egg image path for a given category + categoryLevel.
 */
export function getEggSrc(category: string, categoryLevel: number): string {
  if (categoryLevel === 0) return assetUrl('/assets/birdanimation/coop_egg_english_1.png')
  const type = category === 'M' ? 'math' : 'english'
  const idx = Math.min(categoryLevel, 10) // max 10 egg variants
  return assetUrl(`/assets/birdanimation/coop_egg_${type}_${idx}.png`)
}
