import { useState } from 'react';

/** Type and press Enter (or comma) to add a chip. */
export function ChipsInput({ value, onChange, placeholder, suggestions = [], id }: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  id?: string;
}) {
  const [text, setText] = useState('');
  const listId = id ? `${id}-list` : undefined;
  function add(raw: string) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setText('');
  }
  return (
    <div className="chips-input">
      {value.map((v) => (
        <span className="chip" key={v}>
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button>
        </span>
      ))}
      <input
        id={id}
        list={listId}
        value={text}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) add(e.target.value);
          else setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(text)}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}
