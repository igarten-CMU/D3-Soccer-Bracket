import {
  FIRST_ROUND, TEAM_LOGOS, TEAM_NPI_RANKS, ROUND_NAMES, ROUND_SHORT, ROUND_POINTS,
  LOCK_AT, NCAA_BRACKET_URL, gameKey, gameCount, allGameKeys,
  matchup, normalizePicks, chooseWinner, isTeamEliminated, scoreBracket, maxScore
} from './data.js?v=20261113-npi-ranks';
import {makeStore} from './store.js';

const $app = document.getElementById('app');
const localDraftKey = 'd3soccer2026-draft';
const lastPoolKey = 'd3soccer2026-pool';
const state = {
  store:null, user:null, profile:'', pools:[], room:null,
  picks:{}, roundStart:0, view:'bracket', modal:null, authEmail:false, viewedBracket:null,
  saveStatus:'', loading:false, toast:null, error:null
};
let saveTimer=null;
let saveQueue=Promise.resolve();
let toastTimer=null;

const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeAttr = h;
const icon = name => ({trophy:'🏆',ball:'⚽',clock:'◷',people:'♟',bolt:'✦',check:'✓',invite:'↗',refresh:'↻',lock:'⌁'}[name]||name);
const isLocked = () => Date.now() >= Date.parse(state.room?.pool?.lock_at || LOCK_AT);
const publishedResults = () => normalizePicks(state.room?.officialResults?.results || {});
const myScore = () => scoreBracket(state.picks, publishedResults());
const selectedPoolId = () => state.room?.pool?.id || '';
const pickCount = () => Object.keys(state.picks).length;
const participantCount = () => state.room?.members?.length || 0;
const isPoolOwner = () => !!state.room && state.room.pool.owner_id===state.user?.id;
const visibleRoundCount = () => window.matchMedia('(max-width: 560px)').matches ? 2 : 3;
const lastRoundStart = () => ROUND_NAMES.length-visibleRoundCount();
const draft = () => { try {return normalizePicks(JSON.parse(localStorage.getItem(localDraftKey) || '{}'));} catch {return {};} };
const saveDraftLocal = picks => localStorage.setItem(localDraftKey, JSON.stringify(picks));
const statusText = () => isLocked() ? 'Picks locked' : state.saveStatus || (state.room ? 'Auto-save enabled' : 'Saved in this browser');
const humanDeadline = 'Fri, Nov 13 · 12 PM ET';

function notify(message, error=false) {
  state.toast={message,error}; render();
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{state.toast=null;render();},4500);
}
function showError(e) { console.error(e); notify(e?.message || 'Something went wrong. Please try again.',true); }

async function bootstrap() {
  try {
    state.store=await makeStore();
    state.user=await state.store.user();
    state.picks=draft();
    if (state.user) {
      state.profile=await state.store.profile(state.user);
      if (state.profile) await refreshPools();
      else state.modal='profile';
    } else if (!state.store.demo) {
      state.modal='auth';
    }
    const code=new URLSearchParams(location.search).get('join');
    if (code && state.user && state.profile) await joinFromInvite(code);
    render();
  } catch (e) { state.error=e.message || String(e); render(); }
}

async function refreshPools() {
  state.pools=await state.store.pools(state.user);
  const remembered=localStorage.getItem(lastPoolKey);
  const found=state.pools.find(p=>p.id===remembered) || state.pools[0];
  if (found) await loadPool(found.id);
}

async function loadPool(id) {
  const previous = state.room?.pool?.id;
  const data=await state.store.room(id);
  state.room=data;
  localStorage.setItem(lastPoolKey,id);
  let personal=data.brackets.find(b=>b.user_id===state.user?.id)?.picks;
  // Reuse a pre-group draft when entering a new, unstarted challenge.
  if (!personal && !isLocked()) {
    personal=draft();
    if (Object.keys(personal).length) {
      await state.store.savePicks(id,state.user.id,personal);
      data.brackets.push({user_id:state.user.id,picks:personal,created_at:new Date().toISOString()});
    }
  }
  state.picks=normalizePicks(personal || {});
  state.saveStatus='All changes saved';
  if (previous && previous!==id) {state.viewedBracket=null;state.roundStart=0;state.view='bracket';}
}

async function joinFromInvite(code) {
  await flushPendingSave();
  const id=await state.store.joinPool(code);
  state.pools=await state.store.pools(state.user);
  await loadPool(id);
  state.modal=null;
  const url=new URL(location.href); url.searchParams.delete('join');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
}

async function flushPendingSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await savePicks(false);
  }
  await saveQueue.catch(() => {});
}

