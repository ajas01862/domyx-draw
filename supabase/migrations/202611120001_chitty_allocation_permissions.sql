begin;

drop policy if exists chitty_allocations_workspace_manage on public.chitty_allocations;

create policy chitty_allocations_workspace_manage
on public.chitty_allocations
for all
to authenticated
using (
  exists (
    select 1
    from public.chitty_rounds r
    where r.id = round_id
      and public.can_manage_chitty_group(r.group_id)
  )
)
with check (
  exists (
    select 1
    from public.chitty_rounds r
    where r.id = round_id
      and public.can_manage_chitty_group(r.group_id)
  )
);

create or replace function public.complete_chitty_round(
  p_round_id uuid,
  p_member_id uuid,
  p_amount numeric,
  p_draw_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id
  from public.chitty_rounds
  where id = p_round_id
  for update;

  if v_group_id is null then
    raise exception 'Chitty round not found.';
  end if;

  if not public.can_manage_chitty_group(v_group_id) then
    raise exception 'You do not have permission to complete this round.';
  end if;

  if not exists (
    select 1 from public.chitty_members
    where id = p_member_id and group_id = v_group_id and status = 'active'
  ) then
    raise exception 'Selected winner is not an active member of this group.';
  end if;

  if exists (
    select 1
    from public.chitty_allocations a
    join public.chitty_rounds previous_round on previous_round.id = a.round_id
    where previous_round.group_id = v_group_id
      and a.member_id = p_member_id
  ) then
    raise exception 'This member has already received a payout in this group.';
  end if;

  if exists (select 1 from public.chitty_allocations where round_id = p_round_id)
     or exists (select 1 from public.chitty_rounds where id = p_round_id and status = 'completed') then
    raise exception 'This round has already been completed.';
  end if;

  insert into public.chitty_allocations (round_id, member_id, amount, draw_id)
  values (p_round_id, p_member_id, p_amount, p_draw_id);

  update public.chitty_rounds
  set status = 'completed', draw_id = p_draw_id
  where id = p_round_id;
end;
$$;

grant execute on function public.complete_chitty_round(uuid, uuid, numeric, uuid) to authenticated;

commit;
