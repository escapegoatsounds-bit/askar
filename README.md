# Askar — Egypt Visual Archive

A shared, invite-only visual archive for 7,000 years of Egyptian history. It works on phone and PC as an installable web app (PWA). Collaborators see the same archive live.

**What it does**

- **Timeline**: 18 eras from Predynastic (~5500 BCE) to the modern Republic. Each era opens its own mood board.
- **Discover**: search open collections from one box. Sources: The Met, Wikimedia Commons, Cleveland Museum of Art, Smithsonian, Library of Congress photos, Chronicling America newspapers, Internet Archive films/scans and Sketchfab 3D scans. License, credit, date and source link are saved with every find. Era and category are guessed from the object's dates.
- **Add**: upload from your camera roll, or paste a link to a web page (pick which images to keep), an image or a YouTube video.
- **Android share menu**: once installed, *Askar* appears in the Share menu of Gallery, Chrome and other apps.
- **Map**: 56 sites from Kerma to Rosetta on a Mapbox map. Pins grow with the number of finds saved there. A time scrubber (with ▶ play) moves through the eras, there's a satellite view, and tapping a site opens its finds. When you save something, the site is detected from the museum's title and description, so finds land on the map without extra typing. Item pages show a mini-map.
- **Boards**: *Mood boards* for an age or place. *Reconstruction boards* for one subject (a king, a statue, a temple), with an angle checklist (front, profiles, ¾, back, top, scale, CT/3D, colour evidence…) that shows which views are still missing.
- **Members**: invite-only. Owners add collaborators by email, and collaborators sign in with a one-time link or code (no passwords).

**How storage works**: images from museums and websites are kept as **a link plus a small thumbnail** stored in your database. If a site deletes the original, you still keep the preview and the record of where it came from. Your **own uploads are stored in full**. Videos are stored as links.

---

## Setup (about 15 minutes, once)

### 1. Create the database (Supabase, free)

1. Sign up at <https://supabase.com> and create a **New project** (any name and region; save the database password somewhere).
2. Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**.
3. Make yourself the owner by running this in a new query, using **your email in lower case**:
   ```sql
   insert into public.members (email, role) values ('you@example.com', 'owner');
   ```
4. **Authentication → URL Configuration**: set *Site URL* to your app's address (after step 2 below, e.g. `https://askar.vercel.app`). Add `http://localhost:5173` under *Redirect URLs* for local testing.
5. On phones, sign in in Chrome first, then install the app (Android shares the login). Email templates can only be edited after connecting custom SMTP; the default sign-in link works fine.
6. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.

> Free tier: 500 MB database, 1 GB file storage. Because museum images are stored as thumbnails (~40 KB each), that covers roughly 20,000 saved finds, minus whatever your own full-size uploads use.

### 2. Put it on the web (Vercel, free)

1. Import this GitHub repo at <https://vercel.com/new>. The framework is detected as **Vite**.
2. Add **Environment Variables**:
   - `VITE_SUPABASE_URL`: the Project URL
   - `VITE_SUPABASE_ANON_KEY`: the anon key
   - `VITE_MAPBOX_TOKEN`: a Mapbox public token (`pk.…`). For the live site, create one restricted to your site's URL at <https://account.mapbox.com/access-tokens/>
   - `SMITHSONIAN_API_KEY` (optional): a free key from <https://api.data.gov/signup/>
3. Deploy, then put the resulting URL into Supabase's *Site URL* (step 1.4).

### 3. Install on your phone and invite people

- **Android (Chrome)**: open the site → ⋮ menu → **Install app**. Askar now appears in your Share menu.
- **PC**: open the site in Chrome or Edge → install icon in the address bar (optional; it also works in a normal tab).
- **Invite collaborators**: go to **Members** → add their email → send them the link.

## Run locally

```bash
npm install
cp .env.example .env    # fill in the two Supabase values
npm run dev             # http://localhost:5173 (the /api routes run inside Vite)
```

## Project layout

```
api/                 serverless functions (Vercel): search, image fetch, page import
  _lib/sources.ts    one connector per museum/archive; add new sources here
src/pages/           Timeline, Browse (era + library), Discover, Add, Share, Boards, Item, Members
src/lib/eras.ts      the 18 eras and year→era guessing (keep in sync with schema.sql)
src/lib/taxonomy.ts  categories, reconstruction angles
public/sw.js         service worker that receives Android shares
supabase/schema.sql  tables, invite-only security rules, storage bucket
```

## Honest limitations

- **Licenses**: museum CC0 items are free to use. For anything imported from other websites the license is "Unknown". Check it before you publish anything.
- **Page import reads one page at a time, on demand.** It is not a crawler. Some sites block automated readers and will return an error.
- **iPhone** users can use everything except the Share-menu shortcut (an Apple limitation for web apps).
- The search connectors follow each API's documented format. If a museum changes its API, that one source shows an error in Discover; the others keep working.
