/**
 * Parse EggQuiz TSV data files into JSON
 *
 * Inputs:
 *   - eggquizliteracy_levels.tsv (1530 lines)
 *   - eggquizmath_levels.tsv (617 lines)
 *
 * Outputs:
 *   - public/data/games/eggquiz_literacy.json
 *   - public/data/games/eggquiz_math.json
 */

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const TSV_DIR = path.join(PROJECT_DIR, 'downloads/extracted/mainapp_en_us/Resources/localized/en-us/games/eggquiz');
const OUT_DIR = path.join(PROJECT_DIR, 'public/data/games');

/**
 * Parse a single TSV file into structured level data.
 *
 * TSV structure:
 *   Header row: level_name \t worksheet \t leveltypesequence \t (rest empty)
 *   Problem row: \t \t \t problemID \t type \t field5 ... field11+
 *   Empty/comment rows: blank or starting with #
 *
 * Returns: { levels: { [levelName]: { worksheets: { [wsNum]: { sequence, problems } } } } }
 */
function parseTSV(filePath, isComment1stLine = false) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');

  const result = { levels: {} };
  let currentLevel = null;
  let currentWorksheet = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) continue;

    // Skip comment lines (start with # in col 0)
    if (isComment1stLine && i === 0) continue;

    const cols = line.split('\t');

    // Header row: col 0 has level name, col 1 has worksheet number
    const levelName = cols[0]?.trim();
    const worksheetNum = cols[1]?.trim();

    if (levelName && !levelName.startsWith('#')) {
      // This is a header row
      currentLevel = levelName;
      currentWorksheet = worksheetNum || '1';

      if (!result.levels[currentLevel]) {
        result.levels[currentLevel] = { worksheets: {} };
      }

      const sequence = (cols[2] || '').trim();
      result.levels[currentLevel].worksheets[currentWorksheet] = {
        sequence: sequence,
        problems: {}
      };
      continue;
    }

    // Problem row: col 3 has problem ID, col 4 has type
    const problemId = cols[3]?.trim();
    const type = cols[4]?.trim();

    if (!problemId || !type) continue;
    if (!currentLevel || !currentWorksheet) continue;

    const ws = result.levels[currentLevel].worksheets[currentWorksheet];
    if (!ws) continue;

    // Store all fields from col 5 onwards
    ws.problems[problemId] = {
      type: type,
      // col 5: templatename (math) / display text or image (literacy)
      templatename: (cols[5] || '').trim(),
      // col 6-9: questionoptions (math) / various (literacy)
      questionoption1: (cols[6] || '').trim(),
      questionoption2: (cols[7] || '').trim(),
      questionoption3: (cols[8] || '').trim(),
      questionoption4: (cols[9] || '').trim(),
      // col 10: answer
      answer: (cols[10] || '').trim(),
      // col 11: answeroption1 (choices for literacy, options for math)
      answeroption1: (cols[11] || '').trim(),
    };
  }

  return result;
}

/**
 * Post-process literacy data to extract structured fields
 */
function processLiteracy(data) {
  for (const levelName of Object.keys(data.levels)) {
    const level = data.levels[levelName];
    for (const wsNum of Object.keys(level.worksheets)) {
      const ws = level.worksheets[wsNum];
      for (const pid of Object.keys(ws.problems)) {
        const p = ws.problems[pid];

        // Parse choices from answeroption1 (^-separated)
        if (p.answeroption1) {
          p.choices = p.answeroption1.split('^').map(s => s.trim());
        } else {
          p.choices = [];
        }

        // Map fields based on type for clarity
        switch (p.type) {
          case 'soundonly_word':
          case 'soundonly_image':
          case 'soundonly_sentence':
            // audio is in questionoption4
            p.audio = p.questionoption4;
            break;

          case 'word_word':
            // display text is in templatename
            p.displayText = p.templatename;
            break;

          case 'image_word':
          case 'image_sentence':
            // image file is in questionoption1 (or templatename if present)
            p.image = p.templatename || p.questionoption1;
            // optional audio in questionoption4
            if (p.questionoption4) p.audio = p.questionoption4;
            break;

          case 'sentence_word':
          case 'sentence_sentence':
            // sentence text is in templatename
            p.sentenceText = p.templatename;
            // optional audio
            if (p.questionoption4) p.audio = p.questionoption4;
            break;

          case 'paragraph_sentence':
            // templatename has the question, questionoption1 has the paragraph passage
            p.questionText = p.templatename;
            if (p.questionoption1) p.paragraphText = p.questionoption1;
            // optional audio
            if (p.questionoption4) p.audio = p.questionoption4;
            break;

          case 'imageseq_image':
            // Image sequence: questionoption1=image1, questionoption3=image3
            if (p.questionoption1) p.image1 = p.questionoption1;
            if (p.questionoption3) p.image3 = p.questionoption3;
            if (p.questionoption4) p.audio = p.questionoption4;
            break;

          case 'imageseq_sentence':
            // Text sequence: questionoption1=sentence1, questionoption3=sentence3
            // Answer is the missing middle sentence
            p.sentenceSeq1 = p.questionoption1 || '';
            p.sentenceSeq3 = p.questionoption3 || '';
            if (p.questionoption4) p.audio = p.questionoption4;
            break;

          case 'listeningcomp_sentence':
          case 'listeningcom_image':
            // story audio in templatename
            p.audio = p.templatename;
            if (p.questionoption1) p.questionText = p.questionoption1;
            break;

          case 'ordering_sentence':
            // ordering questions have sentence choices
            break;
        }
      }
    }
  }
  return data;
}