function queueSave() {
  clearTimeout(saveTimer);
  saveDraftLocal(state.picks);
  state.saveStatus=state.room ? 'Saving…' : 'Saved in this browser';
  render();
  if (state.room && !isLocked()) saveTimer=setTimeout(()=>savePicks(false),850);
}

async function savePicks(showFeedback=true) {
  clearTimeout(saveTimer);
  if (!state.room) { saveDraftLocal(state.picks);if(showFeedback)notify('Saved locally. Create or join a group for shared scores.');return; }
  if (isLocked()) { if(showFeedback)notify('The bracket is locked. Picks can no longer be edited.',true); return; }
  const poolId=selectedPoolId(),userId=state.user?.id, snapshot=structuredClone(state.picks);
  saveQueue=saveQueue.catch(()=>{}).then(()=>state.store.savePicks(poolId,userId,snapshot));
  try {
    await saveQueue;
    if (selectedPoolId()===poolId && JSON.stringify(state.picks)===JSON.stringify(snapshot)) {
      state.saveStatus='All changes saved';
      const row=state.room.brackets.find(b=>b.user_id===userId);
      if(row) row.picks=snapshot;
      else state.room.brackets.push({user_id:userId,picks:snapshot,created_at:new Date().toISOString()});
    }
    if(showFeedback) notify('Your bracket has been saved.'); else render();
  } catch(e) {state.saveStatus='Could not save'; showError(e);}
}

