import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ABCPage.css'

type Tab = 'abc' | '123'

const ALPHABET = [
  { upper: 'A', lower: 'a', word: 'Apple', emoji: '🍎' },
  { upper: 'B', lower: 'b', word: 'Ball', emoji: '⚽' },
  { upper: 'C', lower: 'c', word: 'Cat', emoji: '🐱' },
  { upper: 'D', lower: 'd', word: 'Dog', emoji: '🐶' },
  { upper: 'E', lower: 'e', word: 'Egg', emoji: '🥚' },
  { upper: 'F', lower: 'f', word: 'Fish', emoji: '🐟' },
  { upper: 'G', lower: 'g', word: 'Goat', emoji: '🐐' },
  { upper: 'H', lower: 'h', word: 'Hat', emoji: '🎩' },
  { upper: 'I', lower: 'i', word: 'Ice', emoji: '🧊' },
  { upper: 'J', lower: 'j', word: 'Juice', emoji: '🧃' },
  { upper: 'K', lower: 'k', word: 'Kite', emoji: '🪁' },
  { upper: 'L', lower: 'l', word: 'Lion', emoji: '🦁' },
  { upper: 'M', lower: 'm', word: 'Moon', emoji: '🌙' },
  { upper: 'N', lower: 'n', word: 'Nut', emoji: '🥜' },
  { upper: 'O', lower: 'o', word: 'Owl', emoji: '🦉' },
  { upper: 'P', lower: 'p', word: 'Pig', emoji: '🐷' },
  { upper: 'Q', lower: 'q', word: 'Queen', emoji: '👑' },
  { upper: 'R', lower: 'r', word: 'Rain', emoji: '🌧️' },
  { upper: 'S', lower: 's', word: 'Sun', emoji: '☀️' },
  { upper: 'T', lower: 't', word: 'Tree', emoji: '🌳' },
  { upper: 'U', lower: 'u', word: 'Umbrella', emoji: '☂️' },
  { upper: 'V', lower: 'v', word: 'Van', emoji: '🚐' },
  { upper: 'W', lower: 'w', word: 'Water', emoji: '💧' },
  { upper: 'X', lower: 'x', word: 'Xmas', emoji: '🎄' },
  { upper: 'Y', lower: 'y', word: 'Yarn', emoji: '🧶' },
  { upper: 'Z', lower: 'z', word: 'Zebra', emoji: '🦓' },
]

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function toEnglish(n: number): string {
  if (n === 100) return 'one hundred'
  if (n < 20) return ONES[n]
  const t = TENS[Math.floor(n / 10)]
  const o = ONES[n % 10]
  return o ? `${t}-${o}` : t
}

const NUMBERS = Array.from({ length: 100 }, (_, i) => i + 1) // 1–100

function speak(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.85
  window.speechSynthesis.speak(u)
}

function speakLetterAndWord(letter: string, word: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u1 = new SpeechSynthesisUtterance(letter)
  u1.lang = 'en-US'
  u1.rate = 0.85
  const u2 = new SpeechSynthesisUtterance(word)
  u2.lang = 'en-US'
  u2.rate = 0.85
  u1.onend = () => setTimeout(() => window.speechSynthesis.speak(u2), 350)
  window.speechSynthesis.speak(u1)
}

export default function ABCPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('abc')
  const [active, setActive] = useState<string | null>(null)

  function handleLetterClick(letter: typeof ALPHABET[0]) {
    setActive(letter.upper)
    speakLetterAndWord(letter.upper, letter.word)
  }

  function handleNumberClick(n: number) {
    setActive(String(n))
    speak(toEnglish(n))
  }

  return (
    <div className="abc-root">
      {/* Header */}
      <div className="abc-header">
        <button className="abc-back" onClick={() => navigate('/tools')}>← Back</button>
        <span className="abc-title">ABC & 123</span>
        <div style={{ width: 70 }} />
      </div>

      {/* Tabs */}
      <div className="abc-tabs">
        <button
          className={`abc-tab ${tab === 'abc' ? 'abc-tab--active' : ''}`}
          onClick={() => { setTab('abc'); setActive(null) }}
        >
          🔤 Alphabet
        </button>
        <button
          className={`abc-tab ${tab === '123' ? 'abc-tab--active' : ''}`}
          onClick={() => { setTab('123'); setActive(null) }}
        >
          🔢 Numbers
        </button>
      </div>

      {/* Content */}
      <div className="abc-body">
        {tab === 'abc' ? (
          <div className="abc-grid">
            {ALPHABET.map(letter => (
              <button
                key={letter.upper}
                className={`abc-card ${active === letter.upper ? 'abc-card--active' : ''}`}
                onClick={() => handleLetterClick(letter)}
              >
                <div className="abc-card-emoji">{letter.emoji}</div>
                <div className="abc-card-letters">
                  <span className="abc-upper">{letter.upper}</span>
                  <span className="abc-lower">{letter.lower}</span>
                </div>
                <div className="abc-card-word">{letter.word}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="num-grid">
            {NUMBERS.map(n => (
              <button
                key={n}
                className={`num-card ${active === String(n) ? 'num-card--active' : ''}`}
                onClick={() => handleNumberClick(n)}
              >
                <div className="num-big">{n}</div>
                <div className="num-name">{toEnglish(n)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="abc-hint">Tap a card to hear it! 🔊</div>
    </div>
  )
}
