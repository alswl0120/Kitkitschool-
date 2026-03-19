import type { Book, Page, Paragraph, Sentence, Word, Credit } from './types'

/** Add .png only if the string has no image extension already */
function withPng(base: string): string {
  if (!base) return base
  return /\.[a-zA-Z0-9]{2,4}$/.test(base) ? base : base + '.png'
}

/** Split a CSV line into fields, handling double-quoted fields (e.g. "A, B") */
function splitCSVLine(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field — read until closing quote
      i++ // skip opening quote
      let field = ''
      while (i < line.length && line[i] !== '"') field += line[i++]
      i++ // skip closing quote
      if (line[i] === ',') i++ // skip trailing comma
      fields.push(field)
    } else {
      // Unquoted field
      const end = line.indexOf(',', i)
      if (end === -1) { fields.push(line.slice(i)); break }
      fields.push(line.slice(i, end))
      i = end + 1
    }
  }
  return fields
}

/**
 * Parse bookinfo.csv format used by the original C++ bookviewer.
 * Format:
 *   title,<title>,<titleAudio>,<titleImage>,<layout>,audio,
 *   page,<num>,<image>,wordwrap|nowordwrap,
 *   paragraph
 *   sentence,<audio>,<startTime>,
 *   word,<start>,<end>,<text>,<wordAudio>,<duration>,
 */
export function parseBookInfoCSV(csv: string, bookId: string): Book {
  const lines = csv.split(/\r\n|\r|\n/).filter(l => l.trim())
  const pages: Page[] = []
  let title = ''
  let titleAudioFile: string | undefined
  let titleImageFile: string | undefined
  let layout: 'portrait' | 'landscape' = 'portrait'
  let hasAudio = false
  let fontSize = 0  // 0 means use default

  let currentPage: Page | null = null
  let currentParagraph: Paragraph | null = null
  let currentSentence: Sentence | null = null

  for (const line of lines) {
    const parts = splitCSVLine(line)
    const type = parts[0]?.trim()

    if (type === 'title') {
      title = parts[1]?.trim() || ''
      titleAudioFile = parts[2]?.trim() || undefined
      titleImageFile = parts[3]?.trim() || undefined
      layout = (parts[4]?.trim() as 'portrait' | 'landscape') || 'portrait'
      hasAudio = parts[5]?.trim() === 'audio'
      const rawFontSize = parseInt(parts[6]?.trim() || '0', 10)
      if (rawFontSize > 0) fontSize = rawFontSize

      // Title page (page 0)
      currentPage = {
        pageNumber: 0,
        imageFile: titleImageFile ? withPng(titleImageFile) : undefined,
        paragraphs: [],
      }
      pages.push(currentPage)
    } else if (type === 'page') {
      const pageNum = parseInt(parts[1]?.trim() || '0', 10)
      const imageBase = parts[2]?.trim() || ''
      const wrapMode = parts[3]?.trim() || 'wordwrap'

      currentPage = {
        pageNumber: pageNum,
        imageFile: imageBase ? withPng(imageBase) : undefined,
        noWrap: wrapMode === 'nowordwrap',
        paragraphs: [],
      }
      pages.push(currentPage)
      currentParagraph = null
      currentSentence = null
    } else if (type === 'paragraph') {
      currentParagraph = { sentences: [] }
      currentPage?.paragraphs.push(currentParagraph)
      currentSentence = null
    } else if (type === 'sentence') {
      const audioFile = parts[1]?.trim() || undefined
      const startTime = parseFloat(parts[2]?.trim() || '0') || 0

      currentSentence = {
        audioFile,
        startTime,
        words: [],
      }
      currentParagraph?.sentences.push(currentSentence)
    } else if (type === 'word') {
      const startTime = parseFloat(parts[1]?.trim() || '0') || 0
      const endTime = parseFloat(parts[2]?.trim() || '0') || 0
      const text = parts[3]?.trim() || ''
      const audioFile = parts[4]?.trim() || undefined
      const duration = parseFloat(parts[5]?.trim() || '0') || undefined

      const word: Word = { text, startTime, endTime, audioFile, duration }
      currentSentence?.words.push(word)
    }
  }

  // C++ default font size is 80px in 2560x1800 Cocos space.
  // Scale to web: 80 * (web_scale ~0.35) ≈ 28px default
  // If CSV has a custom fontSize, scale similarly
  const webFontSize = fontSize > 0 ? Math.round(fontSize * 0.35) : 28

  return {
    title,
    titleAudioFile,
    titleImageFile: titleImageFile ? withPng(titleImageFile) : undefined,
    layout,
    hasAudio,
    fontSize: webFontSize,
    pages,
  }
}

