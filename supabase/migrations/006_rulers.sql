-- Every ruler of Egypt, for searching and facial-reconstruction research.
create table if not exists public.rulers (
  id bigserial primary key,
  slug text unique not null,
  name text not null,
  aliases text[] not null default '{}',
  dynasty text,
  era_id text references public.eras(id),
  reign_start int,
  reign_end int,
  certainty text not null default 'firm' check (certainty in ('firm','approx','debated')),
  is_group boolean not null default false,
  mummy_status text not null default 'none' check (mummy_status in ('mummy','remains','disputed','lost','none')),
  mummy_note text,
  face_notes text,
  sort int not null default 0
);
create index if not exists rulers_sort on public.rulers (sort);
alter table public.rulers enable row level security;
drop policy if exists rulers_read on public.rulers;
create policy rulers_read on public.rulers for select using (public.has_access());
drop policy if exists rulers_write on public.rulers;
create policy rulers_write on public.rulers for all using (public.is_member()) with check (public.is_member());
