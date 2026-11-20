import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Draft } from '../lib/types';
import { SaveDialog } from '../components/SaveDialog';
import { LinkImporter } from '../components/LinkImporter';

export function filesToDrafts(files: File[]): Draft[] {
  return files
    .filter((f) => f.type.startsWith('image/') || /\.(heic|heif|tif|tiff)$/i.test(f.name))
    .map((f, i) => ({
      key: `${f.name}-${f.size}-${i}`,
      kind: 'image' as const,
      title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
      previewUrl: URL.createObjectURL(f),
      file: f,
      sourceName: 'Upload',
      license: 'Own photo / unknown',
    }));
}

export default function AddPage() {
  const [tab, setTab] = useState<'upload' | 'link'>('upload');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [drag, setDrag] = useState(false);
  const nav = useNavigate();

  return (
    <div className="page narrow-page">
      <section className="hero compact">
        <h1 className="display">Add to the archive</h1>
        <p className="muted">Upload from your phone or computer, or paste a link to a page, an image or a video.</p>
      </section>

      <div className="tabs">
        <button className={tab === 'upload' ? 'on' : ''} onClick={() => setTab('upload')}>📷 Upload</button>
        <button className={tab === 'link' ? 'on' : ''} onClick={() => setTab('link')}>🔗 From a link</button>
      </div>

      {tab === 'upload' ? (
        <label
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const d = filesToDrafts([...e.dataTransfer.files]);
            if (d.length) setDrafts(d);
          }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const d = filesToDrafts([...(e.target.files || [])]);
              if (d.length) setDrafts(d);
              e.target.value = '';
            }}
          />
          <span className="big">⬆</span>
          <b>Tap to choose photos</b>
          <span className="muted small">or drag them here on a computer. Originals are stored in full, so your own photos are kept at full quality.</span>
        </label>
      ) : (
        <LinkImporter onPick={setDrafts} />
      )}

      <div className="tip">
        <b>On Android:</b> install this app (browser menu → <i>Install app</i> / <i>Add to Home screen</i>). Then “Askar” appears in the <i>Share</i> menu of Gallery, Chrome and other apps.
      </div>

      {drafts && (
        <SaveDialog
          drafts={drafts}
          onClose={() => setDrafts(null)}
          onSaved={(items) => { if (items.length === 1) nav(`/item/${items[0].id}`); }}
        />
      )}
    </div>
  );
}
