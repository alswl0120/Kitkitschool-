#!/usr/bin/env node
/**
 * Parse AlphabetPuzzle and NumberPuzzle TSV files into JSON.
 * TSV columns: LanguageTag  Level  Worksheet  Key  (blank)  Motif  X_POS  Y_POS  FaceImg  DepthImg  ShadowImg  SlotImg
 * Rows with Key == "__GAME_ID__" are metadata (puzzleType, gameID, boardImage).
 * Other rows are piece definitions.
 */

const fs = require('fs')
const path = require('path')

const BASE = path.join(__dirname, '..', 'downloads', 'extracted', 'mainapp_en_us',
  'Resources', 'localized', 'en-us', 'games')
const OUT = path.join(__dirname, '..', 'public', 'data', 'games')

function parseTSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'))

  // Group by (level, worksheet)
  const levelsMap = new Map() // key: "level-worksheet" → { meta, pieces }

  for (const line of lines) {
    const cols = line.split('\t')
    if (cols.length < 12) continue

    const lang = cols[0].trim()
    if (lang !== 'en-US') continue

    const level = parseInt(cols[1])
    const worksheet = parseInt(cols[2])
    const key = cols[3].trim()
    const mapKey = `${level}-${worksheet}`

    if (!levelsMap.has(mapKey)) {
      levelsMap.set(mapKey, { level, worksheet, meta: null, pieces: [] })
    }

    const entry = levelsMap.get(mapKey)

    if (key === '__GAME_ID__') {
      // Metadata row: cols[5]=puzzleType, cols[6]=gameID, cols[7]=boardImage
      entry.meta = {
        puzzleType: cols[5].trim(),
        gameID: cols[6].trim().toLowerCase(), // Convert to lowercase for folder names
        boardImage: cols[7].trim(),
      }
    } else {
      // Piece row
      const id = parseInt(key)
      if (isNaN(id)) continue

      entry.pieces.push({
        id,
        motif: cols[5].trim(),
        x: parseFloat(cols[6]),
        y: parseFloat(cols[7]),
        face: cols[8].trim(),
        depth: cols[9].trim(),
        shadow: cols[10].trim(),
        slot: cols[11].trim(),
      })
    }
  }

  // Convert to array
  const levels = []
  for (const [, entry] of levelsMap) {
    if (!entry.meta || entry.pieces.length === 0) continue
    levels.push({
      level: entry.level,
      worksheet: entry.worksheet,
      puzzleType: entry.meta.puzzleType,
      gameID: entry.meta.gameID,
      boardImage: entry.meta.boardImage,
      pieces: entry.pieces.sort((a, b) => a.id - b.id),
    })
  }

  return { levels: levels.sort((a, b) => a.level - b.level || a.worksheet - b.worksheet) }
}

// Parse AlphabetPuzzle
const alphaPath = path.join(BASE, 'alphabetpuzzle', 'alphabetpuzzle_levels.tsv')
if (fs.existsSync(alphaPath)) {
  const data = parseTSV(alphaPath)
  const outPath = path.join(OUT, 'alphabetpuzzle.json')
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
  console.log(`AlphabetPuzzle: ${data.levels.length} levels, ${data.levels.reduce((s, l) => s + l.pieces.length, 0)} pieces → ${outPath}`)
  for (const l of data.levels) {
    console.log(`  Level ${l.level}: ${l.puzzleType} [${l.gameID}] ${l.pieces.length} pieces`)
  }
}

// Parse NumberPuzzle
const numPath = path.join(BASE, 'numberpuzzle', 'numberpuzzle_levels.tsv')
if (fs.existsSync(numPath)) {
  const data = parseTSV(numPath)
  const outPath = path.join(OUT, 'numberpuzzle.json')
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
  console.log(`\nNumberPuzzle: ${data.levels.length} levels, ${data.levels.reduce((s, l) => s + l.pieces.length, 0)} pieces → ${outPath}`)
  for (const l of data.levels) {
    console.log(`  Level ${l.level}: ${l.puzzleType} [${l.gameID}] ${l.pieces.length} pieces`)
  }
}
