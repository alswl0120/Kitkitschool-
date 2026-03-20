import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import BackButton from '../components/BackButton'
import VideoCard from '../components/VideoCard'
import { gameRouteMap } from '../data/gameRouteMap'

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

interface GameEntry {
  gameName: string
  gameLevel: number
  route: string
}

interface GameTopic {
  id: string
  label: string
  gameNames: string[]
}

// Static topic definitions — order determines display order
const LITERACY_TOPICS: GameTopic[] = [
  {
    id: 'letters',
    label: 'Letters & Phonics',
    gameNames: ['LetterMatching', 'AlphabetPuzzle', 'AnimalPuzzle', 'BirdPhonics', 'SoundTrain'],
  },
  {
    id: 'words',
    label: 'Words & Spelling',
    gameNames: ['WordMachine', 'Spelling', 'OldSpelling', 'StarFall', 'WordKicker', 'WordMatrix', 'WordNote'],
  },
  {
    id: 'reading',
    label: 'Reading & Comprehension',
    gameNames: ['Labeling', 'WhatIsThis', 'SentenceMaker', 'SentenceBridge', 'LRComprehension', 'ReadingBird', 'Comprehension', 'CompMatching'],
  },
  {
    id: 'writing',
    label: 'Writing & Tracing',
    gameNames: ['TutorialTrace', 'LetterTrace', 'LetterTracingCard', 'WordTracing'],
  },
]

const MATH_TOPICS: GameTopic[] = [
  {
    id: 'counting',
    label: 'Numbers & Counting',
    gameNames: ['Tapping', 'FindTheMatch', 'NumberMatching', 'NumberPuzzle', 'NumberTracing', 'NumberTracingExt', 'Counting', 'MovingInsects', 'HundredPuzzle', 'NumberTrain', 'Keypad', '100chickens'],
  },
  {
    id: 'addsub',
    label: 'Addition & Subtraction',
    gameNames: ['EquationMaker', 'DoubleDigit', 'MissingNumber', 'MathKicker', 'FishTank', 'FeedingTime', 'MangoShop', 'QuickFacts', 'PlaceValue', 'MultiplicationBoard', 'ThirtyPuzzle'],
  },
  {
    id: 'shapes',
    label: 'Shapes & Patterns',
    gameNames: ['ShapeMatching', 'AirShapes', 'PatternTrain', 'WordWindow', 'WoodenPuzzle'],
  },
  {
    id: 'comparing',
    label: 'Comparing & Ordering',
    gameNames: ['LineMatching', 'EqualsGreatLess', 'BigSmall', 'Count10', 'Crown'],
  },
]

