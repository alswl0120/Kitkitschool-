const fs = require('fs');
const tsv = fs.readFileSync('downloads/extracted/mainapp_en_us/Resources/localized/en-us/games/missingnumber/missingnumber_levels.tsv', 'utf8');
const lines = tsv.split('\n').filter(l => l.trim() && !l.startsWith('#'));

// Group by level → worksheet → problems
const levelMap = {};
for (const line of lines) {
  const cols = line.split('\t');
  const lang = cols[0], lvl = parseInt(cols[1]), ws = parseInt(cols[2]), prob = parseInt(cols[3]);
  const question = (cols[4] || '').trim();
  const suggest = (cols[5] || '').trim();
  const answer = (cols[6] || '').trim();

  if (isNaN(lvl) || !question) continue;

  // Parse sequence from question string like "1, 2, 3, ?"
  const sequence = question.split(',').map(s => s.trim());
  const missingIndex = sequence.indexOf('?');

  // Parse choices
  let choices = null;
  if (suggest && suggest !== 'NA') {
    choices = suggest.split(',').map(s => s.trim());
  }

  if (!levelMap[lvl]) levelMap[lvl] = {};
  if (!levelMap[lvl][ws]) levelMap[lvl][ws] = [];

  levelMap[lvl][ws].push({
    question,
    sequence,
    missingIndex,
    answer,
    choices,
  });
}

// Output: levels keyed by level number, each containing array of worksheets
// Runtime picks one random worksheet
const levels = {};
for (const [lvl, worksheets] of Object.entries(levelMap)) {
  levels[lvl] = Object.values(worksheets);
}

const data = { levels };
fs.writeFileSync('public/data/games/missingnumber.json', JSON.stringify(data, null, 2));

const levelCount = Object.keys(levels).length;
console.log(`Wrote missingnumber.json with ${levelCount} levels`);
const sample = levels['1'][0][0];
console.log('Sample level 1:', JSON.stringify(sample));
