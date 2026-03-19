import { useRef } from 'react'

interface CarouselProps {
  title: string
  children: React.ReactNode
}

export default function Carousel({ title, children }: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Category header - 27sp, #7B7D7A */}
      <h3 style={{
        color: '#7B7D7A',
        fontSize: 22,
        fontWeight: 'normal',
        marginBottom: 4,
        paddingLeft: 4,
      }}>
        {title}
      </h3>
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 4,
          paddingRight: 20,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          height: '38vh',
        }}
      >
        {children}
      </div>
    </div>
  )
}
