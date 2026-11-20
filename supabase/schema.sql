-- =====================================================================
-- Askar — Egypt Visual Archive: database schema for Supabase
-- Run this whole file once in Supabase: SQL Editor -> New query -> Run.
-- Then run the "BOOTSTRAP" line at the very bottom with YOUR email.
-- =====================================================================

-- ---------- Members (invite-only access) -----------------------------
create table if not exists public.members (
  email       text primary key check (email = lower(email)),
  role        text not null default 'editor' check (role in ('owner', 'editor')),
  invited_by  text,
  created_at  timestamptz not null default now()
);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where email = lower(auth.jwt() ->> 'email'));
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where email = lower(auth.jwt() ->> 'email') and role = 'owner');
$$;

-- ---------- Eras: 7,000 years, approximate dates (negative = BCE) ----
create table if not exists public.eras (
  id          text primary key,
  name        text not null,
  start_year  int  not null,
  end_year    int  not null,
  sort        int  not null,
  description text
);

insert into public.eras (id, name, start_year, end_year, sort, description) values
  ('predynastic',      'Predynastic (Badarian – Naqada)',          -5500, -3100,  1, 'Farming villages along the Nile, painted pottery, the first chiefs and cemeteries.'),
  ('early-dynastic',   'Early Dynastic (Dynasties 1–2)',           -3100, -2686,  2, 'Unification under Narmer, the first kings at Abydos and Saqqara.'),
  ('old-kingdom',      'Old Kingdom (Dynasties 3–6)',              -2686, -2181,  3, 'The pyramid age: Djoser, Sneferu, Khufu, Khafre, Menkaure.'),
  ('fip',              'First Intermediate Period (Dyn. 7–11)',    -2181, -2055,  4, 'Central power collapses; regional rulers and provincial art.'),
  ('middle-kingdom',   'Middle Kingdom (Dynasties 11–13)',         -2055, -1650,  5, 'Reunification, classical literature, Senusret and Amenemhat.'),
  ('sip',              'Second Intermediate Period (Dyn. 13–17)',  -1650, -1550,  6, 'The Hyksos in the north, Theban rulers in the south.'),
  ('new-kingdom',      'New Kingdom (Dynasties 18–20)',            -1550, -1069,  7, 'Empire: Hatshepsut, Akhenaten, Tutankhamun, Ramesses II, the Valley of the Kings.'),
  ('tip',              'Third Intermediate Period (Dyn. 21–25)',   -1069,  -664,  8, 'A divided Egypt, Tanis, Libyan and Kushite pharaohs.'),
  ('late-period',      'Late Period (Dynasties 26–31)',             -664,  -332,  9, 'Saite revival and Persian rule.'),
  ('ptolemaic',        'Macedonian & Ptolemaic',                    -332,   -30, 10, 'Alexander, Alexandria, the Ptolemies and Cleopatra VII.'),
  ('roman',            'Roman Egypt',                                -30,   395, 11, 'A Roman province; Fayum mummy portraits.'),
  ('byzantine-coptic', 'Byzantine & Coptic',                         395,   641, 12, 'Christian Egypt, monasteries and Coptic textiles.'),
  ('early-islamic',    'Early Islamic (to the Ikhshidids)',          641,   969, 13, 'The Arab conquest, Fustat, the Tulunid mosque.'),
  ('fatimid',          'Fatimid',                                    969,  1171, 14, 'Cairo is founded; al-Azhar.'),
  ('ayyubid-mamluk',   'Ayyubid & Mamluk',                          1171,  1517, 15, 'Saladin''s citadel and Mamluk architecture.'),
  ('ottoman',          'Ottoman (incl. French expedition)',         1517,  1805, 16, 'Ottoman province; Napoleon''s savants and the Description de l''Égypte.'),
  ('khedivate',        'Muhammad Ali dynasty & Kingdom',            1805,  1953, 17, 'Modernization, the Suez Canal, early photography, newspapers and the great excavations.'),
  ('republic',         'Modern Republic',                           1953,  2100, 18, 'The 1952 revolution to today: Aswan, the Abu Simbel move, the GEM.')
