interface BookCardProps {
  title: string
  author: string
  thumbnail: string
  onClick: () => void
}

export default function BookCard({ title, author, thumbnail, onClick }: BookCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 180,
        height: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        scrollSnapAlign: 'start',
      }}
    >
      {/* Image area - weight 414/604 (~68.5%) */}
      <div style={{
        width: '100%',
        flex: '0 0 68.5%',
        background: '#fff',
        overflow: 'hidden',
      }}>
        <img
          src={thumbnail}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>
      {/* Title - weight 95, 20sp, #212121 */}
      <div style={{
        flex: '0 0 15.7%',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'flex-end',
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
      {/* Author - weight 95, 16sp, #616161 */}
      <div style={{
        flex: '0 0 15.7%',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'flex-start',
      }}>
        <div style={{
          color: '#616161',
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          width: '100%',
        }}>
          {author}
        </div>
      </div>
    </button>
  )
}
