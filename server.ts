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

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    const stats = coopManager.getStats();
    res.json({ ok: true, coop: true, runtime: 'node-express-ws', ...stats });
  });

  app.get('/api/coop/session/:code', (req, res) => {
    const snapshot = coopManager.getSessionSnapshotByCode(req.params.code || '');
    if (!snapshot) {
      res.status(404).json({ ok: true, exists: false });
      return;
    }
    res.json({
      ok: true,
      exists: true,
      sessionId: snapshot.sessionId,
      sessionCode: snapshot.sessionCode,
      playerCount: snapshot.players.length,
      maxPlayers: snapshot.maxPlayers,
    });
  });

  const shouldAttachVite = options.attachVite ?? process.env.NODE_ENV !== 'production';

  let viteServer: { close: () => Promise<void> } | null = null;
  if (shouldAttachVite) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: !hmrDisabled,
        ws: hmrDisabled ? false : { server },
      },
      appType: 'spa',
    });
    viteServer = vite;
    if (hmrDisabled) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const transformed = await vite.transformRequest('/@vite/client');
          if (!transformed?.code) {
            next();
            return;
          }
          const patchedCode = transformed.code
            .replace(
              /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
              '/* HMR WebSocket connection disabled via DISABLE_HMR */'
            )
            .replace(
              /ws\.send\(JSON\.stringify\(data\)\)/g,
              'if (ws && ws.readyState === 1) ws.send(JSON.stringify(data))'
            );
          res.status(200).type('application/javascript').send(patchedCode);
        } catch (err) {
          next(err);
        }
      });
    }
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
