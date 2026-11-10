create extension if not exists pgcrypto;
create type public.workspace_role as enum ('owner','admin','organizer','viewer');
create type public.event_status as enum ('draft','published','live','completed','cancelled');
create type public.draw_status as enum ('draft','ready','running','completed','cancelled');
create type public.subscription_status as enum ('free','active','past_due','cancelled','expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null check (char_length(name) between 1 and 100),
  slug text unique not null,
  created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create table public.plans (
  id uuid primary key default gen_random_uuid(), name text unique not null, slug text unique not null,
  price_monthly numeric(10,2) not null default 0 check (price_monthly >= 0),
  limits jsonb not null default '{}', features jsonb not null default '{}', is_active boolean not null default true
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id), status public.subscription_status not null default 'free',
  started_at timestamptz not null default now(), expires_at timestamptz, created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null check (char_length(title) between 1 and 120),
  description text, slug text unique not null, banner_url text, status public.event_status not null default 'draft',
  visibility text not null default 'public' check (visibility in ('public','private','unlisted')),
  starts_at timestamptz, ends_at timestamptz, registration_enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create table public.event_participants (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null, display_name text not null check (char_length(display_name) between 1 and 100),
  email text, registration_data jsonb not null default '{}', status text not null default 'approved' check (status in ('pending','approved','rejected')),
  registered_at timestamptz not null default now()
);
create unique index event_participant_email_unique on public.event_participants(event_id,lower(email)) where email is not null;
create table public.draws (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null, created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 120),
  draw_type text not null check (draw_type in ('random','number','wheel','comment','chitty')),
  status public.draw_status not null default 'draft', settings jsonb not null default '{}',
  participant_count integer not null default 0 check (participant_count >= 0), winner_count integer not null default 1 check (winner_count between 1 and 100),
  snapshot_hash text, seed_commitment text, seed_reveal text, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.draw_entries (
  id uuid primary key default gen_random_uuid(), draw_id uuid not null references public.draws(id) on delete cascade,
  entry_key text not null, display_name text not null check (char_length(display_name) between 1 and 150),
  weight numeric(12,4) not null default 1 check (weight > 0), eligible boolean not null default true,
  metadata jsonb not null default '{}', unique(draw_id,entry_key)
);
create table public.draw_winners (
  id uuid primary key default gen_random_uuid(), draw_id uuid not null references public.draws(id) on delete cascade,
  entry_id uuid not null references public.draw_entries(id) on delete restrict, position integer not null check (position > 0),
  selected_at timestamptz not null default now(), unique(draw_id,entry_id), unique(draw_id,position)
);
create table public.draw_audit_logs (
  id uuid primary key default gen_random_uuid(), draw_id uuid not null references public.draws(id) on delete cascade,
  action text not null, actor_id uuid references public.profiles(id) on delete set null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
-- Server-only seed material. No client policies or grants are created for this table.
create table public.draw_secrets (draw_id uuid primary key references public.draws(id) on delete cascade, seed text not null, created_at timestamptz not null default now());

create table public.chitty_groups (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id), name text not null, description text, currency char(3) not null default 'BHD',
  contribution_amount numeric(12,3) not null check (contribution_amount > 0), frequency text not null default 'monthly' check (frequency in ('weekly','monthly','custom')),
  total_rounds integer not null check (total_rounds > 0), start_date date, status text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table public.chitty_members (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.chitty_groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null, display_name text not null, contact text,
  status text not null default 'active' check (status in ('active','inactive','removed')), joined_at timestamptz not null default now()
);
create table public.chitty_rounds (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.chitty_groups(id) on delete cascade,
  round_number integer not null check (round_number > 0), scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','open','completed','cancelled')),
  draw_id uuid references public.draws(id) on delete set null, created_at timestamptz not null default now(), unique(group_id,round_number)
);
create table public.chitty_contributions (
  id uuid primary key default gen_random_uuid(), round_id uuid not null references public.chitty_rounds(id) on delete cascade,
  member_id uuid not null references public.chitty_members(id) on delete cascade, expected_amount numeric(12,3) not null check (expected_amount >= 0),
  paid_amount numeric(12,3) not null default 0 check (paid_amount >= 0), status text not null default 'unpaid' check (status in ('unpaid','partial','paid','waived')),
  paid_at timestamptz, note text, created_at timestamptz not null default now(), unique(round_id,member_id)
);
create table public.chitty_allocations (
  id uuid primary key default gen_random_uuid(), round_id uuid not null unique references public.chitty_rounds(id) on delete cascade,
  member_id uuid not null references public.chitty_members(id), amount numeric(12,3) not null check (amount >= 0),
  draw_id uuid references public.draws(id), allocated_at timestamptz not null default now()
);
create table public.comment_imports (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id), platform text not null check (platform in ('youtube','instagram','facebook','csv','manual')),
  source_url text, status text not null default 'completed' check (status in ('pending','completed','failed')), created_at timestamptz not null default now()
);
create table public.comment_entries (
  id uuid primary key default gen_random_uuid(), import_id uuid not null references public.comment_imports(id) on delete cascade,
  external_id text, author_name text not null, comment_text text not null, eligible boolean not null default true, duplicate boolean not null default false, metadata jsonb not null default '{}'
);
create table public.live_rooms (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draw_id uuid references public.draws(id) on delete set null, created_by uuid not null references public.profiles(id),
  room_code text unique not null, title text not null, visibility text not null default 'public' check (visibility in ('public','private','unlisted')),
  status text not null default 'waiting' check (status in ('waiting','live','ended')), created_at timestamptz not null default now()
);
create table public.room_participants (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null, display_name text, role text not null default 'viewer' check (role in ('host','viewer')), joined_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.platform_settings (key text primary key, value jsonb not null default '{}', updated_at timestamptz not null default now());

create index events_workspace_idx on public.events(workspace_id,created_at desc);
create index draws_workspace_idx on public.draws(workspace_id,created_at desc);
create index draw_entries_draw_idx on public.draw_entries(draw_id);
create index draw_winners_draw_idx on public.draw_winners(draw_id);
create index chitty_members_group_idx on public.chitty_members(group_id);
create index chitty_contributions_round_idx on public.chitty_contributions(round_id);
create index room_participants_room_idx on public.room_participants(room_id);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members wm where wm.workspace_id=target_workspace and wm.user_id=auth.uid()) $$;
create or replace function public.has_workspace_role(target_workspace uuid, allowed_roles public.workspace_role[])
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members wm where wm.workspace_id=target_workspace and wm.user_id=auth.uid() and wm.role=any(allowed_roles)) $$;
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce((select p.is_admin from public.profiles p where p.id=auth.uid()),false) $$;

