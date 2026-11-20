// Categories, kinds and reconstruction angles. Shared with the API.

export const CATEGORIES = [
  { id: 'architecture', label: 'Architecture & landmarks', icon: '🏛️' },
  { id: 'statue', label: 'Statues & sculpture', icon: '🗿' },
  { id: 'relief', label: 'Reliefs & wall paintings', icon: '🖼️' },
  { id: 'mummy', label: 'Mummies & remains', icon: '⚱️' },
  { id: 'coffin', label: 'Coffins & sarcophagi', icon: '⚰️' },
  { id: 'pottery', label: 'Pottery & vessels', icon: '🏺' },
  { id: 'papyrus', label: 'Papyrus & manuscripts', icon: '📜' },
  { id: 'inscription', label: 'Inscriptions & stelae', icon: '✍️' },
  { id: 'jewelry', label: 'Jewelry & adornment', icon: '💍' },
  { id: 'tools', label: 'Tools, weapons & daily life', icon: '🪓' },
  { id: 'textile', label: 'Textiles & clothing', icon: '🧵' },
  { id: 'coin', label: 'Coins & seals', icon: '🪙' },
  { id: 'map', label: 'Maps, plans & drawings', icon: '🗺️' },
  { id: 'photograph', label: 'Historic photographs', icon: '📷' },
  { id: 'newspaper', label: 'Newspapers & print', icon: '📰' },
  { id: 'video', label: 'Film & video', icon: '🎞️' },
  { id: 'model3d', label: '3D scans & models', icon: '🧊' },
  { id: 'other', label: 'Other', icon: '✳️' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const CATEGORY_BY_ID: Record<string, (typeof CATEGORIES)[number]> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/** Rough category guess from a title / object type / medium string. */
export function guessCategory(text: string): CategoryId | null {
  const t = text.toLowerCase();
  const rules: [RegExp, CategoryId][] = [
    [/\bmumm(y|ies|ified)|cartonnage|canopic|skull|ct scan|funerary mask|mask of/, 'mummy'],
    [/coffin|sarcophag/, 'coffin'],
    [/papyrus|manuscript|book of the dead|ostracon|ostraca|scroll/, 'papyrus'],
    [/stela|stele|inscri|hieroglyph|cartouche/, 'inscription'],
    [/statue|statuette|bust|head of|sphinx|figure|shabti|ushabti|sculpt/, 'statue'],
    [/relief|painting|fresco|wall|mural/, 'relief'],
    [/\bjar\b|vase|bowl|pottery|ceramic|vessel|amphora|faience cup|dish/, 'pottery'],
    [/necklace|amulet|scarab|ring|earring|bracelet|pectoral|jewel|bead/, 'jewelry'],
    [/coin|seal|tetradrachm|drachm|dinar/, 'coin'],
    [/textile|linen|tunic|tapestry|garment/, 'textile'],
    [/map|plan|elevation|drawing|engraving|description de l/, 'map'],
    [/newspaper|gazette|journal|herald|times|chronicle/, 'newspaper'],
    [/temple|pyramid|tomb|mosque|church|monastery|citadel|obelisk|gate|fortress|palace|ruins|colossi|hypostyle|colonnade|pylon|columns?\b|courtyard|necropolis/, 'architecture'],
    [/photograph|albumen|gelatin silver|lantern slide|stereograph|glass negative/, 'photograph'],
    [/axe|dagger|knife|tool|weapon|sickle|game|board|sandal|comb|mirror/, 'tools'],
  ];
  for (const [re, id] of rules) if (re.test(t)) return id;
  return null;
}

export const KINDS = ['image', 'video', 'document', 'model3d'] as const;
export type Kind = (typeof KINDS)[number];

/** Angles a reconstruction needs. Reconstruction boards show coverage of these. */
export const ANGLES = [
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left-profile', label: 'Left profile' },
  { id: 'right-profile', label: 'Right profile' },
  { id: 'three-quarter-left', label: '¾ left' },
  { id: 'three-quarter-right', label: '¾ right' },
  { id: 'top', label: 'Top / plan' },
  { id: 'detail', label: 'Close-up detail' },
  { id: 'scale', label: 'Scale reference' },
  { id: 'scan', label: 'CT scan / X-ray / 3D' },
  { id: 'colour', label: 'Original colour evidence' },
  { id: 'context', label: 'In situ / context' },
] as const;
export const ANGLE_BY_ID: Record<string, string> = Object.fromEntries(ANGLES.map((a) => [a.id, a.label]));
