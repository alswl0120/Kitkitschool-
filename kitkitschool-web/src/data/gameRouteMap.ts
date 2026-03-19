/**
 * Maps TSV game names from curriculumdata.tsv to web route paths.
 * Ported games have their route path, unported games are null.
 */

export const gameRouteMap: Record<string, string | null> = {
  // === Literacy Games (ported) ===
  AnimalPuzzle:       '/game/animalpuzzle',
  LetterMatching:     '/game/lettermatching',
  LetterTrace:        '/game/lettertrace',
  WordMachine:        '/game/wordmachine',
  StarFall:           '/game/starfall',
  Spelling:           '/game/spelling',
  SentenceMaker:      '/game/sentencemaker',
  Comprehension:      '/game/comprehensiontest',
  WordTracing:        '/game/wordtrace',
  TutorialTrace:      '/game/tutorialtrace',

  // === Math Games (ported) ===
  QuickFacts:         '/game/quickfacts',
  PlaceValue:         '/game/placevalue',
  NumberMatching:     '/game/numbermatching',
  FindTheMatch:       '/game/findthematch',
  Counting:           '/game/counting',
  MovingInsects:      '/game/movinginsects',
  HundredPuzzle:      '/game/hundredpuzzle',
  WoodenPuzzle:       '/game/woodenpuzzles',
  EquationMaker:      '/game/equationmaker',
  FishTank:           '/game/fishtank',
  NumberTracing:      '/game/numbertrace',
  DoubleDigit:        '/game/doubledigit',
  Tapping:            '/game/tapping',
  PatternTrain:       '/game/patterntrain',

  // === Cross-category (ported) ===
  EggQuizLiteracy:    '/game/eggquiz',
  EggQuizMath:        '/game/eggquiz',
  EggQuiz:            '/game/eggquiz',
  DigitalQuiz:        '/game/digitalquiz',
  LetterTracingCard:  '/game/lettertrace',

  // === Special content types ===
  Video:              '/video',       // + /:param
  Book:               '/book',        // + /:param
  BookWithQuiz:       '/book',        // + /:param

  // === Puzzle games (ported) ===
  AlphabetPuzzle:     '/game/alphabetpuzzle',
  NumberPuzzle:       '/game/numberpuzzle',
  SoundTrain:         '/game/soundtrain',
  WordMatrix:         '/game/wordmatrix',
  WordNote:           '/game/wordnote',
  BirdPhonics:        '/game/birdphonics',
  WordKicker:         '/game/wordkicker',
  Labeling:           '/game/labeling',
  WordWindow:         '/game/wordwindow',
  WhatIsThis:         '/game/whatisthis',
  ReadingBird:        '/game/readingbird',
  NumberTracingExt:   '/game/numbertraceext',
  SentenceBridge:     '/game/sentencebridge',
  LRComprehension:    '/game/lrcomprehension',
  CompMatching:       '/game/compmatching',
  MathKicker:         '/game/mathkicker',
  MangoShop:          '/game/mangoshop',
  ShapeMatching:      '/game/shapematching',
  MissingNumber:      '/game/missingnumber',
  NumberTrain:        '/game/numbertrain',
  // NumberPuzzle: already registered above
  FeedingTime:        '/game/feedingtime',
  LineMatching:       '/game/linematching',
  BigSmall:           '/game/bigsmall',
  Crown:              '/game/crown',
  Keypad:             '/game/keypad',
  Count10:            '/game/count10',
  AirShapes:          '/game/airshapes',
  EqualsGreatLess:    '/game/equalsgreatless',
  '100chickens':      '/game/hundredchickens',
  '30puzzle':         '/game/thirtypuzzle',
  ThirtyPuzzle:       '/game/thirtypuzzle',
  MultiplicationBoard: '/game/multiplicationboard',
  OldSpelling:        '/game/oldspelling',
}

/**
 * Resolve the game route for a curriculum game entry.
 * Returns the full path with level param, or null if unported.
 */
export function resolveGameRoute(
  gameName: string,
  gameLevel: number,
  gameParam: string,
): string | null {
  const route = gameRouteMap[gameName]
  if (route === undefined || route === null) return null

  // Video and Book use gameParam as the content ID
  if (gameName === 'Video') {
    return `${route}/${gameParam}`
  }
  if (gameName === 'Book' || gameName === 'BookWithQuiz') {
    return `${route}/${gameParam}`
  }

  // EggQuiz needs a category param to distinguish literacy vs math
  if (gameName === 'EggQuizLiteracy') {
    return `${route}?level=${gameLevel}&category=L`
  }
  if (gameName === 'EggQuizMath') {
    return `${route}?level=${gameLevel}&category=M`
  }

  // Regular games: append level as query param
  return `${route}?level=${gameLevel}`
}
