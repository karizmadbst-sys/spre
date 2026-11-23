import {
  CORE_AUDIO_PRELOAD_URLS,
  getPreloadedAudioAsset,
  preloadAudioAsset,
} from './audioPreload';
import { loadCharacterPreviews } from './characterPreview';

export const MAIN_MENU_BG_URL = '/assets/aistudio/Blood_Moon_Sea_Serpent_c74c70fc.png';
export let SERPENTIS_ICON_URL = '/pwa-192x192.png';
export { CORE_AUDIO_PRELOAD_URLS, getPreloadedAudioAsset, preloadAudioAsset };

export function registerSerpentisIconUrl(url: string): void {
  if (url) {
    SERPENTIS_ICON_URL = url;
  }
}

// Keep strong references to decoded Image objects so the browser never evicts
// menu background, icon, or character portrait bitmaps during WebGL transitions.
const PINNED_IMAGES = new Map<string, HTMLImageElement>();

let corePreloadPromise: Promise<void> | null = null;
let corePreloadComplete = false;

/**
 * Wait for N animation frames (with a timer fallback if the tab is hidden)
 * so the browser compositor is guaranteed to have painted both loading screens
 * and newly mounted UI / WebGL frames before revealing a transition.
 */
export function waitAnimationFrames(count = 2): Promise<void> {
  if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }
  const frames = Math.max(1, Math.floor(count));
  return new Promise<void>((resolve) => {
    let remaining = frames;
    let settled = false;
    let fallbackTimer = 0;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = 0;
      }
      resolve();
    };

    // Safety fallback if the browser tab is backgrounded (rAF paused)
    fallbackTimer = window.setTimeout(finish, Math.max(120, frames * 85));

    const step = () => {
      if (settled) return;
      remaining--;
      if (remaining <= 0) {
        finish();
      } else {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  });
}

/**
 * Load, decode, and pin an image bitmap in memory with a non-blocking timeout guard.
 */
export function preloadImageDecoded(
  src: string,
  timeoutMs = 4500
): Promise<HTMLImageElement | null> {
  if (!src || typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  const existing = PINNED_IMAGES.get(src);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }

  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = existing ?? new Image();
    img.decoding = 'sync';
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (ok && img.naturalWidth > 0) {
        PINNED_IMAGES.set(src, img);
        resolve(img);
      } else {
        resolve(null);
      }
    };

    const timer = window.setTimeout(() => finish(img.complete && img.naturalWidth > 0), timeoutMs);

    const handleLoaded = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(
          () => finish(true),
          () => finish(img.naturalWidth > 0)
        );
      } else {
        finish(true);
      }
    };

    img.onload = handleLoaded;
    img.onerror = () => finish(false);

    if (!existing) {
      img.src = src;
    }

    if (img.complete && img.naturalWidth > 0) {
      handleLoaded();
    }
  });
}

export function isCoreAssetsReady(): boolean {
  return corePreloadComplete;
}

/**
 * Preload and decode all core interface assets (emblem icon, background artwork,
 * full-body 3D character slot portraits, and scream/devour audio buffers) so neither
 * startup nor transitions/encounters ever hitch on uncached network/decode fetches.
 */
export function preloadCoreAssets(
  onProgress?: (pct: number, label: string) => void
): Promise<void> {
  if (corePreloadComplete) {
    onProgress?.(100, 'READY');
    return Promise.resolve();
  }

  if (!corePreloadPromise) {
    corePreloadPromise = (async () => {
      onProgress?.(18, 'LOADING INTERFACE ASSETS...');

      const iconTask = preloadImageDecoded(SERPENTIS_ICON_URL, 3000);
      const fallbackIconTask = preloadImageDecoded('/pwa-192x192.png', 3000);
      const bgTask = preloadImageDecoded(MAIN_MENU_BG_URL, 5000);
      const audioTask = Promise.all(CORE_AUDIO_PRELOAD_URLS.map((u) => preloadAudioAsset(u)));

      await Promise.all([iconTask, fallbackIconTask]);
      onProgress?.(42, 'LOADING ENVIRONMENT BACKDROP...');

      // Render & decode both male & female full-body character slots immediately
      const portraitTask = loadCharacterPreviews(true).then(async (previews) => {
        const decodeList: Promise<HTMLImageElement | null>[] = [];
        if (previews.male) decodeList.push(preloadImageDecoded(previews.male, 2500));
        if (previews.female) decodeList.push(preloadImageDecoded(previews.female, 2500));
        await Promise.all(decodeList);
      });

      await bgTask;
      onProgress?.(72, 'PREPARING CHARACTER & AUDIO ASSETS...');

      await Promise.all([portraitTask, audioTask]);
      onProgress?.(94, 'FINALIZING SCENE...');

      corePreloadComplete = true;
      onProgress?.(100, 'READY');
    })().catch(() => {
      corePreloadComplete = true;
      onProgress?.(100, 'READY');
    });
  }

  return corePreloadPromise;
}
