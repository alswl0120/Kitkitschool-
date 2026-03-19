import { useNavigate } from 'react-router-dom'

export default function BackButton({ color = '#fff', onClick }: { color?: string; onClick?: () => void }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={onClick ?? (() => navigate(-1))}
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 100,
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
