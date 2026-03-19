import { useState } from 'react'
import { useCurriculum } from '../context/CurriculumContext'
import BackButton from '../components/BackButton'

export default function AdminPage() {
  const {
    data, loading,
    getLevels,
    isLevelOpen, numDayCleared,
    setLevelOpen, setLevelLocked,
    clearLevel, unlockAllLevels, clearAllLevels, resetProgress,
  } = useCurriculum()

  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  if (loading || !data) {
    return <div style={{ padding: 40, color: '#888' }}>Loading...</div>
  }

  const literacyLevels = getLevels().filter(l => l.category === 'L').sort((a, b) => a.categoryLevel - b.categoryLevel)
  const mathLevels = getLevels().filter(l => l.category === 'M').sort((a, b) => a.categoryLevel - b.categoryLevel)

  const runWithConfirm = (key: string, action: () => void) => {
    if (confirmAction === key) {
      action()
      setConfirmAction(null)
    } else {
      setConfirmAction(key)
      setTimeout(() => setConfirmAction((prev: string | null) => prev === key ? null : prev), 3000)
    }
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#F5F5F5',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 56,
        background: '#546E7A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        zIndex: 10,
      }}>
        <BackButton />
        <span style={{
          color: '#fff', fontSize: 22, fontWeight: 600,
          fontFamily: 'TodoMainCurly, sans-serif',
          letterSpacing: 1,
        }}>
          Admin Panel
        </span>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 24px 32px',
      }}>
        {/* Bulk Actions */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}>
          <BulkButton
            label="Unlock All Levels"
            color="#2196F3"
            isConfirm={confirmAction === 'unlockAll'}
            onClick={() => runWithConfirm('unlockAll', unlockAllLevels)}
          />
          <BulkButton
            label="Clear All Levels"
            color="#4CAF50"
            isConfirm={confirmAction === 'clearAll'}
            onClick={() => runWithConfirm('clearAll', clearAllLevels)}
          />
          <BulkButton
            label="Reset All Progress"
            color="#F44336"
            isConfirm={confirmAction === 'resetAll'}
            onClick={() => runWithConfirm('resetAll', resetProgress)}
          />
        </div>

        {/* Literacy Section */}
        <SectionHeader title="Literacy" color="#FF9800" />
        {literacyLevels.map(level => (
          <LevelRow
            key={level.levelID}
            levelID={level.levelID}
            title={level.levelTitle}
            numDays={level.numDays}
            cleared={numDayCleared(level.levelID)}
            open={isLevelOpen(level.levelID)}
            onToggleOpen={() => isLevelOpen(level.levelID) ? setLevelLocked(level.levelID) : setLevelOpen(level.levelID)}
            onClear={() => clearLevel(level.levelID)}
            confirmAction={confirmAction}
            setConfirmAction={setConfirmAction}
          />
        ))}

        <div style={{ height: 20 }} />

        {/* Math Section */}
        <SectionHeader title="Math" color="#2196F3" />
        {mathLevels.map(level => (
          <LevelRow
            key={level.levelID}
            levelID={level.levelID}
            title={level.levelTitle}
            numDays={level.numDays}
            cleared={numDayCleared(level.levelID)}
            open={isLevelOpen(level.levelID)}
            onToggleOpen={() => isLevelOpen(level.levelID) ? setLevelLocked(level.levelID) : setLevelOpen(level.levelID)}
            onClear={() => clearLevel(level.levelID)}
            confirmAction={confirmAction}
            setConfirmAction={setConfirmAction}
          />
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    }}>
      <div style={{
        width: 6,
        height: 24,
        borderRadius: 3,
        background: color,
      }} />
      <h2 style={{
        color: '#333',
        fontSize: 20,
        fontWeight: 700,
        margin: 0,
        fontFamily: 'TodoMainCurly, sans-serif',
      }}>
        {title}
      </h2>
    </div>
  )
}

function LevelRow({
  levelID, title, numDays, cleared, open,
  onToggleOpen, onClear,
  confirmAction, setConfirmAction,
}: {
  levelID: string
  title: string
  numDays: number
  cleared: number
  open: boolean
  onToggleOpen: () => void
  onClear: () => void
  confirmAction: string | null
  setConfirmAction: (v: string | null) => void
}) {
  const clearKey = `clear_${levelID}`
  const isAllCleared = cleared === numDays

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      marginBottom: 4,
      background: '#fff',
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      {/* Left: icon + name + progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16 }}>
          {open ? '\uD83D\uDD13' : '\uD83D\uDD12'}
        </span>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: open ? '#333' : '#999',
          fontFamily: 'TodoMainCurly, sans-serif',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        <span style={{
          fontSize: 12,
          color: isAllCleared ? '#4CAF50' : '#aaa',
          fontWeight: isAllCleared ? 700 : 400,
        }}>
          {isAllCleared ? 'DONE' : `${cleared}/${numDays}`}
        </span>
      </div>

      {/* Right: buttons */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onToggleOpen}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: open ? '#FFEBEE' : '#E3F2FD',
            color: open ? '#F44336' : '#2196F3',
            border: `1px solid ${open ? '#FFCDD2' : '#BBDEFB'}`,
            cursor: 'pointer',
          }}
        >
          {open ? 'Lock' : 'Open'}
        </button>
        <button
          onClick={() => {
            if (confirmAction === clearKey) {
              onClear()
              setConfirmAction(null)
            } else {
              setConfirmAction(clearKey)
              setTimeout(() => setConfirmAction(null), 3000)
            }
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: confirmAction === clearKey ? '#4CAF50' : (isAllCleared ? '#E8F5E9' : '#FFF8E1'),
            color: confirmAction === clearKey ? '#fff' : (isAllCleared ? '#A5D6A7' : '#FF8F00'),
            border: `1px solid ${confirmAction === clearKey ? '#4CAF50' : (isAllCleared ? '#C8E6C9' : '#FFE082')}`,
            cursor: isAllCleared && confirmAction !== clearKey ? 'default' : 'pointer',
          }}
        >
          {confirmAction === clearKey ? 'OK?' : 'Clear'}
        </button>
      </div>
    </div>
  )
}

function BulkButton({ label, color, isConfirm, onClick }: {
  label: string
  color: string
  isConfirm: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        background: isConfirm ? color : '#fff',
        color: isConfirm ? '#fff' : color,
        border: `2px solid ${color}`,
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.15s',
      }}
    >
      {isConfirm ? `Confirm ${label}?` : label}
    </button>
  )
}