/**
 * Parse credit.txt format:
 *   #credit
 *   Written by: ...
 *   Illustrated by: ...
 *   #license
 *   "..." is licensed under ...
 */
export function parseCreditTxt(text: string): Credit {
  const credit: Credit = {}
  const lines = text.split('\n')
  let section = ''
  const licenseLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '#credit') { section = 'credit'; continue }
    if (trimmed === '#license') { section = 'license'; continue }
    if (!trimmed) continue

    if (section === 'credit') {
      if (trimmed.startsWith('Written by:')) credit.writtenBy = trimmed.replace('Written by:', '').trim()
      if (trimmed.startsWith('Illustrated by:')) credit.illustratedBy = trimmed.replace('Illustrated by:', '').trim()
    } else if (section === 'license') {
      licenseLines.push(trimmed)
    }
  }
  if (licenseLines.length > 0) credit.license = licenseLines.join(' ')
  return credit
}

/**
 * Parse book data from JSON format (legacy/fallback).
 */
export function parseBookData(data: BookJSON): Book {
  return {
    title: data.title,
    titleAudioFile: data.titleAudioFile,
    titleImageFile: data.titleImageFile,
    layout: data.layout || 'portrait',
    hasAudio: data.hasAudio ?? true,
    fontSize: data.fontSize || 24,
    pages: data.pages.map(p => ({
      pageNumber: p.pageNumber,
      imageFile: p.imageFile,
      noWrap: p.noWrap,
      paragraphs: (p.paragraphs || []).map(para => ({
        sentences: (para.sentences || []).map(s => ({
          audioFile: s.audioFile,
          startTime: s.startTime || 0,
          words: (s.words || []).map(w => ({
            text: w.text,
            startTime: w.startTime || 0,
            endTime: w.endTime || 0,
            audioFile: w.audioFile,
            duration: w.duration,
          })),
        })),
      })),
    })),
  }
}

// JSON schema for book data files
export interface BookJSON {
  title: string
  titleAudioFile?: string
  titleImageFile?: string
  layout?: 'portrait' | 'landscape'
  hasAudio?: boolean
  fontSize?: number
  pages: {
    pageNumber: number
    imageFile?: string
    noWrap?: boolean
    paragraphs?: {
      sentences?: {
        audioFile?: string
        startTime?: number
        words?: {
          text: string
          startTime?: number
          endTime?: number
          audioFile?: string
          duration?: number
        }[]
      }[]
    }[]
  }[]
}

/**
 * Get all text from a page as a single string
 */
export function getPageText(page: Page): string {
  return page.paragraphs
    .flatMap(p => p.sentences)
    .flatMap(s => s.words)
    .map(w => w.text)
    .join(' ')
}

/**
 * Get the currently highlighted word based on audio playback time
 */
export function getHighlightedWord(
  page: Page,
  currentTime: number
): { sentenceIndex: number; wordIndex: number } | null {
  let si = 0
  for (const para of page.paragraphs) {
    for (const sentence of para.sentences) {
      for (let wi = 0; wi < sentence.words.length; wi++) {
        const word = sentence.words[wi]
        if (currentTime >= word.startTime && currentTime < word.endTime) {
          return { sentenceIndex: si, wordIndex: wi }
        }
      }
      si++
    }
  }
  return null
}
