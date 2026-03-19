const fs = require('fs');
const tsv = fs.readFileSync('downloads/extracted/mainapp_en_us/Resources/localized/en-us/games/wordmachine/wordmachine_levels.tsv', 'utf8');
const lines = tsv.split('\n').filter(l => l.trim() && !l.startsWith('#'));
const levels = {};
for (const line of lines) {
  const cols = line.split('\t');
  const lang = cols[0], lvl = parseInt(cols[1]), ws = parseInt(cols[2]), prob = parseInt(cols[3]);
  const type = cols[4] || '';
  const word = cols[5] || '';
  const goodImage = cols[6] || '';
  const badImage = cols[7] || '';
  const sound = cols[8] || '';

  if (isNaN(lvl)) continue;

  if (!levels[lvl]) levels[lvl] = { level: lvl, worksheets: {} };
  if (!levels[lvl].worksheets[ws]) levels[lvl].worksheets[ws] = { worksheet: ws, problems: [] };

  levels[lvl].worksheets[ws].problems.push({
    problem: prob,
    type,
    word,
    goodImage: goodImage || null,
    badImage: badImage || null,
    sound: sound || null
  });
}

const data = {
  levels: Object.values(levels).sort((a,b) => a.level - b.level).map(l => ({
    level: l.level,
    worksheets: Object.values(l.worksheets).sort((a,b) => a.worksheet - b.worksheet)
  }))
};

fs.writeFileSync('public/data/games/wordmachine.json', JSON.stringify(data, null, 2));
console.log('Wrote wordmachine.json with', data.levels.length, 'levels');
console.log('Sample level 1 ws 1:', JSON.stringify(data.levels[0].worksheets[0].problems[0]));
