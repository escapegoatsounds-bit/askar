-- =====================================================================
-- 002: Projects, folders, per-project collaborators, Pinterest-style pins
-- Run after schema.sql. Applied to production on 2026-11-20.
-- Access model:
--   * members (workspace team)  -> see and edit everything
--   * project_members (guests)  -> see only their projects; editors can add
-- =====================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  emoji text,
  color text,
  created_by uuid default auth.uid(),
  created_by_email text default lower(auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  invited_by text default lower(auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);
create index if not exists project_members_email_idx on public.project_members (email);
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists folders_project_idx on public.folders (project_id);
alter table public.boards add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.boards add column if not exists folder_id uuid references public.folders(id) on delete set null;
alter table public.boards add column if not exists position int not null default 0;
create index if not exists boards_project_idx on public.boards (project_id);
alter table public.board_items add column if not exists note text;
alter table public.board_items add column if not exists added_by_email text default lower(auth.jwt() ->> 'email');

create or replace function public.my_email() returns text language sql stable set search_path = public as $$ select lower(auth.jwt() ->> 'email') $$;

create or replace function public.project_role(pid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when pid is null then null
    when public.is_owner() then 'owner'
    when exists (select 1 from project_members where project_id = pid and email = public.my_email() and role = 'owner') then 'owner'
    when public.is_member() then 'editor'
    else (select role from project_members where project_id = pid and email = public.my_email())
  end;
$$;
create or replace function public.can_view_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.project_role(pid) is not null $$;
create or replace function public.can_edit_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.project_role(pid) in ('owner','editor'), false) $$;
create or replace function public.is_guest_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members where email = public.my_email() and role in ('owner','editor'));
$$;
create or replace function public.has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member() or exists (select 1 from project_members where email = public.my_email());
$$;
create or replace function public.board_visible(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from boards b where b.id = bid and (public.is_member() or (b.project_id is not null and public.can_view_project(b.project_id))));
$$;
create or replace function public.board_editable(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from boards b where b.id = bid and (public.is_member() or (b.project_id is not null and public.can_edit_project(b.project_id))));
$$;
create or replace function public.item_visible(iid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member()
    or exists (select 1 from items i where i.id = iid and i.created_by = auth.uid())
    or exists (select 1 from board_items bi join boards b on b.id = bi.board_id
               where bi.item_id = iid and b.project_id is not null and public.can_view_project(b.project_id));
$$;
revoke execute on function public.project_role(uuid), public.can_view_project(uuid), public.can_edit_project(uuid), public.is_guest_editor(), public.has_access(), public.board_visible(uuid), public.board_editable(uuid), public.item_visible(uuid) from public, anon;
grant execute on function public.project_role(uuid), public.can_view_project(uuid), public.can_edit_project(uuid), public.is_guest_editor(), public.has_access(), public.board_visible(uuid), public.board_editable(uuid), public.item_visible(uuid) to authenticated;

create or replace function public.add_project_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.my_email() is not null then
    insert into project_members (project_id, email, role, invited_by) values (new.id, public.my_email(), 'owner', public.my_email())
    on conflict do nothing;
  end if;
  return new;
end; $$;
revoke execute on function public.add_project_owner() from public, anon, authenticated;
drop trigger if exists projects_owner on public.projects;
create trigger projects_owner after insert on public.projects for each row execute function public.add_project_owner();
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.folders enable row level security;

drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_select on public.projects for select using (public.can_view_project(id) or created_by = auth.uid());
create policy projects_insert on public.projects for insert with check (public.is_member());
create policy projects_update on public.projects for update using (public.can_edit_project(id));
create policy projects_delete on public.projects for delete using (public.project_role(id) = 'owner');

drop policy if exists pm_select on public.project_members;
drop policy if exists pm_write on public.project_members;
create policy pm_select on public.project_members for select using (public.can_view_project(project_id));
create policy pm_write on public.project_members for all using (public.project_role(project_id) = 'owner') with check (public.project_role(project_id) = 'owner');

drop policy if exists folders_select on public.folders;
drop policy if exists folders_write on public.folders;
create policy folders_select on public.folders for select using (public.can_view_project(project_id));
create policy folders_write on public.folders for all using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

drop policy if exists boards_all on public.boards;
drop policy if exists boards_select on public.boards;
drop policy if exists boards_insert on public.boards;
drop policy if exists boards_update on public.boards;
drop policy if exists boards_delete on public.boards;
create policy boards_select on public.boards for select using (public.is_member() or (project_id is not null and public.can_view_project(project_id)));
create policy boards_insert on public.boards for insert with check (public.is_member() or (project_id is not null and public.can_edit_project(project_id)));
create policy boards_update on public.boards for update using (public.is_member() or (project_id is not null and public.can_edit_project(project_id)))
  with check (public.is_member() or (project_id is not null and public.can_edit_project(project_id)));
create policy boards_delete on public.boards for delete using (public.is_member() or (project_id is not null and public.project_role(project_id) = 'owner'));

drop policy if exists board_items_all on public.board_items;
drop policy if exists bi_select on public.board_items;
drop policy if exists bi_write on public.board_items;
create policy bi_select on public.board_items for select using (public.board_visible(board_id));
create policy bi_write on public.board_items for all using (public.board_editable(board_id)) with check (public.board_editable(board_id));

drop policy if exists items_all on public.items;
drop policy if exists items_select on public.items;
drop policy if exists items_insert on public.items;
drop policy if exists items_update on public.items;
drop policy if exists items_delete on public.items;
-- created_by is checked directly so INSERT ... RETURNING can see the new row.
create policy items_select on public.items for select using (public.is_member() or created_by = auth.uid() or public.item_visible(id));
create policy items_insert on public.items for insert with check (public.is_member() or public.is_guest_editor());
create policy items_update on public.items for update using (public.is_member() or created_by = auth.uid());
create policy items_delete on public.items for delete using (public.is_member() or created_by = auth.uid());

drop policy if exists sites_read on public.sites;
create policy sites_read on public.sites for select using (public.has_access());

drop policy if exists media_read on storage.objects;
drop policy if exists media_insert on storage.objects;
drop policy if exists media_update on storage.objects;
drop policy if exists media_delete on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media' and (public.is_member()
  or exists (select 1 from public.items i where i.thumb_path = storage.objects.name or i.storage_path = storage.objects.name)));
