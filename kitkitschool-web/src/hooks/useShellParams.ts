import { useSearchParams, useNavigate } from 'react-router-dom'
import { useCallback, useMemo, useRef } from 'react'
import { useCurriculum } from '../context/CurriculumContext'

/**
 * Hook for shell (launcher) integration in game pages.
 *
 * Reads URL search params set by MainScenePage:
 *   ?level=N&from=shell&levelID=...&day=...&gameIndex=...
 *
 * Returns:
 *   - shellLevel: the level to auto-start (number or null)
 *   - isFromShell: whether we came from the shell
 *   - onGameComplete: call this when the game finishes to mark cleared + navigate back
 *   - shellBack: navigate back to the MainScene (or home)
 */
export function useShellParams() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setGameCleared, checkAndSetDayCleared } = useCurriculum()
  const completedRef = useRef(false)

  const isFromShell = searchParams.get('from') === 'shell'
  const shellLevel = searchParams.get('level') ? parseInt(searchParams.get('level')!, 10) : null
  const levelID = searchParams.get('levelID')
  const day = searchParams.get('day') ? parseInt(searchParams.get('day')!, 10) : null
  const gameIndex = searchParams.get('gameIndex') ? parseInt(searchParams.get('gameIndex')!, 10) : null

  const returnPath = useMemo(() => {
    if (isFromShell && levelID && day !== null) {
      return `/coop/${levelID}/day/${day}`
    }
    return '/'
  }, [isFromShell, levelID, day])

  // Store mutable refs to avoid dependency churn in onGameComplete
  const checkAndSetDayClearedRef = useRef(checkAndSetDayCleared)
  checkAndSetDayClearedRef.current = checkAndSetDayCleared
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const onGameComplete = useCallback(() => {
    if (completedRef.current) return // Guard: only fire once
    if (!isFromShell) {
      // Not from shell — no auto-navigation needed
      return
    }
    if (!levelID || day === null || gameIndex === null) {
      console.error(
        '[useShellParams] onGameComplete called but shell params are missing:',
        { levelID, day, gameIndex }
      )
      completedRef.current = true
      // Navigate home as fallback so the user isn't stuck
      setTimeout(() => navigateRef.current('/'), 1500)
      return
    }
    completedRef.current = true
    setGameCleared(levelID, day, gameIndex)
    // Small delay so the completion overlay is visible, then navigate back
    setTimeout(() => {
      checkAndSetDayClearedRef.current(levelID, day)
      navigateRef.current(returnPath)
    }, 1500)
  }, [isFromShell, levelID, day, gameIndex, setGameCleared, returnPath])

  const shellBack = useCallback(() => {
    navigate(returnPath)
  }, [navigate, returnPath])

  return {
    shellLevel,
    isFromShell,
    onGameComplete,
    shellBack,
    returnPath,
  }
}
