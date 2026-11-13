// Verified against the NCAA's official 2026 DIII men's soccer bracket, November 10, 2026.
// The sequence is bracket order, not alphabetical or kickoff order. Adjacent games
// meet in the next round; each block of eight games is one sectional quadrant.
export const FIRST_ROUND = [
  ['Williams', 'John Jay'],
  ['Johns Hopkins', 'Roger Williams'],
  ['Southwestern (TX)', 'Hardin-Simmons'],
  ['Trinity (TX)', 'La Verne'],
  ['Amherst', 'Stevens'],
  ['Messiah', 'Vassar'],
  ['Case Western Reserve', 'Penn St.-Behrend'],
  ['Hope', 'Transylvania'],

  ['Tufts', 'Penn St.-Abington'],
  ['Babson', 'SUNY Oneonta'],
  ["Saint John's (MN)", 'MSOE'],
  ['North Park', 'Whitman'],
  ['St. Olaf', 'Grinnell'],
  ['Wisconsin-Superior', 'Loras'],
  ['UChicago', 'Webster'],
  ['Calvin', 'Wisconsin-Eau Claire'],

  ['Middlebury', "Saint Joseph's (ME)"],
  ['Hobart', 'Wheaton (MA)'],
  ['Montclair State', 'Southern Virginia'],
  ['Cortland', 'Christopher Newport'],
  ['Hamilton', 'Allegheny'],
  ['Denison', 'Plattsburgh State'],
  ['Rowan', 'Marymount (VA)'],
  ['Washington & Lee', 'Colorado College'],

  ['Connecticut College', 'UMass Boston'],
  ['Carnegie Mellon', 'Salem State'],
  ['Lynchburg', 'Covenant'],
  ['Kenyon', 'Ohio Northern'],
  ['Bowdoin', 'Thomas (ME)'],
  ['St. Lawrence', 'Neumann'],
  ['Wesleyan (CT)', 'SUNY Geneseo'],
  ['Scranton', 'Manhattanville'],
];

