import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoopServerManager, type CoopServerOptions } from './src/coop/coopServer.ts';

export interface ServerOptions {
  attachVite?: boolean;
  coop?: CoopServerOptions;
}

export async function createAppServer(options: ServerOptions = {}) {
  const app = express();
  const server = http.createServer(app);
  const coopManager = new CoopServerManager(options.coop);
  coopManager.attachToHttpServer(server, '/ws/coop');

  app.get('/api/health', (_req, res) => {
    const stats = coopManager.getStats();
    res.json({ ok: true, coop: true, ...stats });
  });

  const shouldAttachVite = options.attachVite ?? process.env.NODE_ENV !== 'production';

  let viteServer: { close: () => Promise<void> } | null = null;
  if (shouldAttachVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server },
      },
      appType: 'spa',
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return {
    app,
    server,
    coopManager,
    close: async () => {
      await coopManager.close();
      if (viteServer) {
        await viteServer.close();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryFile === path.resolve(currentFile)) {
  const port = Number(process.env.PORT || 3000);
  createAppServer()
    .then(({ server }) => {
      server.listen(port, '0.0.0.0', () => {
        console.log(`SERPENTIS server listening on http://0.0.0.0:${port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start SERPENTIS server:', err);
      process.exit(1);
    });
}
