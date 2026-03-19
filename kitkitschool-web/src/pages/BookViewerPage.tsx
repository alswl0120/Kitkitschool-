import { useState, useEffect, useCallback, useRef } from 'react'
import { assetUrl } from '../utils/assetPath'
import { useParams, useNavigate } from 'react-router-dom'
import type { Book, Sentence, Word, Credit } from '../book/types'
import { parseBookInfoCSV, parseCreditTxt, parseBookData, type BookJSON } from '../book/BookReader'
import { useShellParams } from '../hooks/useShellParams'

// ── Library book metadata (from library_books.json) ──
interface LibraryBookMeta {
  id: string
  category: string
  categoryName: string
  title: string
  author: string
  thumbnail: string
  foldername: string
}

/** Parse "Written by: X Illustrated by: Y" style author string */
function parseAuthorString(author: string): { writtenBy?: string; illustratedBy?: string } {
  const wMatch = author.match(/Written by:\s*([^I]+?)(?:\s*Illustrated by:|$)/i)
  const iMatch = author.match(/Illustrated by:\s*(.+?)$/i)
  return {
    writtenBy: wMatch?.[1]?.trim() || undefined,
    illustratedBy: iMatch?.[1]?.trim() || undefined,
  }
}

const ALPHABET_WORDS: Record<string, { sentence: string; examples: string[] }> = {
  a: { sentence: 'A is for ant.', examples: ['Ant', 'Apple', 'Arm', 'Anchor'] },
  b: { sentence: 'B is for ball.', examples: ['Ball', 'Bear', 'Bird', 'Banana'] },
  c: { sentence: 'C is for cat.', examples: ['Cat', 'Car', 'Cap', 'Cake'] },
  d: { sentence: 'D is for dog.', examples: ['Dog', 'Drum', 'Door', 'Duck'] },
  e: { sentence: 'E is for egg.', examples: ['Egg', 'Ear', 'Elephant', 'Elbow'] },
  f: { sentence: 'F is for fish.', examples: ['Fish', 'Fly', 'Fan', 'Flag'] },
  g: { sentence: 'G is for goat.', examples: ['Goat', 'Girl', 'Game', 'Grass'] },
  h: { sentence: 'H is for hat.', examples: ['Hat', 'Hen', 'Hand', 'Horse'] },
  i: { sentence: 'I is for insect.', examples: ['Insect', 'Ink', 'Island', 'Igloo'] },
  j: { sentence: 'J is for jar.', examples: ['Jar', 'Juice', 'Jaguar', 'Jump'] },
  k: { sentence: 'K is for kite.', examples: ['King', 'Kite', 'Key', 'Kangaroo'] },
  l: { sentence: 'L is for lion.', examples: ['Lion', 'Lamp', 'Leaf', 'Lemon'] },
  m: { sentence: 'M is for moon.', examples: ['Man', 'Map', 'Moon', 'Monkey'] },
  n: { sentence: 'N is for nest.', examples: ['Nest', 'Net', 'Nose', 'Nut'] },
  o: { sentence: 'O is for owl.', examples: ['Orange', 'Ox', 'Owl', 'Octopus'] },
  p: { sentence: 'P is for pig.', examples: ['Pig', 'Pen', 'Pot', 'Parrot'] },
  q: { sentence: 'Q is for queen.', examples: ['Queen', 'Quail', 'Quiet', 'Quilt'] },
  r: { sentence: 'R is for rabbit.', examples: ['Rat', 'Rope', 'Ring', 'Rabbit'] },
  s: { sentence: 'S is for sun.', examples: ['Sun', 'Sea', 'Sand', 'Snake'] },
  t: { sentence: 'T is for tree.', examples: ['Tree', 'Top', 'Tent', 'Tiger'] },
  u: { sentence: 'U is for umbrella.', examples: ['Umbrella', 'Uncle', 'Under', 'Up'] },
  v: { sentence: 'V is for van.', examples: ['Van', 'Vase', 'Vine', 'Violin'] },
  w: { sentence: 'W is for wind.', examples: ['Web', 'Wind', 'Wing', 'Wolf'] },
  x: { sentence: 'X is for xylophone.', examples: ['Xylophone', 'Fox', 'Box', 'Ox'] },
  y: { sentence: 'Y is for yak.', examples: ['Yak', 'Yarn', 'Yell', 'Yellow'] },
  z: { sentence: 'Z is for zebra.', examples: ['Zebra', 'Zero', 'Zip', 'Zoo'] },
}

