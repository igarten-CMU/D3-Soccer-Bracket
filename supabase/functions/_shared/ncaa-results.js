// The NCAA.com bracket currently reads its tournament data from this official
// NCAA GraphQL endpoint. The query is undocumented, so failures are surfaced
// without replacing the last known-good result set.
export const NCAA_DATA_URL = 'https://sdataprod.ncaa.com/';
export const NCAA_BRACKET_URL = 'https://www.ncaa.com/brackets/soccer-men/d3/2026';
export const NCAA_CHAMPIONSHIP_ID = 6432;
export const NCAA_QUERY_HASH = 'e651c2602fb9e82cdad6e947389600c6b69e0e463e437b78bf7ec614d6d15f80';

// This order is the official bracket order. Bracket IDs 101-132 correspond to
// indexes 0-31, 201-216 to the next round, and so on.
export const FIRST_ROUND = [
  ['Williams', 'John Jay'], ['Johns Hopkins', 'Roger Williams'],
  ['Southwestern (TX)', 'Hardin-Simmons'], ['Trinity (TX)', 'La Verne'],
  ['Amherst', 'Stevens'], ['Messiah', 'Vassar'],
  ['Case Western Reserve', 'Penn St.-Behrend'], ['Hope', 'Transylvania'],
  ['Tufts', 'Penn St.-Abington'], ['Babson', 'SUNY Oneonta'],
  ["Saint John's (MN)", 'MSOE'], ['North Park', 'Whitman'],
  ['St. Olaf', 'Grinnell'], ['Wisconsin-Superior', 'Loras'],
  ['UChicago', 'Webster'], ['Calvin', 'Wisconsin-Eau Claire'],
  ['Middlebury', "Saint Joseph's (ME)"], ['Hobart', 'Wheaton (MA)'],
  ['Montclair State', 'Southern Virginia'], ['Cortland', 'Christopher Newport'],
  ['Hamilton', 'Allegheny'], ['Denison', 'Plattsburgh State'],
  ['Rowan', 'Marymount (VA)'], ['Washington & Lee', 'Colorado College'],
  ['Connecticut College', 'UMass Boston'], ['Carnegie Mellon', 'Salem State'],
  ['Lynchburg', 'Covenant'], ['Kenyon', 'Ohio Northern'],
  ['Bowdoin', 'Thomas (ME)'], ['St. Lawrence', 'Neumann'],
  ['Wesleyan (CT)', 'SUNY Geneseo'], ['Scranton', 'Manhattanville']
];

export function buildNcaaUrl() {
  const url = new URL(NCAA_DATA_URL);
  url.searchParams.set('operationName', 'get_championship_ncaa');
  url.searchParams.set('extensions', JSON.stringify({
    persistedQuery: {version: 1, sha256Hash: NCAA_QUERY_HASH}
  }));
  url.searchParams.set('variables', JSON.stringify({
    sportUrl: 'soccer-men', division: 3, year: 2026
  }));
  return url.toString();
}

const gameKey = (round, game) => `r${round}m${game}`;
const text = value => String(value ?? '').trim();
const numeric = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isInteger(number)) return number;
  }
  return NaN;
};

function contestPosition(contest) {
  const bracketId = numeric(contest?.bracketId, contest?.bracket_id);
  const roundNumber = numeric(
    contest?.roundNumber, contest?.round, contest?.championshipRound,
    Number.isInteger(bracketId) ? Math.floor(bracketId / 100) : NaN
  );
  const round = roundNumber - 1;
  const game = bracketId % 100 - 1;
  const expectedGames = 32 / (2 ** round);
  if (!Number.isInteger(round) || round < 0 || round > 5 ||
      !Number.isInteger(game) || game < 0 || game >= expectedGames) return null;
  return {round, game};
}

export function isFinalContest(contest) {
  if (text(contest?.gameState).toUpperCase() === 'F') return true;
  const status = [contest?.statusCodeDisplay, contest?.finalMessage, contest?.status]
    .map(value => text(value).toLowerCase()).join(' ');
  return /\bfinal\b/.test(status);
}

