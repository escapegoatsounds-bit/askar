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
-- Only signed-in users may ask "am I invited?" (Supabase security advisor).
revoke execute on function public.is_member() from public, anon;
revoke execute on function public.is_owner()  from public, anon;
grant  execute on function public.is_member() to authenticated;
grant  execute on function public.is_owner()  to authenticated;

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
create index if not exists items_site_idx     on public.items (lower(site));

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
create index if not exists board_items_item_idx on public.board_items (item_id);

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


-- ---------- Sites: places on the map (match items by name/alias) -----
create table if not exists public.sites (
  id          serial primary key,
  name        text not null unique,
  lat         double precision not null,
  lng         double precision not null,
  region      text,
  aliases     text[] not null default '{}',
  description text
);
alter table public.sites enable row level security;
drop policy if exists sites_read on public.sites;
drop policy if exists sites_write on public.sites;
create policy sites_read  on public.sites for select using (public.is_member());
create policy sites_write on public.sites for all using (public.is_member()) with check (public.is_member());

insert into public.sites (name, lat, lng, region, aliases, description) values
  ('Giza', 29.9792, 31.1342, 'Memphite necropolis', array['Giza Plateau', 'Great Pyramid', 'Sphinx', 'Pyramids of Giza']::text[], 'Pyramids of Khufu, Khafre and Menkaure; the Great Sphinx.'),
  ('Saqqara', 29.8713, 31.2165, 'Memphite necropolis', array['Sakkara', 'Step Pyramid']::text[], 'Djoser''s Step Pyramid and 3,000 years of tombs.'),
  ('Dahshur', 29.8078, 31.2061, 'Memphite necropolis', array['Bent Pyramid', 'Red Pyramid']::text[], 'Sneferu''s Bent and Red pyramids.'),
  ('Abusir', 29.8956, 31.2028, 'Memphite necropolis', array[]::text[], 'Fifth Dynasty pyramids and sun temples.'),
  ('Memphis', 29.8447, 31.2503, 'Lower Egypt', array['Mit Rahina']::text[], 'The first capital of united Egypt.'),
  ('Meidum', 29.3883, 31.1572, 'Middle Egypt', array['Maidum']::text[], 'The collapsed pyramid; Rahotep and Nofret.'),
  ('Heliopolis', 30.1292, 31.3076, 'Lower Egypt', array['Iunu', 'Matariya']::text[], 'City of the sun god; Senusret I''s obelisk.'),
  ('Fayum', 29.3084, 30.8428, 'Fayum', array['Faiyum', 'Hawara', 'Fayoum']::text[], 'Lake oasis; Hawara pyramid; Roman mummy portraits.'),
  ('Lahun', 29.2333, 30.9667, 'Fayum', array['El-Lahun', 'Illahun', 'Kahun']::text[], 'Senusret II''s pyramid and workers'' town.'),
  ('Beni Hasan', 27.9333, 30.8833, 'Middle Egypt', array[]::text[], 'Painted Middle Kingdom rock tombs.'),
  ('Hermopolis', 27.7811, 30.8036, 'Middle Egypt', array['Ashmunein', 'Tuna el-Gebel']::text[], 'City of Thoth; ibis and baboon catacombs.'),
  ('Amarna', 27.645, 30.8956, 'Middle Egypt', array['Tell el-Amarna', 'Akhetaten']::text[], 'Akhenaten''s short-lived capital; Nefertiti''s bust.'),
  ('Badari', 27.0, 31.4167, 'Upper Egypt', array['El-Badari']::text[], 'Type site of the Badarian culture.'),
  ('Abydos', 26.1847, 31.9189, 'Upper Egypt', array['Umm el-Qa''ab']::text[], 'Royal tombs of Dynasty 1; Seti I''s temple; cult of Osiris.'),
  ('Dendera', 26.1417, 32.6703, 'Upper Egypt', array['Denderah']::text[], 'Temple of Hathor; the zodiac ceiling.'),
  ('Naqada', 25.9, 32.7167, 'Upper Egypt', array['Nagada']::text[], 'Predynastic cemeteries that name an entire culture.'),
  ('Karnak', 25.7188, 32.6573, 'Thebes', array['Thebes', 'Ipet-isut']::text[], 'The vast temple of Amun; the hypostyle hall.'),
  ('Luxor Temple', 25.6995, 32.6391, 'Thebes', array['Luxor']::text[], 'Amenhotep III and Ramesses II''s temple; Avenue of Sphinxes.'),
  ('Valley of the Kings', 25.7402, 32.6014, 'Thebes', array['KV62', 'Biban el-Muluk']::text[], 'New Kingdom royal tombs; Tutankhamun.'),
  ('Deir el-Bahari', 25.7383, 32.6066, 'Thebes', array['Djeser-Djeseru', 'Hatshepsut temple', 'Royal cache']::text[], 'Hatshepsut''s terraced temple; the royal mummy cache.'),
  ('Deir el-Medina', 25.7286, 32.6013, 'Thebes', array['Set Maat']::text[], 'The tomb-builders'' village.'),
  ('Ramesseum', 25.728, 32.6105, 'Thebes', array[]::text[], 'Ramesses II''s memorial temple; the fallen colossus.'),
  ('Medinet Habu', 25.7195, 32.6006, 'Thebes', array[]::text[], 'Ramesses III''s temple and battle reliefs.'),
  ('Valley of the Queens', 25.7281, 32.5928, 'Thebes', array['Nefertari']::text[], 'Tomb of Nefertari.'),
  ('Colossi of Memnon', 25.7206, 32.6104, 'Thebes', array['Memnon']::text[], 'Amenhotep III''s twin statues.'),
  ('Esna', 25.2933, 32.5536, 'Upper Egypt', array[]::text[], 'Ptolemaic–Roman temple of Khnum.'),
  ('Elkab', 25.1194, 32.7958, 'Upper Egypt', array['Nekheb', 'El Kab']::text[], 'Vulture-goddess city; Ahmose son of Ebana''s tomb.'),
  ('Hierakonpolis', 25.0972, 32.7794, 'Upper Egypt', array['Nekhen']::text[], 'Predynastic capital; the Narmer Palette was found here.'),
  ('Edfu', 24.9779, 32.8733, 'Upper Egypt', array[]::text[], 'Best-preserved temple of Horus.'),
  ('Kom Ombo', 24.452, 32.9283, 'Upper Egypt', array[]::text[], 'Double temple of Sobek and Haroeris.'),
  ('Aswan', 24.085, 32.8869, 'Aswan', array['Elephantine', 'Unfinished obelisk']::text[], 'Granite quarries, Elephantine island, the southern frontier.'),
  ('Philae', 24.0256, 32.8844, 'Aswan', array['Agilkia']::text[], 'Temple of Isis, moved stone by stone in the 1970s.'),
  ('Kalabsha', 23.9608, 32.8656, 'Nubia', array[]::text[], 'Roman-era temple relocated near the High Dam.'),
  ('Aswan High Dam', 23.9709, 32.878, 'Aswan', array['Lake Nasser', 'High Dam']::text[], 'Built 1960–70; flooded Nubia, triggered the UNESCO rescue.'),
  ('Abu Simbel', 22.3372, 31.6258, 'Nubia', array[]::text[], 'Ramesses II''s rock temples, lifted in 1964–68.'),
  ('Kerma', 19.6, 30.41, 'Nubia (Sudan)', array[]::text[], 'Capital of the Kingdom of Kush.'),
  ('Gebel Barkal', 18.5357, 31.8278, 'Nubia (Sudan)', array['Napata']::text[], 'Sacred mountain of the Kushite pharaohs.'),
  ('Tanis', 30.9767, 31.8803, 'Delta', array['San el-Hagar']::text[], 'Third Intermediate capital; silver coffins of Psusennes.'),
  ('Avaris', 30.7875, 31.8211, 'Delta', array['Tell el-Dab''a', 'Piramesse', 'Qantir']::text[], 'Hyksos capital; later Ramesses'' Pi-Ramesse.'),
  ('Bubastis', 30.5728, 31.5106, 'Delta', array['Tell Basta']::text[], 'Cat-goddess Bastet''s city.'),
  ('Sais', 30.9653, 30.7686, 'Delta', array['Sa el-Hagar']::text[], 'Seat of the Saite 26th Dynasty.'),
  ('Buto', 31.1964, 30.7417, 'Delta', array['Tell el-Fara''in']::text[], 'Predynastic Delta centre; cobra goddess Wadjet.'),
  ('Rosetta', 31.4044, 30.4164, 'Delta', array['Rashid', 'Rosetta Stone']::text[], 'Where the Rosetta Stone was found in 1799.'),
  ('Alexandria', 31.2001, 29.9187, 'Mediterranean', array['Pharos', 'Kom el-Shoqafa', 'Pompey''s Pillar']::text[], 'Alexander''s city; Ptolemaic and Roman capital.'),
  ('Siwa', 29.2032, 25.5195, 'Western Desert', array['Siwa Oasis', 'Oracle of Amun']::text[], 'Oracle of Amun visited by Alexander.'),
  ('Saint Catherine''s Monastery', 28.5559, 33.976, 'Sinai', array['Mount Sinai', 'Sinai']::text[], '6th-century Byzantine monastery and icons.'),
  ('Wadi Natrun', 30.3167, 30.35, 'Western Desert', array['Wadi El Natrun', 'Scetis']::text[], 'Early Coptic desert monasteries.'),
  ('Coptic Cairo', 30.0057, 31.2306, 'Cairo', array['Old Cairo', 'Fustat', 'Babylon fortress', 'Hanging Church']::text[], 'Roman fortress, churches and the first Islamic capital, Fustat.'),
  ('Ibn Tulun Mosque', 30.0287, 31.2495, 'Cairo', array['Ahmad ibn Tulun']::text[], 'Oldest intact mosque in Cairo (879 CE).'),
  ('Al-Azhar', 30.0459, 31.2627, 'Cairo', array['Islamic Cairo', 'Al-Muizz Street', 'Khan el-Khalili']::text[], 'Fatimid mosque-university and the heart of medieval Cairo.'),
  ('Bab Zuweila', 30.0429, 31.2579, 'Cairo', array['Fatimid walls', 'Bab al-Futuh']::text[], 'Fatimid city gate.'),
  ('Cairo Citadel', 30.0299, 31.2611, 'Cairo', array['Citadel', 'Saladin Citadel', 'Muhammad Ali Mosque']::text[], 'Saladin''s fortress; Muhammad Ali''s mosque.'),
  ('Sultan Hassan Mosque', 30.0322, 31.2565, 'Cairo', array['Madrasa of Sultan Hassan']::text[], 'Monumental Mamluk mosque-madrasa.'),
  ('Downtown Cairo', 30.0478, 31.2336, 'Cairo', array['Cairo', 'Tahrir', 'Egyptian Museum', 'Khedival Cairo', 'Ismailia']::text[], 'Khedive Ismail''s Paris on the Nile; the Egyptian Museum.'),
  ('Grand Egyptian Museum', 29.9946, 31.1193, 'Cairo', array['GEM']::text[], 'The new home of Tutankhamun''s treasures.'),
  ('Port Said', 31.2653, 32.3019, 'Suez Canal', array['Suez Canal', 'Ismailia canal']::text[], 'Suez Canal entrance, opened 1869.'),
  ('Herakleopolis', 29.0853, 30.9348, 'Middle Egypt', array['Ihnasya', 'Heracleopolis', 'Nen-nesut']::text[], 'Seat of the 9th–10th Dynasty kings who ruled the north after the Old Kingdom fell.'),
  ('Lisht', 29.5703, 31.2306, 'Middle Egypt', array['El-Lisht', 'Itjtawy']::text[], 'Pyramids of Amenemhat I and Senusret I near the Middle Kingdom capital Itjtawy.')
on conflict (name) do update set lat = excluded.lat, lng = excluded.lng, region = excluded.region,
  aliases = excluded.aliases, description = excluded.description;

-- Finds per site and era (respects row security)
create or replace view public.site_counts with (security_invoker = true) as
  select lower(site) as site_key, era_id, count(*)::int as n
  from public.items where site is not null group by lower(site), era_id;

-- =====================================================================
-- BOOTSTRAP: make yourself the owner. Replace the email, then run it.
-- (Lower-case only.) Everyone else you invite from inside the app.
-- =====================================================================
-- insert into public.members (email, role) values ('you@example.com', 'owner');
