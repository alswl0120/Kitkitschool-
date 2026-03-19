import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// ─── Types ───────────────────────────────────────────────────────────
export interface GameInfo {
  gameName: string
  gameLevel: number
  gameParam: string
}

export interface DayCurriculum {
  day: number
  numGames: number
  games: GameInfo[]
}

export interface LevelCurriculum {
  levelID: string
  langTag: string
  levelTitle: string
  category: string      // 'L' or 'M'
  categoryLevel: number // 0..11
  numDays: number
  days: DayCurriculum[]
}

export interface CurriculumData {
  levels: LevelCurriculum[]
}

interface ProgressState {
  levelsOpen: Record<string, boolean>
  daysCleared: Record<string, boolean>   // key: `${levelID}__${day}`
  gamesCleared: Record<string, boolean>  // key: `${levelID}__${day}__${gameIndex}`
}

interface CurriculumContextValue {
  data: CurriculumData | null
  loading: boolean

  // Query helpers
  getLevel: (levelID: string) => LevelCurriculum | undefined
  getLevels: (langTag?: string) => LevelCurriculum[]

  // Progress state
  isLevelOpen: (levelID: string) => boolean
  isDayCleared: (levelID: string, day: number) => boolean
  isGameCleared: (levelID: string, day: number, gameIndex: number) => boolean
  numDayCleared: (levelID: string) => number
  ratioDayCleared: (levelID: string) => number

  // Progress mutations
  setLevelOpen: (levelID: string) => void
  setLevelLocked: (levelID: string) => void
  setGameCleared: (levelID: string, day: number, gameIndex: number) => void
  checkAndSetDayCleared: (levelID: string, day: number) => boolean
  clearLevel: (levelID: string) => void
  unlockAllLevels: () => void
  clearAllLevels: () => void
  resetProgress: () => void
}

const CurriculumContext = createContext<CurriculumContextValue | null>(null)

const STORAGE_KEY = 'kitkitschool_progress'

function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { levelsOpen: {}, daysCleared: {}, gamesCleared: {} }
}