// Official NCAA.com school marks for every team in the 2026 bracket.
// The logo paths come from the same NCAA championship feed used for results.
export const TEAM_LOGOS = {
  'Williams': 'https://www.ncaa.com/sites/default/files/images/logos/schools/w/williams.70.png',
  'John Jay': 'https://www.ncaa.com/sites/default/files/images/logos/schools/j/john-jay.70.png',
  'Johns Hopkins': 'https://www.ncaa.com/sites/default/files/images/logos/schools/j/johns-hopkins.70.png',
  'Roger Williams': 'https://www.ncaa.com/sites/default/files/images/logos/schools/r/roger-williams.70.png',
  'Southwestern (TX)': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/southwestern-tx.70.png',
  'Hardin-Simmons': 'https://www.ncaa.com/sites/default/files/images/logos/schools/h/hardin-simmons.70.png',
  'Trinity (TX)': 'https://www.ncaa.com/sites/default/files/images/logos/schools/t/trinity-tx.70.png',
  'La Verne': 'https://www.ncaa.com/sites/default/files/images/logos/schools/l/la-verne.70.png',
  'Amherst': 'https://www.ncaa.com/sites/default/files/images/logos/schools/a/amherst.70.png',
  'Stevens': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/stevens.70.png',
  'Messiah': 'https://www.ncaa.com/sites/default/files/images/logos/schools/m/messiah.70.png',
  'Vassar': 'https://www.ncaa.com/sites/default/files/images/logos/schools/v/vassar.70.png',
  'Case Western Reserve': 'https://www.ncaa.com/sites/default/files/images/logos/schools/c/case.70.png',
  'Penn St.-Behrend': 'https://www.ncaa.com/sites/default/files/images/logos/schools/p/penn-st-behrend.70.png',
  'Hope': 'https://www.ncaa.com/sites/default/files/images/logos/schools/h/hope.70.png',
  'Transylvania': 'https://www.ncaa.com/sites/default/files/images/logos/schools/t/transylvania.70.png',
  'Tufts': 'https://www.ncaa.com/sites/default/files/images/logos/schools/t/tufts.70.png',
  'Penn St.-Abington': 'https://www.ncaa.com/sites/default/files/images/logos/schools/p/penn-st-abington.70.png',
  'Babson': 'https://www.ncaa.com/sites/default/files/images/logos/schools/b/babson.70.png',
  'SUNY Oneonta': 'https://www.ncaa.com/sites/default/files/images/logos/schools/o/oneonta-st.70.png',
  "Saint John's (MN)": 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/saint-johns-mn.70.png',
  'MSOE': 'https://www.ncaa.com/sites/default/files/images/logos/schools/m/msoe.70.png',
  'North Park': 'https://www.ncaa.com/sites/default/files/images/logos/schools/n/north-park.70.png',
  'Whitman': 'https://www.ncaa.com/sites/default/files/images/logos/schools/w/whitman.70.png',
  'St. Olaf': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/st-olaf.70.png',
  'Grinnell': 'https://www.ncaa.com/sites/default/files/images/logos/schools/g/grinnell.70.png',
  'Wisconsin-Superior': 'https://www.ncaa.com/sites/default/files/images/logos/schools/w/wis-superior.70.png',
  'Loras': 'https://www.ncaa.com/sites/default/files/images/logos/schools/l/loras.70.png',
  'UChicago': 'https://www.ncaa.com/sites/default/files/images/logos/schools/c/chicago.70.png',
  'Webster': 'https://www.ncaa.com/sites/default/files/images/logos/schools/w/webster.70.png',
  'Calvin': 'https://www.ncaa.com/sites/default/files/images/logos/schools/c/calvin.70.png',
  'Wisconsin-Eau Claire': 'https://www.ncaa.com/sites/default/files/images/logos/schools/w/wis-eau-claire.70.png',
  'Middlebury': 'https://www.ncaa.com/sites/default/files/images/logos/schools/m/middlebury.70.png',
  "Saint Joseph's (ME)": 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/st-josephs-me.70.png',
  'Hobart': 'https://www.ncaa.com/sites/default/files/images/logos/schools/h/hobart.70.png',
  'Wheaton (MA)': 'https://www.ncaa.com/sites/default/files/images/logos/schools/w/wheaton-ma.70.png',
  'Montclair State': 'https://www.ncaa.com/sites/default/files/images/logos/schools/m/montclair-st.70.png',
  'Southern Virginia': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/southern-va.70.png',
  'Cortland': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/suny-cortland.70.png',
  'Christopher Newport': 'https://www.ncaa.com/sites/default/files/images/logos/schools/c/chris-newport.70.png',
  'Hamilton': 'https://www.ncaa.com/sites/default/files/images/logos/schools/h/hamilton.70.png',
  'Allegheny': 'https://www.ncaa.com/sites/default/files/images/logos/schools/a/allegheny.70.png',
  'Denison': 'https://www.ncaa.com/sites/default/files/images/logos/schools/d/denison.70.png',
  'Plattsburgh State': 'https://www.ncaa.com/sites/default/files/images/logos/schools/p/plattsburgh-st.70.png',
  'Rowan': 'https://www.ncaa.com/sites/default/files/images/logos/schools/r/rowan.70.png',
  'Marymount (VA)': 'https://www.ncaa.com/sites/default/files/images/logos/schools/m/marymount-va.70.png',
  'Washington & Lee': 'https://www.ncaa.com/sites/default/files/images/logos/schools/w/wash-lee.70.png',
  'Colorado College': 'https://www.ncaa.com/sites/default/files/images/logos/schools/c/colorado-col.70.png',
  'Connecticut College': 'https://www.ncaa.com/sites/default/files/images/logos/schools/c/connecticut-col.70.png',
  'UMass Boston': 'https://www.ncaa.com/sites/default/files/images/logos/schools/u/umass-boston.70.png',
  'Carnegie Mellon': 'https://www.ncaa.com/sites/default/files/images/logos/schools/c/carnegie-mellon.70.png',
  'Salem State': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/salem-st.70.png',
  'Lynchburg': 'https://www.ncaa.com/sites/default/files/images/logos/schools/l/lynchburg.70.png',
  'Covenant': 'https://www.ncaa.com/sites/default/files/images/logos/schools/c/covenant.70.png',
  'Kenyon': 'https://www.ncaa.com/sites/default/files/images/logos/schools/k/kenyon.70.png',
  'Ohio Northern': 'https://www.ncaa.com/sites/default/files/images/logos/schools/o/ohio-northern.70.png',
  'Bowdoin': 'https://www.ncaa.com/sites/default/files/images/logos/schools/b/bowdoin.70.png',
  'Thomas (ME)': 'https://www.ncaa.com/sites/default/files/images/logos/schools/t/thomas-me.70.png',
  'St. Lawrence': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/st-lawrence.70.png',
  'Neumann': 'https://www.ncaa.com/sites/default/files/images/logos/schools/n/neumann.70.png',
  'Wesleyan (CT)': 'https://www.ncaa.com/sites/default/files/images/logos/schools/w/wesleyan-ct.70.png',
  'SUNY Geneseo': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/suny-geneseo.70.png',
  'Scranton': 'https://www.ncaa.com/sites/default/files/images/logos/schools/s/scranton.70.png',
  'Manhattanville': 'https://www.ncaa.com/sites/default/files/images/logos/schools/m/manhattanville.70.png',
};

