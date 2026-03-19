import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import BackButton from '../components/BackButton'
import VideoCard from '../components/VideoCard'

interface BookData {
  id: string
  category: string
  categoryName: string
  title: string
  author: string
  thumbnail: string
  foldername: string
}

interface VideoData {
  id: string
  category: string
  categoryName: string
  title: string
  thumbnail: string
  url: string
  filename?: string
}

const emptyBooks: BookData[] = []
const emptyVideos: VideoData[] = []

export default function LibraryPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'videos' | 'books'>('videos')
  const [books, setBooks] = useState<BookData[]>(emptyBooks)
  const [videos, setVideos] = useState<VideoData[]>(emptyVideos)

  useEffect(() => {
    fetch('/data/library_books.json')
      .then(r => r.json())
      .then(data => setBooks(data))
      .catch(() => {})

    fetch('/data/library_videos.json')
      .then(r => r.json())
      .then(data => setVideos(data))
      .catch(() => {})
  }, [])

  // Group by category (preserving order)
  const bookCategories = useMemo(() => {
    const cats = new Map<string, { name: string; items: BookData[] }>()
    for (const book of books) {
      if (!cats.has(book.category)) {
        cats.set(book.category, { name: book.categoryName, items: [] })
      }
      cats.get(book.category)!.items.push(book)
    }
    return cats
  }, [books])

  const videoCategories = useMemo(() => {
    const cats = new Map<string, { name: string; items: VideoData[] }>()
    for (const video of videos) {
      if (!cats.has(video.category)) {
        cats.set(video.category, { name: video.categoryName, items: [] })
      }
      cats.get(video.category)!.items.push(video)
    }
    return cats
  }, [videos])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#F5F5F5',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header - matching original blue toolbar "Kitkit Library" */}
      <div style={{
        height: 56,
        background: '#1D9DE2',
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
          color: '#fff', fontSize: 24, fontWeight: 'normal',
          fontFamily: 'TodoMainCurly, sans-serif',
        }}>
          Kitkit Library
        </span>
      </div>

      {/* Tab Bar - VIDEOS / BOOKS matching original */}
      <div style={{
        display: 'flex',
        background: '#fff',
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
        zIndex: 9,
      }}>
        <TabButton label="VIDEOS" active={tab === 'videos'} onClick={() => setTab('videos')} />
        <TabButton label="BOOKS" active={tab === 'books'} onClick={() => setTab('books')} />
      </div>

      {/* Content Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 0 32px',
        background: '#F5F5F5',
      }}>
        {tab === 'videos' ? (
          [...videoCategories.entries()].map(([key, { name, items }]) => (
            <CategoryRow key={key} title={name} rowHeight={196}>
              {items.map(video => (
                <VideoCard
                  key={video.id}
                  title={video.title}
                  thumbnail={video.thumbnail}
                  onClick={() => {
                    if (video.url) {
                      navigate(`/video/${video.id}?url=${encodeURIComponent(video.url)}&title=${encodeURIComponent(video.title)}`)
                    } else if (video.filename) {
                      navigate(`/video/${video.id}?url=${encodeURIComponent(assetUrl('/assets/videos/' + video.filename))}&title=${encodeURIComponent(video.title)}`)
                    }
                  }}
                />
              ))}
            </CategoryRow>
          ))
        ) : (
          [...bookCategories.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key, { name, items }]) => (
            <CategoryRow key={key} title={name} rowHeight={220}>
              {items.map(book => (
                <LibraryBookCard
                  key={book.id}
                  book={book}
                  onClick={() => navigate(`/book/${book.foldername}`)}
                />
              ))}
            </CategoryRow>
          ))
        )}
      </div>
    </div>
  )
}

// ── Category Row with horizontal scroll (matching original carousel layout) ──
function CategoryRow({ title, children, rowHeight = 196 }: {
  title: string
  children: React.ReactNode
  rowHeight?: number
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Category header */}
      <h3 style={{
        color: '#546E7A',
        fontSize: 18,
        fontWeight: 600,
        margin: '0 0 8px 24px',
        fontFamily: 'TodoMainCurly, sans-serif',
      }}>
        {title}
      </h3>
      {/* Horizontal scroll row — explicit height so cards fill correctly */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 12,
        height: rowHeight,
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingLeft: 24,
        paddingBottom: 6,
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        /* thin scrollbar on desktop so users know they can scroll */
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,0,0,0.2) transparent',
      }}>
        {children}
        {/* Trailing spacer — ensures right-padding works in all browsers */}
        <div style={{ flexShrink: 0, width: 24 }} />
      </div>
    </div>
  )
}

// Palette for placeholder covers — cycles through categories
const COVER_COLORS = ['#6BAED6','#74C476','#FD8D3C','#9E9AC8','#FC9272','#41AB5D','#2171B5','#A63603']

// ── Book Card matching original design (cover image + title below) ──
function LibraryBookCard({ book, onClick }: { book: BookData; onClick: () => void }) {
  const [imgState, setImgState] = useState<'loading' | 'ok' | 'fallback' | 'placeholder'>('loading')

  // Step 1: try thumbnail; step 2: try title page; step 3: show colored placeholder
  const src =
    imgState === 'loading' ? book.thumbnail
    : imgState === 'fallback'
      ? assetUrl(`/assets/books/${book.foldername}/page/book_${book.foldername}_page_0.png`)
      : book.thumbnail

  // Derive a stable color from foldername
  const colorIdx = book.foldername.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % COVER_COLORS.length
  const placeholderColor = COVER_COLORS[colorIdx]

  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 140,
        borderRadius: 6,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        scrollSnapAlign: 'start',
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.03)'
        e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.25)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)'
      }}
    >
      {/* Cover image area */}
      <div style={{
        width: '100%',
        aspectRatio: '3 / 4',
        background: imgState === 'placeholder' ? placeholderColor : '#F0EDE8',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {imgState === 'placeholder' ? (
          // Colorful book-spine placeholder with first letter
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%', gap: 8,
          }}>
            <div style={{ fontSize: 40 }}>📖</div>
            <div style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 11, fontWeight: 700,
              textAlign: 'center', padding: '0 8px',
              lineHeight: 1.2,
            }}>
              {book.title.slice(0, 20)}
            </div>
          </div>
        ) : (
          <img
            src={src}
            alt={book.title}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              display: imgState === 'ok' || imgState === 'fallback' ? 'block' : 'block',
            }}
            onLoad={() => setImgState('ok')}
            onError={() => {
              if (imgState === 'loading') setImgState('fallback')
              else setImgState('placeholder')
            }}
          />
        )}
      </div>
      {/* Title area */}
      <div style={{
        padding: '6px 8px',
        minHeight: 38,
        display: 'flex',
        alignItems: 'center',
      }}>
        <div style={{
          color: '#333',
          fontSize: 12,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.3,
          textAlign: 'left',
          width: '100%',
        }}>
          {book.title}
        </div>
      </div>
    </button>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 0',
        color: active ? '#1D9DE2' : '#90A4AE',
        fontSize: 15,
        fontWeight: active ? 700 : 500,
        letterSpacing: 1,
        borderBottom: active ? '3px solid #1D9DE2' : '3px solid transparent',
        transition: 'all 0.2s',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  )
}
