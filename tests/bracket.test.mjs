import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_ROUND, TEAM_LOGOS, TEAM_NPI_RANKS, ROUND_POINTS, LOCK_AT, gameKey, gameCount,
  allGameKeys, matchup, chooseWinner, normalizePicks, isTeamEliminated, scoreBracket, maxScore
} from '../data.js';

test('64 unique schools, 32 matches and 63 bracket decisions', () => {
  assert.equal(FIRST_ROUND.length, 32);
  assert.equal(new Set(FIRST_ROUND.flat()).size, 64);
  assert.deepEqual([0,1,2,3,4,5].map(gameCount),[32,16,8,4,2,1]);
  assert.equal(allGameKeys().length, 63);
  assert.equal(new Set(allGameKeys()).size, 63);
});

test('verified first-round fixtures include Carnegie Mellon vs Salem State', () => {
  assert.deepEqual(FIRST_ROUND[25], ['Carnegie Mellon','Salem State']);
  assert.deepEqual(FIRST_ROUND[0], ['Williams','John Jay']);
  assert.deepEqual(FIRST_ROUND[8], ['Tufts','Penn St.-Abington']);
  assert.deepEqual(FIRST_ROUND[16], ['Middlebury',"Saint Joseph's (ME)"]);
  assert.deepEqual(FIRST_ROUND[31], ['Scranton','Manhattanville']);
});

test('every tournament team has an official NCAA logo', () => {
  const teams=FIRST_ROUND.flat();
  assert.equal(Object.keys(TEAM_LOGOS).length,64);
  for (const team of teams) {
    assert.match(TEAM_LOGOS[team], /^https:\/\/www\.ncaa\.com\//, `${team} is missing an NCAA logo`);
  }
});

test('every tournament team has its official NCAA selection NPI rank', () => {
  const teams=FIRST_ROUND.flat();
  assert.equal(Object.keys(TEAM_NPI_RANKS).length,64);
  for (const team of teams) {
    assert.equal(Number.isInteger(TEAM_NPI_RANKS[team]),true,`${team} is missing an NPI rank`);
    assert.ok(TEAM_NPI_RANKS[team] > 0,`${team} has an invalid NPI rank`);
  }
  assert.equal(TEAM_NPI_RANKS.Williams,1);
  assert.equal(TEAM_NPI_RANKS['Case Western Reserve'],9);
  assert.equal(TEAM_NPI_RANKS['John Jay'],246);
});

test('advancing one winner determines next-round contenders', () => {
  let picks={};
  picks=chooseWinner(picks,0,0,'Williams');
  picks=chooseWinner(picks,0,1,'Johns Hopkins');
  assert.deepEqual(matchup(1,0,picks),['Williams','Johns Hopkins']);
  picks=chooseWinner(picks,1,0,'Williams');
  assert.equal(picks.r1m0,'Williams');
});

test('changing an early pick invalidates dependent later-round predictions', () => {
  let picks={};
  picks=chooseWinner(picks,0,0,'Williams');
  picks=chooseWinner(picks,0,1,'Johns Hopkins');
  picks=chooseWinner(picks,1,0,'Williams');
  picks=chooseWinner(picks,0,0,'John Jay');
  assert.equal(picks.r0m0,'John Jay');
  assert.equal(picks.r1m0,undefined);
});

test('normalization refuses impossible advancements', () => {
  assert.deepEqual(normalizePicks({r0m0:'Calvin',r1m0:'Williams',r0m2:'Southwestern (TX)'}),{r0m2:'Southwestern (TX)'});
});

test('a team eliminated by an earlier official result stays marked out downstream', () => {
  const picks={r0m26:'Lynchburg',r0m27:'Kenyon',r1m13:'Kenyon',r2m6:'Kenyon'};
  const results={r0m27:'Ohio Northern'};
  assert.equal(isTeamEliminated('Kenyon',1,13,picks,results),true);
  assert.equal(isTeamEliminated('Kenyon',2,6,picks,results),true);
  assert.equal(isTeamEliminated('Lynchburg',1,13,picks,results),false);
  assert.equal(isTeamEliminated('Kenyon',1,13,picks,{r0m27:'Kenyon'}),false);
});

test('all round scores use 10/20/40/80/160/320 and total 1920', () => {
  assert.deepEqual(ROUND_POINTS,[10,20,40,80,160,320]);
  assert.equal(maxScore,1920);
  let picks={};
  for(let r=0;r<6;r++) for(let g=0;g<gameCount(r);g++) {
    const winner=matchup(r,g,picks)[0];
    picks=chooseWinner(picks,r,g,winner);
  }
  assert.equal(Object.keys(picks).length,63);
  assert.deepEqual(scoreBracket(picks,picks).total,1920);
  assert.deepEqual(scoreBracket({},picks).total,0);
});

test('first-round deadline is noon Eastern on Nov 13 2026',()=>{
  assert.equal(LOCK_AT,'2026-11-13T17:00:00Z');
  assert.equal(new Date(LOCK_AT).toISOString(),'2026-11-13T17:00:00.000Z');
});
