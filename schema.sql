-- D3 Soccer Bracket Challenge / Supabase SQL Editor
-- Run exactly once in a new Supabase project. Re-running seed ON CONFLICT is safe.
-- Note: The anon/publishable key is public; NEVER place the service-role key in config.js.

create table if not exists public.tournament_first_round (
  game_index integer primary key check (game_index between 0 and 31),
  team_a text not null,
  team_b text not null
);

-- Actual 2026 NCAA Division III MEN'S soccer bracket (in advancement order).
insert into public.tournament_first_round (game_index,team_a,team_b) values
  (0,'Williams','John Jay'),
  (1,'Johns Hopkins','Roger Williams'),
  (2,'Southwestern (TX)','Hardin-Simmons'),
  (3,'Trinity (TX)','La Verne'),
  (4,'Amherst','Stevens'),
  (5,'Messiah','Vassar'),
  (6,'Case Western Reserve','Penn St.-Behrend'),
  (7,'Hope','Transylvania'),
  (8,'Tufts','Penn St.-Abington'),
  (9,'Babson','SUNY Oneonta'),
  (10,'Saint John''s (MN)','MSOE'),
  (11,'North Park','Whitman'),
  (12,'St. Olaf','Grinnell'),
  (13,'Wisconsin-Superior','Loras'),
  (14,'UChicago','Webster'),
  (15,'Calvin','Wisconsin-Eau Claire'),
  (16,'Middlebury','Saint Joseph''s (ME)'),
  (17,'Hobart','Wheaton (MA)'),
  (18,'Montclair State','Southern Virginia'),
  (19,'Cortland','Christopher Newport'),
  (20,'Hamilton','Allegheny'),
  (21,'Denison','Plattsburgh State'),
  (22,'Rowan','Marymount (VA)'),
  (23,'Washington & Lee','Colorado College'),
  (24,'Connecticut College','UMass Boston'),
  (25,'Carnegie Mellon','Salem State'),
  (26,'Lynchburg','Covenant'),
  (27,'Kenyon','Ohio Northern'),
  (28,'Bowdoin','Thomas (ME)'),
  (29,'St. Lawrence','Neumann'),
  (30,'Wesleyan (CT)','SUNY Geneseo'),
  (31,'Scranton','Manhattanville')
on conflict (game_index) do update set team_a=excluded.team_a, team_b=excluded.team_b;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  invite_code text not null unique,
  owner_id uuid not null references public.profiles(id),
  lock_at timestamptz not null default '2026-11-13T17:00:00Z'::timestamptz,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pool_members (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);
create index if not exists pool_members_user_idx on public.pool_members(user_id);

create table if not exists public.brackets (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  picks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);
create index if not exists brackets_pool_idx on public.brackets(pool_id);

-- Bracket values must represent actual advancement, including correct first-round
-- pairings. Prevents cheating by inserting a future winner anywhere in the JSON.
create or replace function public.valid_bracket(p_picks jsonb)
returns boolean
language plpgsql stable
set search_path = public
as $$
declare
  k text;
  val jsonb;
  r integer;
  i integer;
  a text;
  b text;
  winner text;
begin
  if p_picks is null or jsonb_typeof(p_picks) <> 'object' or pg_column_size(p_picks) > 12000 then
    return false;
  end if;
  for k, val in select key, value from jsonb_each(p_picks) loop
    if k !~ '^r[0-5]m(0|[1-9][0-9]?)$' or jsonb_typeof(val) <> 'string' then
      return false;
    end if;
    r := substring(k from 2 for 1)::integer;
    i := split_part(k, 'm', 2)::integer;
    if i >= (32 / power(2, r))::integer then return false; end if;
  end loop;
  for r in 0..5 loop
    for i in 0..(32 / power(2,r))::integer - 1 loop
      winner := p_picks ->> ('r'||r||'m'||i);
      if winner is not null then
        if r = 0 then
          select team_a, team_b into a, b
          from public.tournament_first_round where game_index = i;
        else
          a := p_picks ->> ('r'||(r-1)||'m'||(i*2));
          b := p_picks ->> ('r'||(r-1)||'m'||(i*2+1));
        end if;
        if winner is distinct from a and winner is distinct from b then
          return false;
        end if;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

alter table public.brackets add constraint brackets_valid_picks check (public.valid_bracket(picks));
alter table public.pools add constraint pools_valid_results check (public.valid_bracket(results));

-- One trusted result set is shared by every challenge. Only the scheduled
-- Supabase Edge Function writes this row using a secret server-side key.
create table if not exists public.official_results (
  tournament_key text primary key,
  results jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  source_url text not null default 'https://www.ncaa.com/brackets/soccer-men/d3/2026',
  check (public.valid_bracket(results))
);
insert into public.official_results (tournament_key)
values ('2026-d3-men') on conflict (tournament_key) do nothing;

-- Safe, non-recursive membership test for row-level security.
create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.pool_members where pool_id = p_pool_id and user_id = auth.uid());
$$;

alter table public.tournament_first_round enable row level security;
alter table public.profiles enable row level security;
alter table public.pools enable row level security;
alter table public.pool_members enable row level security;
alter table public.brackets enable row level security;
alter table public.official_results enable row level security;

create policy first_round_read on public.tournament_first_round
  for select to anon,authenticated using (true);
create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy pools_members_read on public.pools
  for select to authenticated using (public.is_pool_member(id));
