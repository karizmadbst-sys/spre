export const CORE_AUDIO_PRELOAD_URLS = [
  '/assets/aistudio/1795113025845_20261119_183259_dda4ed84.mp3',
  '/assets/aistudio/1795113054247_20261119_183222_15cf3533.mp3',
  '/assets/aistudio/1795115267470_20261119_190943_59ac0ac1.mp3',
  '/assets/aistudio/1795115324815_20261119_190920_0f666a65.mp3',
] as const;

// Keep pinned ArrayBuffer fetch promises so SFX/scream audio files stay cached across gameplay
const PINNED_AUDIO_BUFFERS = new Map<string, Promise<ArrayBuffer | null>>();

export function preloadAudioAsset(url: string): Promise<ArrayBuffer | null> {
  if (!url || typeof fetch !== 'function') {
    return Promise.resolve(null);
  }
  const existing = PINNED_AUDIO_BUFFERS.get(url);
  if (existing) {
    return existing;
  }
  const promise = fetch(url)
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .catch(() => null);
  PINNED_AUDIO_BUFFERS.set(url, promise);
  return promise;
}

export function getPreloadedAudioAsset(url: string): Promise<ArrayBuffer | null> | undefined {
  return PINNED_AUDIO_BUFFERS.get(url);
}
