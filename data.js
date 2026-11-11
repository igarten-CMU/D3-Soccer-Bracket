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
