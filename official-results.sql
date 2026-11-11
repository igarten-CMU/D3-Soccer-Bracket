-- D3 Soccer Bracket automated NCAA results migration
-- Run once in Supabase SQL Editor after the original schema/permissions setup.

-- Correct the middle two sectional quadrants to match NCAA bracket IDs and
-- their actual semifinal advancement path.
insert into public.tournament_first_round (game_index,team_a,team_b) values
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
  (23,'Washington & Lee','Colorado College')
on conflict (game_index) do update set team_a=excluded.team_a, team_b=excluded.team_b;

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

alter table public.official_results enable row level security;
drop policy if exists official_results_read on public.official_results;
create policy official_results_read on public.official_results
  for select to authenticated using (true);

revoke all on table public.official_results from anon, authenticated;
grant select on table public.official_results to authenticated;
grant select, insert, update on table public.official_results to service_role;
grant execute on function public.valid_bracket(jsonb) to service_role;

-- League organizers can no longer publish or alter results.
revoke all on function public.set_pool_results(uuid,jsonb) from public, anon, authenticated;
