import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { ALL_ITEMS, GACHA_COST, MAX_COOP_DECOS, weightedRandom } from '../data/customizationItems'

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

export interface EquippedAccessories {
  head: string | null
  face: string | null
  neck: string | null
  wings: string | null
  effect: string | null
}

interface ProgressState {
  levelsOpen: Record<string, boolean>
  daysCleared: Record<string, boolean>
  gamesCleared: Record<string, boolean>
  stars: number
  unlockedThemes: string[]
  equippedTheme: string
  // Customization
  playerXP: number
  inventory: string[]
  equippedAccessories: EquippedAccessories
  coopDecorations: string[]
}

const DEFAULT_EQUIPPED: EquippedAccessories = { head: null, face: null, neck: null, wings: null, effect: null }

interface CurriculumContextValue {
  data: CurriculumData | null
  loading: boolean

  getLevel: (levelID: string) => LevelCurriculum | undefined
  getLevels: (langTag?: string) => LevelCurriculum[]

  isLevelOpen: (levelID: string) => boolean
  isDayCleared: (levelID: string, day: number) => boolean
  isGameCleared: (levelID: string, day: number, gameIndex: number) => boolean
  numDayCleared: (levelID: string) => number
  ratioDayCleared: (levelID: string) => number

  totalStars: number
  addStars: (n: number) => void

  // Dashboard themes
  unlockedThemes: string[]
  equippedTheme: string
  purchaseTheme: (themeId: string, cost: number) => boolean
  equipTheme: (themeId: string) => void

  // Customization
  playerXP: number
  inventory: string[]
  equippedAccessories: EquippedAccessories
  coopDecorations: string[]
  buyItem: (itemId: string) => boolean
  gachaPull: () => string | null
  equipAccessory: (slot: keyof EquippedAccessories, itemId: string | null) => void
  toggleCoopDeco: (itemId: string) => void

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
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        stars: 0,
        unlockedThemes: ['default'],
        equippedTheme: 'default',
        playerXP: 0,
        inventory: [],
        equippedAccessories: DEFAULT_EQUIPPED,
        coopDecorations: [],
        ...parsed,
      }
    }
  } catch { /* ignore */ }
  return {
    levelsOpen: {}, daysCleared: {}, gamesCleared: {},
    stars: 0, unlockedThemes: ['default'], equippedTheme: 'default',
    playerXP: 0, inventory: [], equippedAccessories: DEFAULT_EQUIPPED, coopDecorations: [],
  }
}