export const SECTION_NAMES = [
  { title: 'Section 01', subtitle: 'Williams · Amherst' },
  { title: 'Section 02', subtitle: 'Tufts · UChicago' },
  { title: 'Section 03', subtitle: 'Middlebury · Hamilton' },
  { title: 'Section 04', subtitle: 'Conn. College · Bowdoin' },
];

export const ROUND_NAMES = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite Eight', 'Final Four', 'Championship'];
export const ROUND_SHORT = ['R64', 'R32', 'S16', 'E8', 'F4', 'Final'];
export const ROUND_POINTS = [10, 20, 40, 80, 160, 320];
export const LOCK_AT = '2026-11-13T17:00:00Z'; // Friday, noon US Eastern (earliest official kickoff)
export const NCAA_BRACKET_URL = 'https://www.ncaa.com/brackets/soccer-men/d3/2026';

export const gameKey = (round, game) => `r${round}m${game}`;
export const gameCount = (round) => 32 / (2 ** round);
export const allGameKeys = () => ROUND_NAMES.flatMap((_, round) =>
  Array.from({ length: gameCount(round) }, (_, game) => gameKey(round, game)));

export function matchup(round, game, picks) {
  if (round === 0) return FIRST_ROUND[game];
  return [picks[gameKey(round - 1, game * 2)] || null,
          picks[gameKey(round - 1, game * 2 + 1)] || null];
}

export function normalizePicks(input) {
  const clean = {};
  for (let round = 0; round < 6; round++) {
    for (let game = 0; game < gameCount(round); game++) {
      const key = gameKey(round, game);
      const options = matchup(round, game, clean);
      if (typeof input?.[key] === 'string' && options.includes(input[key])) {
        clean[key] = input[key];
      }
    }
  }
  return clean;
}

export function chooseWinner(picks, round, game, team) {
  const options = matchup(round, game, picks);
  if (!options.includes(team)) return picks;
  const next = {...picks, [gameKey(round, game)]: team};
  return normalizePicks(next); // invalid downstream picks are discarded
}

export function scoreBracket(picks, results) {
  let total = 0, correct = 0, available = 0;
  const roundScores = ROUND_POINTS.map(() => ({ score: 0, correct: 0, decided: 0 }));
  for (let round = 0; round < 6; round++) {
    for (let game = 0; game < gameCount(round); game++) {
      const key = gameKey(round, game);
      if (results[key]) {
        available += ROUND_POINTS[round];
        roundScores[round].decided++;
        if (picks[key] && picks[key] === results[key]) {
          total += ROUND_POINTS[round];
          correct++;
          roundScores[round].score += ROUND_POINTS[round];
          roundScores[round].correct++;
        }
      }
    }
  }
  return {total, correct, available, roundScores};
}

export const maxScore = ROUND_POINTS.reduce((sum, points, i) => sum + points * gameCount(i), 0);
