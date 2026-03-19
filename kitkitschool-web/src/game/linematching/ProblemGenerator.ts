/**
 * LineMatching Problem Generator
 * Converts JSON config files into renderable problems.
 * Handles 3 data patterns:
 *   A: BasicCategory + UseColors (lm_1~6, lm_9)
 *   B: LeftImages/CenterImages/RightImages (lm_7, lm_8, lm_10)
 *   C: Complex UseColors as object (lm_11, lm_12)
 */

import { assetUrl } from '../../utils/assetPath'

export interface GeneratedObject {
  categoryIndex: number   // matching group ID
  normalImage: string     // display image path
  successImage: string    // matched success image path
  column?: 'left' | 'center' | 'right'  // for 3-column mode
}

export interface GeneratedProblem {
  objects: GeneratedObject[]
  mode: 'two-column' | 'three-column'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawSet = any

/** Resolve JSON image path to web asset path */
export function resolveImagePath(jsonPath: string): string {
  if (!jsonPath) return ''
  const stripped = jsonPath.replace(/^LineMatching\/Images\//i, '')
  // Lowercase the entire path — all files on disk are lowercase
  return assetUrl('/assets/games/linematching/images/' + stripped.toLowerCase())
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(arr: T[], count: number): T[] {
  if (count >= arr.length) return shuffleArray(arr)
  const shuffled = shuffleArray(arr)
  return shuffled.slice(0, count)
}

/** Detect which pattern a Set uses */
function detectPattern(set: RawSet): 'A' | 'B' | 'C' {
  if (set.LeftImages || set.CenterImages || set.RightImages) return 'B'
  if (set.UseColors && typeof set.UseColors === 'object' && !Array.isArray(set.UseColors)) return 'C'
  return 'A'
}

/** Pattern A: BasicCategory + UseColors array */
function generatePatternA(set: RawSet, objectCount: number): GeneratedProblem {
  const useObjCount = set.UseObjectCount || 4
  const useColorCount = set.UseColorCount || 1
  const colors: string[] = Array.isArray(set.UseColors) ? set.UseColors : []
  const basic: Array<{nor: string, succ: string}> = set.BasicCategory || []
  const multi: Array<Record<string, string>> = set.MultipleCategory || []
  const essential: Array<{nor: string, succ: string}> = set.EssentialCategory || []
  const isSuccFullPath = set.IsSuccFullPath !== false
  const useRandomCategory = set.UseRandomCategory !== false

  const objects: GeneratedObject[] = []
  let catIdx = 0

  // Essential categories first (guaranteed inclusion)
  for (const ess of essential) {
    const selectedColors = pickRandom(colors, Math.min(2, colors.length))
    for (const color of selectedColors) {
      objects.push({
        categoryIndex: catIdx,
        normalImage: resolveImagePath(ess.nor + color),
        successImage: resolveImagePath(isSuccFullPath ? ess.succ : ess.nor + color),
      })
    }
    catIdx++
  }

  // Multiple categories (direct image paths)
  if (multi.length > 0 && objects.length < objectCount) {
    const selectedMulti = pickRandom(multi, Math.min(useObjCount - catIdx, multi.length))
    for (const mc of selectedMulti) {
      const maxNum = parseInt(mc.maxNum || '1', 10) + 1
      for (let n = 0; n < maxNum && objects.length < objectCount; n++) {
        objects.push({
          categoryIndex: catIdx,
          normalImage: resolveImagePath(mc[String(n)] || ''),
          successImage: resolveImagePath(mc[`succ_${n}`] || mc[String(n)] || ''),
        })
      }
      catIdx++
    }
  }

  // Basic categories
  if (basic.length > 0 && objects.length < objectCount) {
    const remaining = objectCount - objects.length
    const categoriesNeeded = Math.max(1, Math.ceil(remaining / Math.max(1, useColorCount)))
    const selectedBasic = useRandomCategory
      ? pickRandom(basic, Math.min(categoriesNeeded, basic.length))
      : basic.slice(0, categoriesNeeded)

    for (const cat of selectedBasic) {
      if (objects.length >= objectCount) break
      const selectedColors = pickRandom(colors, Math.min(useColorCount, colors.length))
      const objsPerCat = Math.ceil((objectCount - objects.length) / (categoriesNeeded - catIdx + essential.length + (multi.length > 0 ? 1 : 0)))

      for (let c = 0; c < selectedColors.length && objects.length < objectCount; c++) {
        objects.push({
          categoryIndex: catIdx,
          normalImage: resolveImagePath(cat.nor + selectedColors[c]),
          successImage: resolveImagePath(isSuccFullPath ? cat.succ : cat.nor + selectedColors[c]),
        })
      }
      // If we need more objects per category than colors, duplicate with remaining colors
      if (selectedColors.length < objsPerCat) {
        for (let extra = selectedColors.length; extra < objsPerCat && objects.length < objectCount; extra++) {
          const extraColor = colors[extra % colors.length] || colors[0] || ''
          objects.push({
            categoryIndex: catIdx,
            normalImage: resolveImagePath(cat.nor + extraColor),
            successImage: resolveImagePath(isSuccFullPath ? cat.succ : cat.nor + extraColor),
          })
        }
      }
      catIdx++
    }
  }

  // Shuffle positions if requested
  const result = set.LineMatchingRandom ? shuffleArray(objects) : objects
  return { objects: result.slice(0, objectCount), mode: 'two-column' }
}

/** Resolve a color entry — can be string or {nor, succ} object */
function resolveColorSuffix(color: unknown): { nor: string, succ: string } {
  if (typeof color === 'string') return { nor: color, succ: color }
  if (color && typeof color === 'object') {
    const c = color as { nor?: string; succ?: string }
    return { nor: c.nor || '', succ: c.succ || c.nor || '' }
  }
  return { nor: '', succ: '' }
}

/** Pattern B: LeftImages/CenterImages/RightImages (optionally with Colors) */
function generatePatternB(set: RawSet, objectCount: number): GeneratedProblem {
  const useObjCount = set.UseObjectCount || 4
  const leftImages: Array<{nor: string, succ: string}> = set.LeftImages || []
  const centerImages: Array<{nor: string, succ: string}> = set.CenterImages || []
  const rightImages: Array<{nor: string, succ: string}> = set.RightImages || []

  // Colors arrays — if present, image.nor + color = full path
  const leftColors: unknown[] = set.LeftColors || []
  const centerColors: unknown[] = set.CenterColors || []
  const rightColors: unknown[] = set.RightColors || []
  const hasColors = leftColors.length > 0 || centerColors.length > 0 || rightColors.length > 0

  // Select category indices
  const maxObj = set.MaxObjectCount || leftImages.length
  const allIndices = Array.from({length: maxObj}, (_, i) => i)
  const selected = pickRandom(allIndices, Math.min(useObjCount, allIndices.length))

  const objects: GeneratedObject[] = []

  if (hasColors) {
    // Hybrid mode: Images provide prefixes, Colors provide suffixes
    // Each category gets a unique color index
    const maxColor = set.MaxColorCount || Math.max(leftColors.length, centerColors.length, rightColors.length)
    const useColorCount = set.UseColorCount || maxColor
    const colorIndices = Array.from({length: maxColor}, (_, i) => i)
    const selectedColors = pickRandom(colorIndices, Math.min(useColorCount, colorIndices.length))

    for (let i = 0; i < selected.length; i++) {
      const catIdx = selected[i]
      const colorIdx = selectedColors[i % selectedColors.length]

      // Left column
      if (leftImages[catIdx]) {
        const color = leftColors.length > 0 ? resolveColorSuffix(leftColors[colorIdx]) : { nor: '', succ: '' }
        objects.push({
          categoryIndex: catIdx,
          normalImage: resolveImagePath(leftImages[catIdx].nor + color.nor),
          successImage: resolveImagePath(leftImages[catIdx].succ + color.succ),
          column: 'left',
        })
      }
      // Center column
      if (centerImages[catIdx]) {
        const color = centerColors.length > 0 ? resolveColorSuffix(centerColors[colorIdx]) : { nor: '', succ: '' }
        objects.push({
          categoryIndex: catIdx,
          normalImage: resolveImagePath(centerImages[catIdx].nor + color.nor),
          successImage: resolveImagePath(centerImages[catIdx].succ + color.succ),
          column: 'center',
        })
      }
      // Right column
      if (rightImages[catIdx]) {
        const color = rightColors.length > 0 ? resolveColorSuffix(rightColors[colorIdx]) : { nor: '', succ: '' }
        objects.push({
          categoryIndex: catIdx,
          normalImage: resolveImagePath(rightImages[catIdx].nor + color.nor),
          successImage: resolveImagePath(rightImages[catIdx].succ + color.succ),
          column: 'right',
        })
      }
    }
  } else {
    // Pure mode: Images have direct full paths
    for (const idx of selected) {
      if (leftImages[idx]) {
        objects.push({
          categoryIndex: idx,
          normalImage: resolveImagePath(leftImages[idx].nor),
          successImage: resolveImagePath(leftImages[idx].succ),
          column: 'left',
        })
      }
      if (centerImages[idx]) {
        objects.push({
          categoryIndex: idx,
          normalImage: resolveImagePath(centerImages[idx].nor),
          successImage: resolveImagePath(centerImages[idx].succ),
          column: 'center',
        })
      }
      if (rightImages[idx]) {
        objects.push({
          categoryIndex: idx,
          normalImage: resolveImagePath(rightImages[idx].nor),
          successImage: resolveImagePath(rightImages[idx].succ),
          column: 'right',
        })
      }
    }
  }

  // Shuffle within each column
  if (set.LineMatchingRandom) {
    const left = shuffleArray(objects.filter(o => o.column === 'left'))
    const center = shuffleArray(objects.filter(o => o.column === 'center'))
    const right = shuffleArray(objects.filter(o => o.column === 'right'))
    return { objects: [...left, ...center, ...right], mode: 'three-column' }
  }

  return { objects, mode: 'three-column' }
}

/** Pattern C: Complex UseColors (object with per-index arrays) */
function generatePatternC(set: RawSet, objectCount: number): GeneratedProblem {
  // Pattern C is similar to Pattern A but UseColors is an object
  // For simplicity, treat it as Pattern A with a modified color selection
  const basic: Array<{nor: string, succ: string}> = set.BasicCategory || []
  const useObjCount = set.UseObjectCount || 4
  const norSuccSame = set.Nor_Succ_Same !== false
  const useColors = set.UseColors || {}

  const objects: GeneratedObject[] = []
  const selectedBasic = pickRandom(basic, Math.min(useObjCount, basic.length))

  for (let catIdx = 0; catIdx < selectedBasic.length && objects.length < objectCount; catIdx++) {
    const cat = selectedBasic[catIdx]
    // Get colors for this category index
    let catColors: string[] = []
    const colorEntry = useColors[String(catIdx)]
    if (Array.isArray(colorEntry)) {
      catColors = colorEntry
    } else if (colorEntry && typeof colorEntry === 'object') {
      // Color entry with {nor, succ} pairs
      catColors = [colorEntry]
    }

    if (catColors.length === 0) {
      // No colors, use the image directly
      objects.push({
        categoryIndex: catIdx,
        normalImage: resolveImagePath(cat.nor),
        successImage: resolveImagePath(cat.succ),
      })
      objects.push({
        categoryIndex: catIdx,
        normalImage: resolveImagePath(cat.nor),
        successImage: resolveImagePath(cat.succ),
      })
    } else {
      const choice = set.Choice || catColors.length
      const selected = pickRandom(catColors, Math.min(choice, catColors.length))
      for (const color of selected) {
        if (objects.length >= objectCount) break
        if (typeof color === 'string') {
          objects.push({
            categoryIndex: catIdx,
            normalImage: resolveImagePath(cat.nor + color),
            successImage: resolveImagePath(norSuccSame ? cat.succ : cat.nor + color),
          })
        } else if (color && typeof color === 'object') {
          // {nor: "...", succ: "..."}
          const c = color as {nor?: string, succ?: string}
          objects.push({
            categoryIndex: catIdx,
            normalImage: resolveImagePath(cat.nor + (c.nor || '')),
            successImage: resolveImagePath(norSuccSame ? cat.succ : (c.succ ? cat.nor + c.succ : cat.succ)),
          })
        }
      }
    }
  }

  const result = set.LineMatchingRandom ? shuffleArray(objects) : objects
  return { objects: result.slice(0, objectCount), mode: 'two-column' }
}

/** Main generation function */
export function generateProblem(set: RawSet, objectCount: number): GeneratedProblem {
  const pattern = detectPattern(set)
  switch (pattern) {
    case 'B': return generatePatternB(set, objectCount)
    case 'C': return generatePatternC(set, objectCount)
    default: return generatePatternA(set, objectCount)
  }
}

/** Parse a level JSON and extract all set definitions */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLevelSets(data: any): { objectCount: number; problemCount: number; sets: RawSet[] } {
  const objectCount = data.ObjectCount || 8
  const problemCount = data.ProblemCount || 8
  const sets: RawSet[] = []

  for (let i = 0; i < problemCount; i++) {
    const key = `Set_${i}`
    if (data[key]) {
      sets.push(data[key])
    }
  }

  // If fewer sets than problemCount, cycle through available sets
  const baseLen = sets.length
  while (sets.length < problemCount && baseLen > 0) {
    sets.push(sets[sets.length % baseLen])
  }

  return { objectCount, problemCount, sets }
}