// Display metadata for each game type
// iconFile: filename under /assets/icons/, or null to skip (no icon shown)
const GAME_META: Record<string, { name: string; iconFile: string | null; color: string }> = {
  TutorialTrace:      { name: 'Tutorial Trace',    iconFile: 'game_icon_tutorialtrace.png',      color: '#78909C' },
  LetterMatching:     { name: 'Letter Matching',   iconFile: 'game_icon_lettermatching.png',     color: '#29B6F6' },
  AnimalPuzzle:       { name: 'Animal Puzzle',     iconFile: 'game_icon_animalpuzzle.png',       color: '#FFA000' },
  AlphabetPuzzle:     { name: 'Alphabet Puzzle',   iconFile: 'game_icon_alphabetpuzzle.png',     color: '#8D6E63' },
  LetterTrace:        { name: 'Letter Trace',      iconFile: 'game_icon_lettertrace.png',        color: '#FF7043' },
  LetterTracingCard:  { name: 'Letter Trace',      iconFile: 'game_icon_lettertracingcard.png',  color: '#FF7043' },
  WordMachine:        { name: 'Word Machine',      iconFile: 'game_icon_wordmachine.png',        color: '#78909C' },
  Spelling:           { name: 'Spelling',          iconFile: 'game_icon_spelling.png',           color: '#66BB6A' },
  OldSpelling:        { name: 'Old Spelling',      iconFile: 'game_icon_spelling.png',           color: '#8D6E63' },
  StarFall:           { name: 'Star Fall',         iconFile: 'game_icon_starfall.png',           color: '#FFEE58' },
  SentenceMaker:      { name: 'Sentence Maker',    iconFile: 'game_icon_sentencemaker.png',      color: '#4DB6AC' },
  Comprehension:      { name: 'Comprehension',     iconFile: 'game_icon_comprehension.png',      color: '#7986CB' },
  WordTracing:        { name: 'Word Trace',        iconFile: 'game_icon_wordtracing.png',        color: '#5C6BC0' },
  SoundTrain:         { name: 'Sound Train',       iconFile: 'game_icon_soundtrain.png',         color: '#FF8A65' },
  WordMatrix:         { name: 'Word Matrix',       iconFile: 'game_icon_wordmatrix.png',         color: '#4CAF50' },
  WordNote:           { name: 'Word Note',         iconFile: 'game_icon_wordnote.png',           color: '#29B6F6' },
  BirdPhonics:        { name: 'Bird Phonics',      iconFile: 'game_icon_birdphonics.png',        color: '#81D4FA' },
  WordKicker:         { name: 'Word Kicker',       iconFile: 'game_icon_wordkicker.png',         color: '#4CAF50' },
  Labeling:           { name: 'Labeling',          iconFile: 'game_icon_labeling.png',           color: '#FF7043' },
  WordWindow:         { name: 'Word Window',       iconFile: 'game_icon_wordwindow.png',         color: '#7986CB' },
  WhatIsThis:         { name: 'What Is This?',     iconFile: 'game_icon_whatisthis.png',         color: '#42A5F5' },
  ReadingBird:        { name: 'Reading Bird',      iconFile: 'game_icon_readingbird.png',        color: '#26C6DA' },
  SentenceBridge:     { name: 'Sentence Bridge',   iconFile: 'game_icon_sentencebridge.png',     color: '#4DB6AC' },
  LRComprehension:    { name: 'LR Comprehension',  iconFile: 'game_icon_lrcomprehension.png',    color: '#7986CB' },
  CompMatching:       { name: 'Comp Matching',     iconFile: 'game_icon_comprehension.png',      color: '#7986CB' },
  Tapping:            { name: 'Tapping',           iconFile: 'game_icon_tapping.png',            color: '#4CAF50' },
  NumberMatching:     { name: 'Number Matching',   iconFile: 'game_icon_numbermatching.png',     color: '#26A69A' },
  FindTheMatch:       { name: 'Find The Match',    iconFile: 'game_icon_findthematch.png',       color: '#EF5350' },
  PatternTrain:       { name: 'Pattern Train',     iconFile: 'game_icon_patterntrain.png',       color: '#FF8A65' },
  NumberPuzzle:       { name: 'Number Puzzle',     iconFile: 'game_icon_numberpuzzle.png',       color: '#5C6BC0' },
  NumberTracing:      { name: 'Number Trace',      iconFile: 'game_icon_numbertracing.png',      color: '#AB47BC' },
  NumberTracingExt:   { name: 'Number Trace+',     iconFile: 'game_icon_numbertraceext.png',     color: '#AB47BC' },
  LineMatching:       { name: 'Line Matching',     iconFile: 'game_icon_linematching.png',       color: '#FF8A65' },
  Counting:           { name: 'Counting',          iconFile: 'game_icon_counting.png',           color: '#FFA726' },
  MovingInsects:      { name: 'Moving Insects',    iconFile: 'game_icon_movinginsects.png',      color: '#9CCC65' },
  HundredPuzzle:      { name: 'Hundred Puzzle',    iconFile: 'game_icon_hundredpuzzle.png',      color: '#26C6DA' },
  WoodenPuzzle:       { name: 'Wooden Puzzles',    iconFile: null,                               color: '#A1887F' },
  EquationMaker:      { name: 'Equation Maker',    iconFile: 'game_icon_equationmaker.png',      color: '#EC407A' },
  FishTank:           { name: 'Fish Tank',         iconFile: 'game_icon_fishtank.png',           color: '#42A5F5' },
  DoubleDigit:        { name: 'Double Digit',      iconFile: 'game_icon_doubledigit.png',        color: '#7E57C2' },
  DigitalQuiz:        { name: 'Digital Quiz',      iconFile: null,                               color: '#4DD0E1' },
  MissingNumber:      { name: 'Missing Number',    iconFile: 'game_icon_missingnumber.png',      color: '#81D4FA' },
  NumberTrain:        { name: 'Number Train',      iconFile: 'game_icon_numbertrain.png',        color: '#FFA726' },
  MathKicker:         { name: 'Math Kicker',       iconFile: 'game_icon_mathkicker.png',         color: '#EF5350' },
  MangoShop:          { name: 'Mango Shop',        iconFile: 'game_icon_mangoshop.png',          color: '#FFA000' },
  ShapeMatching:      { name: 'Shape Matching',    iconFile: 'game_icon_shapematching.png',      color: '#26A69A' },
  FeedingTime:        { name: 'Feeding Time',      iconFile: 'game_icon_feedingtime.png',        color: '#66BB6A' },
  BigSmall:           { name: 'Big & Small',       iconFile: 'game_icon_bigsmall.png',           color: '#29B6F6' },
  Crown:              { name: 'Crown',             iconFile: 'game_icon_crown.png',              color: '#FFEE58' },
  Keypad:             { name: 'Keypad',            iconFile: 'game_icon_keypad.png',             color: '#5C6BC0' },
  Count10:            { name: 'Count to 10',       iconFile: 'game_icon_count10.png',            color: '#26A69A' },
  AirShapes:          { name: 'Air Shapes',        iconFile: 'game_icon_airshapes.png',          color: '#29B6F6' },
  EqualsGreatLess:    { name: '= > <',             iconFile: 'game_icon_equalsgreatless.png',    color: '#7E57C2' },
  '100chickens':      { name: '100 Chickens',      iconFile: 'game_icon_100chickens.png',        color: '#FFA726' },
  '30puzzle':         { name: '30 Puzzle',         iconFile: 'game_icon_30puzzle.png',           color: '#FF7043' },
  ThirtyPuzzle:       { name: '30 Puzzle',         iconFile: 'game_icon_thirtypuzzle.png',       color: '#FF7043' },
  MultiplicationBoard:{ name: 'Multiplication',    iconFile: 'game_icon_multiplicationboard.png',color: '#7986CB' },
  QuickFacts:         { name: 'Quick Facts',       iconFile: 'game_icon_quickfacts.png',         color: '#EF5350' },
  PlaceValue:         { name: 'Place Value',       iconFile: 'game_icon_placevalue.png',         color: '#4DB6AC' },
}

