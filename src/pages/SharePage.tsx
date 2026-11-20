import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Draft } from '../lib/types';
import { SaveDialog } from '../components/SaveDialog';
import { LinkImporter } from '../components/LinkImporter';
import { filesToDrafts } from './AddPage';

const INBOX = 'askar-share-inbox';

interface Meta { title: string; text: string; url: string; files: { key: string; name: string; type: string }[] }

/** Receives things shared from other Android apps (see public/sw.js). */
export default function SharePage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      if (!('caches' in window)) return setEmpty(true);
      const cache = await caches.open(INBOX);
      const m = await cache.match('/share-inbox/meta.json');
      if (!m) return setEmpty(true);
      const data: Meta = await m.json();
      const files: File[] = [];
      for (const f of data.files) {
        const r = await cache.match(f.key);
        if (r) files.push(new File([await r.blob()], f.name, { type: f.type }));
      }
      for (const k of await cache.keys()) await cache.delete(k);
      setMeta(data);
      if (files.length) {
        const d = filesToDrafts(files);
        if (data.title) d.forEach((x) => (x.title = data.title));
        setDrafts(d);
      } else {
        const found = (data.url || data.text || '').match(/https?:\/\/\S+/)?.[0] ?? null;
        if (found) setLink(found);
        else setEmpty(true);
      }
    })().catch(() => setEmpty(true));
  }, []);

  return (
    <div className="page narrow-page">
      <section className="hero compact"><h1 className="display">Shared to Askar</h1></section>
      {empty && <p className="empty">Nothing was received. Try sharing again, or <Link to="/add">add something manually</Link>.</p>}
      {meta && drafts === null && link && <LinkImporter initialUrl={link} onPick={setDrafts} />}
      {drafts && <SaveDialog drafts={drafts} onClose={() => nav('/')} onSaved={() => {}} />}
    </div>
  );
}