function saveProgress(state: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ─── Provider ────────────────────────────────────────────────────────

export function CurriculumProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CurriculumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<ProgressState>(loadProgress)

  // Keep a ref for sync reads in gacha/buy
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])

  useEffect(() => {
    fetch('/data/curriculum.json')
      .then(r => r.json())
      .then((d: CurriculumData) => {
        setData(d)
        setProgress(prev => {
          const next = { ...prev, levelsOpen: { ...prev.levelsOpen } }
          for (const level of d.levels) next.levelsOpen[level.levelID] = true
          saveProgress(next)
          return next
        })
      })
      .catch(err => console.error('Failed to load curriculum:', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { saveProgress(progress) }, [progress])

  const getLevel = useCallback((levelID: string) => data?.levels.find(l => l.levelID === levelID), [data])
  const getLevels = useCallback((langTag = 'en-US') => data?.levels.filter(l => l.langTag === langTag) ?? [], [data])
  const isLevelOpen = useCallback((levelID: string) => !!progress.levelsOpen[levelID], [progress])
  const isDayCleared = useCallback((levelID: string, day: number) => !!progress.daysCleared[`${levelID}__${day}`], [progress])
  const isGameCleared = useCallback((levelID: string, day: number, gi: number) => !!progress.gamesCleared[`${levelID}__${day}__${gi}`], [progress])

  const numDayCleared = useCallback((levelID: string) => {
    const level = data?.levels.find(l => l.levelID === levelID)
    if (!level) return 0
    let count = 0
    for (let d = 1; d <= level.numDays; d++) if (progress.daysCleared[`${levelID}__${d}`]) count++
    return count
  }, [data, progress])

  const ratioDayCleared = useCallback((levelID: string) => {
    const level = data?.levels.find(l => l.levelID === levelID)
    if (!level || level.numDays === 0) return 0
    return numDayCleared(levelID) / level.numDays
  }, [data, numDayCleared])

  const addStars = useCallback((n: number) => {
    setProgress(prev => ({
      ...prev,
      stars: (prev.stars ?? 0) + n,
      playerXP: (prev.playerXP ?? 0) + n * 3,
    }))
  }, [])

  const purchaseTheme = useCallback((themeId: string, cost: number): boolean => {
    let success = false
    setProgress(prev => {
      if ((prev.stars ?? 0) < cost) return prev
      if ((prev.unlockedThemes ?? ['default']).includes(themeId)) return prev
      success = true
      return { ...prev, stars: (prev.stars ?? 0) - cost, unlockedThemes: [...(prev.unlockedThemes ?? []), themeId], equippedTheme: themeId }
    })
    return success
  }, [])

  const equipTheme = useCallback((themeId: string) => {
    setProgress(prev => ({ ...prev, equippedTheme: themeId }))
  }, [])

  // ── Customization ─────────────────────────────────────────────────

  const buyItem = useCallback((itemId: string): boolean => {
    const item = ALL_ITEMS.find(i => i.id === itemId)
    if (!item || item.cost === 0) return false
    const prev = progressRef.current
    if ((prev.stars ?? 0) < item.cost) return false
    if ((prev.inventory ?? []).includes(itemId)) return false
    setProgress(p => ({
      ...p,
      stars: (p.stars ?? 0) - item.cost,
      inventory: [...(p.inventory ?? []), itemId],
    }))
    return true
  }, [])

  const gachaPull = useCallback((): string | null => {
    const prev = progressRef.current
    if ((prev.stars ?? 0) < GACHA_COST) return null
    const owned = new Set(prev.inventory ?? [])
    const available = ALL_ITEMS.filter(i => !owned.has(i.id))
    if (available.length === 0) return null
    const winner = weightedRandom(available)
    if (!winner) return null
    setProgress(p => ({
      ...p,
      stars: (p.stars ?? 0) - GACHA_COST,
      inventory: [...(p.inventory ?? []), winner.id],
    }))
    return winner.id
  }, [])

  const equipAccessory = useCallback((slot: keyof EquippedAccessories, itemId: string | null) => {
    setProgress(prev => ({
      ...prev,
      equippedAccessories: { ...(prev.equippedAccessories ?? DEFAULT_EQUIPPED), [slot]: itemId },
    }))
  }, [])

  const toggleCoopDeco = useCallback((itemId: string) => {
    setProgress(prev => {
      const decos = prev.coopDecorations ?? []
      if (decos.includes(itemId)) {
        return { ...prev, coopDecorations: decos.filter(d => d !== itemId) }
      }
      if (decos.length >= MAX_COOP_DECOS) return prev
      return { ...prev, coopDecorations: [...decos, itemId] }
    })
  }, [])

  // ── Progress mutations ─────────────────────────────────────────────

  const setLevelOpen = useCallback((levelID: string) => {
    setProgress(prev => ({ ...prev, levelsOpen: { ...prev.levelsOpen, [levelID]: true } }))
  }, [])

  const setGameCleared = useCallback((levelID: string, day: number, gameIndex: number) => {
    setProgress(prev => ({
      ...prev,
      gamesCleared: { ...prev.gamesCleared, [`${levelID}__${day}__${gameIndex}`]: true },
    }))
  }, [])

  const checkAndSetDayCleared = useCallback((levelID: string, day: number) => {
    const level = data?.levels.find(l => l.levelID === levelID)
    if (!level) return false
    const dayCur = level.days.find(d => d.day === day)
    if (!dayCur) return false
    let wasCleared = false
    setProgress(prev => {
      for (let i = 0; i < dayCur.numGames; i++) {
        if (!prev.gamesCleared[`${levelID}__${day}__${i}`]) return prev
      }
      wasCleared = true
      const next = { ...prev, daysCleared: { ...prev.daysCleared, [`${levelID}__${day}`]: true } }
      const allDaysCleared = level.days.every(d => next.daysCleared[`${levelID}__${d.day}`])
      if (allDaysCleared && level.numDays > 0) {
        const sameCatLevels = data!.levels
          .filter(l => l.category === level.category && l.langTag === level.langTag)
          .sort((a, b) => a.categoryLevel - b.categoryLevel)
        const idx = sameCatLevels.findIndex(l => l.levelID === levelID)
        if (idx >= 0 && idx < sameCatLevels.length - 1) {
          next.levelsOpen = { ...next.levelsOpen, [sameCatLevels[idx + 1].levelID]: true }
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
      const next = { ...prev, levelsOpen: { ...prev.levelsOpen, [levelID]: true }, daysCleared: { ...prev.daysCleared }, gamesCleared: { ...prev.gamesCleared } }
      for (const dayCur of level.days) {
        next.daysCleared[`${levelID}__${dayCur.day}`] = true
        for (let i = 0; i < dayCur.numGames; i++) next.gamesCleared[`${levelID}__${dayCur.day}__${i}`] = true
      }
      const sameCatLevels = data!.levels.filter(l => l.category === level.category && l.langTag === level.langTag).sort((a, b) => a.categoryLevel - b.categoryLevel)
      const idx = sameCatLevels.findIndex(l => l.levelID === levelID)
      if (idx >= 0 && idx < sameCatLevels.length - 1) next.levelsOpen[sameCatLevels[idx + 1].levelID] = true
      return next
    })
  }, [data])

  const unlockAllLevels = useCallback(() => {
    if (!data) return
    setProgress(prev => {
      const next = { ...prev, levelsOpen: { ...prev.levelsOpen } }
      for (const level of data.levels) next.levelsOpen[level.levelID] = true
      return next
    })
  }, [data])

  const clearAllLevels = useCallback(() => {
    if (!data) return
    setProgress(prev => {
      const next = { ...prev, levelsOpen: { ...prev.levelsOpen }, daysCleared: { ...prev.daysCleared }, gamesCleared: { ...prev.gamesCleared } }
      for (const level of data.levels) {
        next.levelsOpen[level.levelID] = true
        for (const dayCur of level.days) {
          next.daysCleared[`${level.levelID}__${dayCur.day}`] = true
          for (let i = 0; i < dayCur.numGames; i++) next.gamesCleared[`${level.levelID}__${dayCur.day}__${i}`] = true
        }
      }
      return next
    })
  }, [data])

  const resetProgress = useCallback(() => {
    const fresh: ProgressState = {
      levelsOpen: {}, daysCleared: {}, gamesCleared: {},
      stars: 0, unlockedThemes: ['default'], equippedTheme: 'default',
      playerXP: 0, inventory: [], equippedAccessories: DEFAULT_EQUIPPED, coopDecorations: [],
    }
    if (data) {
      for (const level of data.levels) if (level.categoryLevel >= 0) fresh.levelsOpen[level.levelID] = true
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
      totalStars: progress.stars ?? 0,
      addStars,
      unlockedThemes: progress.unlockedThemes ?? ['default'],
      equippedTheme: progress.equippedTheme ?? 'default',
      purchaseTheme, equipTheme,
      playerXP: progress.playerXP ?? 0,
      inventory: progress.inventory ?? [],
      equippedAccessories: progress.equippedAccessories ?? DEFAULT_EQUIPPED,
      coopDecorations: progress.coopDecorations ?? [],
      buyItem, gachaPull, equipAccessory, toggleCoopDeco,
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
