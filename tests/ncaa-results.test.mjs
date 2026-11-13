import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNcaaUrl, extractOfficialResults, isFinalContest, assertResultsDoNotRegress,
  formatSyncError
} from '../supabase/functions/_shared/ncaa-results.js';

const team = (seoname, isWinner = false, score = '0') => ({seoname, isWinner, score});
const contest = ({bracketId, teams, gameState = 'F', finalMessage = 'Final'}) => ({
  championshipId: 6432,
  bracketId,
  roundNumber: Math.floor(bracketId / 100),
  gameState,
  finalMessage,
  teams
});

test('builds the official NCAA persisted-query request', () => {
  const url = new URL(buildNcaaUrl());
  assert.equal(url.hostname, 'sdataprod.ncaa.com');
  assert.equal(url.searchParams.get('operationName'), 'get_championship_ncaa');
  assert.deepEqual(JSON.parse(url.searchParams.get('variables')), {
    sportUrl: 'soccer-men', division: 3, year: 2026
  });
});

test('imports a regulation winner only after the NCAA marks the game final', () => {
  const pending = contest({
    bracketId: 101, gameState: 'I', finalMessage: '',
    teams: [team('williams', true, '2'), team('john-jay', false, '0')]
  });
  assert.equal(isFinalContest(pending), false);
  assert.deepEqual(extractOfficialResults([pending]), {});

  pending.gameState = 'F';
  assert.deepEqual(extractOfficialResults([pending]), {r0m0: 'Williams'});
});

test('respects NCAA top/bottom slots if team array order changes', () => {
  const game = contest({
    bracketId: 101,
    teams: [
      {...team('john-jay', true, '1'), isTop: false},
      {...team('williams', false, '0'), isTop: true}
    ]
  });
  assert.deepEqual(extractOfficialResults([game]), {r0m0: 'John Jay'});
});

test('uses NCAA isWinner rather than a tied displayed score after 2OT', () => {
  const game = contest({
    bracketId: 102, finalMessage: 'Final (2OT)',
    teams: [team('johns-hopkins', false, '1'), team('roger-williams', true, '1')]
  });
  assert.deepEqual(extractOfficialResults([game]), {r0m1: 'Roger Williams'});
});

test('uses NCAA isWinner rather than a tied displayed score after penalties', () => {
  const game = contest({
    bracketId: 103, finalMessage: 'Final (PK)',
    teams: [team('southwestern-tx', true, '0'), team('hardin-simmons', false, '0')]
  });
  assert.deepEqual(extractOfficialResults([game]), {r0m2: 'Southwestern (TX)'});
});

test('maps a later-round NCAA team identity through completed first-round games', () => {
  const games = [
    contest({bracketId: 101, teams: [team('williams', true, '2'), team('john-jay')]}),
    contest({bracketId: 102, teams: [team('johns-hopkins'), team('roger-williams', true, '1')]}),
    contest({bracketId: 201, teams: [team('williams'), team('roger-williams', true, '1')]})
  ];
  assert.deepEqual(extractOfficialResults(games), {
    r0m0: 'Williams', r0m1: 'Roger Williams', r1m0: 'Roger Williams'
  });
});

test('rejects ambiguous finals and result regressions', () => {
  const ambiguous = contest({
    bracketId: 101,
    teams: [team('williams', false, '1'), team('john-jay', false, '1')]
  });
  assert.throws(() => extractOfficialResults([ambiguous]), /exactly one winner/);
  assert.throws(
    () => assertResultsDoNotRegress({r0m0: 'Williams'}, {}),
    /last known-good results/
  );
});

test('preserves useful Supabase error details for failed syncs', () => {
  assert.equal(
    formatSyncError({message:'permission denied',details:'table tournament_first_round',hint:'grant select',code:'42501'}),
    'permission denied | Details: table tournament_first_round | Hint: grant select | Code: 42501'
  );
  assert.equal(formatSyncError(new Error('NCAA returned HTTP 503')), 'NCAA returned HTTP 503');
});
