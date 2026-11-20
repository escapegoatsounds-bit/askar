// Shared between the app and the API. Keep in sync with supabase/schema.sql.
// Dates are approximate (conventional chronology); negative = BCE.

export interface Era {
  id: string;
  name: string;
  short: string;
  start: number;
  end: number;
  blurb: string;
  hue: number; // used for the era colour band
}

export const ERAS: Era[] = [
  { id: 'predynastic', name: 'Predynastic (Badarian – Naqada)', short: 'Predynastic', start: -5500, end: -3100, blurb: 'Farming villages along the Nile, painted pottery, the first chiefs and cemeteries.', hue: 28 },
  { id: 'early-dynastic', name: 'Early Dynastic (Dynasties 1–2)', short: 'Early Dynastic', start: -3100, end: -2686, blurb: 'Unification under Narmer, the first kings at Abydos and Saqqara.', hue: 34 },
  { id: 'old-kingdom', name: 'Old Kingdom (Dynasties 3–6)', short: 'Old Kingdom', start: -2686, end: -2181, blurb: 'The pyramid age: Djoser, Sneferu, Khufu, Khafre, Menkaure.', hue: 40 },
  { id: 'fip', name: 'First Intermediate Period (Dyn. 7–11)', short: '1st Intermediate', start: -2181, end: -2055, blurb: 'Central power collapses; regional rulers and provincial art.', hue: 18 },
  { id: 'middle-kingdom', name: 'Middle Kingdom (Dynasties 11–13)', short: 'Middle Kingdom', start: -2055, end: -1650, blurb: 'Reunification, classical literature, Senusret and Amenemhat.', hue: 160 },
  { id: 'sip', name: 'Second Intermediate Period (Dyn. 13–17)', short: '2nd Intermediate', start: -1650, end: -1550, blurb: 'The Hyksos in the north, Theban rulers in the south.', hue: 12 },
  { id: 'new-kingdom', name: 'New Kingdom (Dynasties 18–20)', short: 'New Kingdom', start: -1550, end: -1069, blurb: 'Empire: Hatshepsut, Akhenaten, Tutankhamun, Ramesses II, the Valley of the Kings.', hue: 45 },
  { id: 'tip', name: 'Third Intermediate Period (Dyn. 21–25)', short: '3rd Intermediate', start: -1069, end: -664, blurb: 'A divided Egypt, Tanis, Libyan and Kushite pharaohs.', hue: 8 },
  { id: 'late-period', name: 'Late Period (Dynasties 26–31)', short: 'Late Period', start: -664, end: -332, blurb: 'Saite revival and Persian rule.', hue: 200 },
  { id: 'ptolemaic', name: 'Macedonian & Ptolemaic', short: 'Ptolemaic', start: -332, end: -30, blurb: 'Alexander, Alexandria, the Ptolemies and Cleopatra VII.', hue: 215 },
  { id: 'roman', name: 'Roman Egypt', short: 'Roman', start: -30, end: 395, blurb: 'A Roman province; Fayum mummy portraits.', hue: 350 },
  { id: 'byzantine-coptic', name: 'Byzantine & Coptic', short: 'Coptic', start: 395, end: 641, blurb: 'Christian Egypt, monasteries and Coptic textiles.', hue: 280 },
  { id: 'early-islamic', name: 'Early Islamic (to the Ikhshidids)', short: 'Early Islamic', start: 641, end: 969, blurb: 'The Arab conquest, Fustat, the Tulunid mosque.', hue: 140 },
  { id: 'fatimid', name: 'Fatimid', short: 'Fatimid', start: 969, end: 1171, blurb: 'Cairo is founded; al-Azhar.', hue: 130 },
  { id: 'ayyubid-mamluk', name: 'Ayyubid & Mamluk', short: 'Mamluk', start: 1171, end: 1517, blurb: "Saladin's citadel and Mamluk architecture.", hue: 175 },
  { id: 'ottoman', name: 'Ottoman (incl. French expedition)', short: 'Ottoman', start: 1517, end: 1805, blurb: "Ottoman province; Napoleon's savants and the Description de l'Égypte.", hue: 0 },
  { id: 'khedivate', name: 'Muhammad Ali dynasty & Kingdom', short: 'Khedivate', start: 1805, end: 1953, blurb: 'Modernization, the Suez Canal, early photography, newspapers and the great excavations.', hue: 230 },
  { id: 'republic', name: 'Modern Republic', short: 'Republic', start: 1953, end: 2100, blurb: 'The 1952 revolution to today: Aswan, the Abu Simbel move, the GEM.', hue: 190 },
];

export const ERA_BY_ID: Record<string, Era> = Object.fromEntries(ERAS.map((e) => [e.id, e]));

/** Best guess of era from a year range (negative = BCE). */
export function guessEra(yearStart?: number | null, yearEnd?: number | null): string | null {
  const a = typeof yearStart === 'number' && isFinite(yearStart) ? yearStart : null;
  const b = typeof yearEnd === 'number' && isFinite(yearEnd) ? yearEnd : null;
  if (a === null && b === null) return null;
  const mid = a !== null && b !== null ? Math.round((a + b) / 2) : (a ?? b)!;
  const era = ERAS.find((e) => mid >= e.start && mid < e.end);
  return era ? era.id : null;
}

/** Pull a year range out of free text like "ca. 1353–1336 B.C." or "1890". */
export function parseYears(text?: string | null): { start: number | null; end: number | null } {
  if (!text) return { start: null, end: null };
  const t = text.replace(/,/g, '');
  const bce = /\b(B\.?\s?C\.?(E\.?)?|BCE)\b/i.test(t);
  const nums = [...t.matchAll(/\b(\d{3,4})\b/g)].map((m) => parseInt(m[1], 10));
  if (!nums.length) return { start: null, end: null };
  let [s, e] = [nums[0], nums[nums.length - 1]];
  if (bce) {
    s = -s;
    e = -e;
  }
  if (s > e) [s, e] = [e, s];
  return { start: s, end: e };
}

export function formatYear(y: number): string {
  if (y >= 2100) return 'today';
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}

export function formatRange(e: Era): string {
  return `${formatYear(e.start)} – ${formatYear(e.end)}`;
}
