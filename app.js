import {
  FIRST_ROUND, SECTION_NAMES, ROUND_NAMES, ROUND_SHORT, ROUND_POINTS,
  LOCK_AT, NCAA_BRACKET_URL, gameKey, gameCount, allGameKeys,
  matchup, normalizePicks, chooseWinner, scoreBracket, maxScore
} from './data.js';
import {makeStore} from './store.js';

const $app = document.getElementById('app');
const localDraftKey = 'd3soccer2026-draft';
const lastPoolKey = 'd3soccer2026-pool';
const state = {
  store:null, user:null, profile:'', pools:[], room:null,
  picks:{}, section:0, view:'bracket', modal:null,
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
  if (previous && previous!==id) {state.section=0;state.view='bracket';}
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
    <div class="topline">THE ROAD TO COLUMBUS &nbsp; ✦ &nbsp; 2026 NCAA DIVISION III MEN'S SOCCER</div>
    <div class="shell">
      ${renderTopbar()}
      ${state.store?.demo ? `<div class="demo-notice"><strong>Local preview mode.</strong> Your picks save in this browser, but invites and shared leaderboards require a free Supabase project and hosting. See README.md in the project package.</div>` : !state.user ? `<div class="demo-notice"><strong>You're viewing as a guest.</strong> You can explore the bracket, but sign in to save online and compete with friends.</div>` : ''}
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
      <button class="nav-btn ${state.view==='bracket'?'active':''}" data-action="view" data-view="bracket">My bracket</button>
      <button class="nav-btn ${state.view==='leaderboard'?'active':''}" data-action="view" data-view="leaderboard">Leaderboard</button>
      <button class="nav-btn ${state.view==='rules'?'active':''}" data-action="view" data-view="rules">Rules</button>
    </nav>
    <div class="topright">
      ${hasProfile ? `<button class="avatar" data-action="profile" title="Change your display name">${h(state.profile.slice(0,1).toUpperCase())}</button><span class="profile-name">${h(state.profile)}</span><button class="signout" data-action="signout" title="Sign out of your account">Sign out</button>`
      : `<button class="btn btn-small" data-action="auth">Sign in</button>`}
    </div>
  </header>`;
}

function renderMainContent() {
  if (state.view==='leaderboard') return renderLeaderboard();
  if (state.view==='rules') return renderRules();
  const count=Object.keys(state.picks).length;
  const canEdit=!isLocked();
  return `
    <div class="card-head">
      <div><div class="section-kicker">Tournament central / 2026</div>
        <h2>Your tournament bracket</h2>
        <p>Click a team to advance it. Finish one round to reveal the next.</p></div>
      <span class="status-chip ${!canEdit?'locked':''}">${canEdit ? 'PICKS OPEN' : 'LOCKED'}</span>
    </div>
    <div class="tabstrip" role="tablist" aria-label="Tournament sections">
      ${SECTION_NAMES.map((s,i)=>`<button role="tab" aria-selected="${state.section===i}" class="region-tab ${state.section===i?'active':''}" data-action="section" data-section="${i}"><strong>${h(s.title)}</strong><small>${h(s.subtitle)}</small></button>`).join('')}
      <button role="tab" aria-selected="${state.section===4}" class="region-tab ${state.section===4?'active':''}" data-action="section" data-section="4"><strong>🏆 Final Four</strong><small>Road to the title</small></button>
    </div>
    <div class="bracket-instructions"><span><i class="live-pip"></i>Tap any team to advance it</span><span>${count} / 63 picks filled</span></div>
    <div class="bracket-scroll">${state.section===4 ? renderFinalFour(state.picks,canEdit) : renderSection(state.section,state.picks,canEdit)}</div>
    <div class="section-footer"><div class="savestate">✓ ${h(statusText())}</div>
      <div class="manage-group">
        <button class="btn btn-small btn-outline" data-action="reset" ${!canEdit||count===0?'disabled':''}>Clear picks</button><button class="btn btn-small" data-action="save" ${!canEdit||!count?'disabled':''}>Save bracket →</button>
      </div>
    </div>`;
}

function renderSection(section,picks,canEdit) {
  return `<div class="bracket-grid">${[0,1,2,3].map(round=>{
    const count=8/(2**round), start=section*count;
    const gameIds=Array.from({length:count},(_,i)=>start+i);
    return `<section class="round-col"><div class="round-label"><strong>${h(ROUND_NAMES[round])}</strong><span>+${ROUND_POINTS[round]} PTS</span></div>
      <div class="match-list">${gameIds.map((game)=>renderGameCard(round,game,picks,canEdit)).join('')}</div></section>`;
  }).join('')}</div>`;
}

function renderGameCard(round,game,picks,canEdit) {
  const opts=matchup(round,game,picks),key=gameKey(round,game),picked=picks[key];
  const result=publishedResults()[key];
  return `<div class="game-card" aria-label="Game ${key}">
    <span class="game-number">${ROUND_SHORT[round]}-${game+1}</span>
    <div class="game-topline">${result?'FINAL RESULT':'PICK WINNER'}</div>
    ${opts.map((team,index)=>{
      const selected=!!team && team===picked;
      const correct=!!result && result===team;
      const wrong=!!result && selected && picked!==result;
      const classes=['team-btn',selected?'selected':'',correct?'result-win':'',wrong?'wrong':'',!team?'empty':''].filter(Boolean).join(' ');
      const disabled=!canEdit||!team;
      return `<button class="${classes}" data-action="pick" data-round="${round}" data-game="${game}" data-team="${safeAttr(team||'')}" ${disabled?'disabled':''} title="${team?`Advance ${safeAttr(team)}`:'Pick previous round first'}">
          <span class="mini-ball">${selected?'●':'○'}</span><span class="team-name">${h(team || (round===0?'TBD':`Winner ${game*2+index+1}`))}</span>${selected?'<span class="tick">✓</span>':''}
        </button>`;
    }).join('')}
  </div>`;
}

function renderFinalFour(picks,canEdit) {
  const champ=picks[gameKey(5,0)];
  return `<div class="f4-layout">
    <div class="f4-col"><div class="round-label"><strong>National semifinals</strong><span>+160 PTS</span></div>
      ${renderGameCard(4,0,picks,canEdit)}
      <div class="f4-qualifier">Section 01 winner vs Section 02 winner</div></div>
    <div class="f4-col center"><div class="trophy-art">🏆</div><div class="f4-champ">NATIONAL CHAMPIONSHIP · DEC 5</div>
      <div style="width:100%;max-width:255px;margin-top:16px">${renderGameCard(5,0,picks,canEdit)}</div>
      <div class="f4-team">${h(champ || 'Your champion')}</div><div class="f4-caption">${champ?'One team to rule them all.':'Complete the bracket to crown your winner.'}</div></div>
    <div class="f4-col"><div class="round-label"><strong>National semifinals</strong><span>+160 PTS</span></div>
      ${renderGameCard(4,1,picks,canEdit)}
      <div class="f4-qualifier">Section 03 winner vs Section 04 winner</div></div>
  </div>`;
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
      <div class="section-kicker">The standings</div><h3>Chase the top spot.</h3>
      <p class="sub">Scores update automatically from finalized NCAA results every 30 minutes.</p>
      <div class="leader-mini">
        ${rows.length ? rows.slice(0,4).map((r,i)=>`<div class="leader-mini-row"><span class="rank-bubble">${i+1}</span><span class="${r.isYou?'you':''}">${h(r.name)}${r.isYou?' (you)':''}</span><small>${r.score} pts</small></div>`).join('')
          : `<div class="small-muted" style="padding:9px 0">Your leaderboard appears when you join a group.</div>`}
      </div>
      <button class="btn btn-outline btn-small" data-action="view" data-view="leaderboard">Full leaderboard ↗</button>
    </div>
    <div class="card side-card">
      <div class="section-kicker">Know the rules</div><h3>Every round matters.</h3>
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
    ${rows.length ? `<div class="table-wrap"><table class="leader-table"><thead><tr><th>Rank</th><th>Player</th><th>Points</th><th>Correct</th><th>National champion pick</th></tr></thead>
      <tbody>${rows.map((r,i)=>`<tr class="${r.isYou?'self':''}"><td class="rank">${r.rank||'—'}</td><td class="player">${h(r.name)} ${r.isYou?'<span class="badge-demo">YOU</span>':''}</td><td class="score">${r.score}</td><td class="muted">${r.correct}</td><td class="muted">${prelock && !r.isYou ? 'Hidden until brackets lock' : !r.entered ? 'Not yet saved' : h(r.champion||'Not yet picked')}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty-state"><div class="empty-icon">🏆</div><h3>Your league is waiting.</h3><p>Start a challenge or join a friend’s group to see the standings here.</p><button class="btn" data-action="create">Start a challenge</button></div>`}
    <div class="callout" style="margin-top:22px"><strong>Scoring:</strong> 10 / 20 / 40 / 80 / 160 / 320 points per correct winner in each successive round. A perfect bracket earns ${maxScore.toLocaleString()} points. Finalized winners are imported from NCAA.com every 30 minutes, including matches decided in overtime or on penalty kicks.</div>
  </div>`;
}

function renderRules() {
  return `<div class="content-panel"><div class="section-kicker">How to play</div><h2 style="font-family:'Space Grotesk';font-size:27px;letter-spacing:-1px">A little knowledge. A lot of chaos.</h2>
    <p class="rule-intro">Pick the winner of each of the 63 games in the actual 2026 NCAA Division III men's soccer tournament. Your predictions move through the bracket automatically, all the way to the national champion.</p>
    <div class="rules-grid">${ROUND_NAMES.map((r,i)=>`<div class="rule-box"><div class="pts">+${ROUND_POINTS[i]}</div><div class="rtitle">${h(r)}</div></div>`).join('')}</div>
    <ol class="how-list"><li><strong>Create or join a challenge.</strong> Share the invitation link with your friends. Each group has its own standings.</li>
      <li><strong>Make your picks.</strong> Choose winners in each section, then select both semifinal winners and the champion in the Final Four tab. Changes to earlier games clear invalid downstream selections.</li>
      <li><strong>Save and come back.</strong> Picks auto-save in online challenges. Sign in with the same email and password to restore your saved brackets from any device. You can edit it until <strong>${humanDeadline}</strong>.</li>
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
  if (type==='auth') body=`<div class="section-kicker">Join the competition</div><h2>Sign in to play</h2>
    <p>Use your email and password to access your saved brackets from any device. New here? Create an account below.</p>
    <form data-form="auth">
      <label for="email">Email address</label><input class="field" id="email" name="email" type="email" required placeholder="you@example.com" autocomplete="email" autofocus>
      <label for="password">Password</label><input class="field" id="password" name="password" type="password" required minlength="8" placeholder="At least 8 characters" autocomplete="current-password">
      <div class="auth-actions"><button type="submit" class="btn" data-auth-mode="signin">Sign in →</button><button type="submit" class="btn btn-outline" data-auth-mode="signup">Create account</button></div>
      <p class="auth-note">Email confirmation and password-reset email are disabled. Save your password somewhere secure.</p>
    </form>`;
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
    if(action==='auth'){state.modal='auth';render();return;}
    if(action==='profile'){state.modal='profile';render();return;}
    if(action==='signout'){
      await flushPendingSave();
      await state.store.signOut();
      state.user=null;state.profile='';state.pools=[];state.room=null;
      state.picks=draft();state.modal=state.store.demo?'profile':'auth';render();return;
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
      state.view='bracket';state.section=0;render();notify(`“${poolName}” was deleted.`);return;
    }
    if(action==='copy-code'||action==='copy-link'){
      const text=action==='copy-code'?document.getElementById('share-code')?.textContent:document.getElementById('share-url')?.textContent;
      await navigator.clipboard.writeText(text||''); notify(action==='copy-code'?'Invite code copied.':'Invite link copied.');return;
    }
    if(action==='view'){
      const newView=button.dataset.view;
      state.view=newView;render();return;
    }
    if(action==='section'){state.section=Number(button.dataset.section);render();return;}
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

bootstrap();