on conflict (id) do update set
  name = excluded.name, start_year = excluded.start_year, end_year = excluded.end_year,
  sort = excluded.sort, description = excluded.description;

-- ---------- Items: every image / video / document / 3D model ---------
create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'image' check (kind in ('image', 'video', 'document', 'model3d')),
  title         text not null default '',
  description   text,
  source_name   text,             -- e.g. "The Met", "Wikimedia Commons", "Upload"
  source_url    text,             -- page where it was found
  media_url     text,             -- full-size remote file (link only)
  thumb_url     text,             -- remote thumbnail (fallback)
  thumb_path    text,             -- our own stored thumbnail (in the 'media' bucket)
  storage_path  text,             -- full file we store ourselves (own uploads)
  external_id   text unique,      -- "met:12345", prevents double-saving
  license       text,
  credit        text,
  era_id        text references public.eras(id) on delete set null,
  date_text     text,
  year_start    int,
  year_end      int,
  category      text,
  site          text,
  subjects      text[] not null default '{}',
  tags          text[] not null default '{}',
  notes         text,
  created_by    uuid default auth.uid(),
  created_by_email text default lower(auth.jwt() ->> 'email'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists items_era_idx      on public.items (era_id);
create index if not exists items_category_idx on public.items (category);
create index if not exists items_created_idx  on public.items (created_at desc);
create index if not exists items_subjects_idx on public.items using gin (subjects);

-- ---------- Boards: mood boards and reconstruction boards ------------
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  kind        text not null default 'mood' check (kind in ('mood', 'reconstruction')),
  era_id      text references public.eras(id) on delete set null,
  subject     text,
  cover_item  uuid references public.items(id) on delete set null,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.board_items (
  board_id  uuid not null references public.boards(id) on delete cascade,
  item_id   uuid not null references public.items(id) on delete cascade,
  angle     text,                 -- reconstruction: 'front', 'left-profile', ...
  position  int not null default 0,
  added_by  uuid default auth.uid(),
  added_at  timestamptz not null default now(),
  primary key (board_id, item_id)
);

-- ---------- Counts per era (respects row security) -------------------
create or replace view public.era_counts with (security_invoker = true) as
  select era_id, count(*)::int as n from public.items group by era_id;

-- ---------- updated_at trigger ---------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

-- ---------- Row Level Security: only invited members ------------------
alter table public.members     enable row level security;
alter table public.eras        enable row level security;
alter table public.items       enable row level security;
alter table public.boards      enable row level security;
alter table public.board_items enable row level security;

drop policy if exists members_read  on public.members;
drop policy if exists members_write on public.members;
create policy members_read  on public.members for select using (public.is_member());
create policy members_write on public.members for all    using (public.is_owner()) with check (public.is_owner());

drop policy if exists eras_read on public.eras;
create policy eras_read on public.eras for select using (true);

drop policy if exists items_all on public.items;
create policy items_all on public.items for all using (public.is_member()) with check (public.is_member());

drop policy if exists boards_all on public.boards;
create policy boards_all on public.boards for all using (public.is_member()) with check (public.is_member());

drop policy if exists board_items_all on public.board_items;
create policy board_items_all on public.board_items for all using (public.is_member()) with check (public.is_member());

-- ---------- Storage: private bucket for thumbnails + own uploads ------
insert into storage.buckets (id, name, public)
  values ('media', 'media', false)
  on conflict (id) do nothing;

drop policy if exists media_read   on storage.objects;
drop policy if exists media_insert on storage.objects;
drop policy if exists media_update on storage.objects;
drop policy if exists media_delete on storage.objects;
create policy media_read   on storage.objects for select using (bucket_id = 'media' and public.is_member());
create policy media_insert on storage.objects for insert with check (bucket_id = 'media' and public.is_member());
create policy media_update on storage.objects for update using (bucket_id = 'media' and public.is_member());
create policy media_delete on storage.objects for delete using (bucket_id = 'media' and public.is_member());

-- =====================================================================
-- BOOTSTRAP: make yourself the owner. Replace the email, then run it.
-- (Lower-case only.) Everyone else you invite from inside the app.
-- =====================================================================
-- insert into public.members (email, role) values ('you@example.com', 'owner');
