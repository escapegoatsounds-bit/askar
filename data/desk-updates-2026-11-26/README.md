# Desk records newer than the backup zip

The backup zip (LandOfRebirth-backup-2026-11-26.zip) was made BEFORE Episode 1 was rebuilt.
When importing the Desk data, load the zip's `desk/database/` first, then OVERWRITE with these files:

- `episodes/ep-01-nile-breathes.json` (version 37): the Nebet & Wedja story, 57 frames, story sheet fields (`sh_*`), soundtrack, and the old 53 frames in `scenesArchive`.
- `lore/character-nebet.json`, `lore/character-wedja.json`: new character cards (not in the zip).