/**
 * Post-process math data to extract structured fields
 */
function processMath(data) {
  for (const levelName of Object.keys(data.levels)) {
    const level = data.levels[levelName];
    for (const wsNum of Object.keys(level.worksheets)) {
      const ws = level.worksheets[wsNum];
      for (const pid of Object.keys(ws.problems)) {
        const p = ws.problems[pid];

        // Parse answer range (e.g., "1~5" → {min:1, max:5} or just a number)
        if (p.answer && p.answer.includes('~')) {
          const [min, max] = p.answer.split('~').map(Number);
          p.answerRange = { min, max };
        } else if (p.answer) {
          p.answerValue = parseInt(p.answer, 10) || p.answer;
        }

        // Parse choices from answeroption1
        if (p.answeroption1 && p.answeroption1.includes(',')) {
          p.choices = p.answeroption1.split(',').map(s => s.trim());
        }
      }
    }
  }
  return data;
}

// --- Main ---
console.log('=== Parsing EggQuiz TSV data ===\n');

// Parse Literacy
const litPath = path.join(TSV_DIR, 'eggquizliteracy_levels.tsv');
console.log(`Reading: ${litPath}`);
let litData = parseTSV(litPath, false);
litData = processLiteracy(litData);

const litLevels = Object.keys(litData.levels);
let litProblemCount = 0;
for (const l of litLevels) {
  for (const ws of Object.keys(litData.levels[l].worksheets)) {
    litProblemCount += Object.keys(litData.levels[l].worksheets[ws].problems).length;
  }
}
console.log(`  Levels: ${litLevels.length}`);
console.log(`  Problems: ${litProblemCount}`);
console.log(`  Level names: ${litLevels.slice(0, 5).join(', ')}...`);

// Parse Math
const mathPath = path.join(TSV_DIR, 'eggquizmath_levels.tsv');
console.log(`\nReading: ${mathPath}`);
let mathData = parseTSV(mathPath, true); // skip first comment line
mathData = processMath(mathData);

// Also skip the header line (#level worksheet ...) if it was parsed as a level
if (mathData.levels['#level']) {
  delete mathData.levels['#level'];
}

const mathLevels = Object.keys(mathData.levels);
let mathProblemCount = 0;
for (const l of mathLevels) {
  for (const ws of Object.keys(mathData.levels[l].worksheets)) {
    mathProblemCount += Object.keys(mathData.levels[l].worksheets[ws].problems).length;
  }
}
console.log(`  Levels: ${mathLevels.length}`);
console.log(`  Problems: ${mathProblemCount}`);
console.log(`  Level names: ${mathLevels.slice(0, 5).join(', ')}...`);

// Collect unique types
const litTypes = new Set();
const mathTypes = new Set();
for (const l of litLevels) {
  for (const ws of Object.keys(litData.levels[l].worksheets)) {
    for (const p of Object.values(litData.levels[l].worksheets[ws].problems)) {
      litTypes.add(p.type);
    }
  }
}
for (const l of mathLevels) {
  for (const ws of Object.keys(mathData.levels[l].worksheets)) {
    for (const p of Object.values(mathData.levels[l].worksheets[ws].problems)) {
      mathTypes.add(p.type);
    }
  }
}
console.log(`\nLiteracy types: ${[...litTypes].join(', ')}`);
console.log(`Math types: ${[...mathTypes].join(', ')}`);

// Write output
fs.mkdirSync(OUT_DIR, { recursive: true });

const litOutPath = path.join(OUT_DIR, 'eggquiz_literacy.json');
fs.writeFileSync(litOutPath, JSON.stringify(litData, null, 2));
console.log(`\nWrote: ${litOutPath}`);

const mathOutPath = path.join(OUT_DIR, 'eggquiz_math.json');
fs.writeFileSync(mathOutPath, JSON.stringify(mathData, null, 2));
console.log(`Wrote: ${mathOutPath}`);

console.log('\nDone!');
