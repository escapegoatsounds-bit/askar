import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useThumb } from '../lib/media';
import type { Item } from '../lib/types';

function Tile({ item }: { item: Item }) {
  const url = useThumb(item);
  return url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div />;
}

/** Collage of the newest pins across a project's boards. */
export function ProjectCover({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    supabase
      .from('board_items')
      .select('items(id, thumb_path, thumb_url, media_url), boards!inner(project_id)')
      .eq('boards.project_id', projectId)
      .order('added_at', { ascending: false })
      .limit(4)
      .then(({ data }) => setItems(((data || []) as any[]).map((r) => r.items).filter(Boolean)));
  }, [projectId]);
  return (
    <div className="cover">
      {items.length ? items.map((it) => <Tile key={it.id} item={it} />) : <div className="cover-empty">No pins yet</div>}
    </div>
  );
}
