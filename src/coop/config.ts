export const DEFAULT_PRODUCTION_COOP_WS_URL =
  'wss://ais-dev-jfab6bpsg7wtx4lde3o7tp-1013031700248.europe-west2.run.app/ws/coop';

export function normalizeCoopWsUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  const withScheme = /^wss?:\/\//i.test(trimmed)
    ? trimmed
    : /^https:\/\//i.test(trimmed)
      ? trimmed.replace(/^https:\/\//i, 'wss://')
      : /^http:\/\//i.test(trimmed)
        ? trimmed.replace(/^http:\/\//i, 'ws://')
        : `wss://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath || cleanPath === '/') {
      parsed.pathname = '/ws/coop';
    } else if (cleanPath === '/ws') {
      parsed.pathname = '/ws/coop';
    } else if (!cleanPath.endsWith('/ws/coop')) {
      parsed.pathname = `${cleanPath}/ws/coop`;
    }
    return parsed.toString();
  } catch {
    if (withScheme.endsWith('/ws/coop')) return withScheme;
    if (withScheme.endsWith('/ws')) return `${withScheme}/coop`;
    return `${withScheme}/ws/coop`;
  }
}

export function isLocalhostHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h === 'tauri.localhost' ||
    h.endsWith('.localhost')
  );
}

export function isPackagedNativeHost(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = (window.location.hostname || '').toLowerCase();
  const proto = (window.location.protocol || '').toLowerCase();
  if (proto === 'capacitor:' || proto === 'tauri:' || proto === 'file:') return true;
  if (host === 'tauri.localhost') return true;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return true;
  }
  return false;
}

/**
 * Resolves the single authoritative multiplayer WebSocket endpoint across
 * Web, Capacitor Android APK, and Tauri Windows EXE builds without ever
 * falling back to localhost in production.
 */
export function resolveCoopWsUrl(): string {
  const metaEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string | boolean | undefined> }).env
      : undefined;

  const isProd = metaEnv?.PROD === true;

  const envWs = typeof metaEnv?.VITE_WS_BASE_URL === 'string' ? metaEnv.VITE_WS_BASE_URL : '';
  if (envWs.trim()) {
    const normalized = normalizeCoopWsUrl(envWs);
    try {
      const host = new URL(normalized).hostname;
      if (!isProd || !isLocalhostHostname(host)) {
        return normalized;
      }
    } catch {
      return normalized;
    }
  }

  const envApi = typeof metaEnv?.VITE_API_BASE_URL === 'string' ? metaEnv.VITE_API_BASE_URL : '';
  if (envApi.trim()) {
    const normalized = normalizeCoopWsUrl(envApi);
    try {
      const host = new URL(normalized).hostname;
      if (!isProd || !isLocalhostHostname(host)) {
        return normalized;
      }
    } catch {
      return normalized;
    }
  }

  if (typeof window !== 'undefined' && window.location && !isPackagedNativeHost()) {
    const proto = window.location.protocol;
    const hostname = window.location.hostname || '';
    if ((proto === 'http:' || proto === 'https:') && window.location.host) {
      if (metaEnv?.DEV === true && isLocalhostHostname(hostname)) {
        const wsProto = proto === 'https:' ? 'wss:' : 'ws:';
        return `${wsProto}//${window.location.host}/ws/coop`;
      }
      if (!isLocalhostHostname(hostname) && !hostname.endsWith('.pages.dev')) {
        const wsProto = proto === 'https:' ? 'wss:' : 'ws:';
        return `${wsProto}//${window.location.host}/ws/coop`;
      }
    }
  }

  return DEFAULT_PRODUCTION_COOP_WS_URL;
}
