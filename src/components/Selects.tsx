import { ERAS, formatRange } from '../lib/eras';
import { CATEGORIES, ANGLES, HISTORY_CATEGORY_IDS } from '../lib/taxonomy';

export function EraSelect({ value, onChange, autoLabel }: { value: string; onChange: (v: string) => void; autoLabel?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {autoLabel && <option value="auto">{autoLabel}</option>}
      <option value="">Undated / unknown</option>
      {ERAS.map((e) => (
        <option key={e.id} value={e.id}>{e.short} ({formatRange(e)})</option>
      ))}
    </select>
  );
}

export function CategorySelect({ value, onChange, autoLabel, allLabel }: { value: string; onChange: (v: string) => void; autoLabel?: string; allLabel?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {autoLabel && <option value="auto">{autoLabel}</option>}
      {allLabel && <option value="">{allLabel}</option>}
      {!allLabel && <option value="">—</option>}
      <optgroup label="Visual references">
        {CATEGORIES.filter((c) => !HISTORY_CATEGORY_IDS.has(c.id)).map((c) => (
          <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
        ))}
      </optgroup>
      <optgroup label="History & archaeology">
        {CATEGORIES.filter((c) => HISTORY_CATEGORY_IDS.has(c.id)).map((c) => (
          <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
        ))}
      </optgroup>
    </select>
  );
}

export function AngleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No specific angle</option>
      {ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
    </select>
  );
}
