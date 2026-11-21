-- Fact-check status for videos (and anything else that needs it).
alter table public.items
  add column if not exists verification text check (verification in ('official','pending','verified','partly','unverified')),
  add column if not exists verification_note text,
  add column if not exists verified_sources jsonb,
  add column if not exists verified_at timestamptz;
create index if not exists items_verification_pending on public.items (created_at) where verification = 'pending';
