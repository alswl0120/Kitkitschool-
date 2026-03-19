interface VideoCardProps {
  title: string
  thumbnail: string
  onClick: () => void
}

export default function VideoCard({ title, thumbnail, onClick }: VideoCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 240,
        height: '100%',
        minHeight: 160,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        scrollSnapAlign: 'start',
      }}
    >
      {/* Thumbnail area - weight 414/534 (~77.5%) with play icon overlay */}
      <div style={{
        width: '100%',
        flex: '0 0 77.5%',
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <img
          src={thumbnail}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        {/* Play icon overlay - centered */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
      {/* Title - weight 120, 20sp */}
      <div style={{
        flex: '0 0 22.5%',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <div style={{
          color: '#212121',
          fontSize: 16,
          fontWeight: 'normal',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          width: '100%',
        }}>
          {title}
        </div>
      </div>
    </button>
  )
}