create policy pool_members_read on public.pool_members
  for select to authenticated using (public.is_pool_member(pool_id));
create policy official_results_read on public.official_results
  for select to authenticated using (true);

-- Picks are hidden from other participants until the first tournament kickoff.
create policy brackets_members_read on public.brackets
  for select to authenticated using (
    public.is_pool_member(pool_id)
    and (user_id = auth.uid() or clock_timestamp() >= (select p.lock_at from public.pools p where p.id = pool_id))
  );
create policy brackets_insert_own_before_lock on public.brackets
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_pool_member(pool_id)
    and clock_timestamp() < (select p.lock_at from public.pools p where p.id = pool_id)
    and public.valid_bracket(picks)
  );
create policy brackets_update_own_before_lock on public.brackets
  for update to authenticated
  using (
    user_id = auth.uid() and public.is_pool_member(pool_id)
    and clock_timestamp() < (select p.lock_at from public.pools p where p.id = pool_id)
  )
  with check (
    user_id = auth.uid() and public.is_pool_member(pool_id)
    and clock_timestamp() < (select p.lock_at from public.pools p where p.id = pool_id)
    and public.valid_bracket(picks)
  );

-- Stop changing identity of a saved bracket via UPDATE, keep an audit timestamp.
create or replace function public.bracket_before_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.pool_id is distinct from old.pool_id or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Bracket owner and creation date are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger bracket_update_guard before update on public.brackets
  for each row execute function public.bracket_before_update();

-- Functions run with definer permissions but explicitly check the authenticated user.
create or replace function public.create_pool(p_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  who uuid := auth.uid();
  code text;
  attempt integer;
begin
  if who is null then raise exception 'Sign in first'; end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 80 then
    raise exception 'Challenge name must be 2–80 characters';
  end if;
  if not exists(select 1 from public.profiles where id=who) then
    raise exception 'Set your display name first';
  end if;
  for attempt in 1..5 loop
    code := upper(substr(md5(gen_random_uuid()::text),1,10));
    begin
      insert into public.pools (name, invite_code, owner_id)
      values (trim(p_name), code, who) returning id into new_id;
      insert into public.pool_members(pool_id,user_id) values (new_id,who);
      return new_id;
    exception when unique_violation then
      continue;
    end;
  end loop;
  raise exception 'Unable to generate an invite code';
end;
$$;

create or replace function public.join_pool(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  target uuid;
  who uuid := auth.uid();
begin
  if who is null then raise exception 'Sign in first'; end if;
  if not exists(select 1 from public.profiles where id=who) then
    raise exception 'Set your display name first';
  end if;
  select id into target from public.pools where invite_code=upper(trim(p_code));
  if target is null then raise exception 'Invite code not found'; end if;
  insert into public.pool_members (pool_id,user_id) values (target,who)
  on conflict do nothing;
  return target;
end;
$$;

-- Only the creator can permanently delete a challenge. Related memberships
-- and brackets are removed by their ON DELETE CASCADE foreign keys.
create or replace function public.delete_pool(p_pool_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  deleted_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from public.pools
  where id = p_pool_id and owner_id = auth.uid()
  returning id into deleted_id;
  if deleted_id is null then
    raise exception 'Only the league creator can delete this league';
  end if;
end;
$$;

-- Legacy manual-results RPC retained only so older databases can revoke it
-- cleanly. No browser role receives execute permission.
create or replace function public.set_pool_results(p_pool_id uuid, p_results jsonb)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.pools where id=p_pool_id and owner_id=auth.uid()
  ) then raise exception 'Only the challenge organizer can publish match results'; end if;
  if not public.valid_bracket(p_results) then
    raise exception 'Results must follow actual first-round teams and advancement paths';
  end if;
  update public.pools set results=p_results where id=p_pool_id;
end;
$$;

-- Explicit Data API privileges. These keep the app working when the Supabase
-- "Automatically expose new tables" setting is disabled (recommended).
revoke all on table public.tournament_first_round, public.profiles, public.pools,
  public.pool_members, public.brackets, public.official_results from anon, authenticated;

grant select on table public.tournament_first_round to anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select on table public.pools, public.pool_members to authenticated;
grant select, insert, update on table public.brackets to authenticated;
grant select on table public.official_results to authenticated;
grant select, insert, update on table public.official_results to service_role;

-- Do not inherit PostgreSQL's default PUBLIC execute privilege for functions.
revoke all on function public.valid_bracket(jsonb) from public, anon, authenticated;
revoke all on function public.is_pool_member(uuid) from public, anon, authenticated;
revoke all on function public.bracket_before_update() from public, anon, authenticated;
revoke all on function public.create_pool(text) from public, anon, authenticated;
revoke all on function public.join_pool(text) from public, anon, authenticated;
revoke all on function public.delete_pool(uuid) from public, anon, authenticated;
revoke all on function public.set_pool_results(uuid,jsonb) from public, anon, authenticated;

grant execute on function public.valid_bracket(jsonb) to authenticated, service_role;
grant execute on function public.is_pool_member(uuid) to authenticated;
grant execute on function public.create_pool(text) to authenticated;
grant execute on function public.join_pool(text) to authenticated;
grant execute on function public.delete_pool(uuid) to authenticated;

-- Client-side writes to pools, pool_members and official_results remain unavailable.
-- Only checked group RPCs and the server-side NCAA sync can mutate those records.
