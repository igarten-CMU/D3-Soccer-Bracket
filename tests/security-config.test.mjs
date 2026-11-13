import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const store = readFileSync(new URL('../store.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const edge = readFileSync(new URL('../supabase/functions/sync-ncaa-results/index.ts', import.meta.url), 'utf8');

test('schema uses explicit least-privilege Data API grants', () => {
  assert.match(schema, /revoke all on table public\.tournament_first_round[\s\S]*from anon, authenticated;/);
  assert.match(schema, /grant select on table public\.tournament_first_round to anon, authenticated, service_role;/);
  assert.match(schema, /grant select, insert, update on table public\.profiles to authenticated;/);
  assert.match(schema, /grant select on table public\.pools, public\.pool_members to authenticated;/);
  assert.match(schema, /grant select, insert, update on table public\.brackets to authenticated;/);
  assert.match(schema, /grant select on table public\.official_results to authenticated;/);
  assert.match(schema, /grant select, insert, update on table public\.official_results to service_role;/);
  assert.match(schema, /revoke all on function public\.set_pool_results\(uuid,jsonb\) from public, anon, authenticated;/);
});

test('cloud login uses Google OAuth with an email/password fallback', () => {
  assert.doesNotMatch(store, /signInWithOtp|sendLink/);
  assert.match(store, /auth\.signInWithOAuth\(\{[\s\S]*provider:'google'/);
  assert.match(store, /auth\.signUp\(\{email, password\}\)/);
  assert.match(store, /auth\.signInWithPassword\(\{email, password\}\)/);
  assert.match(app, /Continue with Google/);
  assert.match(app, /Use email and password instead/);
  assert.match(app, /type="password"/);
  assert.match(app, /data-auth-mode="signin"/);
  assert.match(app, /data-auth-mode="signup"/);
});

test('results are read-only in the browser and written only by the protected sync', () => {
  assert.doesNotMatch(store, /saveResults|set_pool_results/);
  assert.doesNotMatch(app, /Manage Results|Publish results/);
  assert.match(store, /from\('official_results'\)/);
  assert.match(edge, /withSupabase\(\{auth: 'secret'\}/);
  assert.match(edge, /ctx\.supabaseAdmin/);
  assert.match(edge, /assertResultsDoNotRegress/);
});

test('challenge members can open read-only brackets only after the lock', () => {
  assert.match(schema, /user_id = auth\.uid\(\) or clock_timestamp\(\) >=/);
  assert.match(app, /data-action="view-bracket"/);
  assert.match(app, /if\(!isLocked\(\)\)throw new Error\('Challenge brackets stay private until kickoff\.'/);
  assert.match(app, /renderRound\(state\.round,bracket\.picks,false\)/);
});

test('league deletion is creator-only and uses a checked database RPC', () => {
  assert.match(schema, /create or replace function public\.delete_pool\(p_pool_id uuid\)/);
  assert.match(schema, /where id = p_pool_id and owner_id = auth\.uid\(\)/);
  assert.match(schema, /grant execute on function public\.delete_pool\(uuid\) to authenticated;/);
  assert.match(store, /rpc\('delete_pool', \{p_pool_id:id\}\)/);
  assert.match(app, /isPoolOwner\(\).*data-action="delete-pool"/);
  assert.match(app, /This permanently removes the league and every member's bracket/);
});