/** Build a minimal Book from library metadata when no asset files are available */
function createSyntheticBook(meta: LibraryBookMeta): import('../book/types').Book {
  const { writtenBy, illustratedBy } = parseAuthorString(meta.author)
  const makeSentence = (text: string): import('../book/types').Paragraph => ({
    sentences: [{
      words: text.split(' ').map(w => ({ text: w, startTime: 0, endTime: 0 })),
      audioFile: undefined,
    }],
  })

  // Alphabet books: en_a, en_b … en_z
  const letterMatch = meta.id.match(/^en_([a-z])$/)
  if (letterMatch) {
    const letter = letterMatch[1]
    const upper = letter.toUpperCase()
    const data = ALPHABET_WORDS[letter]!
    return {
      title: `Letter ${upper}`,
      layout: 'portrait',
      hasAudio: false,
      fontSize: 28,
      pages: [
        { pageNumber: 0, paragraphs: [] },
        { pageNumber: 1, paragraphs: [makeSentence(data.sentence)] },
        {
          pageNumber: 2,
          paragraphs: data.examples.slice(0, 2).map(w =>
            makeSentence(`${w} starts with ${upper}.`)
          ),
        },
        {
          pageNumber: 3,
          paragraphs: data.examples.slice(2).map(w =>
            makeSentence(`${w} starts with ${upper}.`)
          ),
        },
        {
          pageNumber: 4,
          paragraphs: [makeSentence(`Can you find more ${upper} words?`)],
        },
      ],
    }
  }

  return {
    title: meta.title,
    layout: 'portrait',
    hasAudio: false,
    fontSize: 22,
    credit: {
      writtenBy,
      illustratedBy,
      license: 'Content from KitKit School by Enuma, Inc.',
    },
    pages: [
      { pageNumber: 0, paragraphs: [] },
      {
        pageNumber: 1,
        paragraphs: [
          makeSentence(`"${meta.title}"`),
          makeSentence('This book is part of the KitKit School library.'),
          makeSentence('The original illustrated pages and audio narration require the full KitKit School asset package.'),
        ],
      },
      {
        pageNumber: 2,
        paragraphs: [
          ...(writtenBy ? [makeSentence(`Written by: ${writtenBy}`)] : []),
          ...(illustratedBy ? [makeSentence(`Illustrated by: ${illustratedBy}`)] : []),
          makeSentence(`Category: ${meta.categoryName}`),
        ],
      },
    ],
  }
}

// C++ constants from BookPageSpace
const TEXT_COLOR = '#4F3D18' // Color3B(79, 61, 24)
const HIGHLIGHT_COLOR = '#FF0000' // Color3B::RED
const PAGE_BG_COLOR = '#FFFEF7' // cream/paper color

// C++ page turn constants
const TURN_DURATION = 250 // ms
const TITLE_AUDIO_DELAY = 1000 // ms - C++ viewTitle(1.0)
const POST_TURN_AUDIO_DELAY = 500 // ms - C++ _timePage starts at -0.5

