#!/usr/bin/env node
/**
 * Parse curriculumdata.tsv into curriculum.json
 * Follows CurriculumManager.cpp level→day→game hierarchy
 */
const fs = require('fs');
const path = require('path');

const tsvPath = path.join(__dirname, '..', 'downloads', 'extracted', 'mainapp_en_us',
  'Resources', 'localized', 'en-us', 'curriculumdata.tsv');
const outPath = path.join(__dirname, '..', 'public', 'data', 'curriculum.json');

const raw = fs.readFileSync(tsvPath, 'utf-8');
const lines = raw.split('\n');

const levels = [];
let currentLevel = null;
let currentDay = null;

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('게임이름')) continue;

  const cols = trimmed.split('\t');
  const type = cols[0];

  if (type === 'level') {
    // level	en-US	PreSchool	L	0	5
    const langTag = cols[1];
    const levelTitle = cols[2];
    const category = cols[3];
    const categoryLevel = parseInt(cols[4], 10);
    const numDays = parseInt(cols[5], 10);
    const levelID = `${langTag}_${category}_${categoryLevel}`;

    currentLevel = {
      levelID,
      langTag,
      levelTitle,
      category,
      categoryLevel,
      numDays,
      days: [],
    };
    levels.push(currentLevel);
    currentDay = null;

  } else if (type === 'day' && currentLevel) {
    // day	1	3
    const dayOrder = parseInt(cols[1], 10);
    const numGames = parseInt(cols[2], 10);

    currentDay = {
      day: dayOrder,
      numGames,
      games: [],
    };
    currentLevel.days.push(currentDay);

  } else if (type === 'game' && currentDay) {
    // game	TutorialTrace	1	x
    const gameName = cols[1];
    const gameLevel = parseInt(cols[2], 10);
    const gameParam = cols[3] || 'x';

    currentDay.games.push({ gameName, gameLevel, gameParam });
  }
}

// Ensure output directory exists
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ levels }, null, 2));

console.log(`Parsed ${levels.length} levels`);
let totalDays = 0, totalGames = 0;
for (const l of levels) {
  totalDays += l.days.length;
  for (const d of l.days) totalGames += d.games.length;
}
console.log(`Total: ${totalDays} days, ${totalGames} games`);
console.log(`Output: ${outPath}`);