function teamIdentity(team) {
  return text(team?.seoname || team?.seoName || team?.id || team?.teamId ||
    team?.nameShort || team?.shortName || team?.nameFull || team?.name);
}

function contestTeams(contest) {
  const teams = Array.isArray(contest?.teams) ? contest.teams :
    Array.isArray(contest?.team) ? contest.team : [];
  // The bracket feed explicitly identifies the top and bottom slots. Respect
  // those slots even if an upstream serializer changes the array order.
  return teams.every(team => typeof team?.isTop === 'boolean')
    ? [...teams].sort((left, right) => Number(right.isTop) - Number(left.isTop))
    : teams;
}

/**
 * Convert official NCAA contests into the app's r{round}m{game} winner map.
 * A displayed soccer score is deliberately never consulted: NCAA's isWinner
 * field identifies who advanced after regulation, OT/2OT, or penalties.
 */
export function extractOfficialResults(contests) {
  if (!Array.isArray(contests)) throw new Error('NCAA contests payload is not an array');

  const championship = contests.filter(contest =>
    numeric(contest?.championshipId, contest?.championship?.id) === NCAA_CHAMPIONSHIP_ID &&
    contestPosition(contest)
  );
  const ordered = championship.sort((a, b) => {
    const left = contestPosition(a), right = contestPosition(b);
    return left.round - right.round || left.game - right.game;
  });

  // Learn NCAA's team identifiers from its first-round bracket positions. This
  // avoids fragile school-name aliases in later rounds.
  const canonicalByIdentity = new Map();
  for (const contest of ordered) {
    const position = contestPosition(contest);
    if (position.round !== 0) continue;
    const teams = contestTeams(contest);
    if (teams.length !== 2) throw new Error(`NCAA game ${gameKey(0, position.game)} does not have two teams`);
    teams.forEach((team, index) => {
      const identity = teamIdentity(team);
      if (!identity) throw new Error(`NCAA game ${gameKey(0, position.game)} has a team without an identity`);
      canonicalByIdentity.set(identity, FIRST_ROUND[position.game][index]);
    });
  }

  const results = {};
  for (const contest of ordered) {
    if (!isFinalContest(contest)) continue;
    const position = contestPosition(contest);
    const teams = contestTeams(contest);
    const winners = teams.filter(team => team?.isWinner === true);
    if (winners.length !== 1) {
      throw new Error(`Final NCAA game ${gameKey(position.round, position.game)} does not name exactly one winner`);
    }

    let winner;
    if (position.round === 0) {
      const winnerIndex = teams.indexOf(winners[0]);
      winner = FIRST_ROUND[position.game][winnerIndex];
    } else {
      winner = canonicalByIdentity.get(teamIdentity(winners[0]));
      const upstream = [
        results[gameKey(position.round - 1, position.game * 2)],
        results[gameKey(position.round - 1, position.game * 2 + 1)]
      ];
      if (!winner || !upstream.includes(winner)) {
        throw new Error(`NCAA winner for ${gameKey(position.round, position.game)} does not follow the bracket path`);
      }
    }
    results[gameKey(position.round, position.game)] = winner;
  }
  return results;
}

export function assertResultsDoNotRegress(previous, next) {
  for (const [key, winner] of Object.entries(previous || {})) {
    if (next?.[key] !== winner) {
      throw new Error(`NCAA result ${key} disappeared or changed; keeping the last known-good results`);
    }
  }
}

export function formatSyncError(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const parts = [
      error.message,
      error.details && `Details: ${error.details}`,
      error.hint && `Hint: ${error.hint}`,
      error.code && `Code: ${error.code}`
    ].filter(Boolean);
    if (parts.length) return parts.join(' | ');
    try { return JSON.stringify(error); } catch { /* fall through */ }
  }
  return String(error);
}