export default function BookViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isFromShell, onGameComplete, shellBack } = useShellParams()
  const [book, setBook] = useState<Book | null>(null)
  const [credit, setCredit] = useState<Credit | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [highlightSentence, setHighlightSentence] = useState(-1)
  const [highlightWord, setHighlightWord] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [turnAnim, setTurnAnim] = useState<'none' | 'fold-right' | 'unfold-left' | 'fold-left' | 'unfold-right'>('none')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<number>(0)
  const wordAudioRef = useRef<HTMLAudioElement | null>(null)
  const pausedForWordRef = useRef(false)
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bookBasePath = assetUrl(`/assets/books/${id}`)

  // Load book data + credit.
  // Strategy:
  //   0. Alphabet books (en_a..en_z) — built-in, no fetch needed
  //   1. Try bookinfo.csv (original C++ format)
  //   2. Try /data/books/<id>.json (lightweight JSON)
  //   3. Try bookinfo.json alongside assets
  //   4. Try library_books.json metadata → synthetic book
  useEffect(() => {
    if (!id) return
    setLoading(true)

    const tryJson = (url: string): Promise<Book> =>
      fetch(url, { cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error(`Not found: ${url}`); return r.json() })
        .then((data: BookJSON) => parseBookData(data))

    const loadBook: Promise<Book> = fetch(`${bookBasePath}/bookinfo.csv`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('No CSV'); return r.text() })
      .then(csv => parseBookInfoCSV(csv, id))
      .catch(() => tryJson(`/data/books/${id}.json`))
      .catch(() => tryJson(`${bookBasePath}/bookinfo.json`))

    const loadCredit = fetch(`${bookBasePath}/credit.txt`, { cache: 'no-store' })
      .then(r => { if (!r.ok) return null; return r.text() })
      .then(txt => txt ? parseCreditTxt(txt) : null)
      .catch(() => null)

    Promise.all([loadBook, loadCredit])
      .then(([parsed, cred]) => {
        setBook(parsed)
        setCredit(cred)
        setLoading(false)
      })
      .catch(async () => {
        // Last resort: build a synthetic book from library_books.json metadata
        try {
          const lib: LibraryBookMeta[] = await fetch('/data/library_books.json', { cache: 'no-store' }).then(r => r.json())
          const meta = lib.find(b => b.id === id)
          if (meta) {
            setBook(createSyntheticBook(meta))
          }
        } catch {
          // Nothing available — will show "Book Not Available"
        }
        setLoading(false)
      })
  }, [id, bookBasePath])

  // Total pages: book pages + 1 credit page
  const totalPages = book ? book.pages.length + (credit ? 1 : 0) : 0
  const isCreditPage = credit && currentPage === (book?.pages.length ?? 0)
  const isTitle = currentPage === 0

  // Mark game complete when user reaches the last page (credit page or final content page)
  useEffect(() => {
    if (isFromShell && book && totalPages > 0 && currentPage >= totalPages - 1) {
      onGameComplete()
    }
  }, [currentPage, totalPages, isFromShell, book, onGameComplete])

  // ── Audio Control ──
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (wordAudioRef.current) {
      wordAudioRef.current.pause()
      wordAudioRef.current = null
    }
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current)
      timerRef.current = 0
    }
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current)
      autoPlayTimerRef.current = null
    }
    pausedForWordRef.current = false
    setHighlightSentence(-1)
    setHighlightWord(-1)
    setIsPlaying(false)
  }, [])

  // Play all sentences on current page sequentially (C++ timing-based auto-play)
  const playPage = useCallback(() => {
    if (!book || isPlaying) return
    const page = book.pages[currentPage]
    if (!page) return

    const sentences: { sentence: Sentence; idx: number }[] = []
    let globalIdx = 0
    for (const para of page.paragraphs) {
      for (const s of para.sentences) {
        sentences.push({ sentence: s, idx: globalIdx })
        globalIdx++
      }
    }
    if (sentences.length === 0) return

    let i = 0
    setIsPlaying(true)

    const playNext = () => {
      if (i >= sentences.length) { stopAudio(); return }
      const { sentence, idx } = sentences[i]
      if (!sentence.audioFile) { i++; playNext(); return }

      const audio = new Audio(`${bookBasePath}/page/${sentence.audioFile}`)
      audioRef.current = audio
      setHighlightSentence(idx)

      const updateHighlight = () => {
        if (!audioRef.current || pausedForWordRef.current) return
        const t = audioRef.current.currentTime
        let found = false
        for (let wi = 0; wi < sentence.words.length; wi++) {
          const w = sentence.words[wi]
          if (t >= w.startTime && t < w.endTime) {
            setHighlightWord(wi)
            found = true
            break
          }
        }
        if (!found) setHighlightWord(-1)
        timerRef.current = requestAnimationFrame(updateHighlight)
      }

      audio.onplay = () => { timerRef.current = requestAnimationFrame(updateHighlight) }
      audio.onended = () => {
        cancelAnimationFrame(timerRef.current)
        setHighlightSentence(-1)
        setHighlightWord(-1)
        i++
        playNext()
      }
      audio.onerror = () => { i++; playNext() }
      audio.play().catch(() => { i++; playNext() })
    }
    playNext()
  }, [book, currentPage, isPlaying, bookBasePath, stopAudio])

  // Auto-play title audio with 1s delay (C++ viewTitle(1.0))
  const playTitleAudio = useCallback(() => {
    if (!book?.titleAudioFile || !book.hasAudio) return
    autoPlayTimerRef.current = setTimeout(() => {
      const audio = new Audio(`${bookBasePath}/page/${book.titleAudioFile}`)
      audioRef.current = audio
      setIsPlaying(true)
      audio.onended = () => stopAudio()
      audio.onerror = () => stopAudio()
      audio.play().catch(() => stopAudio())
    }, TITLE_AUDIO_DELAY)
  }, [book, bookBasePath, stopAudio])

  // Auto-play page narration after turn (C++ startReading with 0.5s delay)
  const autoPlayPageAudio = useCallback(() => {
    if (!book?.hasAudio) return
    autoPlayTimerRef.current = setTimeout(() => {
      playPage()
    }, POST_TURN_AUDIO_DELAY)
  }, [book, playPage])

  // Play title audio on first load
  useEffect(() => {
    if (book && currentPage === 0) {
      playTitleAudio()
    }
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }
  }, [book]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Word Click: tap individual word to hear it (C++ wordButton handler) ──
  const playWordAudio = useCallback((word: Word) => {
    if (!word.audioFile) return

    // Word audio is always in common/word/ directory (C++ uses book/word/ but web uses shared)
    const audioPath = assetUrl(`/assets/books/common/word/${word.audioFile}`)

    // Pause sentence narration
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      pausedForWordRef.current = true
    }

    // Stop previous word audio
    if (wordAudioRef.current) {
      wordAudioRef.current.pause()
      wordAudioRef.current = null
    }

    const audio = new Audio(audioPath)
    wordAudioRef.current = audio
    audio.onended = () => {
      wordAudioRef.current = null
      // Resume sentence narration after word audio (C++ _pauseReading)
      if (pausedForWordRef.current && audioRef.current) {
        audioRef.current.play().catch(() => {})
        pausedForWordRef.current = false
      }
    }
    audio.onerror = () => {
      wordAudioRef.current = null
      // Resume even if word audio fails
      if (pausedForWordRef.current && audioRef.current) {
        audioRef.current.play().catch(() => {})
        pausedForWordRef.current = false
      }
    }
    audio.play().catch(() => {
      // Resume on play failure
      if (pausedForWordRef.current && audioRef.current) {
        audioRef.current.play().catch(() => {})
        pausedForWordRef.current = false
      }
    })
  }, [bookBasePath])

  // ── Page Turn with curl-like animation (C++ BookPage scaleX+skewY) ──
  const goNext = useCallback(() => {
    if (currentPage < totalPages - 1 && turnAnim === 'none') {
      stopAudio()
      // Phase 1: fold right half of current page
      setTurnAnim('fold-right')
      setTimeout(() => {
        setCurrentPage(p => p + 1)
        // Phase 2: unfold left half of new page
        setTurnAnim('unfold-left')
        setTimeout(() => {
          setTurnAnim('none')
        }, TURN_DURATION)
      }, TURN_DURATION)
    }
  }, [currentPage, totalPages, stopAudio, turnAnim])

  const goPrev = useCallback(() => {
    if (currentPage > 0 && turnAnim === 'none') {
      stopAudio()
      // Phase 1: fold left half of current page
      setTurnAnim('fold-left')
      setTimeout(() => {
        setCurrentPage(p => p - 1)
        // Phase 2: unfold right half of new page
        setTurnAnim('unfold-right')
        setTimeout(() => {
          setTurnAnim('none')
        }, TURN_DURATION)
      }, TURN_DURATION)
    }
  }, [currentPage, stopAudio, turnAnim])

  // Auto-play audio after page turn completes
  useEffect(() => {
    if (!book || turnAnim !== 'none') return
    if (currentPage === 0) return // title already handled separately
    if (isCreditPage) return
    if (book.hasAudio) {
      autoPlayPageAudio()
    }
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }
  }, [currentPage, turnAnim]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  // Cleanup on unmount
  useEffect(() => stopAudio, [stopAudio])

  // ── Page turn CSS transform ──
  const getPageTransform = (): React.CSSProperties => {
    switch (turnAnim) {
      case 'fold-right':
        return {
          transformOrigin: 'left center',
          animation: `foldRight ${TURN_DURATION}ms ease-out forwards`,
        }
      case 'unfold-left':
        return {
          transformOrigin: 'left center',
          animation: `unfoldLeft ${TURN_DURATION}ms ease-in forwards`,
        }
      case 'fold-left':
        return {
          transformOrigin: 'right center',
          animation: `foldLeft ${TURN_DURATION}ms ease-out forwards`,
        }
      case 'unfold-right':
        return {
          transformOrigin: 'right center',
          animation: `unfoldRight ${TURN_DURATION}ms ease-in forwards`,
        }
      default:
        return {}
    }
  }

  const bgImage = book?.layout === 'landscape'
    ? assetUrl('/assets/books/common/book_horizontal_bg.jpg')
    : assetUrl('/assets/books/common/book_vertical_bg.jpg')

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: '#1a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: '#FFF0DE', fontSize: 22, fontFamily: 'TodoMainCurly, sans-serif' }}>
          Loading...
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: '#1a1a2e',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 64 }}>📚</div>
        <div style={{ color: '#FFF0DE', fontSize: 24, fontWeight: 'bold' }}>
          Book Not Available
        </div>
        <div style={{ color: '#AAA', fontSize: 15, maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
          The book assets for <strong style={{ color: '#FFD580' }}>"{id}"</strong> could not be loaded.
          Please make sure the book files are placed at{' '}
          <code style={{ background: '#333', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
            public/assets/books/{id}/
          </code>
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginTop: 12, padding: '10px 28px', borderRadius: 10,
            background: '#1D9DE2', color: '#fff',
            fontSize: 16, fontWeight: 'bold',
            boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
          }}
        >
          ← Go Back
        </button>
      </div>
    )
  }

  const page = !isCreditPage ? book.pages[currentPage] : null

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundImage: `url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#3a2a1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
    }}>
      {/* CSS keyframes for page turn */}
      <style>{`
        @keyframes foldRight {
          from { transform: perspective(1200px) rotateY(0deg) scaleX(1); opacity: 1; }
          to   { transform: perspective(1200px) rotateY(-90deg) scaleX(0.5); opacity: 0.3; }
        }
        @keyframes unfoldLeft {
          from { transform: perspective(1200px) rotateY(90deg) scaleX(0.5); opacity: 0.3; }
          to   { transform: perspective(1200px) rotateY(0deg) scaleX(1); opacity: 1; }
        }
        @keyframes foldLeft {
          from { transform: perspective(1200px) rotateY(0deg) scaleX(1); opacity: 1; }
          to   { transform: perspective(1200px) rotateY(90deg) scaleX(0.5); opacity: 0.3; }
        }
        @keyframes unfoldRight {
          from { transform: perspective(1200px) rotateY(-90deg) scaleX(0.5); opacity: 0.3; }
          to   { transform: perspective(1200px) rotateY(0deg) scaleX(1); opacity: 1; }
        }
      `}</style>

      {/* Back Button */}
      <button
        onClick={() => { stopAudio(); isFromShell ? shellBack() : navigate(-1) }}
        style={{
          position: 'absolute',
          top: 20, left: 20, zIndex: 100,
          width: 48, height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', top: 8, left: '50%',
        transform: 'translateX(-50%)',
        width: '30%', height: 6,
        background: 'rgba(255,255,255,0.2)',
        borderRadius: 3, zIndex: 50,
      }}>
        <div style={{
          width: `${((currentPage + 1) / totalPages) * 100}%`,
          height: '100%',
          background: 'rgba(255,255,255,0.7)',
          borderRadius: 3,
          transition: 'width 0.25s',
        }} />
      </div>

      {/* Book container */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%',
        padding: '48px 16px 16px',
        position: 'relative',
      }}>
        {/* Page with turn animation */}
        <div style={{
          flex: 1,
          maxWidth: book.layout === 'landscape' ? 1000 : 700,
          height: '100%',
          background: PAGE_BG_COLOR,
          borderRadius: 4,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: book.layout === 'portrait' && !isTitle && !isCreditPage ? 'row' : (book.layout === 'landscape' ? 'row' : 'column'),
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          ...getPageTransform(),
        }}>
          {/* Previous arrow - overlaid on left edge */}
          <button
            onClick={goPrev}
            disabled={currentPage === 0 || turnAnim !== 'none'}
            style={{
              position: 'absolute',
              left: -4, top: '50%', transform: 'translateY(-50%)',
              width: 40, height: 160,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 20,
              opacity: currentPage > 0 ? 0.8 : 0,
              transition: 'opacity 0.2s',
            }}
          >
            <img
              src={assetUrl('/assets/books/common/book_arrow_left_normal.png')}
              alt="Previous"
              style={{ width: 20, objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const parent = e.currentTarget.parentElement!
                parent.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="rgba(120,80,40,0.6)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
              }}
            />
          </button>

          {/* Next arrow - overlaid on right edge */}
          <button
            onClick={goNext}
            disabled={currentPage >= totalPages - 1 || turnAnim !== 'none'}
            style={{
              position: 'absolute',
              right: -4, top: '50%', transform: 'translateY(-50%)',
              width: 40, height: 160,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 20,
              opacity: currentPage < totalPages - 1 ? 0.8 : 0,
              transition: 'opacity 0.2s',
            }}
          >
            <img
              src={assetUrl('/assets/books/common/book_arrow_right_normal.png')}
              alt="Next"
              style={{ width: 20, objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const parent = e.currentTarget.parentElement!
                parent.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(120,80,40,0.6)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
              }}
            />
          </button>
          {isCreditPage ? (
            <CreditPage credit={credit!} title={book.title} />
          ) : isTitle ? (
            <TitlePage page={page!} book={book} bookBasePath={bookBasePath} />
          ) : book.layout === 'portrait' ? (
            // Portrait: C++ left=image, right=text (two-page spread)
            <PortraitPageContent
              page={page!}
              book={book}
              bookBasePath={bookBasePath}
              highlightSentence={highlightSentence}
              highlightWord={highlightWord}
              onWordClick={playWordAudio}
              currentPage={currentPage}
              totalPages={totalPages}
            />
          ) : (
            // Landscape: image top, text bottom
            <LandscapePageContent
              page={page!}
              book={book}
              bookBasePath={bookBasePath}
              highlightSentence={highlightSentence}
              highlightWord={highlightWord}
              onWordClick={playWordAudio}
              currentPage={currentPage}
              totalPages={totalPages}
            />
          )}

          {/* Play/Stop button (not on title or credit) */}
          {!isTitle && !isCreditPage && book.hasAudio && (
            <button
              onClick={isPlaying ? stopAudio : playPage}
              style={{
                position: 'absolute',
                bottom: 10, left: 16,
                width: 36, height: 36,
                borderRadius: '50%',
                background: isPlaying ? '#e74c3c' : '#1D9DE2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                zIndex: 10,
              }}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="#fff">
                  <rect x="3" y="2" width="4" height="12" rx="1"/>
                  <rect x="9" y="2" width="4" height="12" rx="1"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="#fff">
                  <path d="M4 2l10 6-10 6V2z"/>
                </svg>
              )}
            </button>
          )}

          {/* Page number (not on credit) */}
          {!isCreditPage && (
            <div style={{
              position: 'absolute', bottom: 10, right: 16,
              fontSize: 13, color: '#999', zIndex: 10,
            }}>
              {currentPage + 1} / {book.pages.length}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Book image with automatic .png ↔ .jpg fallback.
 *  Uses React state so the fallback survives re-renders without conflict.
 *  Pass key={src} at the call-site to reset state when the page changes.
 */
function BookImage({ src, alt, imgStyle }: {
  src: string
  alt: string
  imgStyle?: React.CSSProperties
}) {
  const [activeSrc, setActiveSrc] = useState(src)
  const [failed, setFailed] = useState(false)
  const triedAltRef = useRef(false)

  if (failed) return null

  return (
    <img
      src={activeSrc}
      alt={alt}
      style={imgStyle}
      onError={() => {
        if (!triedAltRef.current) {
          triedAltRef.current = true
          let altSrc: string | null = null
          if (activeSrc.endsWith('.png')) {
            altSrc = activeSrc.slice(0, -4) + '.jpg'
          } else if (/\.jpe?g$/.test(activeSrc)) {
            altSrc = activeSrc.replace(/\.jpe?g$/, '.png')
          }
          if (altSrc) setActiveSrc(altSrc)
          else setFailed(true)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}

// ── Title Page ──
function TitlePage({ page, book, bookBasePath }: {
  page: { imageFile?: string }
  book: Book
  bookBasePath: string
}) {
  return (
    <div style={{
      textAlign: 'center', padding: 40,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%',
    }}>
      {page.imageFile && (
        <BookImage
          key={`${bookBasePath}/page/${page.imageFile}`}
          src={`${bookBasePath}/page/${page.imageFile}`}
          alt={book.title}
          imgStyle={{
            maxWidth: '70%', maxHeight: '55%',
            borderRadius: 4, marginBottom: 24, objectFit: 'contain',
          }}
        />
      )}
      <div style={{
        fontSize: 32, fontWeight: 'bold',
        color: TEXT_COLOR, lineHeight: 1.3,
        fontFamily: 'TodoMainCurly, serif',
        textShadow: '1px 1px 0 rgba(148,94,48,0.3)',
      }}>
        {book.title}
      </div>
      {book.pages[0]?.paragraphs?.[0]?.sentences?.[0] && (
        <div style={{ marginTop: 12, fontSize: 14, color: '#9A7B5A' }}>
          {book.credit?.writtenBy && `Written by: ${book.credit.writtenBy}`}
        </div>
      )}
    </div>
  )
}

// ── Portrait Layout: left=image, right=text (C++ two-page spread) ──
function PortraitPageContent({ page, book, bookBasePath, highlightSentence, highlightWord, onWordClick, currentPage, totalPages }: {
  page: { imageFile?: string; paragraphs: { sentences: Sentence[] }[] }
  book: Book
  bookBasePath: string
  highlightSentence: number
  highlightWord: number
  onWordClick: (word: Word) => void
  currentPage: number
  totalPages: number
}) {
  return (
    <>
      {/* Left half: image */}
      {page.imageFile && (
        <div style={{
          flex: '0 0 55%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          borderRight: '1px solid rgba(0,0,0,0.08)',
        }}>
          <BookImage
            key={`${bookBasePath}/page/${page.imageFile}`}
            src={`${bookBasePath}/page/${page.imageFile}`}
            alt={`Page ${currentPage}`}
            imgStyle={{
              width: '100%', height: '100%',
              objectFit: 'contain', padding: 16,
            }}
          />
        </div>
      )}
      {/* Right half: text */}
      <div style={{
        flex: 1,
        padding: '24px 28px',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'flex-start',
        minWidth: 0, height: '100%',
      }}>
        <PageText
          page={page}
          fontSize={book.fontSize}
          highlightSentence={highlightSentence}
          highlightWord={highlightWord}
          onWordClick={onWordClick}
          hasAudio={book.hasAudio}
        />
      </div>
    </>
  )
}

// ── Landscape Layout: image on top, text on bottom (C++ layout) ──
function LandscapePageContent({ page, book, bookBasePath, highlightSentence, highlightWord, onWordClick, currentPage, totalPages }: {
  page: { imageFile?: string; paragraphs: { sentences: Sentence[] }[] }
  book: Book
  bookBasePath: string
  highlightSentence: number
  highlightWord: number
  onWordClick: (word: Word) => void
  currentPage: number
  totalPages: number
}) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Image area (top, majority of space) */}
      {page.imageFile && (
        <div style={{
          flex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', minHeight: 0, padding: 12,
        }}>
          <BookImage
            key={`${bookBasePath}/page/${page.imageFile}`}
            src={`${bookBasePath}/page/${page.imageFile}`}
            alt={`Page ${currentPage}`}
            imgStyle={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
      {/* Text area (bottom) */}
      <div style={{
        padding: '8px 28px 36px',
        textAlign: 'center', flexShrink: 0,
      }}>
        <PageText
          page={page}
          fontSize={book.fontSize}
          highlightSentence={highlightSentence}
          highlightWord={highlightWord}
          onWordClick={onWordClick}
          hasAudio={book.hasAudio}
        />
      </div>
    </div>
  )
}

// ── Credit Page ──
function CreditPage({ credit, title }: { credit: Credit; title: string }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 40, textAlign: 'center',
      fontFamily: 'TodoMainCurly, serif',
    }}>
      <div style={{ fontSize: 28, fontWeight: 'bold', color: TEXT_COLOR, marginBottom: 32 }}>
        {title}
      </div>
      {credit.writtenBy && (
        <div style={{ fontSize: 18, color: '#6B5A3E', marginBottom: 8 }}>
          Written by: {credit.writtenBy}
        </div>
      )}
      {credit.illustratedBy && (
        <div style={{ fontSize: 18, color: '#6B5A3E', marginBottom: 24 }}>
          Illustrated by: {credit.illustratedBy}
        </div>
      )}
      {credit.license && (
        <div style={{ fontSize: 13, color: '#999', maxWidth: 500, lineHeight: 1.5 }}>
          {credit.license}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#bbb', marginTop: 24 }}>
        &copy; 2015 Enuma, Inc.
      </div>
    </div>
  )
}

// ── Page Text with word-by-word highlighting and click ──
function PageText({ page, fontSize, highlightSentence, highlightWord, onWordClick, hasAudio }: {
  page: { paragraphs: { sentences: Sentence[] }[] }
  fontSize: number
  highlightSentence: number
  highlightWord: number
  onWordClick: (word: Word) => void
  hasAudio: boolean
}) {
  let globalSentenceIdx = 0
  return (
    <div style={{
      fontSize,
      lineHeight: 1.5,
      color: TEXT_COLOR,
      fontWeight: 500,
      fontFamily: 'TodoMainCurly, serif',
    }}>
      {page.paragraphs.map((para, pi) => (
        <div key={pi} style={{ marginBottom: fontSize * 0.5 }}>
          {para.sentences.map((sentence) => {
            const sIdx = globalSentenceIdx++
            return (
              <span key={sIdx}>
                {sentence.words.map((word, wi) => {
                  const isHighlighted = sIdx === highlightSentence && wi === highlightWord
                  return (
                    <span
                      key={wi}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (hasAudio && word.audioFile) {
                          onWordClick(word)
                        }
                      }}
                      style={{
                        color: isHighlighted ? HIGHLIGHT_COLOR : TEXT_COLOR,
                        cursor: hasAudio && word.audioFile ? 'pointer' : 'default',
                        padding: '1px 2px',
                        borderRadius: 2,
                        transition: 'color 0.1s',
                        // Add subtle underline on hover for clickable words
                        ...(hasAudio && word.audioFile ? { borderBottom: '1px dashed transparent' } : {}),
                      }}
                      onMouseEnter={(e) => {
                        if (hasAudio && word.audioFile) {
                          (e.target as HTMLElement).style.borderBottom = '1px dashed #ccc'
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.borderBottom = '1px dashed transparent'
                      }}
                    >
                      {word.text}{' '}
                    </span>
                  )
                })}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
