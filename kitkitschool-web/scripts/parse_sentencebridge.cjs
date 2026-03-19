#!/usr/bin/env node
/**
 * Parse sentencebridge_level.tsv + durations.tsv → sentencebridge.json
 * Follows C++ SentenceBridgeScene::loadData parsing logic exactly.
 */
const fs = require('fs')
const path = require('path')

const PROJECT = path.resolve(__dirname, '..')
const TSV_PATH = path.join(PROJECT, 'downloads/extracted/mainapp_en_us/Resources/localized/en-us/games/sentencebridge/sentencebridge_level.tsv')
const DUR_PATH = path.join(PROJECT, 'downloads/extracted/mainapp_en_us/Resources/localized/en-us/games/sentencebridge/sound/durations.tsv')
const OUT_PATH = path.join(PROJECT, 'public/data/games/sentencebridge.json')

// Parse TSV
const tsvText = fs.readFileSync(TSV_PATH, 'utf-8')
const durText = fs.readFileSync(DUR_PATH, 'utf-8')

// Parse durations: "filename.m4a\tMM:SS:cs" → { filename: seconds }
const durations = {}
for (const line of durText.split('\n')) {
  const parts = line.split('\t')
  if (parts.length < 2) continue
  const filename = parts[0].trim()
  if (!filename) continue
  // Format: "00:00:01.49" → parse centiseconds
  const timeParts = parts[1].trim().split(':')
  if (timeParts.length < 3) continue
  // Remove dot from last part: "01.49" → "0149" → 149 centiseconds
  const csStr = timeParts[2].replace('.', '')
  const cs = parseInt(csStr, 10)
  durations[filename] = cs / 100
}

// Parse problems
const levels = {}

for (const line of tsvText.split('\n')) {
  if (!line.trim()) continue
  if (line.startsWith('#')) continue

  const cols = line.split('\t')
  if (cols.length < 7) continue

  const lang = cols[0].trim()
  if (lang !== 'en-US') continue

  const level = parseInt(cols[1], 10)
  const worksheet = parseInt(cols[2], 10)
  // cols[3] = ProblemNo (not needed in output)
  const rawProblem = cols[4]
  const sound = cols[5].trim()
  const uppercase = cols[6].trim() === 'y'

  // Parse problem string exactly like C++ loadData
  let sentence = ''
  const slots = []
  let multiLinePos = -1
  let hasAlphabet = false
  let isAnswer = false

  for (const ch of rawProblem) {
    switch (ch) {
      case '[':
        isAnswer = true
        break
      case ']':
        isAnswer = false
        break
      case '@':
        multiLinePos = sentence.length
        break
      default:
        if (isAnswer) {
          slots.push(sentence.length)
          if (/[a-zA-Z]/.test(ch)) {
            hasAlphabet = true
          }
        }
        sentence += ch
        break
    }
  }

  // Build level/worksheet structure
  const lvlKey = String(level)
  const wsKey = String(worksheet)

  if (!levels[lvlKey]) levels[lvlKey] = { worksheets: {} }
  if (!levels[lvlKey].worksheets[wsKey]) levels[lvlKey].worksheets[wsKey] = []

  levels[lvlKey].worksheets[wsKey].push({
    sentence,
    sound,
    uppercase,
    hasAlphabet,
    slots,
    multiLinePos,
  })
}

const output = { levels, durations }

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2))

// Stats
const levelCount = Object.keys(levels).length
let problemCount = 0
for (const lvl of Object.values(levels)) {
  for (const ws of Object.values(lvl.worksheets)) {
    problemCount += ws.length
  }
}
console.log(`Parsed ${levelCount} levels, ${problemCount} problems, ${Object.keys(durations).length} durations`)
console.log(`Output: ${OUT_PATH}`)
