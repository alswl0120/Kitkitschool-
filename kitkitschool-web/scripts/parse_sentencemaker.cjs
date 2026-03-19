const fs = require('fs');
const tsv = fs.readFileSync('downloads/extracted/mainapp_en_us/Resources/localized/en-us/games/sentencemaker/sentencemaker.tsv', 'utf8');
const lines = tsv.split('\n').filter(l => l.trim() && !l.startsWith('#'));
const levels = {};
for (const line of lines) {
  const cols = line.split('\t');
  const lang = cols[0], lvl = parseInt(cols[1]), prob = parseInt(cols[2]);
  const solution = cols[3];
  const wrongWords = cols[4] || '';
  const image = cols[5] || '';
  const sound = cols[6] || '';

  if (isNaN(lvl)) continue;

  if (!levels[lvl]) levels[lvl] = { level: lvl, problems: [] };

  const words = solution.split('/').map(w => w.trim()).filter(Boolean);
  const wrong = wrongWords ? wrongWords.split('/').map(w => w.trim()).filter(Boolean) : [];

  levels[lvl].problems.push({
    problem: prob,
    words,
    wrongWords: wrong,
    image: image || null,
    sound: sound || null
  });
}
const data = { levels: Object.values(levels).sort((a,b) => a.level - b.level) };
fs.writeFileSync('public/data/games/sentencemaker.json', JSON.stringify(data, null, 2));
console.log('Wrote sentencemaker.json with', data.levels.length, 'levels');
console.log('Sample level 1:', JSON.stringify(data.levels[0].problems[0]));