const emptyBooks: BookData[] = []
const emptyVideos: VideoData[] = []

export default function LibraryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as 'videos' | 'books' | 'games') ?? 'videos'
  const setTab = (t: 'videos' | 'books' | 'games') => setSearchParams({ tab: t }, { replace: true })
  const [books, setBooks] = useState<BookData[]>(emptyBooks)
  const [videos, setVideos] = useState<VideoData[]>(emptyVideos)
  const [gameCache, setGameCache] = useState<Record<string, GameEntry[]>>({})
  const [levelModal, setLevelModal] = useState<{ gameName: string; entries: GameEntry[] } | null>(null)

  useEffect(() => {
    fetch('/data/library_books.json')
      .then(r => r.json())
      .then(data => setBooks(data))
      .catch(() => {})

    fetch('/data/library_videos.json')
      .then(r => r.json())
      .then(data => setVideos(data))
      .catch(() => {})

    fetch('/data/curriculum.json')
      .then(r => r.json())
      .then(data => {
        const cache: Record<string, GameEntry[]> = {}
        const skipGames = new Set(['Video', 'Book', 'BookWithQuiz', 'EggQuiz', 'EggQuizLiteracy', 'EggQuizMath'])

        for (const level of data.levels as Array<{
          days: Array<{ games: Array<{ gameName: string; gameLevel: number }> }>
        }>) {
          for (const day of level.days) {
            for (const g of day.games) {
              if (skipGames.has(g.gameName)) continue
              const route = gameRouteMap[g.gameName]
              if (!route) continue
              if (!cache[g.gameName]) cache[g.gameName] = []
              // Deduplicate by gameLevel
              if (cache[g.gameName].some(e => e.gameLevel === g.gameLevel)) continue
              cache[g.gameName].push({ gameName: g.gameName, gameLevel: g.gameLevel, route: `${route}?level=${g.gameLevel}` })
            }
          }
        }

        // Sort levels ascending within each game
        for (const entries of Object.values(cache)) {
          entries.sort((a, b) => a.gameLevel - b.gameLevel)
        }

        setGameCache(cache)
      })
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

      {/* Tab Bar - VIDEOS / BOOKS / GAMES */}
      <div style={{
        display: 'flex',
        background: '#fff',
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
        zIndex: 9,
      }}>
        <TabButton label="VIDEOS" active={tab === 'videos'} onClick={() => setTab('videos')} />
        <TabButton label="BOOKS" active={tab === 'books'} onClick={() => setTab('books')} />
        <TabButton label="GAMES" active={tab === 'games'} onClick={() => setTab('games')} />
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
        ) : tab === 'books' ? (
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
        ) : (
          <GamesTab
            gameCache={gameCache}
            onGameCardClick={(gameName, entries) => {
              if (entries.length === 1) {
                navigate(entries[0].route)
              } else {
                setLevelModal({ gameName, entries })
              }
            }}
          />
        )}
      </div>

      {/* Level selection modal */}
      {levelModal && (
        <LevelModal
          gameName={levelModal.gameName}
          entries={levelModal.entries}
          onSelect={(route) => { setLevelModal(null); navigate(route) }}
          onClose={() => setLevelModal(null)}
        />
      )}
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

