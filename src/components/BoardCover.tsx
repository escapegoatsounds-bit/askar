import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useThumb } from '../lib/media';
import type { Item } from '../lib/types';

function Tile({ item }: { item: Item }) {
  const url = useThumb(item);
  return url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div />;
}

/** 2x2 collage of the newest items on a board. */
export function BoardCover({ boardId }: { boardId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    supabase
      .from('board_items')
      .select('items(id, thumb_path, thumb_url, media_url)')
      .eq('board_id', boardId)
      .order('added_at', { ascending: false })
      .limit(4)
      .then(({ data }) => setItems(((data || []) as any[]).map((r) => r.items).filter(Boolean)));
  }, [boardId]);
  return (
    <div className="cover">
      {items.length ? items.map((it) => <Tile key={it.id} item={it} />) : <div className="cover-empty">Empty board</div>}
    </div>
  );
}
