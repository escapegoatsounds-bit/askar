import { useEffect, useMemo, useState } from 'react';
import type { Board, Draft, Item } from '../lib/types';
import { allSites, allSubjects, createBoard, listBoards, saveDrafts } from '../lib/data';
import { ERA_BY_ID } from '../lib/eras';
import { CATEGORY_BY_ID } from '../lib/taxonomy';
import { ChipsInput } from './ChipsInput';
import { SITES } from '../lib/sites';
import { AngleSelect, CategorySelect, EraSelect } from './Selects';

/**
 * One dialog for every way of adding things: search results, uploads,
 * links and shares. Applies the same era/category/site/subjects/board to all.
 */
export function SaveDialog({ drafts, onClose, onSaved, defaultEra, defaultBoard }: {
  drafts: Draft[];
  onClose: () => void;
  onSaved: (items: Item[]) => void;
  defaultEra?: string | null;
  defaultBoard?: string | null;
}) {
  const hasGuesses = drafts.some((d) => d.eraGuess);
  const hasCatGuesses = drafts.some((d) => d.categoryGuess);
  const [era, setEra] = useState<string>(defaultEra ?? (hasGuesses ? 'auto' : ''));
  const [category, setCategory] = useState<string>(hasCatGuesses ? 'auto' : '');
  const [site, setSite] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [titles, setTitles] = useState<Record<string, string>>(() => Object.fromEntries(drafts.map((d) => [d.key, d.title])));
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState<string>(defaultBoard ?? '');
  const [newBoard, setNewBoard] = useState('');
  const [angle, setAngle] = useState('');
  const [subjectSugg, setSubjectSugg] = useState<string[]>([]);
  const [siteSugg, setSiteSugg] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; note?: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBoards().then(setBoards).catch(() => {});
    allSubjects().then(setSubjectSugg).catch(() => {});
    allSites()
      .then((used) => setSiteSugg([...new Set([...SITES.map((x) => x.name), ...used])].sort((a, b) => a.localeCompare(b))))
      .catch(() => setSiteSugg(SITES.map((x) => x.name)));
  }, []);

  const board = boards.find((b) => b.id === boardId);
  const eraSummary = useMemo(() => {
    const ids = [...new Set(drafts.map((d) => d.eraGuess).filter(Boolean))] as string[];
    return ids.map((id) => ERA_BY_ID[id]?.short).filter(Boolean).join(', ');
  }, [drafts]);
  const siteSummary = useMemo(() => [...new Set(drafts.map((d) => d.siteGuess).filter(Boolean))].join(', '), [drafts]);
  const catSummary = useMemo(() => {
    const ids = [...new Set(drafts.map((d) => d.categoryGuess).filter(Boolean))] as string[];
    return ids.map((id) => CATEGORY_BY_ID[id]?.label).filter(Boolean).join(', ');
  }, [drafts]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let targetBoard: string | null = boardId || null;
      if (boardId === '__new' && newBoard.trim()) {
        const b = await createBoard({ title: newBoard.trim(), kind: 'mood', era_id: era && era !== 'auto' ? era : null });
        targetBoard = b.id;
      } else if (boardId === '__new') targetBoard = null;
      const named = drafts.map((d) => ({ ...d, title: titles[d.key]?.trim() || d.title }));
      const { saved, warnings } = await saveDrafts(
        named,
        {
          eraId: era === 'auto' ? undefined : era || null,
          category: category === 'auto' ? undefined : category || null,
          site,
          subjects,
          tags,
          notes,
          boardId: targetBoard,
          angle: angle || null,
        },
        (done, total, note) => setProgress({ done, total, note }),
      );
      setWarnings(warnings);
      if (saved.length) onSaved(saved);
      if (!warnings.length) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Save {drafts.length === 1 ? 'this find' : `${drafts.length} finds`}</h2>
          <button className="ghost small" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        </div>

        <div className="draft-strip">
          {drafts.map((d) => (
            <div className="draft" key={d.key}>
              {d.previewUrl ? <img src={d.previewUrl} alt="" referrerPolicy="no-referrer" /> : <div className="thumb-missing">—</div>}
              <input value={titles[d.key] ?? ''} onChange={(e) => setTitles({ ...titles, [d.key]: e.target.value })} aria-label="Title" />
              {d.license && <small className="muted">{d.license}</small>}
            </div>
          ))}
        </div>

        <div className="form-grid">
          <label>
            Era
            <EraSelect value={era} onChange={setEra} autoLabel={hasGuesses ? `Auto from dates (${eraSummary || '—'})` : undefined} />
          </label>
          <label>
            Category
            <CategorySelect value={category} onChange={setCategory} autoLabel={hasCatGuesses ? `Auto (${catSummary || '—'})` : undefined} />
          </label>
          <label>
            Site / place
            <input list="site-sugg" value={site} onChange={(e) => setSite(e.target.value)} placeholder={siteSummary ? `Auto: ${siteSummary}` : 'Giza, Karnak, Amarna…'} />
            <datalist id="site-sugg">{siteSugg.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label>
            Subjects (people, monuments)
            <ChipsInput id="subjects" value={subjects} onChange={setSubjects} suggestions={subjectSugg} placeholder="Ramesses II, Great Pyramid…" />
          </label>
          <label>
            Tags
            <ChipsInput value={tags} onChange={setTags} placeholder="color, profile, limestone…" />
          </label>
          <label>
            Add to board
            <select value={boardId} onChange={(e) => setBoardId(e.target.value)}>
              <option value="">— none —</option>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.kind === 'reconstruction' ? '🧩 ' : ''}{b.title}</option>)}
              <option value="__new">＋ New mood board…</option>
            </select>
          </label>
          {boardId === '__new' && (
            <label>
              New board name
              <input value={newBoard} onChange={(e) => setNewBoard(e.target.value)} placeholder="New Kingdom — Karnak colors" />
            </label>
          )}
          {board?.kind === 'reconstruction' && (
            <label>
              Angle / view
              <AngleSelect value={angle} onChange={setAngle} />
            </label>
          )}
          <label className="span-2">
            Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this matters, what to compare it with…" />
          </label>
        </div>

        {progress && busy && (
          <div className="progress">
            <div style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            <span>Saving {Math.min(progress.done + 1, progress.total)} of {progress.total}…</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="warn">
            <b>Heads up:</b>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
        {error && <p className="error">{error}</p>}

        <div className="modal-foot">
          <button className="ghost" onClick={onClose} disabled={busy}>{warnings.length ? 'Done' : 'Cancel'}</button>
          {!warnings.length && <button onClick={save} disabled={busy}>{busy ? 'Saving…' : `Save ${drafts.length > 1 ? drafts.length : ''}`}</button>}
        </div>
      </div>
    </div>
  );
}
