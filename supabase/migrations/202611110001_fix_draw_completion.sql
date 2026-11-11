-- Ensure pgcrypto functions are available inside the SECURITY DEFINER function.
-- Supabase commonly installs pgcrypto in the extensions schema.
create or replace function public.complete_draw_transaction(
  p_draw_id uuid,
  p_entry_ids uuid[],
  p_seed_reveal text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_workspace uuid;
  target_winner_count integer;
  member_role public.workspace_role;
  entry_total integer;
begin
  select workspace_id, winner_count
  into target_workspace, target_winner_count
  from public.draws
  where id = p_draw_id and status = 'ready'
  for update;

  if target_workspace is null then
    raise exception 'Draw is not ready or does not exist';
  end if;

  if not exists (
    select 1
    from public.draw_secrets s
    join public.draws d on d.id = s.draw_id
    where s.draw_id = p_draw_id
      and encode(digest(s.seed, 'sha256'), 'hex') = d.seed_commitment
      and s.seed = p_seed_reveal
  ) then
    raise exception 'Seed commitment validation failed';
  end if;

  select role
  into member_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = p_actor_id;

  if member_role is null or member_role not in ('owner', 'admin', 'organizer') then
    raise exception 'Not authorized to complete this draw';
  end if;

  if coalesce(array_length(p_entry_ids, 1), 0) <> target_winner_count then
    raise exception 'Winner count mismatch';
  end if;

  select count(*)
  into entry_total
  from public.draw_entries
  where draw_id = p_draw_id and id = any(p_entry_ids) and eligible = true;

  if entry_total <> target_winner_count then
    raise exception 'Invalid winner entries';
  end if;

  update public.draws
  set status = 'running', started_at = now()
  where id = p_draw_id;

  insert into public.draw_winners(draw_id, entry_id, position)
  select p_draw_id, selected.entry_id, selected.ordinality::integer
  from unnest(p_entry_ids) with ordinality as selected(entry_id, ordinality);

  update public.draws
  set status = 'completed', completed_at = now(), seed_reveal = p_seed_reveal
  where id = p_draw_id;

  delete from public.draw_secrets where draw_id = p_draw_id;

  insert into public.draw_audit_logs(draw_id, actor_id, action, details)
  values (p_draw_id, p_actor_id, 'draw_completed', jsonb_build_object('winner_entry_ids', p_entry_ids));
end;
$$;

revoke all on function public.complete_draw_transaction(uuid, uuid[], text, uuid) from public, anon, authenticated;
grant execute on function public.complete_draw_transaction(uuid, uuid[], text, uuid) to service_role;
