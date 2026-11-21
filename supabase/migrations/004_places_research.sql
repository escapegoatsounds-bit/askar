-- 004: place research fields + predynastic sites (applied 2026-11-21)

alter table public.sites
  add column if not exists eras text[] not null default '{}',
  add column if not exists priority int not null default 0,
  add column if not exists coords_verified boolean not null default true,
  add column if not exists wikipedia_title text,
  add column if not exists summary text,
  add column if not exists culture text,
  add column if not exists dates_text text,
  add column if not exists facts jsonb not null default '[]'::jsonb,
  add column if not exists rulers jsonb not null default '[]'::jsonb,
  add column if not exists deities jsonb not null default '[]'::jsonb,
  add column if not exists beliefs text,
  add column if not exists sources jsonb not null default '[]'::jsonb,
  add column if not exists research_status text not null default 'todo' check (research_status in ('todo','in_progress','done','needs_review')),
  add column if not exists research_notes text,
  add column if not exists researched_at timestamptz,
  add column if not exists research_requested_at timestamptz;

insert into public.sites (name, lat, lng, region, aliases, description, eras, priority, coords_verified) values
  ('Nabta Playa', 22.51, 30.73, 'Western Desert', array['Nabta']::text[], 'Neolithic cattle-herders'' ceremonial centre with stone circle and megaliths in the Nubian desert.', array['predynastic']::text[], 100, false),
  ('Gebel Ramlah', 22.7, 30.4, 'Western Desert', array['Jebel Ramlah']::text[], 'Neolithic cemeteries by an ancient lake near Nabta Playa.', array['predynastic']::text[], 100, false),
  ('Wadi Sura', 23.67, 25.22, 'Western Desert', array['Cave of Swimmers', 'Cave of Beasts', 'Gilf Kebir']::text[], 'Painted rock shelters of the Gilf Kebir: swimmers, beasts and herders.', array['predynastic']::text[], 100, false),
  ('Wadi Kubbaniya', 24.25, 32.85, 'Aswan', array['Kubbaniya']::text[], 'Late Palaeolithic camps of fishers and plant gatherers by the Nile.', array['predynastic']::text[], 100, false),
  ('Jebel Sahaba', 21.98, 31.33, 'Nubia (Sudan)', array['Gebel Sahaba', 'Cemetery 117']::text[], 'Late Palaeolithic cemetery with some of the earliest evidence of organised violence.', array['predynastic']::text[], 100, false),
  ('Qustul', 22.0, 31.36, 'Nubia', array['A-Group', 'Qustul incense burner']::text[], 'A-Group Nubian royal cemetery whose objects echo early Egyptian kingship.', array['predynastic']::text[], 100, false),
  ('Nag el-Hamdulab', 24.13, 32.85, 'Aswan', array['Hamdulab']::text[], 'Rock art of early boats and a royal procession at the dawn of kingship.', array['predynastic', 'early-dynastic']::text[], 100, false),
  ('Merimde Beni Salama', 30.32, 30.85, 'Delta', array['Merimde', 'Merimda']::text[], 'One of Egypt''s earliest farming villages on the western Delta edge.', array['predynastic']::text[], 100, false),
  ('El-Omari', 29.88, 31.35, 'Lower Egypt', array['Omari', 'Helwan Neolithic']::text[], 'Neolithic settlement and burials near Helwan.', array['predynastic']::text[], 100, false),
  ('Maadi', 29.96, 31.27, 'Lower Egypt', array['Maadi culture', 'Wadi Digla']::text[], 'Lower Egyptian town trading with the Levant, with copper, pottery and Wadi Digla burials.', array['predynastic']::text[], 100, false),
  ('Tell el-Farkha', 30.98, 31.63, 'Delta', array['Farkha']::text[], 'Delta brewery, temple and elite tombs bridging the Buto-Maadi and Naqada worlds.', array['predynastic', 'early-dynastic']::text[], 100, false),
  ('Minshat Abu Omar', 30.91, 31.98, 'Delta', array['Minshat Abu Omar cemetery']::text[], 'Eastern Delta cemetery on the trade route to the Levant.', array['predynastic', 'early-dynastic']::text[], 100, false),
  ('Tell el-Iswid', 30.75, 31.69, 'Delta', array['Iswid']::text[], 'Delta settlement showing the shift from Lower Egyptian to Naqada culture.', array['predynastic']::text[], 100, false),
  ('Tell Ibrahim Awad', 30.83, 31.88, 'Delta', array['Ibrahim Awad']::text[], 'Delta temple site with early votive deposits.', array['predynastic', 'early-dynastic', 'old-kingdom']::text[], 100, false),
  ('Kafr Hassan Dawood', 30.55, 31.97, 'Delta', array['Wadi Tumilat']::text[], 'Late predynastic to early dynastic cemetery in the Wadi Tumilat.', array['predynastic', 'early-dynastic']::text[], 100, false),
  ('Helwan', 29.85, 31.34, 'Lower Egypt', array['Ezbet el-Walda']::text[], 'Vast early dynastic cemetery across the river from Memphis.', array['predynastic', 'early-dynastic']::text[], 100, false),
  ('Tarkhan', 29.5, 31.23, 'Lower Egypt', array[]::text[], 'Cemetery of the late predynastic and First Dynasty, with the oldest known linen dress nearby.', array['predynastic', 'early-dynastic']::text[], 100, false),
  ('Gerzeh', 29.46, 31.2, 'Lower Egypt', array['Gerza', 'Gerzean']::text[], 'Naqada II cemetery that names the ''Gerzean'' phase; meteoritic iron beads.', array['predynastic']::text[], 100, false),
  ('Abusir el-Meleq', 29.25, 31.08, 'Middle Egypt', array[]::text[], 'Large late predynastic cemetery at the Fayum entrance.', array['predynastic']::text[], 100, false),
  ('Matmar', 27.12, 31.32, 'Upper Egypt', array[]::text[], 'Badarian and Naqada cemeteries on the east bank.', array['predynastic']::text[], 100, false),
  ('Mostagedda', 27.07, 31.35, 'Upper Egypt', array[]::text[], 'Badarian to Naqada cemeteries near Badari.', array['predynastic']::text[], 100, false),
  ('Deir Tasa', 27.06, 31.37, 'Upper Egypt', array['Tasian']::text[], 'Type site of the disputed ''Tasian'' culture.', array['predynastic']::text[], 100, false),
  ('Hemamieh', 27.03, 31.43, 'Upper Egypt', array['Hammamiya']::text[], 'Stratified Badarian to Naqada settlement layers.', array['predynastic']::text[], 100, false),
  ('Mahasna', 26.25, 31.82, 'Upper Egypt', array['El-Mahasna']::text[], 'Naqada cemetery near Abydos with early clay figurines.', array['predynastic']::text[], 100, false),
  ('Hu', 26.03, 32.27, 'Upper Egypt', array['Diospolis Parva', 'Abadiya']::text[], 'Cemeteries Petrie used to build his ''sequence dating'' of predynastic pottery.', array['predynastic']::text[], 100, false),
  ('Gebel el-Arak', 26.06, 32.45, 'Upper Egypt', array['Gebel el-Arak knife']::text[], 'Area linked to the famous carved ivory-handled flint knife.', array['predynastic']::text[], 100, false),
  ('Ballas', 25.92, 32.73, 'Upper Egypt', array[]::text[], 'Naqada cemetery across from Naqada itself.', array['predynastic']::text[], 100, false),
  ('Armant', 25.62, 32.53, 'Thebes', array['Hermonthis']::text[], 'Predynastic cemetery and later cult centre of Montu and the Buchis bull.', array['predynastic', 'middle-kingdom', 'ptolemaic']::text[], 100, false),
  ('Gebelein', 25.48, 32.48, 'Upper Egypt', array['Pathyris', 'Gebelein Man']::text[], 'Twin hills with the painted Gebelein linen and naturally mummified ''Gebelein Man''.', array['predynastic', 'old-kingdom', 'fip']::text[], 100, false),
  ('Adaima', 25.15, 32.7, 'Upper Egypt', array[]::text[], 'Predynastic village and cemetery with early evidence of human sacrifice debates.', array['predynastic', 'early-dynastic']::text[], 100, false),
  ('Wadi Hammamat', 25.98, 33.4, 'Eastern Desert', array['Hammamat']::text[], 'Desert route with predynastic rock art and later quarry inscriptions.', array['predynastic', 'middle-kingdom']::text[], 100, false),
  ('Dakhla Oasis', 25.5, 29.0, 'Western Desert', array['Bashendi', 'Sheikh Muftah']::text[], 'Oasis cultures (Bashendi, Sheikh Muftah) contemporary with the predynastic Nile.', array['predynastic', 'old-kingdom']::text[], 100, false),
  ('Farafra Oasis', 27.06, 27.97, 'Western Desert', array['Hidden Valley', 'Wadi el-Obeiyid']::text[], 'Holocene herder camps and painted caves of Farafra.', array['predynastic']::text[], 100, false),
  ('Kom Ombo plain', 24.47, 32.95, 'Aswan', array['Gebel el-Silsila', 'Sebilian']::text[], 'Late Palaeolithic ''Sebilian'' camps on the Kom Ombo plain.', array['predynastic']::text[], 100, false)
