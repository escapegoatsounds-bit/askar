import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore plain JS module (also used by the standalone launcher later)
import { handle as handleLocal } from './local/store.mjs';
// @ts-ignore plain JS module
import { createDeskHandler } from './local/desk.mjs';
// @ts-ignore plain JS module (voice engine on this PC: /voice/* -> E:\EscapegoatStudio\tools\voice_server.py)
import { voiceMiddleware } from './local/voice.mjs';

/** Local-first storage: /local/* answers database + file requests from disk; /desk/ is the Production Desk. */
function localStore(): Plugin {
  return {
    name: 'local-store',
    configureServer(server: ViteDevServer) {
      const handleDesk = createDeskHandler({ root: server.config.root });
      server.middlewares.use(voiceMiddleware({ root: server.config.root }));
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        if (await handleDesk(req, res)) return;
        if (!req.url.startsWith('/local/')) return next();
        await handleLocal(req, res);
      });
    },
  };
}

/**
 * In production, files in /api run as Vercel serverless functions.
 * During `npm run dev` this plugin runs those same files inside Vite,
 * so you don't need the Vercel CLI to develop locally.
 */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://localhost');
        const name = url.pathname.replace(/^\/api\//, '').replace(/[^a-z0-9-]/gi, '');
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            return res.end('Method not allowed');
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(url, {
            method: req.method,
            headers,
            body: chunks.length && req.method !== 'GET' ? Buffer.concat(chunks) : undefined,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v;
  process.env.LOR_LOCAL = '1';
  // host 'localhost' keeps the archive private to this PC (not reachable from the network).
  return { plugins: [react(), localStore(), devApi()], server: { host: 'localhost', port: 5173, strictPort: true } };
});
