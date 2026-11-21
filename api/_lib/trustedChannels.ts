/**
 * Official YouTube channels whose videos get the "Official" badge in Askar.
 *
 * A handle alone proves nothing (anyone can register a look-alike), so a channel
 * only counts as official when BOTH are true:
 *   1. the handle below resolves to a channel, and
 *   2. that channel's own description or custom URL mentions the institution's
 *      official web domain listed here.
 * If either check fails the channel is ignored and its videos are treated like any
 * other video (fact-checked before they can reach the Desk).
 *
 * To add a channel: add its @handle, the institution's name and its official domain.
 */
export interface TrustedChannel {
  handle: string;
  name: string;
  site: string; // official domain, e.g. "britishmuseum.org"
}

export const TRUSTED_CHANNELS: TrustedChannel[] = [
  { handle: '@britishmuseum', name: 'British Museum', site: 'britishmuseum.org' },
  { handle: '@metmuseum', name: 'The Metropolitan Museum of Art', site: 'metmuseum.org' },
  { handle: '@smithsonian', name: 'Smithsonian Institution', site: 'si.edu' },
  { handle: '@PennMuseum', name: 'Penn Museum', site: 'penn.museum' },
  { handle: '@ISACChicago', name: 'Institute for the Study of Ancient Cultures (Univ. of Chicago)', site: 'uchicago.edu' },
  { handle: '@BrooklynMuseum', name: 'Brooklyn Museum', site: 'brooklynmuseum.org' },
  { handle: '@mfaboston', name: 'Museum of Fine Arts, Boston', site: 'mfa.org' },
  { handle: '@AshmoleanMuseum', name: 'Ashmolean Museum (Oxford)', site: 'ashmolean.org' },
  { handle: '@FitzwilliamMuseum', name: 'Fitzwilliam Museum (Cambridge)', site: 'fitzmuseum.cam.ac.uk' },
  { handle: '@MuseoEgizio', name: 'Museo Egizio, Turin', site: 'museoegizio.it' },
  { handle: '@museedulouvre', name: 'Musée du Louvre', site: 'louvre.fr' },
  { handle: '@ARCEgypt', name: 'American Research Center in Egypt', site: 'arce.org' },
  { handle: '@EgyptExplorationSociety', name: 'Egypt Exploration Society', site: 'ees.ac.uk' },
  { handle: '@EgyptianMinistryofTourismandAntiquities', name: 'Egypt Ministry of Tourism and Antiquities', site: 'egymonuments.gov.eg' },
  { handle: '@AERAGiza', name: 'Ancient Egypt Research Associates', site: 'aeraweb.org' },
  { handle: '@OxfordUniversity', name: 'University of Oxford', site: 'ox.ac.uk' },
  { handle: '@cambridgeuniversity', name: 'University of Cambridge', site: 'cam.ac.uk' },
  { handle: '@UCL', name: 'University College London', site: 'ucl.ac.uk' },
];

export interface OfficialChannel {
  channelId: string;
  name: string;
  site: string;
}

let cache: { at: number; byId: Map<string, OfficialChannel> } | null = null;
const TTL = 12 * 60 * 60 * 1000;

/** Resolve handles to channel ids (1 quota unit each), keeping only channels that link their official domain. */
export async function officialChannels(key: string, getJson: (u: string) => Promise<any>): Promise<Map<string, OfficialChannel>> {
  if (cache && Date.now() - cache.at < TTL) return cache.byId;
  const byId = new Map<string, OfficialChannel>();
  await Promise.all(
    TRUSTED_CHANNELS.map(async (t) => {
      try {
        const p = new URLSearchParams({ part: 'snippet', forHandle: t.handle, key });
        const d = await getJson(`https://www.googleapis.com/youtube/v3/channels?${p}`);
        const ch = d.items?.[0];
        if (!ch?.id) return;
        const text = `${ch.snippet?.description || ''} ${ch.snippet?.customUrl || ''}`.toLowerCase();
        if (!text.includes(t.site.toLowerCase())) return; // can't confirm it's really theirs
        byId.set(ch.id, { channelId: ch.id, name: t.name, site: t.site });
      } catch {
        /* skip this channel this round */
      }
    }),
  );
  cache = { at: Date.now(), byId };
  return byId;
}
