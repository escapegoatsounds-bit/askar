import type { Kind } from './taxonomy';

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  description: string | null;
  source_name: string | null;
  source_url: string | null;
  media_url: string | null;
  thumb_url: string | null;
  thumb_path: string | null;
  storage_path: string | null;
  external_id: string | null;
  license: string | null;
  credit: string | null;
  era_id: string | null;
  date_text: string | null;
  year_start: number | null;
  year_end: number | null;
  category: string | null;
  site: string | null;
  subjects: string[];
  tags: string[];
  notes: string | null;
  created_by_email: string | null;
  created_at: string;
  /** Videos: 'official' (confirmed institution channel), 'pending' (awaiting fact-check), 'verified', 'partly', 'unverified'. */
  verification?: Verification | null;
  verification_note?: string | null;
  verified_sources?: { title?: string; url: string }[] | null;
}

export type Verification = 'official' | 'pending' | 'verified' | 'partly' | 'unverified';

export interface Board {
  id: string;
  title: string;
  description: string | null;
  kind: 'mood' | 'reconstruction';
  era_id: string | null;
  subject: string | null;
  cover_item: string | null;
  created_at: string;
  project_id?: string | null;
  folder_id?: string | null;
  position?: number;
}

export interface BoardItem {
  board_id: string;
  item_id: string;
  angle: string | null;
  position: number;
  note?: string | null;
  added_by_email?: string | null;
  items: Item;
}

export interface Member {
  email: string;
  role: 'owner' | 'editor';
  invited_by: string | null;
  created_at: string;
}

/** A thing about to be saved (from search, upload, link or share). */
export interface Draft {
  key: string;
  kind: Kind;
  title: string;
  previewUrl: string | null; // what to show in the dialog
  file?: File; // own upload
  remoteUrl?: string | null; // full-size remote image
  thumbUrl?: string | null; // remote thumbnail
  pageUrl?: string | null;
  sourceName?: string | null;
  externalId?: string | null;
  license?: string | null;
  credit?: string | null;
  dateText?: string | null;
  yearStart?: number | null;
  yearEnd?: number | null;
  description?: string | null;
  eraGuess?: string | null;
  categoryGuess?: string | null;
  siteGuess?: string | null;
  verification?: Verification | null;
  officialSite?: string | null;
}

export interface SearchResult {
  source: string;
  externalId: string;
  kind: Kind;
  title: string;
  thumbUrl: string | null;
  mediaUrl: string | null;
  pageUrl: string | null;
  license: string | null;
  credit: string | null;
  dateText: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  eraGuess: string | null;
  categoryGuess: string | null;
  siteGuess: string | null;
  description: string | null;
  official?: { name: string; site: string } | null;
  verification?: Verification | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  desk_sync?: boolean;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  position: number;
}

export interface ProjectMember {
  project_id: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  invited_by: string | null;
  created_at: string;
}

export type BoardWithMeta = Board & { count: number; project_id: string | null; folder_id: string | null; position: number };

export interface SourceRef { title?: string; url: string }
export interface Fact { text: string; source_url?: string | null }
export interface Ruler { name: string; title?: string | null; period?: string | null; certainty?: 'attested' | 'likely' | 'legendary' | 'unknown' | null; note?: string | null; source_url?: string | null }
export interface Deity { name: string; role?: string | null; note?: string | null; source_url?: string | null }

export interface Place {
  id: number;
  name: string;
  lat: number;
  lng: number;
  region: string | null;
  aliases: string[];
  description: string | null;
  eras: string[];
  priority: number;
  coords_verified: boolean;
  wikipedia_title: string | null;
  summary: string | null;
  culture: string | null;
  dates_text: string | null;
  facts: Fact[];
  rulers: Ruler[];
  deities: Deity[];
  beliefs: string | null;
  sources: SourceRef[];
  research_status: 'todo' | 'in_progress' | 'done' | 'needs_review';
  research_notes: string | null;
  researched_at: string | null;
  research_requested_at: string | null;
}
