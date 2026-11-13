begin;

create table if not exists public.chitty_live_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chitty_groups(id) on delete cascade,
  round_id uuid not null unique references public.chitty_rounds(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  status text not null default 'hosted' check (status in ('hosted','ready','running','completed','cancelled')),
  participants jsonb not null default '[]'::jsonb,
  current_index integer not null default -1,
  current_name text,
  winner_name text,
  winner_member_id uuid references public.chitty_members(id),
  draw_id uuid references public.draws(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists chitty_live_sessions_token_idx on public.chitty_live_sessions(public_token);
alter table public.chitty_live_sessions enable row level security;

drop policy if exists chitty_live_sessions_host_select on public.chitty_live_sessions;
drop policy if exists chitty_live_sessions_host_insert on public.chitty_live_sessions;
drop policy if exists chitty_live_sessions_host_update on public.chitty_live_sessions;

create policy chitty_live_sessions_host_select on public.chitty_live_sessions
for select to authenticated using (public.can_access_chitty_group(group_id));
create policy chitty_live_sessions_host_insert on public.chitty_live_sessions
for insert to authenticated with check (public.can_manage_chitty_group(group_id));
create policy chitty_live_sessions_host_update on public.chitty_live_sessions
for update to authenticated using (public.can_manage_chitty_group(group_id))
with check (public.can_manage_chitty_group(group_id));

grant select, insert, update on public.chitty_live_sessions to authenticated;
revoke all on public.chitty_live_sessions from anon;

create or replace function public.get_chitty_live_session(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'group_name', g.name,
    'round_number', r.round_number,
    'status', s.status,
    'participants', s.participants,
    'current_index', s.current_index,
    'current_name', s.current_name,
    'winner_name', s.winner_name,
    'updated_at', s.updated_at
  )
  from public.chitty_live_sessions s
  join public.chitty_groups g on g.id = s.group_id
  join public.chitty_rounds r on r.id = s.round_id
  where s.public_token = p_token;
$$;

revoke all on function public.get_chitty_live_session(uuid) from public;
grant execute on function public.get_chitty_live_session(uuid) to anon, authenticated;

commit;
