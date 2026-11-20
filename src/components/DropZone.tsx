import { useCallback, useEffect, useRef, useState } from 'react';
import type { Draft } from '../lib/types';
import { saveDrafts } from '../lib/data';
import { guessCategory } from '../lib/taxonomy';
import { LinkImporter } from './LinkImporter';

const IMG_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|tiff?|heic)(\?|#|$)/i;

function fileDrafts(files: File[]): Draft[] {
  return files
    .filter((f) => f.type.startsWith('image/') || /\.(heic|heif|tif|tiff)$/i.test(f.name))
    .map((f, i) => ({
      key: `${f.name}-${f.size}-${i}-${Date.now()}`,
      kind: 'image' as const,
      title: (f.name || 'Pasted image').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/^image$/i, 'Pasted image'),
      previewUrl: URL.createObjectURL(f),
      file: f,
      sourceName: 'Upload',
      license: 'Own image / unknown',
      categoryGuess: guessCategory(f.name),
    }));
}

function urlDraft(url: string, title?: string): Draft {
  let host = 'Web';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {}
  return {
    key: url,
    kind: 'image',
    title: title || decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Image').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120),
    previewUrl: url,
    remoteUrl: url,
    thumbUrl: url,
    pageUrl: url,
    sourceName: host,
    license: 'Unknown — check source before reuse',
  };
}

/** Pull image URLs out of dropped/pasted HTML (e.g. an image dragged from another tab). */
function urlsFromHtml(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('img')].map((i) => i.getAttribute('src') || '').filter((u) => /^https?:/.test(u));
}

/**
 * Drag & drop / paste target. Files, images dragged from other tabs and
 * pasted images are saved straight onto `boardId`. A pasted page link opens
 * a picker for the images on that page.
 */
export function DropZone({ boardId, label, onSaved, ensureBoard }: {
  boardId?: string | null;
  label?: string;
  onSaved?: () => void;
  /** Called to get (or create) a board when none is set, e.g. a folder's "Unsorted". */
  ensureBoard?: () => Promise<string>;
}) {
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const busy = useRef(false);

  const save = useCallback(
    async (drafts: Draft[]) => {
      if (!drafts.length || busy.current) return;
      busy.current = true;
      try {
        const target = boardId ?? (ensureBoard ? await ensureBoard() : null);
        if (!target) throw new Error('No board to add to.');
        setStatus(`Saving ${drafts.length}…`);
        const { saved, warnings } = await saveDrafts(
          drafts,
          { eraId: null, category: undefined, site: '', subjects: [], tags: [], notes: '', boardId: target, angle: null },
          (done, total) => setStatus(`Saving ${Math.min(done + 1, total)} of ${total}…`),
        );
        setStatus(saved.length ? `✓ Added ${saved.length}${warnings.length ? ` · ${warnings.length} skipped` : ''}` : warnings[0] ?? 'Nothing saved');
        onSaved?.();
      } catch (e) {
        setStatus((e as Error).message);
      } finally {
        busy.current = false;
        setTimeout(() => setStatus(null), 3500);
      }
    },
    [boardId, ensureBoard, onSaved],
  );

  const handleData = useCallback(
    (dt: DataTransfer) => {
      const files = fileDrafts([...dt.files]);
      if (files.length) return save(files);
      const html = dt.getData('text/html');
      const fromHtml = html ? urlsFromHtml(html) : [];
      if (fromHtml.length) return save(fromHtml.slice(0, 20).map((u) => urlDraft(u)));
      const text = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim();
      const url = text.split(/\s+/).find((t) => /^https?:\/\//.test(t));
      if (!url) return;
      if (IMG_EXT.test(url)) return save([urlDraft(url)]);
      setPageUrl(url); // a page: let the person pick which images
    },
    [save],
  );

  // Ctrl/Cmd+V anywhere on the page (unless typing in a field).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!e.clipboardData) return;
      e.preventDefault();
      handleData(e.clipboardData);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleData]);

  return (
    <>
      <label
        className={`dropzone slim ${over ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handleData(e.dataTransfer);
        }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            save(fileDrafts([...(e.target.files || [])]));
            e.target.value = '';
          }}
        />
        <span className="big">⤓</span>
        <span>
          <b>{status ?? label ?? 'Drop images here'}</b>
          <br />
          <span className="muted small">Drag files or images from other tabs · paste with Ctrl/⌘+V · or tap to choose</span>
        </span>
      </label>
      {pageUrl && (
        <div className="modal-backdrop" onClick={() => setPageUrl(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Pick images from that page</h2><button className="ghost small" onClick={() => setPageUrl(null)}>✕</button></div>
            <LinkImporter
              initialUrl={pageUrl}
              onPick={(drafts) => {
                setPageUrl(null);
                save(drafts.map((d) => ({ ...d, categoryGuess: d.categoryGuess ?? guessCategory(d.title) })));
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
