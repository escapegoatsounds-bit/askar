# Land of Rebirth: handoff for Claude (read this first)

You are continuing work for the owner of this repo on two connected tools for **Land of Rebirth**, a narrated video series about 10,000 years of Egyptian history told through ordinary eyewitnesses. Earlier work happened in a cloud Claude Code session (Nov 2026). This file is everything you need.

## How to talk to the owner (their stated preferences)
- Speak like a childhood friend: warm, humorous, a little sarcastic; comforting only when needed.
- **Never lie or mislead. Give the hard truth** (say plainly what you did not test or verify).
- Answer creative side first, then technical side, then your recommendation.
- **Ask when a request is unclear; never guess because looking it up is effort.**
- They work on **Windows**. Not a developer: give click-by-click steps, never paste secrets into chat.

## The two tools
1. **Askar** (this repo): image + research archive. Vite 5 + React 18 + TypeScript + react-router 6 PWA.
   - Online today: https://askar-archive.vercel.app (Vercel project `askar-archive`, team `askar20`, region fra1). Deploys are manual from branch `claude/egypt-landmarks-archive-app-27setz` (production branch `main` is NOT auto-deployed).
   - Database/storage: Supabase project `inmywhvxsudowwlvlhpy` (URL https://inmywhvxsudowwlvlhpy.supabase.co, publishable key `sb_publishable_Aunkt5MkIvLt_G_JNCvrQQ_sIqQ_T5R`). Private bucket `media` (thumbnails only). Schema: `supabase/schema.sql` + `supabase/migrations/*`.
   - `/api/*` are serverless functions (search across museums/YouTube/etc., fetch-image, import-page). `vite.config.ts` has a dev plugin that runs them inside `npm run dev`, so **the app already runs locally with `npm install && npm run dev`** given a `.env` (see `.env.example`).
   - Main pages: Projects/Boards (Pinterest-style), Discover (search), Map (Mapbox), Timeline, Places (Wikipedia-style research per site), **Rulers** (254 rulers with mummy/remains facts → face-evidence pages and reconstruction boards), Library, Item pages.
   - Optional API keys live in Vercel env (never commit them): YOUTUBE_API_KEY (set), BRAVE/UNSPLASH/PEXELS/PIXABAY/SMITHSONIAN (not set). Mapbox public token is in the app.
2. **The Production Desk** (`desk/index.html`): one big single-file app (≈670 KB) where episodes are written, frames planned and image/video/music prompts generated. Live as a claude.ai Artifact: https://claude.ai/artifact/Ae7qJiZFX6M5SD3ZNQf33S (KEEP IT; it is the owner's backup). In the artifact it uses the artifact runtime: a document database (collections `entries` codex, `lore`, `episodes`, `settings`, `mood`, `moodmeta`), uploaded assets (`/_blob/<id>`), and in-page Claude calls (`S.sample`). `desk/atlas/` holds its map/timeline files (`geo.json`, fonts, `tl-strip*.webp`). Opened as a plain local file, the database and AI features will not work; it must be re-hosted (see plan).

## Where the data is
- **Full backup zip** `LandOfRebirth-backup-2026-11-26.zip` (48 MB), given to the owner to keep on their PC:
  `askar/askar-database.json` (all Askar tables), `desk/database/<collection>/<id>.json` (every Desk record), `desk/uploaded-files/` (40 images + 1 video, named by asset id), `desk/page/` (the Desk app), `names.json`, `README.txt`.
- **Newer than the zip:** `data/desk-updates-2026-11-26/` holds the rebuilt Episode 1 and the Nebet/Wedja lore cards. Import the zip first, then overwrite with these.
- Data-only copy (1 MB) in Google Drive folder "Land of Rebirth · NotebookLM".
- `docs/names.json`: names by era (attested vs reconstructed) and the Episode 1 cast.

## THE OWNER'S DECISION: go local-first (next job)
They no longer collaborate and do not want to depend on subscriptions/online storage. Agreed plan:
1. ✅ Full export/backup (done).
2. Rebuild Askar's storage to be local: a local database (e.g. SQLite via a small Node server, or JSON files) + a normal images folder on disk; keep internet only for searching new images. Remove/skip auth, invites, roles, realtime.
3. Merge the Desk into the same local app, reading/writing the same local data; import `desk/database` + `desk/uploaded-files` from the backup zip. AI features (Break into frames, fillers) should be done by Claude Code on the PC (owner's Claude subscription), not in-page; or via an API key only if the owner agrees.
4. One Windows launcher/desktop icon that starts the local server and opens the app. (There is already `public/studio/Install-Askar-Studio.bat` + `launch.ps1` that make an "Askar Studio" desktop icon opening the ONLINE Askar + Desk side by side; repoint it to the local app when ready.)
Tell the owner honestly what is lost locally: phone access, the cloud 12-hourly research task, Android share target; searching still needs internet.

## Series bible (applies to every episode; also stored in the Desk under Story → Series guidelines)
- **Formula**: (1) clear picture of the age and time; (2) a problem; (3) real history taught through what characters live; (4) the age's arts, culture, music and its own 1–2 min soundtrack; (5) Egypt or a character who stands for Egypt is reborn with a new opportunity at the end; (6) characters are eyewitnesses and the narrator (the episode's main character) tells their own story and emotions, in English (dubbed later).
- **Images**: each frame an award-winning, ultra-realistic photograph (not painting); framed by nature, symbolic, surreal, supernatural; the consciousness of each age; what it means to be Egyptian whatever race or religion; the Nile present or felt. Characters fully visible. Each age styled in its own art/culture.
- **Motion**: people and animals frozen in time; only ambience moves (water, birds, sand/sandstorm, smoke, light, clothes and hair in the breeze).
- **Craft**: 16:9, ~10 s per frame, 40–60 frames per episode; ~1/3 filler frames (establishing, period-object close-up, ambience, time passing, frozen face, symbolic vision); every frame has real foreground/midground/background depth for the camera move; 23 camera presets incl. drone (fly-forward, rise, orbit, top-down), crane (up/down/over), slide-through. At least one documented codex object every second frame. Easter eggs only when planted on purpose. Title cards only for intro and between chapters.
- **Historical accuracy is sacred**: only ancient names before the Greek era (Tjehenu not Libya, Kemet, Wadj-wer, Retjenu, Alashiya…); no gods, objects or names before they are attested; mark reconstructions as such.

## Episode 1 status ("Where the Nile Breathes Life")
- Set **c. 5300 BC**, just before the Predynastic, when the Green Sahara dried. Narrator **Nebet** (mother; reconstructed name, alternatives Merit/Nefret/Ankhet), baby **Wedja** (alt. Ankh/Tjau/Iteru).
- Story: 3-year drought → tribe leaves the oasis for the Nile → starving lions kill the tribe → mother and baby alone → sandstorm (**soundtrack bass drop**: a vision beyond her time revealing the 16 gods her descendants will name; framed as a vision because none are attested in 5300 BC) → cave (Wadi Sura / Cave of Beasts), baby afraid of lizards ("little hands" stencils were really made with reptile feet) → fire, hand stencils → leaves for food → last rain pools + water birds lead east → baby's cry draws an eastbound herder band → the Nile → rebirth: farming the flood mud, a new people; old Nebet tells grown Wedja.
- Soundtrack lyrics (Arabic-script Egyptian chant, 69 stray Hebrew letters were fixed) and translation are saved in the episode.
- **Frames rebuilt (26 Nov 2026)**: 57 frames × 10 s (9.5 min), 18 fillers, written by Claude to the series bible; act cards on frame 1 and the last frame; song runs frames 12–31 with the bass drop on the sandstorm (frame 23) and the gods' vision in frames 25–30. The old 53 Amunharu frames are kept in the episode field `scenesArchive`. Lore has `character-nebet` and `character-wedja` (old `character-amunharu*` entries are still there, unused).
- Accuracy: c. 5300 BC southern Nile people were fishers/herders/wild-grain gatherers (sown farming from c. 5200 BC in the Faiyum), so the ending shows fishing and wild grain, not fields.
- Distance note: Wadi Sura is ~600–700 km from the Nile.

## Research pipeline (cloud; may be retired when local)
- Supabase Edge Function `research-api` (`supabase/functions/research-api/index.ts`) with actions next/update_place/add_images/reset_place/log/videos/verify_item, auth header `X-Research-Token` = secret `RESEARCH_TOKEN`. **The Supabase secret was never saved successfully** (diagnostics showed `secret_set:false`), so the 12-hourly scheduled research task fails until it is added in Supabase → Edge Functions → Secrets.
- All 40 predynastic places were researched by Claude and marked `needs_review` (written without live source access).

## Gotchas learned the hard way
- Wikipedia's REST summary endpoint rate-limits cloud IPs; use the Action API with a User-Agent.
- Pasted Arabic lyrics may contain look-alike Hebrew letters (מ נ ח); check before using.
- The Desk CSS has many layered `!important` rules; later rules win. Test visually.
- Supabase free tier pauses after a week of inactivity (another reason for local).
