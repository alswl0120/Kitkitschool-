export interface Word {
  text: string
  startTime: number
  endTime: number
  audioFile?: string
  duration?: number
}

export interface Sentence {
  words: Word[]
  audioFile?: string
  startTime: number
}

export interface Paragraph {
  sentences: Sentence[]
}

export interface Page {
  pageNumber: number
  imageFile?: string
  paragraphs: Paragraph[]
  noWrap?: boolean
}

export interface Credit {
  writtenBy?: string
  illustratedBy?: string
  license?: string
}

export interface Book {
  title: string
  titleAudioFile?: string
  titleImageFile?: string
  layout: 'portrait' | 'landscape'
  hasAudio: boolean
  fontSize: number
  pages: Page[]
  credit?: Credit
}
