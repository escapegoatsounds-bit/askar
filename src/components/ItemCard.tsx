import { Link } from 'react-router-dom';
import type { Item } from '../lib/types';
import { useThumb } from '../lib/media';
import { ERA_BY_ID } from '../lib/eras';
import { CATEGORY_BY_ID, ANGLE_BY_ID } from '../lib/taxonomy';

const KIND_BADGE: Record<string, string> = { video: '▶ Video', model3d: '🧊 3D', document: '📄 Doc' };

export function ItemCard({ item, angle, selected, onSelect, actions }: {
  item: Item;
  angle?: string | null;
  selected?: boolean;
  onSelect?: (item: Item) => void;
  actions?: React.ReactNode;
}) {
  const thumb = useThumb(item);
  const era = item.era_id ? ERA_BY_ID[item.era_id] : null;
  const cat = item.category ? CATEGORY_BY_ID[item.category] : null;
  const body = (
    <>
      <div className="thumb">
        {thumb ? <img src={thumb} alt={item.title} loading="lazy" referrerPolicy="no-referrer" /> : <div className="thumb-missing">No preview</div>}
        {KIND_BADGE[item.kind] && <span className="badge kind">{KIND_BADGE[item.kind]}</span>}
        {angle && <span className="badge angle">{ANGLE_BY_ID[angle] ?? angle}</span>}
        {onSelect && <span className={`check ${selected ? 'on' : ''}`}>{selected ? '✓' : ''}</span>}
      </div>
      <div className="meta">
        <div className="title" title={item.title}>{cat ? `${cat.icon} ` : ''}{item.title}</div>
        <div className="sub">
          {era && <span className="era-dot" style={{ background: `hsl(${era.hue} 55% 50%)` }} />}
          {era?.short ?? 'Undated'}
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
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );
}

export function ItemGrid({ children }: { children: React.ReactNode }) {
  return <div className="masonry">{children}</div>;
}
