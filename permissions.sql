-- D3 Soccer Bracket explicit Data API permissions
-- Run this file in Supabase SQL Editor ONLY if you already ran an older copy of
-- schema.sql before explicit grants were added. It is safe to run more than once.

revoke all on table public.tournament_first_round, public.profiles, public.pools,
  public.pool_members, public.brackets from anon, authenticated;

grant select on table public.tournament_first_round to anon, authenticated, service_role;
grant select, insert, update on table public.profiles to authenticated;
grant select on table public.pools, public.pool_members to authenticated;
grant select, insert, update on table public.brackets to authenticated;

revoke all on function public.valid_bracket(jsonb) from public, anon, authenticated;
revoke all on function public.is_pool_member(uuid) from public, anon, authenticated;
revoke all on function public.bracket_before_update() from public, anon, authenticated;
revoke all on function public.create_pool(text) from public, anon, authenticated;
revoke all on function public.join_pool(text) from public, anon, authenticated;
revoke all on function public.set_pool_results(uuid,jsonb) from public, anon, authenticated;

grant execute on function public.valid_bracket(jsonb) to authenticated, service_role;
grant execute on function public.is_pool_member(uuid) to authenticated;
grant execute on function public.create_pool(text) to authenticated;
grant execute on function public.join_pool(text) to authenticated;