function saveProgress(state: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ─── Provider ────────────────────────────────────────────────────────

export function CurriculumProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CurriculumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<ProgressState>(loadProgress)

  // Load curriculum data
  useEffect(() => {
    fetch('/data/curriculum.json')
      .then(r => r.json())
      .then((d: CurriculumData) => {
        setData(d)
        // Auto-open all levels
        setProgress(prev => {
          const next = { ...prev, levelsOpen: { ...prev.levelsOpen } }
          for (const level of d.levels) {
            next.levelsOpen[level.levelID] = true
          }
          saveProgress(next)
          return next
        })
      })
      .catch(err => console.error('Failed to load curriculum:', err))
      .finally(() => setLoading(false))
  }, [])

  // Persist progress on change
  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  const getLevel = useCallback((levelID: string) => {
    return data?.levels.find(l => l.levelID === levelID)
  }, [data])

  const getLevels = useCallback((langTag = 'en-US') => {
    return data?.levels.filter(l => l.langTag === langTag) ?? []
  }, [data])

  const isLevelOpen = useCallback((levelID: string) => {
    return !!progress.levelsOpen[levelID]
  }, [progress])

  const isDayCleared = useCallback((levelID: string, day: number) => {
    return !!progress.daysCleared[`${levelID}__${day}`]
  }, [progress])

  const isGameCleared = useCallback((levelID: string, day: number, gameIndex: number) => {
    return !!progress.gamesCleared[`${levelID}__${day}__${gameIndex}`]
  }, [progress])

  const numDayCleared = useCallback((levelID: string) => {
    const level = data?.levels.find(l => l.levelID === levelID)
    if (!level) return 0
    let count = 0
    for (let d = 1; d <= level.numDays; d++) {
      if (progress.daysCleared[`${levelID}__${d}`]) count++
    }
    return count
  }, [data, progress])

  const ratioDayCleared = useCallback((levelID: string) => {
    const level = data?.levels.find(l => l.levelID === levelID)
    if (!level || level.numDays === 0) return 0
    const cleared = numDayCleared(levelID)
    return cleared / level.numDays
  }, [data, numDayCleared])

  const setLevelOpen = useCallback((levelID: string) => {
    setProgress(prev => ({
      ...prev,
      levelsOpen: { ...prev.levelsOpen, [levelID]: true },
    }))
  }, [])

  const setGameCleared = useCallback((levelID: string, day: number, gameIndex: number) => {
    setProgress(prev => ({
      ...prev,
      gamesCleared: {
        ...prev.gamesCleared,
        [`${levelID}__${day}__${gameIndex}`]: true,
      },
    }))
  }, [])

  const checkAndSetDayCleared = useCallback((levelID: string, day: number) => {
    const level = data?.levels.find(l => l.levelID === levelID)
    if (!level) return false
    const dayCur = level.days.find(d => d.day === day)
    if (!dayCur) return false

    // Use functional update to read latest progress inside setProgress
    // This avoids depending on `progress` in the useCallback deps,
    // which would cause reference churn → infinite loops in consumers.
    let wasCleared = false
    setProgress(prev => {
      // Check all games cleared using prev (latest state)
      for (let i = 0; i < dayCur.numGames; i++) {
        if (!prev.gamesCleared[`${levelID}__${day}__${i}`]) return prev // no change
      }

      wasCleared = true
      const next = {
        ...prev,
        daysCleared: { ...prev.daysCleared, [`${levelID}__${day}`]: true },
      }

      // Check if all days cleared → open next level
      const allDaysCleared = level.days.every(
        d => next.daysCleared[`${levelID}__${d.day}`]
      )
      if (allDaysCleared && level.numDays > 0) {
        // Find and open the next level in same category
        const sameCatLevels = data!.levels
          .filter(l => l.category === level.category && l.langTag === level.langTag)
          .sort((a, b) => a.categoryLevel - b.categoryLevel)
        const idx = sameCatLevels.findIndex(l => l.levelID === levelID)
        if (idx >= 0 && idx < sameCatLevels.length - 1) {
          const nextLevel = sameCatLevels[idx + 1]
          next.levelsOpen = { ...next.levelsOpen, [nextLevel.levelID]: true }
        }
      }

      return next
    })
    return wasCleared
  }, [data])

  const setLevelLocked = useCallback((levelID: string) => {
    setProgress(prev => {
      const next = { ...prev, levelsOpen: { ...prev.levelsOpen } }
      delete next.levelsOpen[levelID]
      return next
    })
  }, [])

  const clearLevel = useCallback((levelID: string) => {
    const level = data?.levels.find(l => l.levelID === levelID)
    if (!level) return
    setProgress(prev => {
      const next = {
        ...prev,
        levelsOpen: { ...prev.levelsOpen, [levelID]: true },
        daysCleared: { ...prev.daysCleared },
        gamesCleared: { ...prev.gamesCleared },
      }
      for (const dayCur of level.days) {
        next.daysCleared[`${levelID}__${dayCur.day}`] = true
        for (let i = 0; i < dayCur.numGames; i++) {
          next.gamesCleared[`${levelID}__${dayCur.day}__${i}`] = true
        }
      }
      // Auto-open next level in same category
      const sameCatLevels = data!.levels
        .filter(l => l.category === level.category && l.langTag === level.langTag)
        .sort((a, b) => a.categoryLevel - b.categoryLevel)
      const idx = sameCatLevels.findIndex(l => l.levelID === levelID)
      if (idx >= 0 && idx < sameCatLevels.length - 1) {
        next.levelsOpen[sameCatLevels[idx + 1].levelID] = true
      }
      return next
    })
  }, [data])

  const unlockAllLevels = useCallback(() => {
    if (!data) return
    setProgress(prev => {
      const next = { ...prev, levelsOpen: { ...prev.levelsOpen } }
      for (const level of data.levels) {
        next.levelsOpen[level.levelID] = true
      }
      return next
    })
  }, [data])

  const clearAllLevels = useCallback(() => {
    if (!data) return
    setProgress(prev => {
      const next = {
        ...prev,
        levelsOpen: { ...prev.levelsOpen },
        daysCleared: { ...prev.daysCleared },
        gamesCleared: { ...prev.gamesCleared },
      }
      for (const level of data.levels) {
        next.levelsOpen[level.levelID] = true
        for (const dayCur of level.days) {
          next.daysCleared[`${level.levelID}__${dayCur.day}`] = true
          for (let i = 0; i < dayCur.numGames; i++) {
            next.gamesCleared[`${level.levelID}__${dayCur.day}__${i}`] = true
          }
        }
      }
      return next
    })
  }, [data])

  const resetProgress = useCallback(() => {
    const fresh: ProgressState = { levelsOpen: {}, daysCleared: {}, gamesCleared: {} }
    // Re-open PreSchool and Level 1
    if (data) {
      for (const level of data.levels) {
        if (level.categoryLevel >= 0) {
          fresh.levelsOpen[level.levelID] = true
        }
      }
    }
    setProgress(fresh)
    saveProgress(fresh)
  }, [data])

  return (
    <CurriculumContext.Provider value={{
      data, loading,
      getLevel, getLevels,
      isLevelOpen, isDayCleared, isGameCleared,
      numDayCleared, ratioDayCleared,
      setLevelOpen, setLevelLocked, setGameCleared, checkAndSetDayCleared,
      clearLevel, unlockAllLevels, clearAllLevels, resetProgress,
    }}>
      {children}
    </CurriculumContext.Provider>
  )
}

export function useCurriculum() {
  const ctx = useContext(CurriculumContext)
  if (!ctx) throw new Error('useCurriculum must be used within CurriculumProvider')
  return ctx
}
