// Known sites with coordinates. Mirrors the seed in supabase/schema.sql;
// extra sites added to the database at runtime are merged on top.
export interface Site { name: string; lat: number; lng: number; region: string; aliases: string[]; description: string }

export const SITES: Site[] = [
  {
  "name": "Giza",
  "lat": 29.9792,
  "lng": 31.1342,
  "region": "Memphite necropolis",
  "aliases": [
  "Giza Plateau",
  "Great Pyramid",
  "Sphinx",
  "Pyramids of Giza"
  ],
  "description": "Pyramids of Khufu, Khafre and Menkaure; the Great Sphinx."
  },
  {
  "name": "Saqqara",
  "lat": 29.8713,
  "lng": 31.2165,
  "region": "Memphite necropolis",
  "aliases": [
  "Sakkara",
  "Step Pyramid"
  ],
  "description": "Djoser's Step Pyramid and 3,000 years of tombs."
  },
  {
  "name": "Dahshur",
  "lat": 29.8078,
  "lng": 31.2061,
  "region": "Memphite necropolis",
  "aliases": [
  "Bent Pyramid",
  "Red Pyramid"
  ],
  "description": "Sneferu's Bent and Red pyramids."
  },
  {
  "name": "Abusir",
  "lat": 29.8956,
  "lng": 31.2028,
  "region": "Memphite necropolis",
  "aliases": [],
  "description": "Fifth Dynasty pyramids and sun temples."
  },
  {
  "name": "Memphis",
  "lat": 29.8447,
  "lng": 31.2503,
  "region": "Lower Egypt",
  "aliases": [
  "Mit Rahina"
  ],
  "description": "The first capital of united Egypt."
  },
  {
  "name": "Meidum",
  "lat": 29.3883,
  "lng": 31.1572,
  "region": "Middle Egypt",
  "aliases": [
  "Maidum"
  ],
  "description": "The collapsed pyramid; Rahotep and Nofret."
  },
  {
  "name": "Heliopolis",
  "lat": 30.1292,
  "lng": 31.3076,
  "region": "Lower Egypt",
  "aliases": [
  "Iunu",
  "Matariya"
  ],
  "description": "City of the sun god; Senusret I's obelisk."
  },
  {
  "name": "Fayum",
  "lat": 29.3084,
  "lng": 30.8428,
  "region": "Fayum",
  "aliases": [
  "Faiyum",
  "Hawara",
  "Fayoum"
  ],
  "description": "Lake oasis; Hawara pyramid; Roman mummy portraits."
  },
  {
  "name": "Lahun",
  "lat": 29.2333,
  "lng": 30.9667,
  "region": "Fayum",
  "aliases": [
  "El-Lahun",
  "Illahun",
  "Kahun"
  ],
  "description": "Senusret II's pyramid and workers' town."
  },
  {
  "name": "Beni Hasan",
  "lat": 27.9333,
  "lng": 30.8833,
  "region": "Middle Egypt",
  "aliases": [],
  "description": "Painted Middle Kingdom rock tombs."
  },
  {
  "name": "Hermopolis",
  "lat": 27.7811,
  "lng": 30.8036,
  "region": "Middle Egypt",
  "aliases": [
  "Ashmunein",
  "Tuna el-Gebel"
  ],
  "description": "City of Thoth; ibis and baboon catacombs."
  },
  {
  "name": "Amarna",
  "lat": 27.645,
  "lng": 30.8956,
  "region": "Middle Egypt",
  "aliases": [
  "Tell el-Amarna",
  "Akhetaten"
  ],
  "description": "Akhenaten's short-lived capital; Nefertiti's bust."
  },
  {
  "name": "Badari",
  "lat": 27.0,
  "lng": 31.4167,
  "region": "Upper Egypt",
  "aliases": [
  "El-Badari"
  ],
  "description": "Type site of the Badarian culture."
  },
  {
  "name": "Abydos",
  "lat": 26.1847,
  "lng": 31.9189,
  "region": "Upper Egypt",
  "aliases": [
  "Umm el-Qa'ab"
  ],
  "description": "Royal tombs of Dynasty 1; Seti I's temple; cult of Osiris."
  },
  {
  "name": "Dendera",
  "lat": 26.1417,
  "lng": 32.6703,
  "region": "Upper Egypt",
  "aliases": [
  "Denderah"
  ],
  "description": "Temple of Hathor; the zodiac ceiling."
  },
  {
  "name": "Naqada",
  "lat": 25.9,
  "lng": 32.7167,
  "region": "Upper Egypt",
  "aliases": [
  "Nagada"
  ],
  "description": "Predynastic cemeteries that name an entire culture."
  },
  {
  "name": "Karnak",
  "lat": 25.7188,
  "lng": 32.6573,
  "region": "Thebes",
  "aliases": [
  "Thebes",
  "Ipet-isut"
  ],
  "description": "The vast temple of Amun; the hypostyle hall."
  },
  {
  "name": "Luxor Temple",
  "lat": 25.6995,
  "lng": 32.6391,
  "region": "Thebes",
  "aliases": [
  "Luxor"
  ],
  "description": "Amenhotep III and Ramesses II's temple; Avenue of Sphinxes."
  },
  {
  "name": "Valley of the Kings",
  "lat": 25.7402,
  "lng": 32.6014,
  "region": "Thebes",
  "aliases": [
  "KV62",
  "Biban el-Muluk"
  ],
  "description": "New Kingdom royal tombs; Tutankhamun."
  },
  {
  "name": "Deir el-Bahari",
  "lat": 25.7383,
  "lng": 32.6066,
  "region": "Thebes",
  "aliases": [
  "Djeser-Djeseru",
  "Hatshepsut temple",
  "Royal cache"
  ],
  "description": "Hatshepsut's terraced temple; the royal mummy cache."
  },
  {
  "name": "Deir el-Medina",
  "lat": 25.7286,
  "lng": 32.6013,
  "region": "Thebes",
  "aliases": [
  "Set Maat"
  ],
  "description": "The tomb-builders' village."
  },
  {
  "name": "Ramesseum",
  "lat": 25.728,
  "lng": 32.6105,
  "region": "Thebes",
  "aliases": [],
  "description": "Ramesses II's memorial temple; the fallen colossus."
  },
  {
  "name": "Medinet Habu",
  "lat": 25.7195,
  "lng": 32.6006,
  "region": "Thebes",
  "aliases": [],
  "description": "Ramesses III's temple and battle reliefs."
  },
  {
  "name": "Valley of the Queens",
  "lat": 25.7281,
  "lng": 32.5928,
  "region": "Thebes",
  "aliases": [
  "Nefertari"
  ],
  "description": "Tomb of Nefertari."
  },
  {
  "name": "Colossi of Memnon",
  "lat": 25.7206,
  "lng": 32.6104,
  "region": "Thebes",
  "aliases": [
  "Memnon"
  ],
  "description": "Amenhotep III's twin statues."
  },
  {
  "name": "Esna",
  "lat": 25.2933,
  "lng": 32.5536,
  "region": "Upper Egypt",
  "aliases": [],
  "description": "Ptolemaic–Roman temple of Khnum."
  },
  {
  "name": "Elkab",
  "lat": 25.1194,
  "lng": 32.7958,
  "region": "Upper Egypt",
  "aliases": [
  "Nekheb",
  "El Kab"
  ],
  "description": "Vulture-goddess city; Ahmose son of Ebana's tomb."
  },
  {
  "name": "Hierakonpolis",
  "lat": 25.0972,
  "lng": 32.7794,
  "region": "Upper Egypt",
  "aliases": [
  "Nekhen"
  ],
  "description": "Predynastic capital; the Narmer Palette was found here."
  },
  {
  "name": "Edfu",
  "lat": 24.9779,
  "lng": 32.8733,
  "region": "Upper Egypt",
  "aliases": [],
  "description": "Best-preserved temple of Horus."
  },
  {
  "name": "Kom Ombo",
  "lat": 24.452,
  "lng": 32.9283,
  "region": "Upper Egypt",
  "aliases": [],
  "description": "Double temple of Sobek and Haroeris."
  },
  {
  "name": "Aswan",
  "lat": 24.085,
  "lng": 32.8869,
  "region": "Aswan",
  "aliases": [
  "Elephantine",
  "Unfinished obelisk"
  ],
  "description": "Granite quarries, Elephantine island, the southern frontier."
  },
  {
  "name": "Philae",
  "lat": 24.0256,
  "lng": 32.8844,
  "region": "Aswan",
  "aliases": [
  "Agilkia"
  ],
  "description": "Temple of Isis, moved stone by stone in the 1970s."
  },
  {
  "name": "Kalabsha",
  "lat": 23.9608,
  "lng": 32.8656,
  "region": "Nubia",
  "aliases": [],
  "description": "Roman-era temple relocated near the High Dam."
  },
  {
  "name": "Aswan High Dam",
  "lat": 23.9709,
  "lng": 32.878,
  "region": "Aswan",
  "aliases": [
  "Lake Nasser",
  "High Dam"
  ],
  "description": "Built 1960–70; flooded Nubia, triggered the UNESCO rescue."
  },
  {
  "name": "Abu Simbel",
  "lat": 22.3372,
  "lng": 31.6258,
  "region": "Nubia",
  "aliases": [],
  "description": "Ramesses II's rock temples, lifted in 1964–68."
  },
  {
  "name": "Kerma",
  "lat": 19.6,
  "lng": 30.41,
  "region": "Nubia (Sudan)",
  "aliases": [],
  "description": "Capital of the Kingdom of Kush."
  },
  {
  "name": "Gebel Barkal",
  "lat": 18.5357,
  "lng": 31.8278,
  "region": "Nubia (Sudan)",
  "aliases": [
  "Napata"
  ],
  "description": "Sacred mountain of the Kushite pharaohs."
  },
  {
  "name": "Tanis",
  "lat": 30.9767,
  "lng": 31.8803,
  "region": "Delta",
  "aliases": [
  "San el-Hagar"
  ],
  "description": "Third Intermediate capital; silver coffins of Psusennes."
  },
  {
  "name": "Avaris",
  "lat": 30.7875,
  "lng": 31.8211,
  "region": "Delta",
  "aliases": [
  "Tell el-Dab'a",
  "Piramesse",
  "Qantir"
  ],
  "description": "Hyksos capital; later Ramesses' Pi-Ramesse."
  },
  {
  "name": "Bubastis",
  "lat": 30.5728,
  "lng": 31.5106,
  "region": "Delta",
  "aliases": [
  "Tell Basta"
  ],
  "description": "Cat-goddess Bastet's city."
  },
  {
  "name": "Sais",
  "lat": 30.9653,
  "lng": 30.7686,
  "region": "Delta",
  "aliases": [
  "Sa el-Hagar"
  ],
  "description": "Seat of the Saite 26th Dynasty."
  },
  {
  "name": "Buto",
  "lat": 31.1964,
  "lng": 30.7417,
  "region": "Delta",
  "aliases": [
  "Tell el-Fara'in"
  ],
  "description": "Predynastic Delta centre; cobra goddess Wadjet."
  },
  {
  "name": "Rosetta",
  "lat": 31.4044,
  "lng": 30.4164,
  "region": "Delta",
  "aliases": [
  "Rashid",
  "Rosetta Stone"
  ],
  "description": "Where the Rosetta Stone was found in 1799."
  },
  {
  "name": "Alexandria",
  "lat": 31.2001,
  "lng": 29.9187,
  "region": "Mediterranean",
  "aliases": [
  "Pharos",
  "Kom el-Shoqafa",
  "Pompey's Pillar"
  ],
  "description": "Alexander's city; Ptolemaic and Roman capital."
  },
  {
  "name": "Siwa",
  "lat": 29.2032,
  "lng": 25.5195,
  "region": "Western Desert",
  "aliases": [
  "Siwa Oasis",
  "Oracle of Amun"
  ],
  "description": "Oracle of Amun visited by Alexander."
  },
  {
  "name": "Saint Catherine's Monastery",
  "lat": 28.5559,
  "lng": 33.976,
  "region": "Sinai",
  "aliases": [
  "Mount Sinai",
  "Sinai"
  ],
  "description": "6th-century Byzantine monastery and icons."
  },
  {
  "name": "Wadi Natrun",
  "lat": 30.3167,
  "lng": 30.35,
  "region": "Western Desert",
  "aliases": [
  "Wadi El Natrun",
  "Scetis"
  ],
  "description": "Early Coptic desert monasteries."
  },
  {
  "name": "Coptic Cairo",
  "lat": 30.0057,
  "lng": 31.2306,
  "region": "Cairo",
  "aliases": [
  "Old Cairo",
  "Fustat",
  "Babylon fortress",
  "Hanging Church"
  ],
  "description": "Roman fortress, churches and the first Islamic capital, Fustat."
  },
  {
  "name": "Ibn Tulun Mosque",
  "lat": 30.0287,
  "lng": 31.2495,
  "region": "Cairo",
  "aliases": [
  "Ahmad ibn Tulun"
  ],
  "description": "Oldest intact mosque in Cairo (879 CE)."
  },
  {
  "name": "Al-Azhar",
  "lat": 30.0459,
  "lng": 31.2627,
  "region": "Cairo",
  "aliases": [
  "Islamic Cairo",
  "Al-Muizz Street",
  "Khan el-Khalili"
  ],
  "description": "Fatimid mosque-university and the heart of medieval Cairo."
  },
  {
  "name": "Bab Zuweila",
  "lat": 30.0429,
  "lng": 31.2579,
  "region": "Cairo",
  "aliases": [
  "Fatimid walls",
  "Bab al-Futuh"
  ],
  "description": "Fatimid city gate."
  },
  {
  "name": "Cairo Citadel",
  "lat": 30.0299,
  "lng": 31.2611,
  "region": "Cairo",
  "aliases": [
  "Citadel",
  "Saladin Citadel",
  "Muhammad Ali Mosque"
  ],
  "description": "Saladin's fortress; Muhammad Ali's mosque."
  },
  {
  "name": "Sultan Hassan Mosque",
  "lat": 30.0322,
  "lng": 31.2565,
  "region": "Cairo",
  "aliases": [
  "Madrasa of Sultan Hassan"
  ],
  "description": "Monumental Mamluk mosque-madrasa."
  },
  {
  "name": "Downtown Cairo",
  "lat": 30.0478,
  "lng": 31.2336,
  "region": "Cairo",
  "aliases": [
  "Cairo",
  "Tahrir",
  "Egyptian Museum",
  "Khedival Cairo",
  "Ismailia"
  ],
  "description": "Khedive Ismail's Paris on the Nile; the Egyptian Museum."
  },
  {
  "name": "Grand Egyptian Museum",
  "lat": 29.9946,
  "lng": 31.1193,
  "region": "Cairo",
  "aliases": [
  "GEM"
  ],
  "description": "The new home of Tutankhamun's treasures."
  },
  {
  "name": "Port Said",
  "lat": 31.2653,
  "lng": 32.3019,
  "region": "Suez Canal",
  "aliases": [
  "Suez Canal",
  "Ismailia canal"
  ],
  "description": "Suez Canal entrance, opened 1869."
  }
  ];