on conflict (name) do nothing;

update public.sites set eras = array['old-kingdom']::text[], priority = 10 where name = 'Giza';
update public.sites set eras = array['early-dynastic', 'old-kingdom', 'new-kingdom', 'late-period', 'ptolemaic']::text[], priority = 60 where name = 'Saqqara';
update public.sites set eras = array['old-kingdom', 'middle-kingdom']::text[], priority = 10 where name = 'Dahshur';
update public.sites set eras = array['old-kingdom']::text[], priority = 10 where name = 'Abusir';
update public.sites set eras = array['early-dynastic', 'old-kingdom', 'middle-kingdom', 'new-kingdom', 'late-period', 'ptolemaic']::text[], priority = 60 where name = 'Memphis';
update public.sites set eras = array['old-kingdom']::text[], priority = 10 where name = 'Meidum';
update public.sites set eras = array['old-kingdom', 'middle-kingdom', 'new-kingdom']::text[], priority = 60 where name = 'Heliopolis';
update public.sites set eras = array['middle-kingdom', 'ptolemaic', 'roman']::text[], priority = 60 where name = 'Fayum';
update public.sites set eras = array['middle-kingdom']::text[], priority = 10 where name = 'Lahun';
update public.sites set eras = array['middle-kingdom']::text[], priority = 10 where name = 'Beni Hasan';
update public.sites set eras = array['new-kingdom', 'late-period', 'ptolemaic', 'roman']::text[], priority = 10 where name = 'Hermopolis';
update public.sites set eras = array['new-kingdom']::text[], priority = 10 where name = 'Amarna';
update public.sites set eras = array['predynastic']::text[], priority = 90 where name = 'Badari';
update public.sites set eras = array['predynastic', 'early-dynastic', 'middle-kingdom', 'new-kingdom']::text[], priority = 90 where name = 'Abydos';
update public.sites set eras = array['ptolemaic', 'roman']::text[], priority = 10 where name = 'Dendera';
update public.sites set eras = array['predynastic']::text[], priority = 90 where name = 'Naqada';
update public.sites set eras = array['middle-kingdom', 'new-kingdom', 'tip', 'late-period', 'ptolemaic']::text[], priority = 10 where name = 'Karnak';
update public.sites set eras = array['new-kingdom', 'roman', 'ayyubid-mamluk']::text[], priority = 10 where name = 'Luxor Temple';
update public.sites set eras = array['new-kingdom', 'khedivate']::text[], priority = 10 where name = 'Valley of the Kings';
update public.sites set eras = array['middle-kingdom', 'new-kingdom', 'tip']::text[], priority = 10 where name = 'Deir el-Bahari';
update public.sites set eras = array['new-kingdom']::text[], priority = 10 where name = 'Deir el-Medina';
update public.sites set eras = array['new-kingdom']::text[], priority = 10 where name = 'Ramesseum';
update public.sites set eras = array['new-kingdom', 'tip', 'byzantine-coptic']::text[], priority = 10 where name = 'Medinet Habu';
update public.sites set eras = array['new-kingdom']::text[], priority = 10 where name = 'Valley of the Queens';
update public.sites set eras = array['new-kingdom', 'roman']::text[], priority = 10 where name = 'Colossi of Memnon';
update public.sites set eras = array['ptolemaic', 'roman']::text[], priority = 10 where name = 'Esna';
update public.sites set eras = array['predynastic', 'sip', 'new-kingdom']::text[], priority = 90 where name = 'Elkab';
update public.sites set eras = array['predynastic', 'early-dynastic']::text[], priority = 90 where name = 'Hierakonpolis';
update public.sites set eras = array['ptolemaic']::text[], priority = 10 where name = 'Edfu';
update public.sites set eras = array['ptolemaic', 'roman']::text[], priority = 10 where name = 'Kom Ombo';
update public.sites set eras = array['old-kingdom', 'middle-kingdom', 'new-kingdom', 'roman']::text[], priority = 60 where name = 'Aswan';
update public.sites set eras = array['late-period', 'ptolemaic', 'roman', 'byzantine-coptic', 'republic']::text[], priority = 10 where name = 'Philae';
update public.sites set eras = array['roman', 'republic']::text[], priority = 10 where name = 'Kalabsha';
update public.sites set eras = array['republic']::text[], priority = 10 where name = 'Aswan High Dam';
update public.sites set eras = array['new-kingdom', 'republic']::text[], priority = 10 where name = 'Abu Simbel';
update public.sites set eras = array['middle-kingdom', 'sip']::text[], priority = 10 where name = 'Kerma';
update public.sites set eras = array['new-kingdom', 'tip', 'late-period']::text[], priority = 10 where name = 'Gebel Barkal';
update public.sites set eras = array['tip']::text[], priority = 10 where name = 'Tanis';
update public.sites set eras = array['sip', 'new-kingdom']::text[], priority = 10 where name = 'Avaris';
update public.sites set eras = array['old-kingdom', 'tip', 'late-period']::text[], priority = 10 where name = 'Bubastis';
update public.sites set eras = array['late-period']::text[], priority = 10 where name = 'Sais';
update public.sites set eras = array['predynastic', 'early-dynastic', 'late-period']::text[], priority = 90 where name = 'Buto';
update public.sites set eras = array['ptolemaic', 'ottoman']::text[], priority = 10 where name = 'Rosetta';
update public.sites set eras = array['ptolemaic', 'roman', 'byzantine-coptic', 'khedivate']::text[], priority = 10 where name = 'Alexandria';
update public.sites set eras = array['late-period', 'ptolemaic']::text[], priority = 10 where name = 'Siwa';
update public.sites set eras = array['byzantine-coptic', 'fatimid']::text[], priority = 10 where name = 'Saint Catherine''s Monastery';
update public.sites set eras = array['byzantine-coptic', 'early-islamic']::text[], priority = 10 where name = 'Wadi Natrun';
update public.sites set eras = array['roman', 'byzantine-coptic', 'early-islamic']::text[], priority = 10 where name = 'Coptic Cairo';
update public.sites set eras = array['early-islamic']::text[], priority = 10 where name = 'Ibn Tulun Mosque';
update public.sites set eras = array['fatimid', 'ayyubid-mamluk', 'ottoman']::text[], priority = 10 where name = 'Al-Azhar';
update public.sites set eras = array['fatimid', 'ayyubid-mamluk']::text[], priority = 10 where name = 'Bab Zuweila';
update public.sites set eras = array['ayyubid-mamluk', 'ottoman', 'khedivate']::text[], priority = 10 where name = 'Cairo Citadel';
update public.sites set eras = array['ayyubid-mamluk']::text[], priority = 10 where name = 'Sultan Hassan Mosque';
update public.sites set eras = array['khedivate', 'republic']::text[], priority = 10 where name = 'Downtown Cairo';
update public.sites set eras = array['republic']::text[], priority = 10 where name = 'Grand Egyptian Museum';
update public.sites set eras = array['khedivate', 'republic']::text[], priority = 10 where name = 'Port Said';
update public.sites set eras = array['fip', 'middle-kingdom', 'tip']::text[], priority = 10 where name = 'Herakleopolis';
update public.sites set eras = array['middle-kingdom']::text[], priority = 10 where name = 'Lisht';

create table if not exists public.research_log (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  places text[] not null default '{}',
  summary text,
  images_added int not null default 0
);
alter table public.research_log enable row level security;
drop policy if exists research_log_read on public.research_log;
create policy research_log_read on public.research_log for select using (public.has_access());