create policy media_insert on storage.objects for insert with check (bucket_id = 'media' and (public.is_member() or public.is_guest_editor()));
create policy media_update on storage.objects for update using (bucket_id = 'media' and (public.is_member() or owner = auth.uid()));
create policy media_delete on storage.objects for delete using (bucket_id = 'media' and (public.is_member() or owner = auth.uid()));

-- Live collaboration (Supabase Realtime respects the policies above)
alter publication supabase_realtime add table public.board_items, public.boards, public.folders, public.projects;

-- =====================================================================
-- 003: Bridge to the Land of Rebirth Production Desk (applied 2026-11-21)
-- Pins in projects with desk_sync = true are queued here with a JPEG
-- (data URL) and metadata; the Desk pulls them via the Supabase connector.
-- =====================================================================
alter table public.projects add column if not exists desk_sync boolean not null default false;
create table if not exists public.desk_outbox (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  image_b64 text not null,
  title text, notes text, era_id text, desk_age text, site text, category text,
  source_name text, source_url text, license text, credit text,
  tags text[] not null default '{}',
  added_by_email text default lower(auth.jwt() ->> 'email'),
  added_at timestamptz not null default now(),
  synced_at timestamptz,
  desk_mood_id text
);
create index if not exists desk_outbox_pending_idx on public.desk_outbox (added_at) where synced_at is null;
alter table public.desk_outbox enable row level security;
drop policy if exists outbox_select on public.desk_outbox;
drop policy if exists outbox_insert on public.desk_outbox;
drop policy if exists outbox_update on public.desk_outbox;
drop policy if exists outbox_delete on public.desk_outbox;
create policy outbox_select on public.desk_outbox for select using (public.can_view_project(project_id));
create policy outbox_insert on public.desk_outbox for insert with check (public.can_edit_project(project_id));
create policy outbox_update on public.desk_outbox for update using (public.can_edit_project(project_id));
create policy outbox_delete on public.desk_outbox for delete using (public.can_edit_project(project_id));
