// Askar service worker.
// Main job: receive images/links shared from other Android apps (Web Share Target)
// and hand them to the app via a temporary cache "inbox".
const INBOX = 'askar-share-inbox';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShare(event.request));
  }
});

async function handleShare(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(INBOX);
    // Clear any previous, unprocessed share.
    for (const key of await cache.keys()) await cache.delete(key);

    const files = form.getAll('media').filter((f) => f && typeof f !== 'string');
    const meta = {
      title: form.get('title') || '',
      text: form.get('text') || '',
      url: form.get('url') || '',
      files: [],
      at: Date.now(),
    };
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const key = `/share-inbox/file-${i}`;
      await cache.put(key, new Response(f, { headers: { 'Content-Type': f.type, 'X-Filename': encodeURIComponent(f.name || `shared-${i}`) } }));
      meta.files.push({ key, name: f.name || `shared-${i}`, type: f.type });
    }
    await cache.put('/share-inbox/meta.json', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
  } catch (e) {
    // fall through to the app; it will show "nothing received"
  }
  return Response.redirect('/share?incoming=1', 303);
}
