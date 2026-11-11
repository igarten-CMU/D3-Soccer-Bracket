-- D3 Soccer Bracket owner-only league deletion migration
-- Run once in Supabase SQL Editor for an existing project.

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

revoke all on function public.delete_pool(uuid) from public, anon, authenticated;
grant execute on function public.delete_pool(uuid) to authenticated;
