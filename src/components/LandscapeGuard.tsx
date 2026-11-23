import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, RotateCw, Smartphone } from 'lucide-react';
import {
  attachAndroidFullscreenLifecycle,
  isMobileTouchDevice,
  requestAndroidFullscreen,
} from '../game/fullscreen';

interface LandscapeGuardProps {
  onPortraitBlockChange?: (blocked: boolean) => void;
}

function getViewportDimensions(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  const vv = window.visualViewport;
  const width = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1280);
  const height = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 720);
  return { width, height };
}

export const LandscapeGuard: React.FC<LandscapeGuardProps> = ({ onPortraitBlockChange }) => {
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileTouchDevice());
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    const { width, height } = getViewportDimensions();
    return height > width;
  });

  const evaluateOrientation = useCallback(() => {
    const mobile = isMobileTouchDevice();
    const { width, height } = getViewportDimensions();
    setIsMobile(mobile);
    setIsPortrait(height > width);
  }, []);

  // Enforce true Android fullscreen + native landscape lock across startup, focus, and user touches
  useEffect(() => {
    evaluateOrientation();
    const detachFullscreenLifecycle = attachAndroidFullscreenLifecycle();

    if (isMobileTouchDevice()) {
      void requestAndroidFullscreen(false);
    }

    let settleTimer: number | null = null;
    const handleViewportChange = () => {
      evaluateOrientation();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        evaluateOrientation();
        if (isMobileTouchDevice()) {
          void requestAndroidFullscreen(false);
        }
      }, 140);
    };

    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('orientationchange', handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
    window.screen?.orientation?.addEventListener?.('change', handleViewportChange);

    return () => {
      detachFullscreenLifecycle();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.screen?.orientation?.removeEventListener?.('change', handleViewportChange);
    };
  }, [evaluateOrientation]);

  const portraitBlocked = isMobile && isPortrait;

  useEffect(() => {
    onPortraitBlockChange?.(portraitBlocked);
  }, [portraitBlocked, onPortraitBlockChange]);

  const handleLockFullscreenLandscape = async () => {
    await requestAndroidFullscreen(true);
    evaluateOrientation();
  };

  if (!portraitBlocked) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#070c0e] text-[#e6f3f5]"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.5rem, env(safe-area-inset-right))',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Landscape orientation required"
    >
      <div className="w-full max-w-xs rounded-xl bg-[#0e1518] border border-[#31474d] p-5 flex flex-col items-center text-center gap-3.5 shadow-2xl">
        <div className="text-[10px] font-mono tracking-[0.22em] text-[#52e0b6] uppercase">
          SERPENTIS · LANDSCAPE ONLY
        </div>

        <div className="relative w-16 h-16 rounded-xl bg-[#091013] border border-[#253a40] flex items-center justify-center">
          <Smartphone className="w-8 h-8 text-[#52e0b6] animate-phone-rotate" />
          <RotateCw className="w-3.5 h-3.5 text-[#88c8ba] absolute bottom-1.5 right-1.5" />
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-base font-extrabold tracking-wider uppercase text-[#eaf6f8]">
            Rotate Your Device
          </h2>
          <p className="text-xs text-[#93adb3] leading-relaxed">
            Turn your phone sideways to horizontal landscape mode to play. Portrait orientation is disabled.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleLockFullscreenLandscape()}
          className="w-full py-2.5 px-4 rounded-lg bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Lock Landscape Mode
        </button>
      </div>
    </div>
  );
};