function bracketRows() {
  if (!state.room) return [];
  const results=publishedResults();
  const now=Date.now();
  const rows=state.room.members.map(member=>{
    const record=state.room.brackets.find(b=>b.user_id===member.user_id);
    const picks=record?.picks || {};
    const score=scoreBracket(picks,results);
    return {
      id:member.user_id,
      name:member.profiles?.display_name || 'Player',
      isYou:member.user_id===state.user?.id,
      score:score.total,
      correct:score.correct,
      champion:picks[gameKey(5,0)] || null,
      picks,
      entered:!!record,
      createdAt:record?.created_at || '9999',
    };
  });
  rows.sort((a,b)=>b.score-a.score || b.correct-a.correct || a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
  return rows.map((x,i)=>({...x,rank:i && x.score===rows[i-1].score && x.correct===rows[i-1].correct?null:i+1}));
}

function render() {
  const scroller=document.querySelector('.bracket-scroll');
  const pos={left:scroller?.scrollLeft||0,top:scroller?.scrollTop||0};
  if (state.error) {
    $app.innerHTML=`<main class="shell"><div class="empty-state"><div class="empty-icon">⚠</div><h3>Unable to load the challenge</h3><p>${h(state.error)}</p><button class="btn" data-action="retry">Try again</button></div></main>`;
    return;
  }
  const score=myScore();
  $app.innerHTML=`
    <div class="shell">
      ${renderTopbar()}
      ${state.store?.demo ? `<div class="demo-notice"><strong>Local preview mode.</strong> Your picks save in this browser, but invites and shared leaderboards require a free Supabase project and hosting. See README.md in the project package.</div>` : !state.user ? `<div class="demo-notice"><strong>You're viewing as a guest.</strong> You can explore the bracket, but log in to save online and compete with friends.</div>` : ''}
      <div class="metrics">
        ${metric('Your picks',`${pickCount()}<span class="small">/ 63</span>`, `<div class="progress-track"><div class="progress-fill" style="width:${pickCount()/63*100}%"></div></div>`,true)}
        ${metric('Your points',`${score.total}<span class="small">/ ${maxScore}</span>`,`${score.correct} correct predictions`,false)}
        ${metric('Challenge members',String(participantCount()),state.room ? 'Competing in this group' : 'Create a group to invite friends',false)}
        ${metric('Bracket deadline','NOV 13', 'Friday · 12:00 PM ET',false)}
      </div>
      <div class="main-layout">
        <main class="card bracket-card">${renderMainContent()}</main>
        <aside class="side">${renderSidebar()}</aside>
      </div>
      <footer class="footer"><span>D3 SOCCER BRACKET / 2026 MEN'S CHAMPIONSHIP &nbsp; • &nbsp; An independent fan project, not affiliated with the NCAA.</span><a href="${NCAA_BRACKET_URL}" target="_blank" rel="noopener noreferrer">View official NCAA bracket ↗</a></footer>
    </div>
    ${renderModal()}
    ${state.toast ? `<div class="toast ${state.toast.error?'error':''}" role="status">${h(state.toast.message)}</div>`:''}
  `;
  const newScroller=document.querySelector('.bracket-scroll');
  if(newScroller){newScroller.scrollLeft=pos.left;newScroller.scrollTop=pos.top;}
}

function metric(label, number, foot, accent) {
  return `<div class="metric"><div class="micro">${label}</div><div class="num ${accent?'accent':''}">${number}</div><div class="small">${foot}</div></div>`;
}

function renderTopbar() {
  const hasProfile=!!state.profile;
  return `<header class="topbar">
    <a class="brand" href="./" aria-label="D3 Soccer Bracket homepage"><span class="brandmark">D3</span><span class="brandword">D3 Soccer <span>Bracket</span></span></a>
    <nav class="nav" aria-label="Site navigation">
      <button class="nav-btn ${state.view==='bracket'||state.view==='friend-bracket'?'active':''}" data-action="view" data-view="bracket">My bracket</button>
      <button class="nav-btn ${state.view==='leaderboard'?'active':''}" data-action="view" data-view="leaderboard">Leaderboard</button>
      <button class="nav-btn ${state.view==='rules'?'active':''}" data-action="view" data-view="rules">Rules</button>
    </nav>
    <div class="topright">
      ${hasProfile ? `<button class="avatar" data-action="profile" title="Change your display name">${h(state.profile.slice(0,1).toUpperCase())}</button><span class="profile-name">${h(state.profile)}</span><button class="signout" data-action="signout" title="Sign out of your account">Sign out</button>`
      : `<button class="btn btn-small" data-action="auth">Log in</button>`}
    </div>
  </header>`;
}

function renderMainContent() {
  if (state.view==='leaderboard') return renderLeaderboard();
  if (state.view==='rules') return renderRules();
  if (state.view==='friend-bracket') return renderFriendBracket();
  const count=Object.keys(state.picks).length;
  const canEdit=!isLocked();
  return `
    <div class="card-head">
      <div><div class="section-kicker">Tournament central / 2026</div>
        <h2>Your tournament bracket</h2>
        <p>Click a team to advance it. Finish one round to reveal the next.</p></div>
      <span class="status-chip ${!canEdit?'locked':''}">${canEdit ? 'PICKS OPEN' : 'LOCKED'}</span>
    </div>
    ${renderRoundNavigation()}
    <div class="bracket-instructions"><span><i class="live-pip"></i>Tap any team to advance it</span><span>${count} / 63 picks filled</span></div>
    <div class="bracket-scroll">${renderRoundWindow(state.picks,canEdit,'Your tournament bracket')}</div>
    <div class="section-footer"><div class="savestate">✓ ${h(statusText())}</div>
      <div class="manage-group">
        <button class="btn btn-small btn-outline" data-action="reset" ${!canEdit||count===0?'disabled':''}>Clear picks</button><button class="btn btn-small" data-action="save" ${!canEdit||!count?'disabled':''}>Save bracket →</button>
      </div>
    </div>`;
}

function renderFriendBracket() {
  const bracket=state.viewedBracket;
  if (!bracket) {state.view='leaderboard';return renderLeaderboard();}
  const count=Object.keys(bracket.picks).length;
  return `
    <div class="card-head">
      <div><div class="section-kicker">Locked challenge bracket</div><h2>${h(bracket.name)}’s bracket</h2>
        <p>These picks became visible to challenge members when brackets locked.</p></div>
      <button class="btn btn-outline btn-small" data-action="friend-back">← Standings</button>
    </div>
    ${renderRoundNavigation()}
    <div class="bracket-instructions"><span><i class="live-pip"></i>Read-only bracket</span><span>${count} / 63 picks filled</span></div>
    <div class="bracket-scroll">${renderRoundWindow(bracket.picks,false,`${bracket.name}’s tournament bracket`)}</div>
    <div class="section-footer"><div class="savestate">🔒 Locked at kickoff</div><button class="btn btn-outline btn-small" data-action="friend-back">Back to standings</button></div>`;
}

function renderRoundNavigation() {
  const count=visibleRoundCount(), lastStart=lastRoundStart();
  state.roundStart=Math.min(state.roundStart,lastStart);
  const first=ROUND_NAMES[state.roundStart], last=ROUND_NAMES[state.roundStart+count-1];
  const range=count===1?first:`${first} – ${last}`;
  return `<div class="round-window-nav" aria-label="Change visible tournament rounds">
    <button class="round-window-btn" data-action="round-window" data-direction="-1" ${state.roundStart===0?'disabled':''}>← Previous round</button>
    <div class="round-window-status" aria-live="polite"><strong>${h(range)}</strong><small>${count} round${count===1?'':'s'} shown</small></div>
    <button class="round-window-btn" data-action="round-window" data-direction="1" ${state.roundStart===lastStart?'disabled':''}>Next round →</button>
  </div>`;
}

function renderRoundWindow(picks,canEdit,label) {
  const rounds=Array.from({length:visibleRoundCount()},(_,index)=>state.roundStart+index);
  return `<div class="round-window" aria-label="${safeAttr(label)}">
    ${rounds.map(round=>renderRound(round,picks,canEdit,state.roundStart)).join('')}
  </div>`;
}

function renderRound(round,picks,canEdit,windowStart) {
  const gameIds=Array.from({length:gameCount(round)},(_,game)=>game);
  const step=round-windowStart, pitch=160;
  const topOffset=pitch*(2**step-1)/2;
  const cardGap=pitch*(2**step)-148;
  return `<section class="round-panel" style="--round-top:${topOffset}px;--round-gap:${cardGap}px"><div class="round-panel-head"><div><strong>${h(ROUND_NAMES[round])}</strong><span>+${ROUND_POINTS[round]} points</span></div><small>${gameIds.length} matchup${gameIds.length===1?'':'s'}</small></div>
    <div class="match-list">${gameIds.map((game)=>renderGameCard(round,game,picks,canEdit)).join('')}</div></section>`;
}

const teamInitials = team => String(team || '?').replace(/\([^)]*\)/g,'').split(/[\s.-]+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
function teamLogo(team, large=false) {
  if (!team) return `<span class="team-logo ${large?'large':''} empty-logo">?</span>`;
  const url=TEAM_LOGOS[team];
  return `<span class="team-logo ${large?'large':''}"><span class="team-logo-fallback">${h(teamInitials(team))}</span>${url?`<img src="${safeAttr(url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:''}</span>`;
}

function teamNpiRank(team) {
  const rank=TEAM_NPI_RANKS[team];
  return rank ? `<sup class="npi-rank" title="NCAA NPI rank ${rank}">#${rank}</sup>` : '';
}

function renderGameCard(round,game,picks,canEdit) {
  const opts=matchup(round,game,picks),key=gameKey(round,game),picked=picks[key];
  const results=publishedResults(),result=results[key];
  const pickCorrect=!!result && picked===result;
  const pickWrong=!!result && !!picked && picked!==result;
  const resultLabel=pickCorrect?'CORRECT PICK':pickWrong?'INCORRECT PICK':result?'FINAL RESULT':'PICK WINNER';
  const cardClass=pickCorrect?'pick-correct':pickWrong?'pick-wrong':'';
  return `<article class="game-card ${cardClass}" aria-label="Game ${key}">
    <div class="game-choices">
      <div class="game-topline"><span>${resultLabel}</span><b>${ROUND_SHORT[round]}-${game+1}</b></div>
      ${opts.map((team)=>{
      const selected=!!team && team===picked;
      const correct=!!result && result===team && !pickWrong;
      const wrong=!!result && selected && picked!==result;
      const eliminated=isTeamEliminated(team,round,game,picks,results);
      const classes=['team-btn',selected?'selected':'',correct?'result-win':'',wrong?'wrong':'',eliminated?'eliminated':'',!team?'empty':''].filter(Boolean).join(' ');
      const disabled=!canEdit||!team;
      return `<button class="${classes}" data-action="pick" data-round="${round}" data-game="${game}" data-team="${safeAttr(team||'')}" ${disabled?'disabled':''} title="${team?`Advance ${safeAttr(team)}`:'Pick previous round first'}">
          ${teamLogo(team)}<span class="team-name">${teamNpiRank(team)}<span class="team-label">${h(team || 'Winner from previous round')}</span>${eliminated?'<small class="out-badge">OUT</small>':''}</span><span class="selection-ring" aria-hidden="true">${selected?'<i></i>':''}</span>
        </button>`;
      }).join('')}
      <div class="game-meta"><span>${result?'Official result':'Matchup'}</span><span>${result?'Final':`${ROUND_SHORT[round]} · Game ${game+1}`}</span></div>
    </div>
    <div class="my-pick"><div class="my-pick-logo">${picked?teamLogo(picked,true):'<span class="pick-placeholder">—</span>'}</div><small>My pick</small><strong>${h(picked || 'Choose a team')}</strong></div>
  </article>`;
}

function renderSidebar() {
  const rows=bracketRows();
  const pool=state.room?.pool;
  return `
    <div class="card side-card pool-highlight">
      <div class="section-kicker">Your challenge</div>
      ${pool ? `<div class="pool-id"><div class="pool-icon">⚑</div><div><div class="pool-name">${h(pool.name)}</div><div class="pool-code">CODE: ${h(pool.invite_code)}</div></div></div>
        <p class="sub">${participantCount()} player${participantCount()===1?'':'s'} in your group. Challenge your friends to out-predict you.</p>
        <button class="btn" data-action="share">↗ &nbsp; Share invite link</button>`
        : `<div class="pool-id"><div class="pool-icon">⚑</div><div><div class="pool-name">No group yet</div><div class="pool-code">MAKE IT COMPETITIVE</div></div></div>
          <p class="sub">Your draft is ready. Create a group to track points and compare brackets with friends.</p><button class="btn" data-action="create">＋ &nbsp; Create a challenge</button>`}
      <button class="btn btn-outline" data-action="join">Join another group</button>
      ${state.pools.length>1 ? `<select class="switcher" id="pool-switch" aria-label="Switch challenge">${state.pools.map(p=>`<option value="${safeAttr(p.id)}" ${pool?.id===p.id?'selected':''}>${h(p.name)}</option>`).join('')}</select>`:''}
      ${isPoolOwner() ? `<button class="btn btn-danger btn-small" data-action="delete-pool">Delete league</button>` : ''}
    </div>
    <div class="card side-card">
      <h3>Standings</h3>
      <p class="sub">Scores update automatically from finalized NCAA results every 30 minutes.</p>
      <div class="leader-mini">
        ${rows.length ? rows.slice(0,4).map((r,i)=>`<div class="leader-mini-row"><span class="rank-bubble">${i+1}</span><span class="${r.isYou?'you':''}">${h(r.name)}${r.isYou?' (you)':''}</span><small>${r.score} pts</small></div>`).join('')
          : `<div class="small-muted" style="padding:9px 0">Your leaderboard appears when you join a group.</div>`}
      </div>
      <button class="btn btn-outline btn-small" data-action="view" data-view="leaderboard">Full leaderboard ↗</button>
    </div>
    <div class="card side-card">
      <h3>Rules</h3>
      <div class="deadline"><div class="deadline-ico">◷</div><div><div class="deadline-date">${humanDeadline}</div><div class="deadline-small">All predictions lock at kickoff</div></div></div>
      <hr class="side-divider">
      <div class="mini-label">Points for a correct pick</div>
      <div class="round-points">${ROUND_NAMES.map((r,i)=>`<div><span>${h(r)}</span><strong>+${ROUND_POINTS[i]}</strong></div>`).join('')}</div>
      <a class="side-link" href="${NCAA_BRACKET_URL}" target="_blank" rel="noopener noreferrer">Official NCAA tournament bracket ↗</a>
    </div>`;
}

function renderLeaderboard() {
  const rows=bracketRows();
  const results=publishedResults();
  const decided=Object.keys(results).length;
  const prelock=!isLocked();
  const synced=state.room?.officialResults?.synced_at;
  const syncFailed=!!state.room?.officialResults?.last_error;
  const syncStatus=syncFailed ? 'The latest NCAA sync failed; existing scores remain unchanged.'
    : synced ? `Official NCAA results synced ${new Date(synced).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}.`
      : 'Waiting for the first official NCAA results sync.';
  return `<div class="content-panel">
    <div class="leaderboard-heading"><div><div class="section-kicker">Bragging rights on the line</div><h2>${state.room?h(state.room.pool.name):'Group leaderboard'}</h2>
      <p>${decided} of 63 official games completed. ${prelock?'Brackets stay private until kickoff.':''} ${h(syncStatus)}</p></div>
      <button class="btn btn-outline btn-small" data-action="refresh">↻ Refresh</button></div>
    ${rows.length ? `<div class="table-wrap"><table class="leader-table"><thead><tr><th>Rank</th><th>Player</th><th>Points</th><th>Correct</th><th>National champion pick</th><th>Bracket</th></tr></thead>
      <tbody>${rows.map((r,i)=>`<tr class="${r.isYou?'self':''}"><td class="rank">${r.rank||'—'}</td><td class="player">${h(r.name)} ${r.isYou?'<span class="badge-demo">YOU</span>':''}</td><td class="score">${r.score}</td><td class="muted">${r.correct}</td><td class="muted">${prelock && !r.isYou ? 'Hidden until brackets lock' : !r.entered ? 'Not yet saved' : h(r.champion||'Not yet picked')}</td><td>${prelock && !r.isYou ? '<span class="muted">Locked</span>' : r.entered ? `<button class="view-bracket-btn" data-action="view-bracket" data-user="${safeAttr(r.id)}">View bracket</button>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty-state"><div class="empty-icon">🏆</div><h3>Your league is waiting.</h3><p>Start a challenge or join a friend’s group to see the standings here.</p><button class="btn" data-action="create">Start a challenge</button></div>`}
    <div class="callout" style="margin-top:22px"><strong>Scoring:</strong> 10 / 20 / 40 / 80 / 160 / 320 points per correct winner in each successive round. A perfect bracket earns ${maxScore.toLocaleString()} points. Finalized winners are imported from NCAA.com every 30 minutes, including matches decided in overtime or on penalty kicks.</div>
  </div>`;
}

function renderRules() {
  return `<div class="content-panel"><h2 style="font-family:'Space Grotesk';font-size:27px;letter-spacing:-1px">How to play</h2>
    <p class="rule-intro">Pick the winner of each of the 63 games in the actual 2026 NCAA Division III men's soccer tournament. Your predictions move through the bracket automatically, all the way to the national champion.</p>
    <div class="rules-grid">${ROUND_NAMES.map((r,i)=>`<div class="rule-box"><div class="pts">+${ROUND_POINTS[i]}</div><div class="rtitle">${h(r)}</div></div>`).join('')}</div>
    <ol class="how-list"><li><strong>Create or join a challenge.</strong> Share the invitation link with your friends. Each group has its own standings.</li>
      <li><strong>Make your picks.</strong> Work through each round tab, from the Round of 64 through the championship. Changes to earlier games clear invalid downstream selections.</li>
      <li><strong>Save and come back.</strong> Picks auto-save in online challenges. Log in with Google using the same email to restore your saved brackets from any device. You can edit it until <strong>${humanDeadline}</strong>.</li>
      <li><strong>Climb the leaderboard.</strong> Finalized winners are imported from NCAA.com every 30 minutes. Points are awarded for picking the team that advances, including overtime and penalty-kick decisions.</li>
      <li><strong>No peeking.</strong> Other participants' bracket selections are hidden until the kickoff deadline.</li></ol>
    <div class="callout">Only the 2026 NCAA Division III <strong>men's</strong> soccer tournament is included. Games tied after regulation are determined by the team advancing from the match, including penalty kicks when necessary. <a href="${NCAA_BRACKET_URL}" target="_blank" rel="noopener noreferrer">Check the official NCAA bracket ↗</a></div>
  </div>`;
}

function renderModal() {
  if(!state.modal) return '';
  const type=state.modal;
  let body='';
  if (type==='profile') body=`<div class="section-kicker">Player profile</div><h2>What should we call you?</h2><p>This name appears on your group's leaderboard. You can change it later.</p>
    <form data-form="profile"><label for="player-name">Display name</label><input class="field" id="player-name" name="name" value="${safeAttr(state.profile)}" maxlength="40" minlength="2" required placeholder="e.g. Soccer Genius" autofocus><button type="submit" class="btn">Continue →</button></form>`;
  if (type==='auth') body=`<div class="section-kicker">Welcome</div><h2>Log in or create an account</h2>
    <p>Continue with Google to access your bracket from any device.</p>
    <button class="google-btn" data-action="google-auth" autofocus>
      <svg class="google-icon" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.259h2.909c1.703-1.568 2.684-3.878 2.684-6.615Z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.259c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.961H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.039l3.007-2.333Z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.961l3.007 2.333C4.672 5.165 6.656 3.58 9 3.58Z"/></svg>
      <span>Continue with Google</span>
    </button>
    <p class="auth-helper"><strong>New here?</strong> Your account will be created automatically.</p>
    <p class="auth-match-note">Already have an account? Use the Google account with the same email to keep your saved bracket.</p>
    <button class="auth-switch" data-action="email-auth">${state.authEmail?'Hide email and password':'Use email and password instead'}</button>
    ${state.authEmail?`<form class="auth-email-panel" data-form="auth">
      <h3>Email and password</h3>
      <label for="email">Email address</label><input class="field" id="email" name="email" type="email" required placeholder="you@example.com" autocomplete="email" autofocus>
      <label for="password">Password</label><input class="field" id="password" name="password" type="password" required minlength="8" placeholder="At least 8 characters" autocomplete="current-password">
      <div class="auth-actions"><button type="submit" class="btn" data-auth-mode="signin">Log in with email</button><button type="submit" class="btn btn-outline" data-auth-mode="signup">New here? Create an email account</button></div>
      <p class="auth-note">Email confirmation and password-reset email are disabled. Save your password somewhere secure.</p>
    </form>`:''}`;
  if (type==='create') body=`<div class="section-kicker">Your inner circle</div><h2>Start a challenge.</h2><p>Give your league a name, then invite friends with a private share code. You can still join other leagues later.</p>
    <form data-form="create"><label for="pool-name">Challenge name</label><input class="field" id="pool-name" name="name" required minlength="2" maxlength="80" placeholder="e.g. Tartan Soccer Crew" autofocus><button type="submit" class="btn">Create my challenge →</button></form>
    <button class="alt-link" data-action="join">Already have an invite? Join instead</button>`;
  if (type==='join') body=`<div class="section-kicker">Find your squad</div><h2>Join a challenge.</h2><p>Enter the invite code your friend shared. Your bracket will appear in the same leaderboard.</p>
    <form data-form="join"><label for="join-code">Invite code</label><input class="field" id="join-code" name="code" required placeholder="e.g. A1B2C3D4E5" style="text-transform:uppercase;letter-spacing:2px" value="${safeAttr(new URLSearchParams(location.search).get('join')||'')}" autofocus><button type="submit" class="btn">Join the challenge →</button></form>
    <button class="alt-link" data-action="create">Create your own group instead</button>`;
  if (type==='share') {
    const code=state.room?.pool?.invite_code || '';
    const url=new URL(location.pathname,location.origin);url.searchParams.set('join',code);
    body=`<div class="section-kicker">Bring your friends</div><h2>Let the games begin.</h2><p>Invite friends to <strong>${h(state.room?.pool?.name)}</strong>. They’ll join this same leaderboard with their own bracket.</p>
      <label>Invite code</label><div class="code-box" id="share-code">${h(code)}</div><button class="btn btn-outline" data-action="copy-code">Copy invite code</button>
      ${!state.store.demo?`<label style="display:block;margin-top:18px">Shareable link</label><div class="code-box" id="share-url">${h(url.href)}</div><button class="btn" data-action="copy-link">Copy invite link ↗</button>`:
      `<p style="margin-top:16px;color:#f0d9a3">Local preview: the code only works in this browser. Set up Supabase and deploy to enable working links for friends.</p>`}`;
  }
  return `<div class="modal-overlay" data-action="overlay-close"><div class="modal" role="dialog" aria-modal="true" aria-label="${h(type)} dialog"><button class="modal-close" aria-label="Close dialog" data-action="close-modal">×</button>${body}</div></div>`;
}

$app.addEventListener('click',async(event)=>{
  const button=event.target.closest('[data-action]');
  if(!button || button.disabled) return;
  const action=button.dataset.action;
  if(action==='overlay-close' && event.target!==button) return;
  try {
    if(action==='overlay-close' || action==='close-modal'){if(state.modal==='profile'&&!state.profile)return;state.modal=null;render();return;}
    if(action==='retry'){state.error=null;await bootstrap();return;}
    if(action==='auth'){state.authEmail=false;state.modal='auth';render();return;}
    if(action==='email-auth'){state.authEmail=!state.authEmail;render();return;}
    if(action==='google-auth'){
      const redirectUrl=new URL(location.href);redirectUrl.hash='';
      await state.store.signInWithGoogle(redirectUrl.href);return;
    }
    if(action==='profile'){state.modal='profile';render();return;}
    if(action==='signout'){
      await flushPendingSave();
      await state.store.signOut();
      state.user=null;state.profile='';state.pools=[];state.room=null;
      state.picks=draft();state.viewedBracket=null;state.view='bracket';state.authEmail=false;state.modal=state.store.demo?'profile':'auth';render();return;
    }
    if(action==='create'||action==='join'){
      if(!state.user){state.modal='auth';}
      else if(!state.profile){state.modal='profile';}
      else state.modal=action;
      render();return;
    }
    if(action==='share'){state.modal='share';render();return;}
    if(action==='delete-pool'){
      if(!isPoolOwner())throw new Error('Only the league creator can delete this league.');
      const poolId=selectedPoolId(), poolName=state.room.pool.name;
      const confirmed=window.confirm(`Delete “${poolName}”? This permanently removes the league and every member's bracket. This cannot be undone.`);
      if(!confirmed)return;
      await flushPendingSave();
      await state.store.deletePool(poolId);
      state.room=null;
      state.pools=await state.store.pools(state.user);
      localStorage.removeItem(lastPoolKey);
      if(state.pools[0])await loadPool(state.pools[0].id);
      else state.picks=draft();
      state.viewedBracket=null;state.view='bracket';state.roundStart=0;render();notify(`“${poolName}” was deleted.`);return;
    }
    if(action==='copy-code'||action==='copy-link'){
      const text=action==='copy-code'?document.getElementById('share-code')?.textContent:document.getElementById('share-url')?.textContent;
      await navigator.clipboard.writeText(text||''); notify(action==='copy-code'?'Invite code copied.':'Invite link copied.');return;
    }
    if(action==='view'){
      const newView=button.dataset.view;
      state.viewedBracket=null;state.view=newView;render();return;
    }
    if(action==='view-bracket'){
      if(!isLocked())throw new Error('Challenge brackets stay private until kickoff.');
      const row=bracketRows().find(item=>item.id===button.dataset.user && item.entered);
      if(!row)throw new Error('That bracket is not available.');
      state.viewedBracket={id:row.id,name:row.name,picks:normalizePicks(row.picks)};
      state.view='friend-bracket';state.roundStart=0;render();return;
    }
    if(action==='friend-back'){state.viewedBracket=null;state.view='leaderboard';render();return;}
    if(action==='round-window'){
      state.roundStart=Math.max(0,Math.min(lastRoundStart(),state.roundStart+Number(button.dataset.direction)));
      render();return;
    }
    if(action==='pick'){
      const r=Number(button.dataset.round),g=Number(button.dataset.game),t=button.dataset.team;
      if(isLocked())return;
      state.picks=chooseWinner(state.picks,r,g,t);
      queueSave();return;
    }
    if(action==='save'){await savePicks(true);return;}
    if(action==='reset'){
      if(isLocked())return;
      if(window.confirm('Clear your entire bracket? You can start again before the deadline.')){state.picks={};queueSave();}
      return;
    }
    if(action==='refresh'){
      if(state.room){await flushPendingSave();await loadPool(selectedPoolId());} render();notify('Standings are up to date.');return;
    }
  } catch(e){showError(e);}
});

$app.addEventListener('change',async event=>{
  if(event.target.id==='pool-switch'){
    try {await flushPendingSave();await loadPool(event.target.value);render();}catch(e){showError(e);}
  }
});

$app.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form]');
  if(!form)return;
  event.preventDefault();
  const type=form.dataset.form,data=new FormData(form);
  const mode=event.submitter?.dataset.authMode || 'signin';
  const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(button=>button.disabled=true);
  try {
    if(type==='auth'){
      const email=String(data.get('email')||'').trim();
      const password=String(data.get('password')||'');
      if(password.length<8)throw new Error('Use a password with at least 8 characters.');
      state.user=mode==='signup' ? await state.store.signUp(email,password) : await state.store.signIn(email,password);
      state.profile=await state.store.profile(state.user);
      if(state.profile){
        await refreshPools();
        const pendingCode=new URLSearchParams(location.search).get('join');
        if(pendingCode)await joinFromInvite(pendingCode);
        else state.modal=null;
      }else state.modal='profile';
      render();notify(mode==='signup'?'Account created. Welcome to D3 Soccer Bracket!':'Signed in successfully.');return;
    }
    if(type==='profile'){
      const name=String(data.get('name')||'').trim();
      if(name.length<2||name.length>40)throw new Error('Choose a display name between 2 and 40 characters.');
      await state.store.saveProfile(state.user,name);
      state.profile=name; state.modal=null;
      await refreshPools();
      // A newly invited player sees the profile form before joining.
      // Finish joining after the name is saved rather than losing the invite.
      const pendingCode=new URLSearchParams(location.search).get('join');
      if(pendingCode) await joinFromInvite(pendingCode);
      render();return;
    }
    if(type==='create'){
      const name=String(data.get('name')||'').trim();
      await flushPendingSave();
      const id=await state.store.createPool(name);
      state.pools=await state.store.pools(state.user);
      await loadPool(id);
      state.modal='share';state.view='bracket';render();notify('Challenge created. Invite your friends!');return;
    }
    if(type==='join'){
      const code=String(data.get('code')||'');
      await joinFromInvite(code);
      state.view='bracket';render();notify('You joined the challenge!');return;
    }
  }catch(e){showError(e);}finally{buttons.forEach(button=>button.disabled=false);}
});

// Refresh NCAA results while the leaderboard is open, without interrupting bracket editing.
setInterval(async()=>{
  if(state.view!=='leaderboard'||!state.room)return;
  try {await flushPendingSave();await loadPool(selectedPoolId());render();} catch(e){console.error('Standings refresh failed',e);}
},60000);

let renderedRoundCount=visibleRoundCount();
window.addEventListener('resize',()=>{
  const nextCount=visibleRoundCount();
  if(nextCount===renderedRoundCount)return;
  renderedRoundCount=nextCount;
  state.roundStart=Math.min(state.roundStart,lastRoundStart());
  render();
});

bootstrap();