const INDEX = new Map<string, Site>();
export function indexSites(list: Site[]) {
  INDEX.clear();
  for (const s of list) {
    INDEX.set(s.name.toLowerCase(), s);
    for (const a of s.aliases) if (!INDEX.has(a.toLowerCase())) INDEX.set(a.toLowerCase(), s);
  }
}
indexSites(SITES);

/** Find the site a free-text place name refers to (exact name or alias, case-insensitive). */
export function findSite(place?: string | null): Site | null {
  if (!place) return null;
  return INDEX.get(place.trim().toLowerCase()) ?? null;
}

// Aliases too generic to trust when guessing from free text.
const VAGUE = new Set(['cairo', 'citadel', 'sinai', 'memnon', 'luxor', 'thebes', 'gem', 'high dam', 'sphinx']);
let MATCHERS: { re: RegExp; site: Site; len: number }[] | null = null;

/** Guess a site from a title/description, e.g. "From Deir el-Bahari, tomb of…" → Deir el-Bahari. */
export function findSiteInText(text?: string | null): Site | null {
  if (!text) return null;
  if (!MATCHERS) {
    MATCHERS = [];
    for (const s of SITES) {
      for (const term of [s.name, ...s.aliases]) {
        if (term.length < 4 || VAGUE.has(term.toLowerCase())) continue;
        const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        MATCHERS.push({ re: new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, 'iu'), site: s, len: term.length });
      }
    }
    MATCHERS.sort((a, b) => b.len - a.len);
  }
  for (const m of MATCHERS) if (m.re.test(text)) return m.site;
  return null;
}

export const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;

/** Small static map image (no JS map needed). */
export function staticMapUrl(points: { lat: number; lng: number }[], opts: { w: number; h: number; zoom?: number; dark?: boolean }): string | null {
  if (!MAPBOX_TOKEN || !points.length) return null;
  const style = opts.dark ? 'mapbox/dark-v11' : 'mapbox/outdoors-v12';
  const pins = points.slice(0, 60).map((p) => `pin-s+c8952f(${p.lng.toFixed(3)},${p.lat.toFixed(3)})`).join(',');
  const view = points.length === 1 && opts.zoom ? `${points[0].lng},${points[0].lat},${opts.zoom},0` : 'auto';
  return `https://api.mapbox.com/styles/v1/${style}/static/${pins}/${view}/${opts.w}x${opts.h}@2x?padding=30&access_token=${MAPBOX_TOKEN}`;
}
