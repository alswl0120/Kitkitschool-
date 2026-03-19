/**
 * Finds the closest available level to the target level.
 * If exact match exists, returns it. Otherwise returns the nearest.
 */
export function findClosestLevel<T extends { level: number }>(
  levels: T[],
  target: number
): T | undefined {
  if (!levels.length) return undefined
  const exact = levels.find(l => l.level === target)
  if (exact) return exact
  // Find closest
  return levels.reduce((prev, curr) =>
    Math.abs(curr.level - target) < Math.abs(prev.level - target) ? curr : prev
  )
}

/**
 * For dict-format data (levels keyed by string).
 * Returns the value for the closest level key.
 */
export function findClosestDictLevel<T>(
  levels: Record<string, T>,
  target: number
): T | undefined {
  const keys = Object.keys(levels).map(Number).filter(n => !isNaN(n))
  if (!keys.length) return undefined
  if (levels[String(target)] !== undefined) return levels[String(target)]
  const closest = keys.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  )
  return levels[String(closest)]
}