// ── Games Tab ────────────────────────────────────────────────────────────────
function GamesTab({ gameCache, onGameCardClick }: {
  gameCache: Record<string, GameEntry[]>
  onGameCardClick: (gameName: string, entries: GameEntry[]) => void
}) {
  return (
    <div>
      {/* Literacy Section */}
      <SectionHeader label="Literacy" color="#1D9DE2" />
      {LITERACY_TOPICS.map(topic => {
        const games = topic.gameNames.filter(n => gameCache[n]?.length > 0)
        if (games.length === 0) return null
        return (
          <CategoryRow key={topic.id} title={topic.label} rowHeight={220}>
            {games.map(name => (
              <GameCard key={name} gameName={name} levelCount={gameCache[name].length} onClick={() => onGameCardClick(name, gameCache[name])} />
            ))}
          </CategoryRow>
        )
      })}

      {/* Math Section */}
      <SectionHeader label="Math" color="#E64A19" />
      {MATH_TOPICS.map(topic => {
        const games = topic.gameNames.filter(n => gameCache[n]?.length > 0)
        if (games.length === 0) return null
        return (
          <CategoryRow key={topic.id} title={topic.label} rowHeight={220}>
            {games.map(name => (
              <GameCard key={name} gameName={name} levelCount={gameCache[name].length} onClick={() => onGameCardClick(name, gameCache[name])} />
            ))}
          </CategoryRow>
        )
      })}
    </div>
  )
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '28px 24px 24px',
    }}>
      <div style={{ width: 4, height: 22, background: color, borderRadius: 2 }} />
      <span style={{
        fontSize: 26,
        fontWeight: 700,
        color,
        fontFamily: 'TodoMainCurly, sans-serif',
        letterSpacing: 0.5,
      }}>
        {label}
      </span>
    </div>
  )
}

function GameCard({ gameName, levelCount, onClick }: { gameName: string; levelCount: number; onClick: () => void }) {
  const meta = GAME_META[gameName] ?? { name: gameName, iconFile: null, color: '#607D8B' }

  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 160,
        background: 'none',
        border: 'none',
        padding: 0,
        scrollSnapAlign: 'start',
        cursor: 'pointer',
        transition: 'transform 0.15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Icon area */}
        <div style={{
          width: '100%',
          aspectRatio: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F5F7FA',
          padding: 12,
          boxSizing: 'border-box',
        }}>
          {meta.iconFile ? (
            <img
              src={assetUrl('/assets/icons/' + meta.iconFile)}
              alt={meta.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: 52 }}>🎮</span>
          )}
        </div>
        {/* Name area */}
        <div style={{
          width: '100%',
          padding: '8px 10px',
          background: '#fff',
          boxSizing: 'border-box',
          borderTop: '1px solid #EEF0F3',
        }}>
          <span style={{
            display: 'block',
            color: '#333',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.3,
            wordBreak: 'break-word',
          }}>
            {meta.name}
          </span>
        </div>
      </div>
      {/* Level badge */}
      {levelCount > 1 && (
        <div style={{
          position: 'absolute',
          top: 6,
          right: 6,
          background: '#1D9DE2',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          borderRadius: 10,
          padding: '2px 7px',
          lineHeight: 1.6,
        }}>
          {levelCount}
        </div>
      )}
    </button>
  )
}

// ── Level Selection Modal ─────────────────────────────────────────────────────
function LevelModal({ gameName, entries, onSelect, onClose }: {
  gameName: string
  entries: GameEntry[]
  onSelect: (route: string) => void
  onClose: () => void
}) {
  const meta = GAME_META[gameName] ?? { name: gameName, iconFile: null, color: '#607D8B' }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '24px 20px 20px',
          width: '88%',
          maxWidth: 400,
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {meta.iconFile && (
            <img src={assetUrl('/assets/icons/' + meta.iconFile)} alt={meta.name}
              style={{ width: 52, height: 52, objectFit: 'contain' }} />
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#333', fontFamily: 'TodoMainCurly, sans-serif' }}>
              {meta.name}
            </div>
            <div style={{ fontSize: 12, color: '#90A4AE', marginTop: 2 }}>
              {entries.length} level{entries.length > 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', background: '#F0F4F8', border: 'none',
              borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
              fontSize: 16, color: '#546E7A', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Level grid — scrollable */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
            gap: 8,
          }}>
            {entries.map((e) => (
              <button
                key={e.gameLevel}
                onClick={() => onSelect(e.route)}
                style={{
                  padding: '10px 4px',
                  background: '#1D9DE2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e2) => { (e2.currentTarget as HTMLButtonElement).style.background = '#1580BB' }}
                onMouseLeave={(e2) => { (e2.currentTarget as HTMLButtonElement).style.background = '#1D9DE2' }}
              >
                {e.gameLevel}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
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
