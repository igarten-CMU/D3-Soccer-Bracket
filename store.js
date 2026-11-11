const DEMO_PREFIX = 'd3bracket2026:';
const copy = x => JSON.parse(JSON.stringify(x));
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(DEMO_PREFIX + k) ?? JSON.stringify(fallback)); } catch { return fallback; } };
const write = (k, v) => localStorage.setItem(DEMO_PREFIX + k, JSON.stringify(v));

export async function makeStore() {
  const config = window.D3_CONFIG || {};
  if (config.supabaseUrl && config.supabaseAnonKey) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    return new CloudStore(createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    }));
  }
  return new DemoStore();
}

class CloudStore {
  constructor(client) { this.client = client; this.demo = false; }
  async user() {
    // Email/password authentication provides a recoverable identity on any device.
    // Draft picks can still be made locally before signing in.
    const {data, error} = await this.client.auth.getUser();
    if (data?.user) return data.user;
    if (error && !/auth session missing|session.*missing|invalid claim/i.test(error.message)) throw error;
    return null;
  }
  onAuth(callback) { return this.client.auth.onAuthStateChange((_event, session) => callback(session?.user || null)); }
  async signUp(email, password) {
    const {data, error} = await this.client.auth.signUp({email, password});
    if (error) throw error;
    if (!data?.session || !data?.user) {
      throw new Error('Account created, but Supabase is still waiting for email confirmation. Turn off Confirm Email in Authentication → Sign In / Providers → Email, then try again.');
    }
    return data.user;
  }
  async signIn(email, password) {
    const {data, error} = await this.client.auth.signInWithPassword({email, password});
    if (error) throw error;
    if (!data?.user) throw new Error('Sign-in did not return a user. Please try again.');
    return data.user;
  }
  async signOut() { const {error} = await this.client.auth.signOut(); if (error) throw error; }
  async profile(user) {
    const {data, error} = await this.client.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data?.display_name || '';
  }
  async saveProfile(user, name) {
    const {error} = await this.client.from('profiles').upsert({id: user.id, display_name: name.trim()});
    if (error) throw error;
  }
  async pools(user) {
    const {data, error} = await this.client.from('pool_members')
      .select('pool_id, pools(id,name,invite_code,owner_id,lock_at,created_at)')
      .eq('user_id', user.id).order('joined_at', {ascending:false});
    if (error) throw error;
    return (data || []).map(row => row.pools).filter(Boolean);
  }
  async createPool(name) {
    const {data, error} = await this.client.rpc('create_pool', {p_name:name.trim()});
    if (error) throw error;
    return data;
  }
  async joinPool(code) {
    const {data, error} = await this.client.rpc('join_pool', {p_code:code.trim().toUpperCase()});
    if (error) throw error;
    return data;
  }
  async deletePool(id) {
    const {error} = await this.client.rpc('delete_pool', {p_pool_id:id});
    if (error) throw error;
  }
  async room(id) {
    const [pool, members, brackets, officialResults] = await Promise.all([
      this.client.from('pools').select('*').eq('id', id).single(),
      this.client.from('pool_members').select('user_id,joined_at,profiles(display_name)').eq('pool_id', id),
      this.client.from('brackets').select('user_id,picks,updated_at,created_at').eq('pool_id', id),
      this.client.from('official_results').select('results,synced_at,last_attempt_at,last_error,source_url').eq('tournament_key','2026-d3-men').single()
    ]);
    for (const r of [pool,members,brackets,officialResults]) if (r.error) throw r.error;
    return {pool:pool.data, members:members.data || [], brackets:brackets.data || [], officialResults:officialResults.data};
  }
  async savePicks(poolId, userId, picks) {
    const {error} = await this.client.from('brackets').upsert({pool_id:poolId, user_id:userId, picks}, {onConflict:'pool_id,user_id'});
    if (error) throw error;
  }
}

class DemoStore {
  constructor() { this.demo = true; this.id = 'local-demo-user'; }
  async user() { return {id:this.id, email:'preview@local.test'}; }
  onAuth() { return {data:{subscription:{unsubscribe(){}}}}; }
  async signOut() { write('name', ''); }
  async profile() { return read('name', ''); }
  async saveProfile(_user, name) { write('name', name.trim()); }
  async pools() { return read('pools', []); }
  async createPool(name) {
    const id = 'local-' + crypto.randomUUID();
    const code = 'DEMO' + Math.random().toString(36).slice(2,8).toUpperCase();
    const pool = {id, name, invite_code:code, owner_id:this.id, lock_at:'2026-11-13T17:00:00Z', results:{}, created_at: new Date().toISOString()};
    write('pools', [pool, ...read('pools', [])]);
    write('room:'+id, {pool, members:[{user_id:this.id, profiles:{display_name:read('name','Preview player')}}], brackets:[]});
    return id;
  }
  async joinPool(code) {
    const room = read('pools', []).find(p => p.invite_code === code.toUpperCase());
    if (!room) throw new Error('In local preview, only groups created in this browser are available. Configure Supabase to share across devices.');
    return room.id;
  }
  async deletePool(id) {
    const pools = read('pools', []);
    const pool = pools.find(item => item.id === id);
    if (!pool || pool.owner_id !== this.id) throw new Error('Only the league creator can delete this league.');
    write('pools', pools.filter(item => item.id !== id));
    localStorage.removeItem(DEMO_PREFIX + 'room:' + id);
  }
  async room(id) {
    let room = read('room:'+id, null);
    if (!room) throw new Error('Challenge not found in this browser.');
    const pool = read('pools', []).find(p => p.id === id) || room.pool;
    const members = room.members.map(m => m.user_id===this.id ? {...m,profiles:{display_name:read('name','Preview player')}}:m);
    return copy({...room, pool, members, officialResults:{results:pool.results || {},synced_at:null,last_attempt_at:null,last_error:null,source_url:null}});
  }
  async savePicks(poolId, userId, picks) {
    const room = await this.room(poolId);
    const idx = room.brackets.findIndex(b => b.user_id === userId);
    const entry = {user_id:userId,picks,updated_at:new Date().toISOString(),created_at:new Date().toISOString()};
    if (idx < 0) room.brackets.push(entry); else room.brackets[idx] = {...room.brackets[idx],...entry};
    write('room:'+poolId, room);
  }
}
