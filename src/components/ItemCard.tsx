import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item } from '../lib/types';
import { useThumb } from '../lib/media';
import { ERA_BY_ID } from '../lib/eras';
import { CATEGORY_BY_ID, ANGLE_BY_ID } from '../lib/taxonomy';
import { PinButton } from './PinButton';

const KIND_BADGE: Record<string, string> = { video: '▶ Video', model3d: '🧊 3D', document: '📄 Doc' };

export function ItemCard({ item, angle, selected, onSelect, actions, note, pin = true, by }: {
  item: Item;
  angle?: string | null;
  selected?: boolean;
  onSelect?: (item: Item) => void;
  actions?: React.ReactNode;
  note?: string | null;
  pin?: boolean;
  by?: string | null;
}) {
  const thumb = useThumb(item);
  const [broken, setBroken] = useState(false);
  const era = item.era_id ? ERA_BY_ID[item.era_id] : null;
  const cat = item.category ? CATEGORY_BY_ID[item.category] : null;
  const body = (
    <>
      <div className="thumb">
        {thumb && !broken ? <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <div className="thumb-missing">No preview</div>}
        {KIND_BADGE[item.kind] && <span className="badge kind">{KIND_BADGE[item.kind]}</span>}
        {angle && <span className="badge angle">{ANGLE_BY_ID[angle] ?? angle}</span>}
        {onSelect && <span className={`check ${selected ? 'on' : ''}`}>{selected ? '✓' : ''}</span>}
      </div>
      <div className="meta">
        <div className="title" title={item.title}>{cat ? `${cat.icon} ` : ''}{item.title}</div>
        <div className="sub">
          {era && <span className="era-dot" style={{ background: `hsl(${era.hue} 55% 50%)` }} />}
          {era ? era.short : cat ? cat.label : item.source_name ?? ''}
          {item.site ? ` · ${item.site}` : ''}
        </div>
      </div>
    </>
  );
  return (
    <div className={`item-card ${selected ? 'selected' : ''}`}>
      {onSelect ? (
        <button type="button" className="card-hit" onClick={() => onSelect(item)}>{body}</button>
      ) : (
        <Link to={`/item/${item.id}`} className="card-hit">{body}</Link>
      )}
      {pin && !onSelect && <div className="card-pin"><PinButton itemIds={[item.id]} /></div>}
      {note && <div className="pin-note">{note}</div>}
      {by && <div className="pin-by" title={`Added by ${by}`}>{by.slice(0, 1).toUpperCase()}</div>}
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );
}

export function ItemGrid({ children }: { children: React.ReactNode }) {
  return <div className="masonry">{children}</div>;
}
