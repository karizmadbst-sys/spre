#!/usr/bin/env node
/**
 * Resolves the deployed Cloudflare Worker URL (HTTP + WebSocket) for frontend builds
 * across Web (Cloudflare Pages), Android (Capacitor APK), and Windows (Tauri EXE).
 *
 * Resolution order:
 *   1. Explicit `VITE_API_BASE_URL` or `VITE_CLOUDFLARE_WORKER_URL`
 *   2. `DEPLOYED_WORKER_URL` (captured during `wrangler deploy`)
 *   3. Cloudflare API lookup of the account's `workers.dev` subdomain using
 *      `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` combined with the Worker
 *      name in `cloudflare/wrangler.toml`.
 *
 * Pass `--github-env` to append `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` directly
 * to `$GITHUB_ENV` (works identically on Linux, macOS, and Windows runners).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function normalizeHttpBase(raw) {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://')
      .replace(/\/ws$/i, '');
  }
  return `https://${trimmed}`;
}

function normalizeWsBase(raw, fallbackHttpBase) {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  const source = trimmed || fallbackHttpBase;
  if (!source) return '';

  const withScheme = /^wss?:\/\//i.test(source)
    ? source
    : /^https:\/\//i.test(source)
      ? source.replace(/^https:\/\//i, 'wss://')
      : /^http:\/\//i.test(source)
        ? source.replace(/^http:\/\//i, 'ws://')
        : `wss://${source}`;

  try {
    const parsed = new URL(withScheme);
    if (parsed.pathname === '' || parsed.pathname === '/') {
      parsed.pathname = '/ws';
    }
    return parsed.toString();
  } catch {
    return withScheme.endsWith('/ws') ? withScheme : `${withScheme}/ws`;
  }
}

function readWorkerName() {
  const wranglerTomlPath = path.join(repoRoot, 'cloudflare', 'wrangler.toml');
  try {
    const content = fs.readFileSync(wranglerTomlPath, 'utf8');
    const match = content.match(/^\s*name\s*=\s*"([^"]+)"/m);
    if (match && match[1]) return match[1].trim();
  } catch {
    // Fall back to default worker name
  }
  return 'deep-tile-multiplayer';
}

async function fetchWorkersSubdomain(accountId, apiToken) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/subdomain`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Cloudflare API responded with HTTP ${res.status}`);
  }
  const data = await res.json();
  const subdomain = data?.result?.subdomain;
  if (typeof subdomain === 'string' && subdomain.trim()) {
    return subdomain.trim();
  }
  throw new Error('Cloudflare account workers.dev subdomain was not returned');
}

async function checkWorkerHealth(apiBase) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${apiBase}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      console.log(`Cloudflare Worker health check passed: ${apiBase}/api/health`);
    } else {
      console.warn(`Cloudflare Worker health check returned HTTP ${res.status}: ${apiBase}/api/health`);
    }
  } catch (err) {
    console.warn(
      `Could not verify Worker health at ${apiBase}/api/health (${err instanceof Error ? err.message : String(err)})`
    );
  }
}

async function main() {
  const writeGithubEnv = process.argv.includes('--github-env');
  let apiBase = normalizeHttpBase(
    process.env.VITE_API_BASE_URL ||
      process.env.VITE_CLOUDFLARE_WORKER_URL ||
      process.env.DEPLOYED_WORKER_URL
  );

  if (!apiBase) {
    const token = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
    const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    if (token && accountId) {
      const workerName = readWorkerName();
      try {
        const subdomain = await fetchWorkersSubdomain(accountId, token);
        apiBase = `https://${workerName}.${subdomain}.workers.dev`;
        console.log(`Auto-resolved Cloudflare Worker URL from account subdomain: ${apiBase}`);
      } catch (err) {
        console.warn(
          `Unable to auto-resolve Cloudflare Worker subdomain (${err instanceof Error ? err.message : String(err)}).`
        );
      }
    }
  }

  const wsBase = normalizeWsBase(process.env.VITE_WS_BASE_URL, apiBase);

  if (apiBase) {
    console.log(`Multiplayer HTTP API -> ${apiBase}`);
    console.log(`Multiplayer WebSocket -> ${wsBase}`);
    await checkWorkerHealth(apiBase);
  } else {
    console.log('No remote Cloudflare Worker URL configured; build will use same-origin endpoints.');
  }

  if (writeGithubEnv && process.env.GITHUB_ENV) {
    const lines = [];
    if (apiBase) lines.push(`VITE_API_BASE_URL=${apiBase}`);
    if (wsBase) lines.push(`VITE_WS_BASE_URL=${wsBase}`);
    if (lines.length > 0) {
      fs.appendFileSync(process.env.GITHUB_ENV, `${lines.join('\n')}\n`, 'utf8');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