insert into public.plans(name,slug,price_monthly,limits,features) values
('Free','free',0,'{"active_events":3,"participants_per_event":100,"live_rooms_monthly":2,"chitty_groups":1}','{"custom_branding":false,"advanced_analytics":false}'),
('Premium','premium',0,'{"active_events":-1,"participants_per_event":5000,"live_rooms_monthly":-1,"chitty_groups":-1}','{"custom_branding":true,"advanced_analytics":true}') on conflict(slug) do nothing;

create or replace function public.bootstrap_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare new_workspace uuid;
begin
  insert into public.profiles(id,full_name,avatar_url) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),new.raw_user_meta_data->>'avatar_url') on conflict(id) do nothing;
  insert into public.workspaces(owner_id,name,slug) values(new.id,'Personal workspace','personal-'||replace(new.id::text,'-','')) returning id into new_workspace;
  insert into public.workspace_members(workspace_id,user_id,role) values(new_workspace,new.id,'owner');
  insert into public.subscriptions(user_id,plan_id,status) select new.id,id,'free' from public.plans where slug='free';
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.bootstrap_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.draws enable row level security;
alter table public.draw_entries enable row level security;
alter table public.draw_winners enable row level security;
alter table public.draw_audit_logs enable row level security;
alter table public.draw_secrets enable row level security;
alter table public.chitty_groups enable row level security;
alter table public.chitty_members enable row level security;
alter table public.chitty_rounds enable row level security;
alter table public.chitty_contributions enable row level security;
alter table public.chitty_allocations enable row level security;
alter table public.comment_imports enable row level security;
alter table public.comment_entries enable row level security;
alter table public.live_rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.notifications enable row level security;
alter table public.platform_settings enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_platform_admin() or exists(select 1 from public.workspace_members a join public.workspace_members b on a.workspace_id=b.workspace_id where a.user_id=auth.uid() and b.user_id=profiles.id));
create policy profiles_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and is_admin=public.is_platform_admin());
create policy workspace_select on public.workspaces for select to authenticated using (public.is_workspace_member(id) or owner_id=auth.uid());
create policy workspace_insert on public.workspaces for insert to authenticated with check (owner_id=auth.uid());
create policy workspace_update on public.workspaces for update to authenticated using (public.has_workspace_role(id,array['owner','admin']::public.workspace_role[]));
create policy members_select on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated with check (public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
create policy members_delete on public.workspace_members for delete to authenticated using (public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
create policy plans_select on public.plans for select to anon,authenticated using (is_active);
create policy subscriptions_select on public.subscriptions for select to authenticated using (user_id=auth.uid() or public.is_platform_admin());
create policy events_select on public.events for select to anon,authenticated using ((visibility in ('public','unlisted') and status='published') or public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy events_insert on public.events for insert to authenticated with check (created_by=auth.uid() and public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy events_update on public.events for update to authenticated using (public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy events_delete on public.events for delete to authenticated using (public.has_workspace_role(workspace_id,array['owner','admin']::public.workspace_role[]));
create policy participants_select on public.event_participants for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.events e where e.id=event_id and public.has_workspace_role(e.workspace_id,array['owner','admin','organizer']::public.workspace_role[])));
create policy participants_insert on public.event_participants for insert to authenticated with check (user_id=auth.uid());
create policy draws_select on public.draws for select to authenticated using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy draws_insert on public.draws for insert to authenticated with check (created_by=auth.uid() and public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy draws_update on public.draws for update to authenticated using (status in ('draft','ready') and public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy entries_select on public.draw_entries for select to authenticated using (exists(select 1 from public.draws d where d.id=draw_id and public.is_workspace_member(d.workspace_id)));
create policy winners_select on public.draw_winners for select to anon,authenticated using (exists(select 1 from public.draws d where d.id=draw_id and (d.status='completed' or public.is_workspace_member(d.workspace_id))));
create policy audit_select on public.draw_audit_logs for select to authenticated using (exists(select 1 from public.draws d where d.id=draw_id and public.is_workspace_member(d.workspace_id)));
create policy chitty_groups_select on public.chitty_groups for select to authenticated using (public.is_workspace_member(workspace_id));
create policy chitty_groups_insert on public.chitty_groups for insert to authenticated with check (created_by=auth.uid() and public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy chitty_groups_update on public.chitty_groups for update to authenticated using (public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy chitty_members_all on public.chitty_members for all to authenticated using (exists(select 1 from public.chitty_groups g where g.id=group_id and public.has_workspace_role(g.workspace_id,array['owner','admin','organizer']::public.workspace_role[]))) with check (exists(select 1 from public.chitty_groups g where g.id=group_id and public.has_workspace_role(g.workspace_id,array['owner','admin','organizer']::public.workspace_role[])));
create policy chitty_rounds_all on public.chitty_rounds for all to authenticated using (exists(select 1 from public.chitty_groups g where g.id=group_id and public.has_workspace_role(g.workspace_id,array['owner','admin','organizer']::public.workspace_role[]))) with check (exists(select 1 from public.chitty_groups g where g.id=group_id and public.has_workspace_role(g.workspace_id,array['owner','admin','organizer']::public.workspace_role[])));
create policy chitty_contributions_all on public.chitty_contributions for all to authenticated using (exists(select 1 from public.chitty_rounds r join public.chitty_groups g on g.id=r.group_id where r.id=round_id and public.has_workspace_role(g.workspace_id,array['owner','admin','organizer']::public.workspace_role[]))) with check (exists(select 1 from public.chitty_rounds r join public.chitty_groups g on g.id=r.group_id where r.id=round_id and public.has_workspace_role(g.workspace_id,array['owner','admin','organizer']::public.workspace_role[])));
create policy chitty_allocations_select on public.chitty_allocations for select to authenticated using (exists(select 1 from public.chitty_rounds r join public.chitty_groups g on g.id=r.group_id where r.id=round_id and public.is_workspace_member(g.workspace_id)));
create policy comment_imports_select on public.comment_imports for select to authenticated using (public.is_workspace_member(workspace_id));
create policy comment_imports_insert on public.comment_imports for insert to authenticated with check (created_by=auth.uid() and public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy comment_entries_select on public.comment_entries for select to authenticated using (exists(select 1 from public.comment_imports i where i.id=import_id and public.is_workspace_member(i.workspace_id)));
create policy rooms_select on public.live_rooms for select to anon,authenticated using (visibility in ('public','unlisted') or public.is_workspace_member(workspace_id));
create policy rooms_insert on public.live_rooms for insert to authenticated with check (created_by=auth.uid() and public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy rooms_update on public.live_rooms for update to authenticated using (public.has_workspace_role(workspace_id,array['owner','admin','organizer']::public.workspace_role[]));
create policy room_participants_select on public.room_participants for select to anon,authenticated using (exists(select 1 from public.live_rooms r where r.id=room_id and (r.visibility in ('public','unlisted') or public.is_workspace_member(r.workspace_id))));
create policy room_participants_insert on public.room_participants for insert to anon,authenticated with check (role='viewer');
create policy notifications_owner on public.notifications for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy platform_settings_admin on public.platform_settings for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

revoke all on public.draw_secrets from anon,authenticated;
grant all on public.draw_secrets to service_role;
revoke all on public.platform_settings from anon,authenticated;
grant select on public.plans to anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.workspaces,public.workspace_members to authenticated;
grant select on public.events to anon,authenticated;
grant insert,update,delete on public.events to authenticated;
grant select,insert on public.event_participants to authenticated;
grant select,insert,update on public.draws,public.draw_entries,public.draw_winners,public.draw_audit_logs to authenticated;
grant select,insert,update,delete on public.chitty_groups,public.chitty_members,public.chitty_rounds,public.chitty_contributions,public.chitty_allocations to authenticated;
grant select,insert,update on public.comment_imports,public.comment_entries to authenticated;
grant select,insert,update on public.live_rooms,public.room_participants to anon,authenticated;
grant select on public.subscriptions to authenticated;
grant select,update on public.notifications to authenticated;

-- Atomic completion prevents concurrent requests from recording multiple winner sets.
create or replace function public.complete_draw_transaction(
  p_draw_id uuid,
  p_entry_ids uuid[],
  p_seed_reveal text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  target_winner_count integer;
  member_role public.workspace_role;
  entry_total integer;
begin
  select workspace_id, winner_count into target_workspace, target_winner_count
  from public.draws where id = p_draw_id and status = 'ready' for update;
  if target_workspace is null then raise exception 'Draw is not ready or does not exist'; end if;
  if not exists (select 1 from public.draw_secrets s join public.draws d on d.id=s.draw_id where s.draw_id=p_draw_id and encode(digest(s.seed, 'sha256'), 'hex')=d.seed_commitment and s.seed=p_seed_reveal) then raise exception 'Seed commitment validation failed'; end if;
  select role into member_role from public.workspace_members
  where workspace_id = target_workspace and user_id = p_actor_id;
  if member_role is null or member_role not in ('owner', 'admin', 'organizer') then raise exception 'Not authorized to complete this draw'; end if;
  if coalesce(array_length(p_entry_ids, 1), 0) <> target_winner_count then raise exception 'Winner count mismatch'; end if;
  select count(*) into entry_total from public.draw_entries
  where draw_id = p_draw_id and id = any(p_entry_ids) and eligible = true;
  if entry_total <> target_winner_count then raise exception 'Invalid winner entries'; end if;
  update public.draws set status = 'running', started_at = now() where id = p_draw_id;
  insert into public.draw_winners(draw_id, entry_id, position)
  select p_draw_id, selected.entry_id, selected.ordinality::integer
  from unnest(p_entry_ids) with ordinality as selected(entry_id, ordinality);
  update public.draws set status = 'completed', completed_at = now(), seed_reveal = p_seed_reveal where id = p_draw_id;
  delete from public.draw_secrets where draw_id = p_draw_id;
  insert into public.draw_audit_logs(draw_id, actor_id, action, details)
  values (p_draw_id, p_actor_id, 'draw_completed', jsonb_build_object('winner_entry_ids', p_entry_ids));
end;
$$;
revoke all on function public.complete_draw_transaction(uuid, uuid[], text, uuid) from public, anon, authenticated;
grant execute on function public.complete_draw_transaction(uuid, uuid[], text, uuid) to service_role;
