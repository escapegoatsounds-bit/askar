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
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  kind: 'mood' | 'reconstruction';
  era_id: string | null;
  subject: string | null;
  cover_item: string | null;
  created_at: string;
}

export interface BoardItem {
  board_id: string;
  item_id: string;
  angle: string | null;
  position: number;
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
}
