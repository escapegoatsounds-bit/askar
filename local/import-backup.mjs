/**
 * Import the Land of Rebirth backup into the local data folder.
 *
 *   node local/import-backup.mjs "C:\path\LandOfRebirth-backup-2026-11-26.zip"   (or the unzipped folder)
 *   add --force to replace tables that already have rows (a dated copy is kept first)
 *
 * What it does:
 *   askar/askar-database.json  -> <data>/db/<table>.json
 *   askar/(media|storage)/...  -> <data>/media/...     (if the backup contains Askar files)
 *   desk/database, desk/uploaded-files, desk/page, names.json -> <data>/desk/... (kept as-is for the Desk merge)
 */
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { DATA_DIR, MEDIA_DIR, TABLES, table, replaceTable, flush } from './store.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const src = args.find((a) => !a.startsWith('--'));
if (!src || !fs.existsSync(src)) {
  console.error('Usage: node local/import-backup.mjs <backup.zip | unzipped folder> [--force]');
  process.exit(1);
}

/** Uniform file access for a zip or a folder: list() -> relative paths, read(p) -> Buffer. */
async function open(p) {
  if (fs.statSync(p).isDirectory()) {
    const files = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else files.push(path.relative(p, full).replace(/\\/g, '/'));
      }
    };
    walk(p);
    return { list: () => files, read: async (f) => fs.readFileSync(path.join(p, f)) };
  }
  const zip = await JSZip.loadAsync(fs.readFileSync(p));
  const files = Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name);
  return { list: () => files, read: async (f) => zip.file(f).async('nodebuffer') };
}

const src_ = await open(src);
let files = src_.list();
// Tolerate a single wrapping folder inside the zip.
const top = new Set(files.map((f) => f.split('/')[0]));
let prefix = '';
if (top.size === 1 && !files.includes('README.txt') && files.some((f) => f.split('/').length > 2)) prefix = [...top][0] + '/';
const rel = (f) => f.slice(prefix.length);
const find = (r) => files.find((f) => rel(f) === r);

console.log(`Data folder: ${DATA_DIR}`);
console.log(`Reading:     ${src}  (${files.length} files)`);

// -------------------------------------------------------------- database
const dbFile = find('askar/askar-database.json');
if (!dbFile) {
  console.warn('! askar/askar-database.json not found in the backup; skipping Askar tables.');
} else {
  const raw = JSON.parse((await src_.read(dbFile)).toString('utf8'));
  // Accept {table: rows[]}, {tables: {table: rows[]}} or [{table, rows}]
  let tables = raw.tables && typeof raw.tables === 'object' && !Array.isArray(raw.tables) ? raw.tables : raw;
  if (Array.isArray(tables)) tables = Object.fromEntries(tables.map((t) => [t.table || t.name, t.rows || t.data]));

  const nonEmpty = TABLES.filter((t) => tables[t]?.length && table(t).length);
  if (nonEmpty.length && !force) {
    console.error(`These local tables already have rows: ${nonEmpty.join(', ')}. Re-run with --force to replace them (a copy is kept).`);
    process.exit(2);
  }
  const dbDir = path.join(DATA_DIR, 'db');
  if (fs.existsSync(dbDir) && fs.readdirSync(dbDir).length) {
    const keep = path.join(DATA_DIR, `db-before-import-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    fs.cpSync(dbDir, keep, { recursive: true });
    console.log(`  kept a copy of the current tables in ${keep}`);
  }
  for (const [name, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) continue;
    if (name === 'storage_objects') continue; // list of Supabase files, not a table (files are not in the zip)
    if (!TABLES.includes(name)) {
      console.warn(`  ? unknown table "${name}" (${rows.length} rows) saved as-is`);
    }
    replaceTable(name, rows);
    console.log(`  ${name.padEnd(16)} ${rows.length} rows`);
  }
  flush();
}

// ----------------------------------------------------------------- files
let media = 0;
let desk = 0;
for (const f of files) {
  const r = rel(f);
  const m = r.match(/^askar\/(?:media|storage|files)\/(.+)$/);
  if (m) {
    const out = path.join(MEDIA_DIR, m[1]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await src_.read(f));
    media++;
    continue;
  }
  if (r.startsWith('desk/') || r === 'names.json' || r === 'README.txt') {
    const out = path.join(DATA_DIR, 'desk-backup', r);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await src_.read(f));
    desk++;
  }
}
console.log(`  Askar media files: ${media}${media ? '' : ' (the backup has no Askar image files; saved items show their original web links instead)'}`);
console.log(`  Desk files kept for the Desk merge: ${desk}  -> ${path.join(DATA_DIR, 'desk-backup')}`);
console.log('Done.');
