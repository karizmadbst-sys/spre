export interface SerpentisAndroidBridge {
  enterFullscreen?: () => void;
}

declare global {
  interface Window {
    SerpentisAndroidFullscreen?: SerpentisAndroidBridge;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isMobileTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const coarsePointer =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(any-pointer: coarse)').matches);
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  const shortSide = Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight
  );
  return mobileUa || (coarsePointer && hasTouch) || (hasTouch && shortSide <= 1024);
}

export function isCapacitorNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.SerpentisAndroidFullscreen?.enterFullscreen === 'function') {
    return true;
  }
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    const plat = typeof cap.getPlatform === 'function' ? cap.getPlatform() : '';
    return !plat || plat === 'android';
  }
  return false;
}

export function getActiveFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function enterNativeAndroidImmersive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof window.SerpentisAndroidFullscreen?.enterFullscreen === 'function') {
      window.SerpentisAndroidFullscreen.enterFullscreen();
      return true;
    }
  } catch {
    // ignore native bridge invocation errors
  }
  return false;
}

async function lockLandscapeOrientation(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
      | undefined;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
      return true;
    }
  } catch {
    // Browser or OS blocked orientation.lock()
  }
  return false;
}

/**
 * Enters true edge-to-edge immersive fullscreen on Android devices, hiding the
 * status bar, navigation bar, and gesture bars without modifying game UI elements.
 */
export async function requestAndroidFullscreen(force = false): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const nativeEntered = enterNativeAndroidImmersive();
  if (nativeEntered || isCapacitorNativeAndroid()) {
    void lockLandscapeOrientation();
    return nativeEntered;
  }

  const shouldAttemptBrowserFullscreen = force || isAndroidDevice() || isMobileTouchDevice();
  if (!shouldAttemptBrowserFullscreen) {
    return false;
  }

  let entered = Boolean(getActiveFullscreenElement());
  if (!entered) {
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (typeof rootEl.requestFullscreen === 'function') {
      try {
        await rootEl.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        entered = true;
      } catch {
        try {
          await rootEl.requestFullscreen();
          entered = true;
        } catch {
          // User activation missing or fullscreen unsupported
        }
      }
    }
    if (!entered && typeof rootEl.webkitRequestFullscreen === 'function') {
      try {
        await Promise.resolve(rootEl.webkitRequestFullscreen());
        entered = Boolean(getActiveFullscreenElement());
      } catch {
        // ignore WebKit fullscreen rejection
      }
    }
  }

  await lockLandscapeOrientation();
  return entered || Boolean(getActiveFullscreenElement());
}

/**
 * Attaches Android/mobile lifecycle & trusted user-activation listeners so true
 * fullscreen stays engaged across touch interactions, level transitions, and
 * app resume without hiding or altering any game UI buttons.
 */
export function attachAndroidFullscreenLifecycle(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const syncNative = () => {
    if (isCapacitorNativeAndroid()) {
      enterNativeAndroidImmersive();
    }
  };

  syncNative();

  const onUserGesture = (ev: Event) => {
    const target = ev.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }
    if (!isAndroidDevice() && !isMobileTouchDevice() && !isCapacitorNativeAndroid()) {
      return;
    }
    if (isCapacitorNativeAndroid()) {
      enterNativeAndroidImmersive();
      return;
    }
    if (!getActiveFullscreenElement()) {
      void requestAndroidFullscreen(false);
    }
  };

  const onVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible') {
      syncNative();
    }
  };

  window.addEventListener('touchend', onUserGesture, { capture: true, passive: true });
  window.addEventListener('click', onUserGesture, { capture: true, passive: true });
  window.addEventListener('focus', syncNative, { passive: true });
  window.addEventListener('resize', syncNative, { passive: true });
  window.addEventListener('orientationchange', syncNative, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityOrFocus, { passive: true });

  return () => {
    window.removeEventListener('touchend', onUserGesture, true);
    window.removeEventListener('click', onUserGesture, true);
    window.removeEventListener('focus', syncNative);
    window.removeEventListener('resize', syncNative);
    window.removeEventListener('orientationchange', syncNative);
    document.removeEventListener('visibilitychange', onVisibilityOrFocus);
  };
}
